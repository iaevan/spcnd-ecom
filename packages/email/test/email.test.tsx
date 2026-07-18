import { createSpcndCore, EMAIL_TRANSPORT, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';
import { describe, expect, it } from 'vitest';
import EmailPlugin, { EMAIL_TEMPLATES } from '../src/index.js';
import { ConsoleTransport } from '../src/transports.js';

async function createCore(transport: ConsoleTransport): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({
    db,
    plugins: [
      {
        id: 'test/transport',
        version: '0.0.0',
        setup({ container }) {
          container.register(EMAIL_TRANSPORT, transport);
        },
      },
      EmailPlugin,
    ],
  });
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

describe('email package', () => {
  it('declares all 22 WC template ids', () => {
    expect(Object.keys(EMAIL_TEMPLATES)).toHaveLength(22);
    expect(EMAIL_TEMPLATES.new_order.customerFacing).toBe(false);
    expect(EMAIL_TEMPLATES.customer_processing_order.customerFacing).toBe(true);
  });

  it('checkout sends new_order to the merchant and processing email to the customer', async () => {
    const transport = new ConsoleTransport();
    const core = await createCore(transport);
    await core.settings.set('merchant_email', 'owner@store.test');
    const product = await core.products.create({ name: 'Widget', regularPrice: '25.0000' });
    await core.cart.addToCart('e1', { productId: product.id, quantity: 2 });
    await core.checkout.processCheckout('e1', { billing: BILLING, paymentMethod: 'cod' });

    const to = transport.sent.map((m) => m.to);
    expect(to).toContain('owner@store.test');
    expect(to).toContain(BILLING.email);
    const newOrder = transport.sent.find((m) => m.to === 'owner@store.test');
    expect(newOrder?.subject).toMatch(/New order #\d+/);
    expect(newOrder?.html).toContain('Widget');
    expect(newOrder?.html).toContain('$50.00');
    const processing = transport.sent.find((m) => m.to === BILLING.email);
    expect(processing?.html).toContain('Ada');
    await core.close();
  });

  it('fires the merchant new_order only once per order (order_events guard)', async () => {
    const transport = new ConsoleTransport();
    const core = await createCore(transport);
    await core.settings.set('merchant_email', 'owner@store.test');
    const order = await core.orders.create({ billing: { email: 'x@y.z' } });
    await core.orders.setStatus(order.id, 'processing');
    await core.orders.setStatus(order.id, 'on-hold');
    await core.orders.setStatus(order.id, 'processing');
    const merchantMails = transport.sent.filter(
      (m) => m.to === 'owner@store.test' && m.subject.includes('New order'),
    );
    expect(merchantMails).toHaveLength(1);
    await core.close();
  });

  it('respects per-template enabled config and placeholder overrides', async () => {
    const transport = new ConsoleTransport();
    const core = await createCore(transport);
    await core.settings.set('email_settings', {
      customer_processing_order: { enabled: false },
      customer_completed_order: { subject: 'Done! {site_title} #{order_number}' },
    });
    await core.settings.set('store_name', 'Acme');
    const order = await core.orders.create({ billing: { email: 'c@u.st' } });
    await core.orders.setStatus(order.id, 'processing');
    expect(transport.sent.filter((m) => m.to === 'c@u.st')).toHaveLength(0);
    await core.orders.setStatus(order.id, 'completed');
    const done = transport.sent.find((m) => m.to === 'c@u.st');
    expect(done?.subject).toBe(`Done! Acme #${order.id}`);
    await core.close();
  });

  it('sends the new-account email on customer creation', async () => {
    const transport = new ConsoleTransport();
    const core = await createCore(transport);
    await core.customers.create({ email: 'new@user.io', firstName: 'Nia' });
    const mail = transport.sent.find((m) => m.to === 'new@user.io');
    expect(mail?.html).toContain('Nia');
    expect(mail?.subject).toMatch(/account has been created/);
    await core.close();
  });
});
