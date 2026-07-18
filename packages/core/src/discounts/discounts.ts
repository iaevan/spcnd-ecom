import { Money, roundHalfAwayFromZero } from '@spacendigital/types';
import type { Coupon } from '../entities.js';

/**
 * Port of WC_Discounts (woocommerce_comprehensive_report.md §9). Pure integer
 * arithmetic in 4-decimal minor units — the same "cents at rounding precision"
 * space WC uses (price decimals + 2).
 */

/** A cart/order line normalized for discount math (§9.2). */
export interface DiscountableItem {
  key: string;
  productId: number;
  variationId: number | null;
  /** Parent product id when the line is a variation (product_ids may target either). */
  parentProductId: number | null;
  quantity: number;
  /** Line subtotal in minor units (unit price × qty, incl. tax per store settings). */
  priceMinor: number;
  onSale: boolean;
  categoryIds: number[];
}

/** The coupon fields the engine reads; derived from a Coupon row. */
export interface EngineCoupon {
  code: string;
  discountType: Coupon['discountType'] | (string & {});
  /** Percentage for `percent` (e.g. 10 = 10%), otherwise minor-unit amount. */
  amountPercent: number;
  amountMinor: number;
  limitUsageToXItems: number | null;
  productIds: number[];
  excludedProductIds: number[];
  productCategories: number[];
  excludedProductCategories: number[];
  excludeSaleItems: boolean;
}

export function toEngineCoupon(coupon: Coupon): EngineCoupon {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    amountPercent: Money.fromDb(coupon.amount).toNumber(),
    amountMinor: Money.fromDb(coupon.amount).minor,
    limitUsageToXItems: coupon.limitUsageToXItems,
    productIds: coupon.productIds ?? [],
    excludedProductIds: coupon.excludedProductIds ?? [],
    productCategories: coupon.productCategories ?? [],
    excludedProductCategories: coupon.excludedProductCategories ?? [],
    excludeSaleItems: coupon.excludeSaleItems,
  };
}

export const PRODUCT_COUPON_TYPES = ['fixed_product', 'percent'] as const;
export const CART_COUPON_TYPES = ['fixed_cart'] as const;

export function isProductCouponType(type: string): boolean {
  return (PRODUCT_COUPON_TYPES as readonly string[]).includes(type);
}

export function isCartCouponType(type: string): boolean {
  return (CART_COUPON_TYPES as readonly string[]).includes(type);
}

/** WC_Coupon::is_valid_for_product (§8.4). */
export function isValidForProduct(coupon: EngineCoupon, item: DiscountableItem): boolean {
  if (!isProductCouponType(coupon.discountType)) return false;
  const ids = [item.productId, item.variationId, item.parentProductId].filter(
    (v): v is number => v !== null,
  );
  let valid = false;
  if (coupon.productIds.length > 0) {
    if (ids.some((id) => coupon.productIds.includes(id))) valid = true;
  }
  if (coupon.productCategories.length > 0) {
    if (item.categoryIds.some((c) => coupon.productCategories.includes(c))) valid = true;
  }
  if (coupon.productIds.length === 0 && coupon.productCategories.length === 0) valid = true;
  if (coupon.excludedProductIds.length > 0 && ids.some((id) => coupon.excludedProductIds.includes(id))) {
    valid = false;
  }
  if (
    coupon.excludedProductCategories.length > 0 &&
    item.categoryIds.some((c) => coupon.excludedProductCategories.includes(c))
  ) {
    valid = false;
  }
  if (coupon.excludeSaleItems && item.onSale) valid = false;
  return valid;
}

export interface DiscountsOptions {
  /** `calc_discounts_sequentially` — each coupon sees already-discounted prices (§9.9). */
  sequential: boolean;
  /** Bridge for the `coupon.apply_quantity` filter (must be sync). */
  applyQuantityFilter?: (quantity: number, item: DiscountableItem, coupon: EngineCoupon) => number;
  /** Handler for custom (plugin) discount types; returns discount minor units per item. */
  customDiscount?: (
    coupon: EngineCoupon,
    item: DiscountableItem,
    discountedPriceMinor: number,
    priceToDiscountMinor: number,
  ) => number;
}

export class Discounts {
  /** Items sorted by price DESC for fair distribution (§9.2). */
  private readonly items: DiscountableItem[];
  /** coupon code → item key → discount in minor units. */
  private readonly discounts = new Map<string, Map<string, number>>();

