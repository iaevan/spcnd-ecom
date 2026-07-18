import { roundHalfAwayFromZero } from '@spacendigital/types';
import {
  type DiscountableItem,
  Discounts,
  type DiscountsOptions,
  type EngineCoupon,
} from '../discounts/discounts.js';
import type { MatchedTaxRate, TaxLocation, TaxService } from '../services/interfaces.js';

/**
 * The shared totals engine (WC_Cart_Totals; woocommerce_comprehensive_report.md
 * §11.1). Consumed by the cart for live totals and by the order service for
 * calculate_totals. All arithmetic in integer minor units; taxes accumulate
 * unrounded per rate and are rounded per line or at subtotal per settings
 * (§11.6).
 */

export interface TotalsItem {
  key: string;
  productId: number;
  variationId: number | null;
  parentProductId: number | null;
  quantity: number;
  /** Active unit price in minor units (inclusive of tax when the store enters prices that way). */
  unitPriceMinor: number;
  taxable: boolean;
  taxClass: string;
  onSale: boolean;
  categoryIds: number[];
}

export interface TotalsFee {
  id: string;
  name: string;
  /** Ex-tax amount; negative fees act as discounts and get capped (§11.7). */
  amountMinor: number;
  taxable: boolean;
  taxClass: string;
}

export interface TotalsShippingLine {
  rateId: string;
  methodId: string;
  instanceId: number;
  label: string;
  costMinor: number;
  taxable: boolean;
}

export interface TotalsConfig {
  calcTaxes: boolean;
  pricesIncludeTax: boolean;
  roundAtSubtotal: boolean;
  sequentialDiscounts: boolean;
  taxLocation: TaxLocation;
  /** 'inherit' resolves to the first line item's tax class (§11.2 step 2). */
  shippingTaxClass: string;
  /** Customer is VAT-exempt: no taxes on anything (§11.2 step 3). */
  vatExempt?: boolean;
}

export interface TotalsInput {
  items: TotalsItem[];
  coupons: EngineCoupon[];
  fees: TotalsFee[];
  shippingLines: TotalsShippingLine[];
  config: TotalsConfig;
  discountsOptions?: Pick<DiscountsOptions, 'applyQuantityFilter' | 'customDiscount'>;
}

export interface ComputedItemTotals {
  key: string;
  /** qty × unit price, before discounts, ex tax. */
  subtotalMinor: number;
  subtotalTaxMinor: number;
  /** After discounts, ex tax. */
  totalMinor: number;
  totalTaxMinor: number;
  /** Unrounded tax by rate id for the discounted line. */
  taxesByRate: Record<string, number>;
  subtotalTaxesByRate: Record<string, number>;
}

export interface ComputedFeeTotals {
  id: string;
  name: string;
  totalMinor: number;
  taxMinor: number;
  taxesByRate: Record<string, number>;
}

export interface ComputedShippingTotals {
  rateId: string;
  methodId: string;
  instanceId: number;
  label: string;
  totalMinor: number;
  taxMinor: number;
  taxesByRate: Record<string, number>;
}

export interface ComputedTotals {
  subtotalMinor: number;
  subtotalTaxMinor: number;
  discountTotalMinor: number;
  discountTaxMinor: number;
  itemsTotalMinor: number;
  itemsTaxMinor: number;
  feeTotalMinor: number;
  feeTaxMinor: number;
  shippingTotalMinor: number;
  shippingTaxMinor: number;
  cartTaxMinor: number;
  totalTaxMinor: number;
  totalMinor: number;
  items: ComputedItemTotals[];
  fees: ComputedFeeTotals[];
  shipping: ComputedShippingTotals[];
  /** Per coupon code: ex-tax discount and its tax share (order coupon lines). */
  couponTotals: Map<string, { discountMinor: number; discountTaxMinor: number }>;
  /** Cart (items + fees) taxes by rate id, rounded. */
  cartTaxesByRate: Record<string, number>;
  shippingTaxesByRate: Record<string, number>;
}

export class TotalsEngine {
  constructor(private readonly tax?: TaxService) {}

