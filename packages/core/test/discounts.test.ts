import { describe, expect, it } from 'vitest';
import { type DiscountableItem, Discounts, type EngineCoupon } from '../src/discounts/discounts.js';

function item(key: string, priceMinor: number, quantity = 1): DiscountableItem {
  return {
    key,
    productId: 1,
    variationId: null,
    parentProductId: null,
    quantity,
    priceMinor,
    onSale: false,
    categoryIds: [],
  };
}

function coupon(over: Partial<EngineCoupon>): EngineCoupon {
  return {
    code: 'c',
    discountType: 'percent',
    amountPercent: 10,
    amountMinor: 100000,
    limitUsageToXItems: null,
    productIds: [],
    excludedProductIds: [],
    productCategories: [],
    excludedProductCategories: [],
    excludeSaleItems: false,
    ...over,
  };
}

describe('Discounts (WC_Discounts port)', () => {
  it('percent: floors per item and corrects the remainder at cart level', async () => {
    // 3 × 0.33 at 33.33%: per-item floor loses 3 minor units; the cart-level
    // rounding wants 3300, so the remainder pass adds them back.
    const items = [item('a', 3300), item('b', 3300), item('c', 3300)];
    const discounts = new Discounts(items, { sequential: false });
    const total = discounts.applyCoupon(coupon({ amountPercent: 33.33 }));
    expect(total).toBe(3300);
    const byItem = discounts.totalsByItem();
    expect([...byItem.values()].reduce((a, b) => a + b, 0)).toBe(3300);
    await Promise.resolve();
  });

  it('fixed_cart: spreads per unit and drips the remainder one minor unit at a time', () => {
    // 10.00 across 3 units of 5.00 → 33333/unit + 1-minor-unit remainder.
    const items = [item('a', 150000, 3)];
    const discounts = new Discounts(items, { sequential: false });
    const total = discounts.applyCoupon(
      coupon({ discountType: 'fixed_cart', amountMinor: 100000 }),
    );
    expect(total).toBe(100000);
  });

  it('fixed_cart: never discounts more than the items are worth', () => {
    const items = [item('a', 30000, 1)];
    const discounts = new Discounts(items, { sequential: false });
    const total = discounts.applyCoupon(
      coupon({ discountType: 'fixed_cart', amountMinor: 100000 }),
    );
    expect(total).toBe(30000);
  });

  it('fixed_product: caps at line price and honors limit_usage_to_x_items', () => {
    const items = [item('a', 30000, 1), item('b', 200000, 2)];
    const discounts = new Discounts(items, { sequential: false });
    // 5.00 per item; item a is worth only 3.00.
    const total = discounts.applyCoupon(
      coupon({ discountType: 'fixed_product', amountMinor: 50000 }),
    );
    expect(discounts.getDiscountsByCoupon().get('c')?.get('a')).toBe(30000);
    expect(discounts.getDiscountsByCoupon().get('c')?.get('b')).toBe(100000);
    expect(total).toBe(130000);

    const limited = new Discounts([item('b', 200000, 2)], { sequential: false });
    const limitedTotal = limited.applyCoupon(
      coupon({ discountType: 'fixed_product', amountMinor: 50000, limitUsageToXItems: 1 }),
    );
    expect(limitedTotal).toBe(50000);
  });

  it('sequential vs parallel: second coupon sees discounted vs original price', () => {
    const parallel = new Discounts([item('a', 100000)], { sequential: false });
    parallel.applyCoupon(coupon({ code: 'p1', amountPercent: 50 }));
    parallel.applyCoupon(coupon({ code: 'p2', amountPercent: 50 }));
    expect(parallel.totalDiscount()).toBe(100000);

    const sequential = new Discounts([item('a', 100000)], { sequential: true });
    sequential.applyCoupon(coupon({ code: 's1', amountPercent: 50 }));
    sequential.applyCoupon(coupon({ code: 's2', amountPercent: 50 }));
    expect(sequential.totalDiscount()).toBe(75000);
  });

  it('respects product restrictions and sale-item exclusion per item', () => {
    const saleItem = { ...item('sale', 50000), onSale: true };
    const normal = item('norm', 50000);
    const discounts = new Discounts([saleItem, normal], { sequential: false });
    const total = discounts.applyCoupon(coupon({ amountPercent: 10, excludeSaleItems: true }));
    expect(discounts.getDiscountsByCoupon().get('c')?.has('sale')).toBe(false);
    expect(total).toBe(5000);
  });
});