  constructor(
    items: DiscountableItem[],
    private readonly opts: DiscountsOptions,
  ) {
    this.items = [...items].sort((a, b) => b.priceMinor - a.priceMinor);
  }

  /** Remaining price for an item after all discounts applied so far. */
  getDiscountedPrice(item: DiscountableItem): number {
    let price = item.priceMinor;
    for (const byItem of this.discounts.values()) {
      price -= byItem.get(item.key) ?? 0;
    }
    return Math.max(0, price);
  }

  /** `array[coupon_code][item_key] => minor units` (§9.1). */
  getDiscountsByCoupon(): Map<string, Map<string, number>> {
    return this.discounts;
  }

  /** Total discount per coupon code, minor units. */
  totalsByCoupon(): Map<string, number> {
    const totals = new Map<string, number>();
    for (const [code, byItem] of this.discounts) {
      let sum = 0;
      for (const v of byItem.values()) sum += v;
      totals.set(code, sum);
    }
    return totals;
  }

  /** Total discount per item key across all coupons, minor units. */
  totalsByItem(): Map<string, number> {
    const totals = new Map<string, number>();
    for (const byItem of this.discounts.values()) {
      for (const [key, v] of byItem) totals.set(key, (totals.get(key) ?? 0) + v);
    }
    return totals;
  }

  totalDiscount(): number {
    let sum = 0;
    for (const total of this.totalsByCoupon().values()) sum += total;
    return sum;
  }

  /** WC_Discounts::apply_coupon (§9.3). Validation happens before this call. */
  applyCoupon(coupon: EngineCoupon): number {
    if (!this.discounts.has(coupon.code)) this.discounts.set(coupon.code, new Map());
    const itemsToApply = this.getItemsToApply(coupon);
    switch (coupon.discountType) {
      case 'percent':
        return this.applyPercent(coupon, itemsToApply);
      case 'fixed_product':
        return this.applyFixedProduct(coupon, itemsToApply);
      case 'fixed_cart':
        return this.applyFixedCart(coupon, itemsToApply);
      default:
        return this.applyCustom(coupon, itemsToApply);
    }
  }

  /** WC get_items_to_apply: drop zero-priced lines and product-invalid lines. */
  private getItemsToApply(coupon: EngineCoupon): DiscountableItem[] {
    return this.items.filter((item) => {
      if (this.getDiscountedPrice(item) === 0 || item.priceMinor <= 0) return false;
      if (!isValidForProduct(coupon, item) && !isCartCouponType(coupon.discountType)) return false;
      return true;
    });
  }

  private addDiscount(code: string, itemKey: string, amount: number): void {
    const byItem = this.discounts.get(code) ?? new Map<string, number>();
    byItem.set(itemKey, (byItem.get(itemKey) ?? 0) + amount);
    this.discounts.set(code, byItem);
  }

  private applyQuantity(item: DiscountableItem, coupon: EngineCoupon, appliedCount: number): number {
    const limit = coupon.limitUsageToXItems;
    let quantity =
      limit !== null && limit - appliedCount < item.quantity
        ? Math.max(0, limit - appliedCount)
        : item.quantity;
    if (this.opts.applyQuantityFilter) {
      quantity = Math.max(0, this.opts.applyQuantityFilter(quantity, item, coupon));
    }
    return quantity;
  }

  /** §9.4 — per-item floor, then cart-level remainder correction. */
  private applyPercent(coupon: EngineCoupon, itemsToApply: DiscountableItem[]): number {
    let totalDiscount = 0;
    let cartTotal = 0;
    let appliedCount = 0;
    for (const item of itemsToApply) {
      const discountedPrice = this.getDiscountedPrice(item);
      let priceToDiscount = this.opts.sequential
        ? discountedPrice
        : roundHalfAwayFromZero(item.priceMinor);
      const applyQuantity = this.applyQuantity(item, coupon, appliedCount);
      priceToDiscount = (priceToDiscount / item.quantity) * applyQuantity;
      let discount = Math.floor(priceToDiscount * (coupon.amountPercent / 100));
      discount = roundHalfAwayFromZero(Math.min(discountedPrice, discount));
      cartTotal += priceToDiscount;
      totalDiscount += discount;
      appliedCount += applyQuantity;
      this.addDiscount(coupon.code, item.key, discount);
    }
    // The whole-cart discount the store owner expects; distribute the odd
    // cents lost to per-item flooring (§9.4 remainder correction).
    const cartTotalDiscount = roundHalfAwayFromZero(cartTotal * (coupon.amountPercent / 100));
    if (totalDiscount < cartTotalDiscount) {
      totalDiscount += this.applyRemainder(coupon, itemsToApply, cartTotalDiscount - totalDiscount);
    }
    return totalDiscount;
  }

