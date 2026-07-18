import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import { and, asc, eq } from 'drizzle-orm';
import type { ProductService } from '../catalog/product-service.js';
import type { DownloadPermission, Order } from '../entities.js';
import { NotFoundError, SpcndError } from '../errors.js';
import { filterFileDownloadPath, filterOrderIsDownloadPermitted } from '../events.js';
import type { OrderService } from '../orders/order-service.js';
import type { MediaAdapter } from '../services/interfaces.js';
import type { SettingsService } from '../settings/service.js';
import { nowIso } from '../utils.js';

/** How the HTTP layer should deliver the file (EDGE_V2_HARDENING gap 4). */
export type DownloadDelivery =
  | { kind: 'stream'; stream: ReadableStream<Uint8Array>; fileName: string }
  | { kind: 'redirect'; url: string };

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
  settings: SettingsService;
  orders: OrderService;
  products: ProductService;
  media?: MediaAdapter;
}

/**
 * Download permissions: granted once per order (order_events guard) when the
 * order becomes paid — on payment_complete, or on processing/completed per
 * the grant-after-payment setting — plus counted, expiring delivery.
 * Delivery routes exclusively through MediaAdapter.stream()/getSignedUrl();
 * no fs access here (EDGE_V2_HARDENING gaps 3–4).
 */
export class DownloadService {
  constructor(private readonly deps: Deps) {}

  /** Grant permissions for every downloadable line on a (paid) order. */
  async grantPermissions(orderId: number): Promise<number> {
    const { db, bus, orders, products } = this.deps;
    const order = await orders.get(orderId);
    const permitted = await bus.applyFilters(
      filterOrderIsDownloadPermitted,
      ['processing', 'completed'].includes(order.status),
      order,
    );
    if (!permitted) return 0;
    if (!(await orders.recordEvent(orderId, 'download_permissions_granted'))) return 0;

    const items = await orders.getItems(orderId, ['line_item']);
    let granted = 0;
    await db.transaction(async (tx) => {
      const s = tx.schema;
      for (const item of items) {
        if (!item.productId) continue;
        const product = await products.find(item.productId);
        if (!product) continue;
        const variation = item.variationId
          ? await products.getVariation(item.variationId).catch(() => null)
          : null;
        const downloadable = variation?.downloadable ?? product.downloadable;
        if (!downloadable) continue;

        const downloads = await tx.drizzle
          .select()
          .from(s.productDownloads)
          .where(
            variation
              ? and(
                  eq(s.productDownloads.productId, product.id),
                  eq(s.productDownloads.variationId, variation.id),
                )
              : eq(s.productDownloads.productId, product.id),
          )
          .orderBy(asc(s.productDownloads.sortOrder));

        const downloadLimit = variation?.downloadLimit ?? product.downloadLimit;
        const downloadExpiry = variation?.downloadExpiry ?? product.downloadExpiry;
        for (const download of downloads) {
          const quantity = item.quantity ?? 1;
          await tx.drizzle.insert(s.downloadPermissions).values({
            downloadId: download.downloadId,
            productId: product.id,
            orderId: order.id,
            orderKey: order.orderKey,
            userId: order.customerId,
            userEmail: order.billingEmail,
            // downloads_remaining: limit × qty; null = unlimited (-1).
            downloadsRemaining: downloadLimit >= 0 ? downloadLimit * quantity : null,
            accessGranted: nowIso(),
            accessExpires:
              downloadExpiry >= 0
                ? new Date(Date.now() + downloadExpiry * 86_400_000).toISOString()
                : null,
            downloadCount: 0,
          });
          granted++;
        }
      }
    });
    return granted;
  }

  /** Hooked in app.ts: grant on payment_complete / processing per settings. */
  async maybeGrantOnStatus(order: Order): Promise<void> {
    const afterPayment = await this.deps.settings.getBool('downloads_grant_access_after_payment');
    const grantStatuses = afterPayment ? ['processing', 'completed'] : ['completed'];
    if (grantStatuses.includes(order.status)) await this.grantPermissions(order.id);
  }

