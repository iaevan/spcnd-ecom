import type { SpcndDb } from '@spacendigital/db';
import { Money } from '@spacendigital/types';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { REPORTING_STATUSES } from './sync.js';

/**
 * The 10 report queries + leaderboards (RESUME step 9; feature-parity §9.2),
 * all reading the lookup tables. Amounts are integer minor units; date range
 * bounds are inclusive ISO strings.
 */

export interface ReportRange {
  after?: string;
  before?: string;
  /** Override the reporting statuses (default processing/completed/on-hold). */
  statuses?: string[];
}

const minor = (value: string | number | null) => Money.fromDb(value === null ? '0' : String(value)).minor;

/**
 * Convert a raw SQL SUM() over a money column. SQLite stores money as INTEGER
 * minor units (DECISION-2), so aggregates come back as raw minor units;
 * PG/MySQL NUMERIC aggregates come back as decimal strings.
 */
function aggMinor(dialect: SpcndDb['dialect'], value: string | number | null): number {
  if (value === null) return 0;
  if (dialect === 'sqlite') return Math.round(Number(value));
  return Money.fromDb(String(value)).minor;
}

function statsConds(db: SpcndDb, range: ReportRange) {
  const s = db.schema;
  const conds = [inArray(s.orderStats.status, range.statuses ?? [...REPORTING_STATUSES])];
  if (range.after) conds.push(gte(s.orderStats.dateCreated, range.after));
  if (range.before) conds.push(lte(s.orderStats.dateCreated, range.before));
  return and(...conds);
}

export interface RevenueReport {
  ordersCount: number;
  numItemsSold: number;
  grossSalesMinor: number;
  netRevenueMinor: number;
  taxesMinor: number;
  shippingMinor: number;
  refundsMinor: number;
  totalSalesMinor: number;
  avgOrderValueMinor: number;
  /** Per calendar day (UTC). */
  intervals: {
    date: string;
    ordersCount: number;
    grossSalesMinor: number;
    netRevenueMinor: number;
  }[];
}

/** 1. Revenue. */
export async function revenueReport(db: SpcndDb, range: ReportRange = {}): Promise<RevenueReport> {
  const s = db.schema;
  const rows = await db.drizzle.select().from(s.orderStats).where(statsConds(db, range));
  const refundConds = [];
  if (range.after) refundConds.push(gte(s.orderRefunds.dateCreated, range.after));
  if (range.before) refundConds.push(lte(s.orderRefunds.dateCreated, range.before));
  const refunds = await db.drizzle
    .select()
    .from(s.orderRefunds)
    .where(refundConds.length > 0 ? and(...refundConds) : undefined);

  const intervals = new Map<string, { ordersCount: number; grossSalesMinor: number; netRevenueMinor: number }>();
  let gross = 0;
  let net = 0;
  let taxes = 0;
  let shipping = 0;
  let items = 0;
  for (const row of rows) {
    gross += minor(row.totalSales);
    net += minor(row.netTotal);
    taxes += minor(row.taxTotal);
    shipping += minor(row.shippingTotal);
    items += row.numItemsSold;
    const day = row.dateCreated.slice(0, 10);
    const bucket = intervals.get(day) ?? { ordersCount: 0, grossSalesMinor: 0, netRevenueMinor: 0 };
    bucket.ordersCount++;
    bucket.grossSalesMinor += minor(row.totalSales);
    bucket.netRevenueMinor += minor(row.netTotal);
    intervals.set(day, bucket);
  }
  // Row values come through the drizzle money mapper (strings) — not SQL sums.
  const refundsMinor = refunds.reduce((sum, r) => sum + minor(r.amount), 0);
  return {
    ordersCount: rows.length,
    numItemsSold: items,
    grossSalesMinor: gross,
    netRevenueMinor: net,
    taxesMinor: taxes,
    shippingMinor: shipping,
    refundsMinor,
    totalSalesMinor: gross - refundsMinor,
    avgOrderValueMinor: rows.length > 0 ? Math.round(gross / rows.length) : 0,
    intervals: [...intervals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({ date, ...bucket })),
  };
}

/** 2. Orders: per-interval counts + averages. */
export async function ordersReport(db: SpcndDb, range: ReportRange = {}) {
  const revenue = await revenueReport(db, range);
  return {
    ordersCount: revenue.ordersCount,
    avgOrderValueMinor: revenue.avgOrderValueMinor,
    avgItemsPerOrder: revenue.ordersCount > 0 ? revenue.numItemsSold / revenue.ordersCount : 0,
    intervals: revenue.intervals,
  };
}

