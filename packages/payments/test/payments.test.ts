import { createSpcndCore, PAYMENT_SERVICE, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';
import { describe, expect, it } from 'vitest';
import PaymentsPlugin from '../src/index.js';

async function createCore(): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({ db, plugins: [PaymentsPlugin] });
}

describe('BuiltinPaymentService', () => {
  it('lists enabled gateways (COD by default) and honors config', async () => {
    const core = await createCore();
    const payments = core.container.resolve(PAYMENT_SERVICE);
    const initial = await payments.availableGateways();
    expect(initial.map((g) => g.id)).toEqual(['cod']);
    expect(initial[0]).toMatchObject({ methodTitle: 'Cash on delivery', hasFields: false });

    await core.settings.set('gateway_bacs_settings', { enabled: true, title: 'Bank transfer' });
    await core.settings.set('gateway_cod_settings', { enabled: false });
    const updated = await payments.availableGateways();
    expect(updated.map((g) => g.id)).toEqual(['bacs']);
    expect(updated[0]?.title).toBe('Bank transfer');
    await core.close();
  });

  it('COD moves the order to processing; BACS holds it', async () => {
    const core = await createCore();
    const payments = core.container.resolve(PAYMENT_SERVICE);
    await core.settings.set('gateway_bacs_settings', { enabled: true });

    const codOrder = await core.orders.create({ billing: { email: 'p@t.co' } });
    expect(await payments.processPayment('cod', codOrder)).toMatchObject({ result: 'success' });
    expect((await core.orders.get(codOrder.id)).status).toBe('processing');
    const notes = await core.orders.getNotes(codOrder.id);
    expect(notes.some((n) => n.note.includes('upon delivery'))).toBe(true);

    const bacsOrder = await core.orders.create({ billing: { email: 'b@t.co' } });
    await payments.processPayment('bacs', bacsOrder);
    expect((await core.orders.get(bacsOrder.id)).status).toBe('on-hold');
    await core.close();
  });

  it('refuses third-party gateways (S5) and unknown/disabled ids', async () => {
    const core = await createCore();
    const payments = core.container.resolve(PAYMENT_SERVICE);
    const order = await core.orders.create({});
    expect((await payments.processPayment('stripe', order)).result).toBe('failure');
    expect((await payments.processPayment('nope', order)).result).toBe('failure');
    expect((await payments.processRefund('cod', order, 1000)).ok).toBe(false);
    expect(await payments.supports('cod', 'products')).toBe(true);
    expect(await payments.supports('cod', 'refunds')).toBe(false);
    await core.close();
  });
});
