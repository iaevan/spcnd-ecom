import AnalyticsPlugin from '@spacendigital/analytics';
import { createSpcndCore, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';
import { describe, expect, it } from 'vitest';
import { createApi } from '../src/index.js';

async function createApp() {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  const core = await createSpcndCore({ db, plugins: [AnalyticsPlugin] });
  return { core, app: createApi(core) };
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

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

function cookieOf(res: Response): string {
  return res.headers.get('Set-Cookie')?.split(';')[0] ?? '';
}

describe('api', () => {
  it('health + v1 product CRUD with pagination headers', async () => {
    const { core, app } = await createApp();
    expect((await app.request('/api/health')).status).toBe(200);

    const created = await app.request(
      '/api/v1/products',
      json({ name: 'Widget', regularPrice: '19.9900', sku: 'W-1' }),
    );
    expect(created.status).toBe(201);
    const product = (await created.json()) as { id: number; price: string };
    expect(product.price).toBe('19.9900');

    const list = await app.request('/api/v1/products?per_page=5');
    expect(list.status).toBe(200);
    expect(list.headers.get('X-WP-Total')).toBe('1');
    expect(list.headers.get('X-WP-TotalPages')).toBe('1');

    const missing = await app.request('/api/v1/products/9999');
    expect(missing.status).toBe(404);
    await core.close();
  });

  it('v3 serves WC shapes and batch updates', async () => {
    const { core, app } = await createApp();
    await core.products.create({ name: 'Fedora', regularPrice: '25.0000', salePrice: '19.9900' });

    const list = await app.request('/api/v3/products');
    expect(list.headers.get('X-WP-Total')).toBe('1');
    const [wc] = (await list.json()) as Record<string, unknown>[];
    expect(wc).toMatchObject({
      name: 'Fedora',
      price: '19.99',
      regular_price: '25.00',
      on_sale: true,
      dimensions: { length: '', width: '', height: '' },
    });

    const batch = await app.request(
      '/api/v3/products/batch',
      json({
        create: [{ name: 'Batched', regular_price: '5.00' }],
        update: [{ id: wc.id, regular_price: '30.00', sale_price: '' }],
      }),
    );
    const result = (await batch.json()) as {
      create: Record<string, unknown>[];
      update: Record<string, unknown>[];
    };
    expect(result.create[0]).toMatchObject({ name: 'Batched', price: '5.00' });
    expect(result.update[0]).toMatchObject({ regular_price: '30.00', on_sale: false });
    await core.close();
  });

  it('storefront: cookie cart → coupon → checkout → order received', async () => {
    const { core, app } = await createApp();
    const product = await core.products.create({ name: 'Cart item', regularPrice: '10.0000' });
    await core.coupons.create({ code: 'ten', discountType: 'percent', amount: '10.0000' });

    const add = await app.request('/api/store/cart/items', json({ productId: product.id, quantity: 3 }));
    expect(add.status).toBe(201);
    const cookie = cookieOf(add);
    expect(cookie).toMatch(/^spcnd_session=/);

    const withCoupon = await app.request('/api/store/cart/coupons', {
      ...json({ code: 'ten' }),
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    });
    const cart = (await withCoupon.json()) as { totals: { totalMinor: number } };
    expect(cart.totals.totalMinor).toBe(270000);

    const checkout = await app.request('/api/store/checkout', {
      ...json({ billing: BILLING, paymentMethod: 'cod' }),
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    });
    expect(checkout.status).toBe(200);
    const placed = (await checkout.json()) as { orderId: number; orderKey: string };
    expect(placed.orderKey).toMatch(/^wc_order_/);

    const received = await app.request(
      `/api/store/order-received/${placed.orderId}?key=${placed.orderKey}`,
    );
    expect(received.status).toBe(200);
    const wrongKey = await app.request(`/api/store/order-received/${placed.orderId}?key=nope`);
    expect(wrongKey.status).toBe(403);

    // The cart cookie was consumed by checkout.
    const after = await app.request('/api/store/cart', { headers: { Cookie: cookie } });
    const emptied = (await after.json()) as { items: unknown[] };
    expect(emptied.items).toHaveLength(0);
    await core.close();
  });

  it('v1 orders: status transitions, refunds, reports read the flow', async () => {
    const { core, app } = await createApp();
    const product = await core.products.create({ name: 'O', regularPrice: '40.0000' });
    await core.cart.addToCart('api-o', { productId: product.id });
    const result = await core.checkout.processCheckout('api-o', {
      billing: BILLING,
      paymentMethod: 'cod',
    });

    const refund = await app.request(
      `/api/v1/orders/${result.orderId}/refunds`,
      json({ amount: '10.0000', reason: 'damaged' }),
    );
    expect(refund.status).toBe(201);

    const revenue = await app.request('/api/v1/reports/revenue');
    const report = (await revenue.json()) as { ordersCount: number; refundsMinor: number };
    expect(report.ordersCount).toBe(1);
    expect(report.refundsMinor).toBe(100000);

    const gateways = await app.request('/api/v1/payment-gateways');
    expect(await gateways.json()).toEqual([]);

    const status = await app.request('/api/v1/system_status');
    expect(((await status.json()) as { security: { pending: string[] } }).security.pending).toContain(
      'S4 auth',
    );
    await core.close();
  });

  it('settings round-trip and data endpoints', async () => {
    const { core, app } = await createApp();
    await app.request('/api/v1/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'EUR' }),
    });
    expect(await core.settings.getString('currency')).toBe('EUR');
    const countries = (await (await app.request('/api/v1/data/countries')).json()) as Record<string, string>;
    expect(countries.US).toBeDefined();
    await core.close();
  });
});