  async calculate(input: TotalsInput): Promise<ComputedTotals> {
    const { config } = input;
    const taxEnabled = config.calcTaxes && !config.vatExempt && this.tax !== undefined;

    const rateCache = new Map<string, MatchedTaxRate[]>();
    const ratesFor = async (taxClass: string, shipping = false): Promise<MatchedTaxRate[]> => {
      if (!taxEnabled || !this.tax) return [];
      const cacheKey = `${shipping ? 's' : 'c'}:${taxClass}`;
      const hit = rateCache.get(cacheKey);
      if (hit) return hit;
      const rates = shipping
        ? await this.tax.findShippingRates(config.taxLocation, taxClass)
        : await this.tax.findRates(config.taxLocation, taxClass);
      rateCache.set(cacheKey, rates);
      return rates;
    };

    // Round a per-rate tax map: per line unless round_at_subtotal (§11.6).
    const roundLine = (taxes: Map<number, number>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [rateId, amount] of taxes) {
        out[String(rateId)] = config.roundAtSubtotal ? amount : roundHalfAwayFromZero(amount);
      }
      return out;
    };
    const sumTaxes = (taxes: Record<string, number>): number => {
      let sum = 0;
      for (const v of Object.values(taxes)) sum += v;
      return config.roundAtSubtotal ? sum : roundHalfAwayFromZero(sum);
    };

    // --- 1. Item subtotals (before discounts) ------------------------------
    const discountItems: DiscountableItem[] = input.items.map((item) => ({
      key: item.key,
      productId: item.productId,
      variationId: item.variationId,
      parentProductId: item.parentProductId,
      quantity: item.quantity,
      priceMinor: item.unitPriceMinor * item.quantity,
      onSale: item.onSale,
      categoryIds: item.categoryIds,
    }));

    // --- 2. Discounts ------------------------------------------------------
    const discounts = new Discounts(discountItems, {
      sequential: config.sequentialDiscounts,
      ...input.discountsOptions,
    });
    for (const coupon of input.coupons) discounts.applyCoupon(coupon);
    const discountByItem = discounts.totalsByItem();

    // --- 3. Per-item totals + taxes ---------------------------------------
    const items: ComputedItemTotals[] = [];
    let subtotalMinor = 0;
    let subtotalTaxMinor = 0;
    let itemsTotalMinor = 0;
    let itemsTaxMinor = 0;
    const cartTaxesByRate: Record<string, number> = {};
    const itemRates = new Map<string, MatchedTaxRate[]>();

    for (const item of input.items) {
      const linePrice = item.unitPriceMinor * item.quantity;
      const discountedLine = linePrice - (discountByItem.get(item.key) ?? 0);
      const rates = item.taxable ? await ratesFor(item.taxClass) : [];
      itemRates.set(item.key, rates);

      const subtotalTaxes = this.calcTax(rates, linePrice, config.pricesIncludeTax);
      const totalTaxes = this.calcTax(rates, discountedLine, config.pricesIncludeTax);
      const subtotalTaxesByRate = roundLine(subtotalTaxes);
      const taxesByRate = roundLine(totalTaxes);
      const lineSubtotalTax = sumTaxes(subtotalTaxesByRate);
      const lineTotalTax = sumTaxes(taxesByRate);

      const lineSubtotalEx = config.pricesIncludeTax ? linePrice - lineSubtotalTax : linePrice;
      const lineTotalEx = config.pricesIncludeTax ? discountedLine - lineTotalTax : discountedLine;

      subtotalMinor += lineSubtotalEx;
      subtotalTaxMinor += lineSubtotalTax;
      itemsTotalMinor += lineTotalEx;
      itemsTaxMinor += lineTotalTax;
      for (const [rateId, amount] of Object.entries(taxesByRate)) {
        cartTaxesByRate[rateId] = (cartTaxesByRate[rateId] ?? 0) + amount;
      }
      items.push({
        key: item.key,
        subtotalMinor: lineSubtotalEx,
        subtotalTaxMinor: lineSubtotalTax,
        totalMinor: lineTotalEx,
        totalTaxMinor: lineTotalTax,
        taxesByRate,
        subtotalTaxesByRate,
      });
    }

    // --- 4. Per-coupon ex-tax discount + tax share (§11.4 step 7) ----------
    const couponTotals = new Map<string, { discountMinor: number; discountTaxMinor: number }>();
    for (const [code, byItem] of discounts.getDiscountsByCoupon()) {
      let discountMinor = 0;
      let discountTaxMinor = 0;
      for (const [itemKey, amount] of byItem) {
        if (amount === 0) continue;
        const rates = itemRates.get(itemKey) ?? [];
        const taxes = this.calcTax(rates, amount, config.pricesIncludeTax);
        let taxSum = 0;
        for (const v of taxes.values()) taxSum += v;
        taxSum = roundHalfAwayFromZero(taxSum);
        if (config.pricesIncludeTax) {
          discountMinor += amount - taxSum;
        } else {
          discountMinor += amount;
        }
        discountTaxMinor += taxSum;
      }
      couponTotals.set(code, { discountMinor, discountTaxMinor });
    }

