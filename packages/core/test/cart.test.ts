import { describe, expect, it } from 'vitest';
import { createTestCore, seedProduct } from './helpers.js';

const CART = 'cart-test-session';

describe('CartService', () => {
  it('adds items, merges quantity, and validates stock', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { manageStock: true, stockQuantity: 3 });
    const key = await core.cart.addToCart(CART, { productId: product.id, quantity: 2 });
    expect(await core.cart.contentsCount(CART)).toBe(2);
    const key2 = await core.cart.addToCart(CART, { productId: product.id, quantity: 1 });
    expect(key2).toBe(key);
    expect(await core.cart.contentsCount(CART)).toBe(3);
    await expect(core.cart.addToCart(CART, { productId: product.id })).rejects.toThrow(
      /do not have enough/,
    );
    await core.close();
  });

  it('enforces sold-individually and variable-needs-variation', async () => {
    const core = await createTestCore();
    const single = await seedProduct(core, { name: 'Single', soldIndividually: true });
    await core.cart.addToCart(CART, { productId: single.id, quantity: 5 });
    expect(await core.cart.contentsCount(CART)).toBe(1);
    await expect(core.cart.addToCart(CART, { productId: single.id })).rejects.toThrow(
      /cannot add another/,
    );
    const variable = await seedProduct(core, { name: 'Var', type: 'variable', regularPrice: null });
    await expect(core.cart.addToCart(CART, { productId: variable.id })).rejects.toThrow(
      /choose product options/,
    );
    await core.close();
  });

  it('set-quantity updates, removes at zero, and restore works', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core);
    const key = await core.cart.addToCart('c2', { productId: product.id, quantity: 2 });
    await core.cart.setQuantity('c2', key, 4);
    expect(await core.cart.contentsCount('c2')).toBe(4);
    await core.cart.setQuantity('c2', key, 0);
    expect(await core.cart.isEmpty('c2')).toBe(true);
    expect(await core.cart.restoreItem('c2', key)).toBe(true);
    expect(await core.cart.contentsCount('c2')).toBe(4);
    await core.close();
  });

  it('applies coupons through the validation pipeline and calculates totals', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { regularPrice: '25.0000' });
    await core.cart.addToCart('c3', { productId: product.id, quantity: 2 });
    await core.coupons.create({ code: 'TEN', discountType: 'percent', amount: '10.0000' });
    await core.cart.applyCoupon('c3', 'ten');
    await expect(core.cart.applyCoupon('c3', 'TEN')).rejects.toThrow(/already applied/i);

    const calculated = await core.cart.calculate('c3');
    expect(calculated.totals.subtotalMinor).toBe(500000);
    expect(calculated.totals.discountTotalMinor).toBe(50000);
    expect(calculated.totals.totalMinor).toBe(450000);
    expect(calculated.coupons.map((c) => c.code)).toEqual(['ten']);
    await core.close();
  });

  it('individual-use coupons evict/block others', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { name: 'P4' });
    await core.cart.addToCart('c4', { productId: product.id });
    await core.coupons.create({ code: 'solo', discountType: 'percent', amount: '5.0000', individualUse: true });
    await core.coupons.create({ code: 'other', discountType: 'percent', amount: '5.0000' });
    await core.cart.applyCoupon('c4', 'solo');
    await expect(core.cart.applyCoupon('c4', 'other')).rejects.toThrow(/not applicable/);
    await core.close();
  });

  it('drops coupons that stop validating and reports them', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { name: 'P5' });
    await core.cart.addToCart('c5', { productId: product.id });
    const coupon = await core.coupons.create({
      code: 'fleeting',
      discountType: 'percent',
      amount: '5.0000',
    });
    await core.cart.applyCoupon('c5', 'fleeting');
    await core.coupons.update(coupon.id, {
      dateExpires: new Date(Date.now() - 1000).toISOString(),
    });
    const calculated = await core.cart.calculate('c5');
    expect(calculated.removedCoupons).toEqual(['fleeting']);
    expect(calculated.coupons).toEqual([]);
    await core.close();
  });

  it('cart hash tracks content changes', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { name: 'P6' });
    const key = await core.cart.addToCart('c6', { productId: product.id });
    const first = await core.cart.calculate('c6');
    await core.cart.setQuantity('c6', key, 3);
    const second = await core.cart.calculate('c6');
    expect(first.cartHash).not.toBe(second.cartHash);
    await core.close();
  });
});
