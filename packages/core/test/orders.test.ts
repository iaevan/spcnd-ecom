import { describe, expect, it } from 'vitest';
import { orderStatusChanged, orderStatusEvent, paymentComplete } from '../src/events.js';
import { createTestCore, seedProduct } from './helpers.js';

describe('OrderService', () => {
  it('fires transition events in the documented order and stamps dates', async () => {
    const core = await createTestCore();
    const order = await core.orders.create({ billing: { email: 'x@y.z' } });
    const sequence: string[] = [];
    core.bus.on(orderStatusEvent('processing'), () => {
      sequence.push('status.processing');
    });
    core.bus.onName('order.status.pending_to_processing', () => {
      sequence.push('transition');
    });
    core.bus.on(orderStatusChanged, () => {
      sequence.push('changed');
    });
    const updated = await core.orders.setStatus(order.id, 'processing');
    expect(sequence).toEqual(['status.processing', 'transition', 'changed']);
    expect(updated.status).toBe('processing');
    expect(updated.datePaid).not.toBeNull();
    const completed = await core.orders.setStatus(order.id, 'completed');
    expect(completed.dateCompleted).not.toBeNull();
    const notes = await core.orders.getNotes(order.id);
    expect(notes.some((n) => n.note.includes('pending to processing'))).toBe(true);
    await core.close();
  });

  it('payment_complete routes by needs_processing and respects valid statuses', async () => {
    const core = await createTestCore();
    const physical = await seedProduct(core, { name: 'Phys' });
    await core.cart.addToCart('o1', { productId: physical.id });
    const cart = await core.cart.calculate('o1');
    const order = await core.orders.createFromCart(cart, { billing: { email: 'p@q.r' } });

    let fired = 0;
    core.bus.on(paymentComplete, () => {
      fired++;
    });
    expect(await core.orders.paymentComplete(order.id, 'txn-1')).toBe(true);
    const paid = await core.orders.get(order.id);
    expect(paid.status).toBe('processing');
    expect(paid.transactionId).toBe('txn-1');
    expect(fired).toBe(1);
    // Already processing → not a valid payment_complete source status.
    expect(await core.orders.paymentComplete(order.id)).toBe(false);
    expect(fired).toBe(1);
    await core.close();
  });

  it('virtual+downloadable orders complete directly', async () => {
    const core = await createTestCore();
    const soft = await seedProduct(core, { name: 'Soft', virtual: true, downloadable: true });
    await core.cart.addToCart('o2', { productId: soft.id });
    const cart = await core.cart.calculate('o2');
    const order = await core.orders.createFromCart(cart, { billing: { email: 'v@d.io' } });
    await core.orders.paymentComplete(order.id);
    expect((await core.orders.get(order.id)).status).toBe('completed');
    await core.close();
  });

  it('one-shot ops: stock reduces once, restores on cancel', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { manageStock: true, stockQuantity: 10 });
    await core.cart.addToCart('o3', { productId: product.id, quantity: 3 });
    const cart = await core.cart.calculate('o3');
    const order = await core.orders.createFromCart(cart, { billing: { email: 's@t.co' } });
    await core.orders.setStatus(order.id, 'processing');
    expect((await core.products.get(product.id)).stockQuantity).toBe(7);
    // Second paid transition must not double-reduce.
    await core.orders.setStatus(order.id, 'completed');
    expect((await core.products.get(product.id)).stockQuantity).toBe(7);
    await core.orders.setStatus(order.id, 'cancelled');
    expect((await core.products.get(product.id)).stockQuantity).toBe(10);
    await core.close();
  });

  it('records and reverses coupon usage with the order lifecycle', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { name: 'CP', regularPrice: '30.0000' });
    await core.coupons.create({ code: 'save5', discountType: 'fixed_cart', amount: '5.0000' });
    await core.cart.addToCart('o4', { productId: product.id });
    await core.cart.applyCoupon('o4', 'save5');
    const cart = await core.cart.calculate('o4');
    const order = await core.orders.createFromCart(cart, { billing: { email: 'c@u.co' } });
    await core.orders.setStatus(order.id, 'processing');
    expect((await core.coupons.findByCode('save5'))?.usageCount).toBe(1);
    await core.orders.setStatus(order.id, 'cancelled');
    expect((await core.coupons.findByCode('save5'))?.usageCount).toBe(0);
    await core.close();
  });

  it('refunds partially then fully, flipping status to refunded', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { name: 'R', regularPrice: '40.0000' });
    await core.cart.addToCart('o5', { productId: product.id });
    const cart = await core.cart.calculate('o5');
    const order = await core.orders.createFromCart(cart, { billing: { email: 'r@f.co' } });
    await core.orders.paymentComplete(order.id);

    await core.orders.createRefund(order.id, { amount: '10.0000', reason: 'damaged box' });
    expect(await core.orders.totalRefundedMinor(order.id)).toBe(100000);
    expect((await core.orders.get(order.id)).status).toBe('processing');

    await expect(
      core.orders.createRefund(order.id, { amount: '100.0000' }),
    ).rejects.toThrow(/exceeds remaining/);

    await core.orders.createRefund(order.id, { amount: '30.0000' });
    expect((await core.orders.get(order.id)).status).toBe('refunded');
    await core.close();
  });

  it('resumes a pending order on identical cart hash', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { name: 'Resume' });
    await core.cart.addToCart('o6', { productId: product.id });
    const cart = await core.cart.calculate('o6');
    const first = await core.orders.createFromCart(cart, { billing: { email: 'a@a.co' } });
    const second = await core.orders.createFromCart(cart, {
      billing: { email: 'a@a.co' },
      resumeOrderId: first.id,
    });
    expect(second.id).toBe(first.id);
    const items = await core.orders.getItems(first.id, ['line_item']);
    expect(items).toHaveLength(1);
    await core.close();
  });
});