  /** §9.5. `amountOverride` is used by fixed_cart's per-item pass. */
  private applyFixedProduct(
    coupon: EngineCoupon,
    itemsToApply: DiscountableItem[],
    amountOverride?: number,
  ): number {
    const amount = amountOverride ?? coupon.amountMinor;
    let totalDiscount = 0;
    let appliedCount = 0;
    for (const item of itemsToApply) {
      const discountedPrice = this.getDiscountedPrice(item);
      let discount: number;
      if (coupon.limitUsageToXItems !== null && amountOverride === undefined) {
        const applyQuantity = this.applyQuantity(item, coupon, appliedCount);
        discount = Math.min(amount, item.priceMinor / item.quantity) * applyQuantity;
        appliedCount += applyQuantity;
      } else {
        const applyQuantity = this.applyQuantity(item, coupon, appliedCount);
        discount = amount * applyQuantity;
        appliedCount += applyQuantity;
      }
      discount = roundHalfAwayFromZero(Math.min(discountedPrice, discount));
      totalDiscount += discount;
      this.addDiscount(coupon.code, item.key, discount);
    }
    return totalDiscount;
  }

  /** §9.6 — spread evenly per unit, recurse on the remainder, then cent-drip. */
  private applyFixedCart(
    coupon: EngineCoupon,
    itemsToApply: DiscountableItem[],
    amountOverride?: number,
  ): number {
    let totalDiscount = 0;
    const amount = amountOverride ?? coupon.amountMinor;
    const applicable = itemsToApply.filter((item) => this.getDiscountedPrice(item) > 0);
    const itemCount = applicable.reduce((sum, item) => sum + item.quantity, 0);
    if (itemCount === 0) return 0;
    const perItemDiscount = Math.floor(amount / itemCount);
    if (perItemDiscount > 0) {
      totalDiscount = this.applyFixedProduct(coupon, applicable, perItemDiscount);
      const remaining = amount - totalDiscount;
      if (totalDiscount > 0 && remaining > 0) {
        totalDiscount += this.applyFixedCart(coupon, applicable, remaining);
      }
    } else if (amount > 0) {
      totalDiscount = this.applyRemainder(coupon, applicable, amount);
    }
    return totalDiscount;
  }

  /** §9.7 — one minor unit at a time across items × quantities. */
  private applyRemainder(
    coupon: EngineCoupon,
    itemsToApply: DiscountableItem[],
    amount: number,
  ): number {
    let totalDiscount = 0;
    outer: for (const item of itemsToApply) {
      for (let i = 0; i < item.quantity; i++) {
        const discountedPrice = this.getDiscountedPrice(item);
        const discount = Math.min(discountedPrice, 1);
        this.addDiscount(coupon.code, item.key, discount);
        totalDiscount += discount;
        if (totalDiscount >= amount) break outer;
      }
    }
    return totalDiscount;
  }

  /** §9.8 — plugin-defined types via the customDiscount hook. */
  private applyCustom(coupon: EngineCoupon, itemsToApply: DiscountableItem[]): number {
    if (!this.opts.customDiscount) return 0;
    let totalDiscount = 0;
    let appliedCount = 0;
    for (const item of itemsToApply) {
      const discountedPrice = this.getDiscountedPrice(item);
      const priceToDiscount = this.opts.sequential
        ? discountedPrice
        : roundHalfAwayFromZero(item.priceMinor);
      const applyQuantity = this.applyQuantity(item, coupon, appliedCount);
      appliedCount += applyQuantity;
      const raw = this.opts.customDiscount(coupon, item, discountedPrice, priceToDiscount);
      const discount = roundHalfAwayFromZero(Math.min(discountedPrice, raw));
      totalDiscount += discount;
      this.addDiscount(coupon.code, item.key, discount);
    }
    return totalDiscount;
  }
}
