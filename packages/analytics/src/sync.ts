import type { AnalyticsSync } from '@spacendigital/core';
import type { SpcndDb } from '@spacendigital/db';
import { Money } from '@spacendigital/types';
import { and, asc, eq, inArray, lt, ne } from 'drizzle-orm';

/**
 * The lookup-table sync engine (feature-parity report §9.1; RESUME step 9).
 * Every method takes the caller's transaction handle so order/customer writes
 * and their analytics rows commit atomically (docs/AGENTS.md §4.1 rule 10).
 */

/** Statuses whose orders count toward sales reports (WC Analytics default). */
export const REPORTING_STATUSES = ['processing', 'completed', 'on-hold'] as const;

const minor = (value: string | null) => Money.fromDb(value).minor;
const toDb = (m: number) => Money.fromMinor(m).toDbString();

export class DbAnalyticsSync implements AnalyticsSync {
  /** Rebuild order_stats + order_product/tax/coupon_lookup for one order. */
  async syncOrder(tx: SpcndDb, orderId: number): Promise<void> {
    const s = tx.schema;
    const order = (await tx.drizzle.select().from(s.orders).where(eq(s.orders.id, orderId)))[0];
    await this.deleteOrder(tx, orderId);
    if (!order || order.status === 'trash' || order.status.includes('draft')) return;

    const items = await tx.drizzle
      .select()
      .from(s.orderItems)
      .where(eq(s.orderItems.orderId, orderId))
      .orderBy(asc(s.orderItems.id));
    const lineItems = items.filter((i) => i.type === 'line_item');
    const numItemsSold = lineItems.reduce((sum, i) => sum + (i.quantity ?? 0), 0);

    // Returning customer: any earlier reportable order by the same customer.
    let returningCustomer = false;
    if (order.customerId !== null) {
      const earlier = await tx.drizzle
        .select({ id: s.orders.id })
        .from(s.orders)
        .where(
          and(
            eq(s.orders.customerId, order.customerId),
            ne(s.orders.id, orderId),
            inArray(s.orders.status, [...REPORTING_STATUSES]),
            lt(s.orders.dateCreated, order.dateCreated),
          ),
        )
        .limit(1);
      returningCustomer = earlier.length > 0;
    }

    const totalMinor = minor(order.total);
    const taxMinor = minor(order.totalTax);
    const shippingMinor = minor(order.shippingTotal);
    await tx.drizzle.insert(s.orderStats).values({
      orderId,
      parentId: order.parentId,
      status: order.status,
      totalSales: order.total,
      taxTotal: order.totalTax,
      shippingTotal: order.shippingTotal,
      netTotal: toDb(totalMinor - taxMinor - shippingMinor),
      returningCustomer,
      customerId: order.customerId,
      numItemsSold,
      dateCreated: order.dateCreated,
      datePaid: order.datePaid,
    });

    // Per-line product rows; shipping is apportioned by line share of the
    // items total (WC's product lookup semantics).
    const itemsTotalMinor = lineItems.reduce((sum, i) => sum + minor(i.total), 0);
    for (const item of lineItems) {
      if (!item.productId) continue;
      const lineTotal = minor(item.total);
      const share = itemsTotalMinor > 0 ? lineTotal / itemsTotalMinor : 0;
      await tx.drizzle.insert(s.orderProductLookup).values({
        orderItemId: item.id,
        orderId,
        productId: item.productId,
        variationId: item.variationId,
        customerId: order.customerId,
        qty: item.quantity ?? 0,
        totalSales: item.total ?? '0.0000',
        taxTotal: item.totalTax ?? '0.0000',
        shippingTotal: toDb(Math.round(shippingMinor * share)),
        couponAmount: toDb(Math.max(0, minor(item.subtotal) - lineTotal)),
        dateCreated: order.dateCreated,
      });
    }

    for (const item of items.filter((i) => i.type === 'tax')) {
      const rateId = Number(item.metaData?.find((m) => m.key === 'rate_id')?.value ?? 0);
      if (!rateId) continue;
      // Consolidated tax lines: total = cart tax, subtotal = shipping tax.
      const orderTax = minor(item.total);
      const shippingTax = minor(item.subtotal);
      await tx.drizzle.insert(s.orderTaxLookup).values({
        orderId,
        taxRateId: rateId,
        dateCreated: order.dateCreated,
        shippingTax: toDb(shippingTax),
        orderTax: toDb(orderTax),
        totalTax: toDb(orderTax + shippingTax),
      });
    }

    for (const item of items.filter((i) => i.type === 'coupon')) {
      const coupon = (
        await tx.drizzle.select().from(s.coupons).where(eq(s.coupons.code, item.name))
      )[0];
      if (!coupon) continue;
      await tx.drizzle.insert(s.orderCouponLookup).values({
        orderId,
        couponId: coupon.id,
        dateCreated: order.dateCreated,
        discountAmount: item.total ?? '0.0000',
        discountAmountTax: item.totalTax ?? '0.0000',
      });
    }
  }