/** 3. Products: items sold + net revenue per product. */
export async function productsReport(db: SpcndDb, range: ReportRange = {}, limit = 25) {
  const s = db.schema;
  const conds = [];
  if (range.after) conds.push(gte(s.orderProductLookup.dateCreated, range.after));
  if (range.before) conds.push(lte(s.orderProductLookup.dateCreated, range.before));
  const rows = await db.drizzle
    .select({
      productId: s.orderProductLookup.productId,
      name: s.products.name,
      itemsSold: sql<number>`sum(${s.orderProductLookup.qty})`,
      netRevenue: sql<string>`sum(${s.orderProductLookup.totalSales})`,
      ordersCount: sql<number>`count(distinct ${s.orderProductLookup.orderId})`,
    })
    .from(s.orderProductLookup)
    .innerJoin(s.products, eq(s.products.id, s.orderProductLookup.productId))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .groupBy(s.orderProductLookup.productId, s.products.name)
    .orderBy(desc(sql`sum(${s.orderProductLookup.qty})`))
    .limit(limit);
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    itemsSold: Number(r.itemsSold),
    netRevenueMinor: aggMinor(db.dialect, r.netRevenue),
    ordersCount: Number(r.ordersCount),
  }));
}

/** 4. Categories: rollup of product sales per category. */
export async function categoriesReport(db: SpcndDb, range: ReportRange = {}, limit = 25) {
  const s = db.schema;
  const conds = [];
  if (range.after) conds.push(gte(s.orderProductLookup.dateCreated, range.after));
  if (range.before) conds.push(lte(s.orderProductLookup.dateCreated, range.before));
  const rows = await db.drizzle
    .select({
      categoryId: s.productCategoryMap.categoryId,
      name: s.productCategories.name,
      itemsSold: sql<number>`sum(${s.orderProductLookup.qty})`,
      netRevenue: sql<string>`sum(${s.orderProductLookup.totalSales})`,
    })
    .from(s.orderProductLookup)
    .innerJoin(s.productCategoryMap, eq(s.productCategoryMap.productId, s.orderProductLookup.productId))
    .innerJoin(s.productCategories, eq(s.productCategories.id, s.productCategoryMap.categoryId))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .groupBy(s.productCategoryMap.categoryId, s.productCategories.name)
    .orderBy(desc(sql`sum(${s.orderProductLookup.qty})`))
    .limit(limit);
  return rows.map((r) => ({
    categoryId: r.categoryId,
    name: r.name,
    itemsSold: Number(r.itemsSold),
    netRevenueMinor: aggMinor(db.dialect, r.netRevenue),
  }));
}

/** 5. Coupons: usage + discounted amount per coupon. */
export async function couponsReport(db: SpcndDb, range: ReportRange = {}, limit = 25) {
  const s = db.schema;
  const conds = [];
  if (range.after) conds.push(gte(s.orderCouponLookup.dateCreated, range.after));
  if (range.before) conds.push(lte(s.orderCouponLookup.dateCreated, range.before));
  const rows = await db.drizzle
    .select({
      couponId: s.orderCouponLookup.couponId,
      code: s.coupons.code,
      ordersCount: sql<number>`count(*)`,
      amount: sql<string>`sum(${s.orderCouponLookup.discountAmount})`,
    })
    .from(s.orderCouponLookup)
    .innerJoin(s.coupons, eq(s.coupons.id, s.orderCouponLookup.couponId))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .groupBy(s.orderCouponLookup.couponId, s.coupons.code)
    .orderBy(desc(sql`sum(${s.orderCouponLookup.discountAmount})`))
    .limit(limit);
  return rows.map((r) => ({
    couponId: r.couponId,
    code: r.code,
    ordersCount: Number(r.ordersCount),
    amountMinor: aggMinor(db.dialect, r.amount),
  }));
}

/** 6. Taxes: per-rate totals. */
export async function taxesReport(db: SpcndDb, range: ReportRange = {}) {
  const s = db.schema;
  const conds = [];
  if (range.after) conds.push(gte(s.orderTaxLookup.dateCreated, range.after));
  if (range.before) conds.push(lte(s.orderTaxLookup.dateCreated, range.before));
  const rows = await db.drizzle
    .select({
      taxRateId: s.orderTaxLookup.taxRateId,
      ordersCount: sql<number>`count(distinct ${s.orderTaxLookup.orderId})`,
      orderTax: sql<string>`sum(${s.orderTaxLookup.orderTax})`,
      shippingTax: sql<string>`sum(${s.orderTaxLookup.shippingTax})`,
      totalTax: sql<string>`sum(${s.orderTaxLookup.totalTax})`,
    })
    .from(s.orderTaxLookup)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .groupBy(s.orderTaxLookup.taxRateId);
  return rows.map((r) => ({
    taxRateId: r.taxRateId,
    ordersCount: Number(r.ordersCount),
    orderTaxMinor: aggMinor(db.dialect, r.orderTax),
    shippingTaxMinor: aggMinor(db.dialect, r.shippingTax),
    totalTaxMinor: aggMinor(db.dialect, r.totalTax),
  }));
}

