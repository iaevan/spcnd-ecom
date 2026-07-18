import { Money } from '@spacendigital/types';
import { describe, expect, it } from 'vitest';
import { createTestCore, seedProduct, US_BILLING } from './helpers.js';

describe('CheckoutService', () => {
  it('rejects an empty cart and collects validation errors', async () => {
    const core = await createTestCore();
    await expect(
      core.checkout.processCheckout('empty', { billing: US_BILLING }),
    ).rejects.toThrow(/session has expired/);

    const product = await seedProduct(core);
    await core.cart.addToCart('chk1', { productId: product.id });
    await expect(
      core.checkout.processCheckout('chk1', {
        billing: { ...US_BILLING, email: 'not-an-email', country: 'XX', postcode: '' },
      }),
    ).rejects.toThrow(/valid billing email.*|not a valid country/);
    await core.close();
  });

  it('completes an end-to-end no-payment checkout', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, {
      name: 'Widget',
      regularPrice: '25.0000',
      manageStock: true,
      stockQuantity: 10,
    });
    await core.cart.addToCart('chk2', { productId: product.id, quantity: 2 });
    await core.coupons.create({ code: 'ten', discountType: 'percent', amount: '10.0000' });
    await core.cart.applyCoupon('chk2', 'ten');

    const result = await core.checkout.processCheckout('chk2', {
      billing: US_BILLING,
      paymentMethod: 'cod',
      customerNote: 'Leave at the door',
    });

    expect(result.result).toBe('success');
    expect(result.redirect).toContain(`order-received/${result.orderId}`);
    expect(result.orderKey).toMatch(/^wc_order_/);

    const order = result.order;
    // Physical product → processing after the no-payment payment_complete.
    expect(order.status).toBe('processing');
    expect(order.datePaid).not.toBeNull();
    expect(order.billingEmail).toBe(US_BILLING.email);
    expect(order.customerNote).toBe('Leave at the door');
    expect(order.createdVia).toBe('checkout');

    // Totals: 2 × 25.00 − 10% = 45.00, no taxes configured.
    expect(Money.fromDb(order.total).minor).toBe(450000);
    expect(Money.fromDb(order.discountTotal).minor).toBe(50000);

    const lineItems = await core.orders.getItems(order.id, ['line_item']);
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).toMatchObject({ quantity: 2, subtotal: '50.0000', total: '45.0000' });
    const couponItems = await core.orders.getItems(order.id, ['coupon']);
    expect(couponItems.map((c) => c.name)).toEqual(['ten']);

    // Side effects: stock reduced, coupon counted, cart emptied.
    expect((await core.products.get(product.id)).stockQuantity).toBe(8);
    expect((await core.coupons.findByCode('ten'))?.usageCount).toBe(1);
    expect(await core.cart.isEmpty('chk2')).toBe(true);
    await core.close();
  });

  it('requires shipping destination fields when the cart needs shipping', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { name: 'NeedsShip' });
    await core.cart.addToCart('chk3', { productId: product.id });
    await expect(
      core.checkout.processCheckout('chk3', {
        billing: US_BILLING,
        shipToDifferentAddress: true,
        shipping: { country: '' },
        paymentMethod: 'cod',
      }),
    ).rejects.toThrow(/Shipping country/);
    await core.close();
  });

  it('registers the customer when an account is requested', async () => {
    const core = await createTestCore();
    await core.settings.set('enable_signup_and_login_from_checkout', true);
    const product = await seedProduct(core, { name: 'Acct' });
    await core.cart.addToCart('chk4', { productId: product.id });
    const result = await core.checkout.processCheckout('chk4', {
      billing: US_BILLING,
      paymentMethod: 'cod',
      createAccount: true,
    });
    const customer = await core.customers.findByEmail(US_BILLING.email);
    expect(customer).toBeDefined();
    // Credential binding is deferred (SECURITY_WORK S4) — row exists, no hash.
    expect(customer?.passwordHash).toBe('');
    expect(result.order.customerId).toBe(customer?.id ?? -1);
    await core.close();
  });
});
