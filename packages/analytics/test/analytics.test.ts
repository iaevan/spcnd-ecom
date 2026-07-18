import { createSpcndCore, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import AnalyticsPlugin, {
  couponsReport,
  customersReport,
  leaderboards,
  productsReport,
  rebuildAllLookups,
  revenueReport,
  stockReport,
} from '../src/index.js';

async function createCore(): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({ db, plugins: [AnalyticsPlugin] });
}

const BILLING = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  address1: '1 Way',
  city: 'SF',
  state: 'CA',
  postcode: '94103',
  country: 'US',
  email: 'ada@example.com',
  phone: '',
};

async function placeOrder(core: SpcndCore, cartId: string, productId: number, qty = 1, coupon?: string) {
  await core.cart.addToCart(cartId, { productId, quantity: qty });
  if (coupon) await core.cart.applyCoupon(cartId, coupon);
  return core.checkout.processCheckout(cartId, { billing: BILLING, paymentMethod: 'cod' });
}

describe('analytics sync + reports', () => {
  it('checkout writes order_stats, product and coupon lookups in the same flow', async () => {
    const core = await createCore();
    const product = await core.products.create({ name: 'Widget', regularPrice: '25.0000' });
    await core.coupons.create({ code: 'ten', discountType: 'percent', amount: '10.0000' });
    const result = await placeOrder(core, 'a1', product.id, 2, 'ten');

    const s = core.db.schema;
    const stats = (
      await core.db.drizzle.select().from(s.orderStats).where(eq(s.orderStats.orderId, result.orderId))
    )[0];
    // 2 × 25 − 10% = 45.00; no tax/shipping → net equals total.
    expect(stats).toMatchObject({
      status: 'processing',
      totalSales: '45.0000',
      netTotal: '45.0000',
      numItemsSold: 2,
      returningCustomer: false,
    });

    const productRows = await core.db.drizzle
      .select()
      .from(s.orderProductLookup)
      .where(eq(s.orderProductLookup.orderId, result.orderId));
    expect(productRows).toHaveLength(1);
    expect(productRows[0]).toMatchObject({
      productId: product.id,
      qty: 2,
      totalSales: '45.0000',
      couponAmount: '5.0000',
    });

    const couponRows = await core.db.drizzle
      .select()
      .from(s.orderCouponLookup)
      .where(eq(s.orderCouponLookup.orderId, result.orderId));
    expect(couponRows[0]).toMatchObject({ discountAmount: '5.0000' });
    await core.close();
  });

  it('status changes resync stats; trash removes them', async () => {
    const core = await createCore();
    const product = await core.products.create({ name: 'S', regularPrice: '10.0000' });
    const result = await placeOrder(core, 'a2', product.id);
    const s = core.db.schema;

    await core.orders.setStatus(result.orderId, 'completed');
    let stats = (
      await core.db.drizzle.select().from(s.orderStats).where(eq(s.orderStats.orderId, result.orderId))
    )[0];
    expect(stats?.status).toBe('completed');

    await core.orders.setStatus(result.orderId, 'trash');
    stats = (
      await core.db.drizzle.select().from(s.orderStats).where(eq(s.orderStats.orderId, result.orderId))
    )[0];
    expect(stats).toBeUndefined();
    await core.close();
  });

  it('revenue/products/coupons reports aggregate the lookups', async () => {
    const core = await createCore();
    const a = await core.products.create({ name: 'Alpha', regularPrice: '10.0000' });
    const b = await core.products.create({ name: 'Beta', regularPrice: '30.0000' });
    await core.coupons.create({ code: 'five', discountType: 'fixed_cart', amount: '5.0000' });
    await placeOrder(core, 'r1', a.id, 3);
    await placeOrder(core, 'r2', b.id, 1, 'five');

    const revenue = await revenueReport(core.db);
    expect(revenue.ordersCount).toBe(2);
    expect(revenue.grossSalesMinor).toBe(300000 + 250000);
    expect(revenue.numItemsSold).toBe(4);
    expect(revenue.intervals).toHaveLength(1);

    const products = await productsReport(core.db);
    expect(products[0]).toMatchObject({ name: 'Alpha', itemsSold: 3 });
    const coupons = await couponsReport(core.db);
    expect(coupons[0]).toMatchObject({ code: 'five', amountMinor: 50000 });

    const boards = await leaderboards(core.db, {}, 3);
    expect(boards.products.length).toBeGreaterThan(0);
    await core.close();
  });

  it('returning customers are flagged and customer_lookup fills', async () => {
    const core = await createCore();
    const customer = await core.customers.create({ email: BILLING.email, firstName: 'Ada', billing: BILLING });
    const product = await core.products.create({ name: 'R', regularPrice: '10.0000' });
    const first = await placeOrder(core, 'c1', product.id);
    const second = await placeOrder(core, 'c2', product.id);

    const s = core.db.schema;
    await core.db.drizzle
      .update(s.orders)
      .set({ customerId: customer.id })
      .where(eq(s.orders.id, first.orderId));
    await core.db.drizzle
      .update(s.orders)
      .set({ customerId: customer.id })
      .where(eq(s.orders.id, second.orderId));
    await rebuildAllLookups(core.db);

    const stats2 = (
      await core.db.drizzle.select().from(s.orderStats).where(eq(s.orderStats.orderId, second.orderId))
    )[0];
    expect(stats2?.returningCustomer).toBe(true);

    const customers = await customersReport(core.db);
    expect(customers[0]).toMatchObject({ email: BILLING.email, country: 'US' });
    await core.close();
  });

  it('stock report surfaces low and out-of-stock products', async () => {
    const core = await createCore();
    await core.products.create({ name: 'Low', regularPrice: '1.0000', manageStock: true, stockQuantity: 1 });
    const out = await core.products.create({
      name: 'Out',
      regularPrice: '1.0000',
      manageStock: true,
      stockQuantity: 5,
    });
    await core.products.setStock(out.id, 0);
    const report = await stockReport(core.db);
    expect(report.outOfStockCount).toBe(1);
    expect(report.lowStock.map((p) => p.name)).toEqual(['Low']);
    await core.close();
  });
});