    // --- 5. Shipping -------------------------------------------------------
    // 'inherit' means "tax shipping like the first taxable item" (§11.2).
    const inheritClass =
      input.items.find((i) => i.taxable)?.taxClass ?? '';
    const shippingTaxClass =
      config.shippingTaxClass === 'inherit' ? inheritClass : config.shippingTaxClass;
    const shipping: ComputedShippingTotals[] = [];
    let shippingTotalMinor = 0;
    let shippingTaxMinor = 0;
    const shippingTaxesByRate: Record<string, number> = {};
    for (const line of input.shippingLines) {
      const rates = line.taxable ? await ratesFor(shippingTaxClass, true) : [];
      const taxes = this.calcTax(rates, line.costMinor, false);
      const taxesByRate = roundLine(taxes);
      const taxSum = sumTaxes(taxesByRate);
      shippingTotalMinor += line.costMinor;
      shippingTaxMinor += taxSum;
      for (const [rateId, amount] of Object.entries(taxesByRate)) {
        shippingTaxesByRate[rateId] = (shippingTaxesByRate[rateId] ?? 0) + amount;
      }
      shipping.push({
        rateId: line.rateId,
        methodId: line.methodId,
        instanceId: line.instanceId,
        label: line.label,
        totalMinor: line.costMinor,
        taxMinor: taxSum,
        taxesByRate,
      });
    }

    // --- 6. Fees with negative capping (§11.7) -----------------------------
    const fees: ComputedFeeTotals[] = [];
    let feeTotalMinor = 0;
    let feeTaxMinor = 0;
    for (const fee of input.fees) {
      let amount = fee.amountMinor;
      if (amount < 0) {
        const maxDiscount = -(itemsTotalMinor + feeTotalMinor + shippingTotalMinor);
        if (amount < maxDiscount && maxDiscount < 0) amount = maxDiscount;
        if (maxDiscount >= 0) amount = 0;
      }
      const rates = fee.taxable ? await ratesFor(fee.taxClass) : [];
      const taxes = this.calcTax(rates, amount, false);
      const taxesByRate = roundLine(taxes);
      const taxSum = sumTaxes(taxesByRate);
      feeTotalMinor += amount;
      feeTaxMinor += taxSum;
      for (const [rateId, v] of Object.entries(taxesByRate)) {
        cartTaxesByRate[rateId] = (cartTaxesByRate[rateId] ?? 0) + v;
      }
      fees.push({ id: fee.id, name: fee.name, totalMinor: amount, taxMinor: taxSum, taxesByRate });
    }

    // --- 7. Aggregate + grand total (§11.5) --------------------------------
    for (const key of Object.keys(cartTaxesByRate)) {
      cartTaxesByRate[key] = roundHalfAwayFromZero(cartTaxesByRate[key] ?? 0);
    }
    for (const key of Object.keys(shippingTaxesByRate)) {
      shippingTaxesByRate[key] = roundHalfAwayFromZero(shippingTaxesByRate[key] ?? 0);
    }
    subtotalTaxMinor = roundHalfAwayFromZero(subtotalTaxMinor);
    itemsTaxMinor = roundHalfAwayFromZero(itemsTaxMinor);
    feeTaxMinor = roundHalfAwayFromZero(feeTaxMinor);
    shippingTaxMinor = roundHalfAwayFromZero(shippingTaxMinor);

    const cartTaxMinor = itemsTaxMinor + feeTaxMinor;
    const discountTotalMinor = roundHalfAwayFromZero(subtotalMinor - itemsTotalMinor);
    const discountTaxMinor = roundHalfAwayFromZero(subtotalTaxMinor - itemsTaxMinor);
    const totalMinor = Math.max(
      0,
      roundHalfAwayFromZero(
        itemsTotalMinor + feeTotalMinor + shippingTotalMinor + cartTaxMinor + shippingTaxMinor,
      ),
    );

    return {
      subtotalMinor,
      subtotalTaxMinor,
      discountTotalMinor,
      discountTaxMinor,
      itemsTotalMinor,
      itemsTaxMinor,
      feeTotalMinor,
      feeTaxMinor,
      shippingTotalMinor,
      shippingTaxMinor,
      cartTaxMinor,
      totalTaxMinor: cartTaxMinor + shippingTaxMinor,
      totalMinor,
      items,
      fees,
      shipping,
      couponTotals,
      cartTaxesByRate,
      shippingTaxesByRate,
    };
  }

  /** WC_Tax::calc_tax over minor units; returns unrounded amounts per rate. */
  private calcTax(
    rates: MatchedTaxRate[],
    priceMinor: number,
    priceIncludesTax: boolean,
  ): Map<number, number> {
    if (rates.length === 0 || priceMinor === 0) return new Map();
    if (this.tax) return this.tax.calcTax(priceMinor, rates, priceIncludesTax);
    return new Map();
  }
}