  async syncCustomer(tx: SpcndDb, customerId: number): Promise<void> {
    const s = tx.schema;
    const customer = (
      await tx.drizzle.select().from(s.customers).where(eq(s.customers.id, customerId))
    )[0];
    await tx.drizzle.delete(s.customerLookup).where(eq(s.customerLookup.customerId, customerId));
    if (!customer) return;
    const billing = (
      await tx.drizzle
        .select()
        .from(s.customerAddresses)
        .where(
          and(eq(s.customerAddresses.customerId, customerId), eq(s.customerAddresses.type, 'billing')),
        )
    )[0];
    const lastOrder = (
      await tx.drizzle
        .select({ dateCreated: s.orders.dateCreated })
        .from(s.orders)
        .where(eq(s.orders.customerId, customerId))
        .orderBy(asc(s.orders.dateCreated))
    ).at(-1);
    const spentMinor = minor(customer.totalSpent);
    await tx.drizzle.insert(s.customerLookup).values({
      customerId,
      username: customer.username ?? '',
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      country: billing?.country ?? '',
      city: billing?.city ?? '',
      state: billing?.state ?? '',
      postcode: billing?.postcode ?? '',
      totalSpent: customer.totalSpent,
      orderCount: customer.orderCount,
      avgOrderValue: toDb(customer.orderCount > 0 ? Math.round(spentMinor / customer.orderCount) : 0),
      dateRegistered: customer.dateCreated,
      dateLastActive: lastOrder?.dateCreated ?? null,
    });
  }

  async deleteOrder(tx: SpcndDb, orderId: number): Promise<void> {
    const s = tx.schema;
    await tx.drizzle.delete(s.orderStats).where(eq(s.orderStats.orderId, orderId));
    await tx.drizzle
      .delete(s.orderProductLookup)
      .where(eq(s.orderProductLookup.orderId, orderId));
    await tx.drizzle.delete(s.orderTaxLookup).where(eq(s.orderTaxLookup.orderId, orderId));
    await tx.drizzle.delete(s.orderCouponLookup).where(eq(s.orderCouponLookup.orderId, orderId));
  }

  /** category_lookup: ancestor path string + product count per category. */
  async syncCategoryLookup(tx: SpcndDb): Promise<void> {
    const s = tx.schema;
    const categories = await tx.drizzle.select().from(s.productCategories);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const maps = await tx.drizzle.select().from(s.productCategoryMap);
    const counts = new Map<number, number>();
    for (const row of maps) counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);

    await tx.exec('DELETE FROM category_lookup');
    for (const category of categories) {
      const path: number[] = [category.id];
      let cursor = category.parentId;
      while (cursor !== null) {
        path.unshift(cursor);
        cursor = byId.get(cursor)?.parentId ?? null;
      }
      await tx.drizzle.insert(s.categoryLookup).values({
        categoryId: category.id,
        categoryTree: path.join('/'),
        count: counts.get(category.id) ?? 0,
      });
    }
  }
}

/** Full rebuild for `spcnd-ecom db sync-lookups --rebuild` (one transaction). */
export async function rebuildAllLookups(db: SpcndDb): Promise<{ orders: number; customers: number }> {
  const sync = new DbAnalyticsSync();
  let orders = 0;
  let customers = 0;
  await db.transaction(async (tx) => {
    const s = tx.schema;
    for (const row of await tx.drizzle.select({ id: s.orders.id }).from(s.orders)) {
      await sync.syncOrder(tx, row.id);
      orders++;
    }
    for (const row of await tx.drizzle.select({ id: s.customers.id }).from(s.customers)) {
      await sync.syncCustomer(tx, row.id);
      customers++;
    }
    await sync.syncCategoryLookup(tx);
  });
  return { orders, customers };
}
