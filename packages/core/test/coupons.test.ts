import { describe, expect, it } from 'vitest';
import { COUPON_ERROR_CODES, CouponError } from '../src/errors.js';
import type { CouponValidationContext } from '../src/coupons/coupon-service.js';
import { createTestCore } from './helpers.js';

const ctx = (over: Partial<CouponValidationContext> = {}): CouponValidationContext => ({
  items: [
    {
      key: 'a',
      productId: 1,
      variationId: null,
      parentProductId: null,
      quantity: 1,
      priceMinor: 100000,
      onSale: false,
      categoryIds: [],
    },
  ],
  subtotalMinor: 100000,
  customerId: null,
  customerEmails: [],
  ...over,
});

async function code(fn: () => Promise<unknown>): Promise<number | undefined> {
  try {
    await fn();
    return undefined;
  } catch (error) {
    return error instanceof CouponError ? error.couponCode : undefined;
  }
}

describe('CouponService validation pipeline (§9.10 order)', () => {
  it('walks the documented error codes', async () => {
    const core = await createTestCore();
    expect(await code(() => core.coupons.validate(undefined, ctx()))).toBe(
      COUPON_ERROR_CODES.NOT_EXIST,
    );

    const expired = await core.coupons.create({
      code: 'expired',
      amount: '5.0000',
      dateExpires: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await code(() => core.coupons.validate(expired, ctx()))).toBe(
      COUPON_ERROR_CODES.EXPIRED,
    );

    const minSpend = await core.coupons.create({
      code: 'min',
      amount: '5.0000',
      minimumAmount: '50.0000',
    });
    expect(
      await code(() => core.coupons.validate(minSpend, ctx({ subtotalMinor: 100000 }))),
    ).toBe(COUPON_ERROR_CODES.MIN_SPEND_LIMIT_NOT_MET);

    const maxSpend = await core.coupons.create({
      code: 'max',
      amount: '5.0000',
      maximumAmount: '5.0000',
    });
    expect(await code(() => core.coupons.validate(maxSpend, ctx()))).toBe(
      COUPON_ERROR_CODES.MAX_SPEND_LIMIT_MET,
    );

    const restricted = await core.coupons.create({
      code: 'productonly',
      amount: '5.0000',
      discountType: 'percent',
      productIds: [999],
    });
    expect(await code(() => core.coupons.validate(restricted, ctx()))).toBe(
      COUPON_ERROR_CODES.NOT_APPLICABLE,
    );

    const emailBound = await core.coupons.create({
      code: 'vip',
      amount: '5.0000',
      emailRestrictions: ['*@corp.com'],
    });
    expect(
      await code(() =>
        core.coupons.validate(emailBound, ctx({ customerEmails: ['someone@else.io'] })),
      ),
    ).toBe(COUPON_ERROR_CODES.NOT_YOURS_REMOVED);
    await expect(
      core.coupons.validate(emailBound, ctx({ customerEmails: ['jane@corp.com'] })),
    ).resolves.toBe(true);

    const saleExcluded = await core.coupons.create({
      code: 'nosale',
      amount: '5.0000',
      discountType: 'fixed_cart',
      excludeSaleItems: true,
    });
    const allOnSale = ctx();
    allOnSale.items = allOnSale.items.map((i) => ({ ...i, onSale: true }));
    expect(await code(() => core.coupons.validate(saleExcluded, allOnSale))).toBe(
      COUPON_ERROR_CODES.NOT_VALID_SALE_ITEMS,
    );
    await core.close();
  });

  it('enforces usage limits including tentative holds (115/116)', async () => {
    const core = await createTestCore();
    const limited = await core.coupons.create({ code: 'once', amount: '5.0000', usageLimit: 1 });
    await expect(core.coupons.validate(limited, ctx())).resolves.toBe(true);

    // A hold from an in-flight checkout occupies the last slot.
    const hold = await core.coupons.holdUsage(limited.id);
    expect(await code(() => core.coupons.validate(limited, ctx()))).toBe(
      COUPON_ERROR_CODES.USAGE_LIMIT_COUPON_STUCK_GUEST,
    );
    expect(await code(() => core.coupons.validate(limited, ctx({ customerId: 7 })))).toBe(
      COUPON_ERROR_CODES.USAGE_LIMIT_COUPON_STUCK,
    );
    await core.coupons.releaseHold(hold);
    await expect(core.coupons.validate(limited, ctx())).resolves.toBe(true);
    await core.close();
  });

  it('tracks real usage per user and reverses it', async () => {
    const core = await createTestCore();
    const coupon = await core.coupons.create({
      code: 'peruser',
      amount: '5.0000',
      usageLimitPerUser: 1,
    });
    const order = await core.orders.create({ billing: { email: 'u@e.co' } });
    await core.coupons.increaseUsage(core.db, coupon, { email: 'u@e.co' }, order.id, '5.0000');
    expect((await core.coupons.get(coupon.id)).usageCount).toBe(1);
    const refreshed = await core.coupons.get(coupon.id);
    expect(
      await code(() => core.coupons.validate(refreshed, ctx({ customerEmails: ['u@e.co'] }))),
    ).toBe(COUPON_ERROR_CODES.USAGE_LIMIT_REACHED);
    await core.coupons.decreaseUsage(core.db, coupon.id, order.id);
    expect((await core.coupons.get(coupon.id)).usageCount).toBe(0);
    await core.close();
  });
});
