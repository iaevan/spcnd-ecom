import type { SpcndDb } from '@spacendigital/db';
import { and, eq, inArray, lt } from 'drizzle-orm';
import type { Order } from '../entities.js';
import type { ScheduledJob } from '../jobs/scheduled.js';
import type { SettingsService } from '../settings/service.js';
import { nowIso } from '../utils.js';

/**
 * GDPR data export / erasure / anonymization (docs/AGENTS.md §8.7) plus the
 * retention jobs, exposed as ScheduledJob entries per EDGE_V2_HARDENING gap 6.
 */

export interface CustomerDataExport {
  customer: Record<string, unknown> | null;
  addresses: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  downloads: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
}

/** Everything stored about an email address, WC exporter groups mirrored. */
export async function exportCustomerData(db: SpcndDb, email: string): Promise<CustomerDataExport> {
  const s = db.schema;
  const lowered = email.toLowerCase();
  const customers = await db.drizzle.select().from(s.customers).where(eq(s.customers.email, lowered));
  const customer = customers[0] ?? null;
  const addresses = customer
    ? await db.drizzle
        .select()
        .from(s.customerAddresses)
        .where(eq(s.customerAddresses.customerId, customer.id))
    : [];
  const orders = await db.drizzle.select().from(s.orders).where(eq(s.orders.billingEmail, lowered));
  const downloads = await db.drizzle
    .select()
    .from(s.downloadPermissions)
    .where(eq(s.downloadPermissions.userEmail, lowered));
  const reviews = await db.drizzle.select().from(s.reviews).where(eq(s.reviews.authorEmail, lowered));
  const strip = (row: Record<string, unknown>) => {
    const { passwordHash: _passwordHash, ...rest } = row as Record<string, unknown> & {
      passwordHash?: unknown;
    };
    return rest;
  };
  return {
    customer: customer ? strip(customer) : null,
    addresses,
    orders,
    downloads,
    reviews,
  };
}

const ANON_STRING = '[deleted]';

/** WC's order anonymization: PII blanked, financial/reporting data kept. */
export async function anonymizeOrder(db: SpcndDb, orderId: number): Promise<void> {
  const s = db.schema;
  await db.drizzle
    .update(s.orders)
    .set({
      billingFirstName: ANON_STRING,
      billingLastName: ANON_STRING,
      billingCompany: '',
      billingAddress1: ANON_STRING,
      billingAddress2: '',
      billingCity: ANON_STRING,
      billingPostcode: '00000',
      billingEmail: `deleted@site.invalid`,
      billingPhone: '',
      shippingFirstName: ANON_STRING,
      shippingLastName: ANON_STRING,
      shippingCompany: '',
      shippingAddress1: ANON_STRING,
      shippingAddress2: '',
      shippingCity: ANON_STRING,
      shippingPostcode: '00000',
      shippingPhone: '',
      customerIpAddress: null,
      customerUserAgent: null,
      customerNote: null,
      customerId: null,
      dateModified: nowIso(),
    })
    .where(eq(s.orders.id, orderId));
}

export interface EraseResult {
  customerErased: boolean;
  ordersAnonymized: number;
  downloadsRemoved: number;
  reviewsAnonymized: number;
}

/** Erase a customer per the store's erasure settings (§24.2 semantics). */
export async function eraseCustomerData(
  db: SpcndDb,
  settings: SettingsService,
  email: string,
): Promise<EraseResult> {
  const s = db.schema;
  const lowered = email.toLowerCase();
  const result: EraseResult = {
    customerErased: false,
    ordersAnonymized: 0,
    downloadsRemoved: 0,
    reviewsAnonymized: 0,
  };

  if (await settings.getBool('erasure_request_removes_order_data')) {
    const orders = await db.drizzle
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(eq(s.orders.billingEmail, lowered));
    for (const order of orders) {
      await anonymizeOrder(db, order.id);
      result.ordersAnonymized++;
    }
  }
  if (await settings.getBool('erasure_request_removes_download_data')) {
    const rows = await db.drizzle
      .select({ id: s.downloadPermissions.id })
      .from(s.downloadPermissions)
      .where(eq(s.downloadPermissions.userEmail, lowered));
    if (rows.length > 0) {
      await db.drizzle
        .delete(s.downloadPermissions)
        .where(eq(s.downloadPermissions.userEmail, lowered));
      result.downloadsRemoved = rows.length;
    }
  }

  const reviewRows = await db.drizzle
    .select({ id: s.reviews.id })
    .from(s.reviews)
    .where(eq(s.reviews.authorEmail, lowered));
  if (reviewRows.length > 0) {
    await db.drizzle
      .update(s.reviews)
      .set({ authorName: ANON_STRING, authorEmail: 'deleted@site.invalid', customerId: null })
      .where(inArray(s.reviews.id, reviewRows.map((r) => r.id)));
    result.reviewsAnonymized = reviewRows.length;
  }

  const customers = await db.drizzle.select().from(s.customers).where(eq(s.customers.email, lowered));
  if (customers[0]) {
    await db.drizzle.delete(s.customers).where(eq(s.customers.id, customers[0].id));
    result.customerErased = true;
  }
  return result;
}

/** WC relative-date retention option `{ number, unit }` → cutoff ISO string. */
function retentionCutoff(option: { number: string | number; unit: string }): string | null {
  const n = Number(option.number);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = { days: 86_400_000, weeks: 604_800_000, months: 2_592_000_000, years: 31_536_000_000 }[
    option.unit
  ];
  if (!ms) return null;
  return new Date(Date.now() - n * ms).toISOString();
}

/** The §17.1 retention jobs; register with the app's ScheduledJobs. */
export function retentionJobs(db: SpcndDb, settings: SettingsService): ScheduledJob[] {
  const trashOrdersWhere = async (
    status: Order['status'],
    settingKey: string,
  ): Promise<number> => {
    const option = await settings.getJson<{ number: string; unit: string }>(settingKey);
    const cutoff = option ? retentionCutoff(option) : null;
    if (!cutoff) return 0;
    const s = db.schema;
    const rows = await db.drizzle
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(and(eq(s.orders.status, status), lt(s.orders.dateModified, cutoff)));
    for (const row of rows) {
      await db.drizzle.update(s.orders).set({ status: 'trash' }).where(eq(s.orders.id, row.id));
    }
    return rows.length;
  };

  return [
    {
      name: 'gdpr.trash-pending-orders',
      schedule: '0 3 * * *',
      run: async () => {
        await trashOrdersWhere('pending', 'trash_pending_orders');
      },
    },
    {
      name: 'gdpr.trash-failed-orders',
      schedule: '10 3 * * *',
      run: async () => {
        await trashOrdersWhere('failed', 'trash_failed_orders');
      },
    },
    {
      name: 'gdpr.trash-cancelled-orders',
      schedule: '20 3 * * *',
      run: async () => {
        await trashOrdersWhere('cancelled', 'trash_cancelled_orders');
      },
    },
    {
      name: 'gdpr.anonymize-completed-orders',
      schedule: '30 3 * * *',
      run: async () => {
        const option = await settings.getJson<{ number: string; unit: string }>(
          'anonymize_completed_orders',
        );
        const cutoff = option ? retentionCutoff(option) : null;
        if (!cutoff) return;
        const s = db.schema;
        const rows = await db.drizzle
          .select({ id: s.orders.id })
          .from(s.orders)
          .where(and(eq(s.orders.status, 'completed'), lt(s.orders.dateModified, cutoff)));
        for (const row of rows) await anonymizeOrder(db, row.id);
      },
    },
  ];
}