/** 7. Customers: from customer_lookup. */
export async function customersReport(db: SpcndDb, limit = 25) {
  const s = db.schema;
  const rows = await db.drizzle
    .select()
    .from(s.customerLookup)
    .orderBy(desc(s.customerLookup.totalSpent))
    .limit(limit);
  return rows.map((r) => ({
    customerId: r.customerId,
    name: `${r.firstName} ${r.lastName}`.trim() || r.email,
    email: r.email,
    ordersCount: r.orderCount,
    totalSpendMinor: minor(r.totalSpent),
    avgOrderValueMinor: minor(r.avgOrderValue),
    dateLastActive: r.dateLastActive,
    country: r.country,
  }));
}

/** 8. Stock: low/out-of-stock overview from the product lookup. */
export async function stockReport(db: SpcndDb, lowStockThreshold = 2, limit = 50) {
  const s = db.schema;
  const managed = await db.drizzle
    .select({
      productId: s.products.id,
      name: s.products.name,
      stockQuantity: s.products.stockQuantity,
      stockStatus: s.products.stockStatus,
    })
    .from(s.products)
    .where(eq(s.products.manageStock, true))
    .orderBy(asc(s.products.stockQuantity))
    .limit(limit);
  const outOfStock = await db.drizzle
    .select({ count: sql<number>`count(*)` })
    .from(s.productMetaLookup)
    .where(eq(s.productMetaLookup.stockStatus, 'outofstock'));
  return {
    outOfStockCount: Number(outOfStock[0]?.count ?? 0),
    lowStock: managed.filter(
      (p) => p.stockQuantity !== null && p.stockQuantity <= lowStockThreshold && p.stockStatus !== 'outofstock',
    ),
    products: managed,
  };
}

/** 9. Downloads: per-product download counts. */
export async function downloadsReport(db: SpcndDb, limit = 25) {
  const s = db.schema;
  const rows = await db.drizzle
    .select({
      productId: s.downloadPermissions.productId,
      name: s.products.name,
      downloadCount: sql<number>`sum(${s.downloadPermissions.downloadCount})`,
      permissions: sql<number>`count(*)`,
    })
    .from(s.downloadPermissions)
    .innerJoin(s.products, eq(s.products.id, s.downloadPermissions.productId))
    .groupBy(s.downloadPermissions.productId, s.products.name)
    .orderBy(desc(sql`sum(${s.downloadPermissions.downloadCount})`))
    .limit(limit);
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    downloadCount: Number(r.downloadCount),
    permissions: Number(r.permissions),
  }));
}

/** 10. Variations: items sold + revenue per variation. */
export async function variationsReport(db: SpcndDb, range: ReportRange = {}, limit = 25) {
  const s = db.schema;
  const conds = [sql`${s.orderProductLookup.variationId} IS NOT NULL`];
  if (range.after) conds.push(gte(s.orderProductLookup.dateCreated, range.after));
  if (range.before) conds.push(lte(s.orderProductLookup.dateCreated, range.before));
  const rows = await db.drizzle
    .select({
      variationId: s.orderProductLookup.variationId,
      productId: s.orderProductLookup.productId,
      name: s.products.name,
      itemsSold: sql<number>`sum(${s.orderProductLookup.qty})`,
      netRevenue: sql<string>`sum(${s.orderProductLookup.totalSales})`,
    })
    .from(s.orderProductLookup)
    .innerJoin(s.products, eq(s.products.id, s.orderProductLookup.productId))
    .where(and(...conds))
    .groupBy(s.orderProductLookup.variationId, s.orderProductLookup.productId, s.products.name)
    .orderBy(desc(sql`sum(${s.orderProductLookup.qty})`))
    .limit(limit);
  return rows.map((r) => ({
    variationId: r.variationId,
    productId: r.productId,
    name: r.name,
    itemsSold: Number(r.itemsSold),
    netRevenueMinor: aggMinor(db.dialect, r.netRevenue),
  }));
}

/** Dashboard leaderboards: top products / categories / coupons / customers. */
export async function leaderboards(db: SpcndDb, range: ReportRange = {}, limit = 5) {
  return {
    products: await productsReport(db, range, limit),
    categories: await categoriesReport(db, range, limit),
    coupons: await couponsReport(db, range, limit),
    customers: await customersReport(db, limit),
  };
}