  async listForOrder(orderId: number): Promise<DownloadPermission[]> {
    const { db } = this.deps;
    const s = db.schema;
    return db.drizzle
      .select()
      .from(s.downloadPermissions)
      .where(eq(s.downloadPermissions.orderId, orderId))
      .orderBy(asc(s.downloadPermissions.id));
  }

  async listForCustomer(email: string): Promise<DownloadPermission[]> {
    const { db } = this.deps;
    const s = db.schema;
    return db.drizzle
      .select()
      .from(s.downloadPermissions)
      .where(eq(s.downloadPermissions.userEmail, email.toLowerCase()))
      .orderBy(asc(s.downloadPermissions.id));
  }

  async revokeForOrder(orderId: number): Promise<void> {
    const { db } = this.deps;
    const s = db.schema;
    await db.drizzle.delete(s.downloadPermissions).where(eq(s.downloadPermissions.orderId, orderId));
  }

  /**
   * Validate a download request (order key + email + download id), decrement
   * the remaining counter, and resolve how to deliver the bytes.
   */
  async consume(input: {
    downloadId: string;
    orderKey: string;
    email: string;
  }): Promise<{ permission: DownloadPermission; delivery: DownloadDelivery }> {
    const { db, bus, settings } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select()
      .from(s.downloadPermissions)
      .where(
        and(
          eq(s.downloadPermissions.downloadId, input.downloadId),
          eq(s.downloadPermissions.orderKey, input.orderKey),
          eq(s.downloadPermissions.userEmail, input.email.toLowerCase()),
        ),
      );
    const permission = rows[0];
    if (!permission) throw new NotFoundError('Download', input.downloadId);
    if (permission.downloadsRemaining !== null && permission.downloadsRemaining <= 0) {
      throw new SpcndError('Sorry, you have reached your download limit.', 'download_limit_reached');
    }
    if (permission.accessExpires && new Date(permission.accessExpires).getTime() < Date.now()) {
      throw new SpcndError('Sorry, this download has expired.', 'download_expired');
    }

    const fileRows = await db.drizzle
      .select()
      .from(s.productDownloads)
      .where(eq(s.productDownloads.downloadId, permission.downloadId));
    const file = fileRows[0];
    if (!file) throw new NotFoundError('Download file', permission.downloadId);

    await db.drizzle
      .update(s.downloadPermissions)
      .set({
        downloadCount: permission.downloadCount + 1,
        downloadsRemaining:
          permission.downloadsRemaining !== null ? permission.downloadsRemaining - 1 : null,
      })
      .where(eq(s.downloadPermissions.id, permission.id));

    const filePath = await bus.applyFilters(
      filterFileDownloadPath,
      file.fileUrl,
      permission.productId,
      file.downloadId,
    );
    const delivery = await this.resolveDelivery(filePath, file.name);
    return { permission: { ...permission, downloadCount: permission.downloadCount + 1 }, delivery };
  }

  /** `force` streams via the adapter; `redirect` 302s to a (signed) URL. */
  private async resolveDelivery(fileUrl: string, fileName: string): Promise<DownloadDelivery> {
    const { settings, media } = this.deps;
    const method = await settings.getString('file_download_method');
    const key = this.adapterKey(fileUrl);
    if (method === 'force' && media?.stream && key) {
      return { kind: 'stream', stream: await media.stream(key), fileName };
    }
    if (media?.getSignedUrl && key) {
      return { kind: 'redirect', url: await media.getSignedUrl(key, 60) };
    }
    return { kind: 'redirect', url: fileUrl };
  }

  /** Adapter storage key for internal files; external URLs pass through. */
  private adapterKey(fileUrl: string): string | null {
    if (/^https?:\/\//i.test(fileUrl)) return null;
    return fileUrl.replace(/^\/+/, '');
  }
}
