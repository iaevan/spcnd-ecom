import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import { type Address, Money } from '@spacendigital/types';
import type { ProductService } from '../catalog/product-service.js';
import type { CouponService } from '../coupons/coupon-service.js';
import { type EngineCoupon, toEngineCoupon } from '../discounts/discounts.js';
import type { Coupon, Product, ProductVariation } from '../entities.js';
import { COUPON_ERROR_CODES, CouponError, SpcndError, StockError } from '../errors.js';
import {
  cartAfterCalculateTotals,
  cartBeforeCalculateTotals,
  cartBeforeEmptied,
  cartCalculateFees,
  cartCheckItems,
  cartCouponApplied,
  cartCouponRemoved,
  cartEmptied,
  cartItemAdded,
  cartItemQuantityUpdated,
  cartItemRemove,
  cartItemRemoved,
  cartItemRestore,
  cartItemRestored,
  cartItemSetQuantity,
  filterAddCartItem,
  filterAddCartItemData,
  filterAddToCartQuantity,
  filterCartContentsCount,
  filterCartCrosssellIds,
  filterCartId,
  filterCartNeedsPayment,
  filterCartNeedsShipping,
  filterProductIsSoldIndividually,
} from '../events.js';
import type {
  SessionStore,
  ShippingService,
  TaxLocation,
  TaxService,
} from '../services/interfaces.js';
import type { SettingsService } from '../settings/service.js';
import { nowIso, stableHash } from '../utils.js';
import {
  type ComputedTotals,
  type TotalsFee,
  type TotalsItem,
  type TotalsShippingLine,
  TotalsEngine,
} from './totals.js';

/** One cart line as persisted in the session. */
export interface CartLine {
  key: string;
  productId: number;
  variationId: number | null;
  variation: Record<string, string>;
  quantity: number;
  cartItemData: Record<string, unknown>;
}

/** The session-persisted cart state. */
export interface CartState {
  items: CartLine[];
  removed: CartLine[];
  coupons: string[];
  /** Chosen shipping rate id (single package in v1). */
  chosenShippingRate: string | null;
}

const EMPTY_STATE: CartState = { items: [], removed: [], coupons: [], chosenShippingRate: null };

export interface AddToCartInput {
  productId: number;
  quantity?: number;
  variationId?: number;
  variation?: Record<string, string>;
  cartItemData?: Record<string, unknown>;
}

export interface CalculateOptions {
  /** Shipping destination; without one shipping is skipped (cost_requires_address). */
  destination?: Address;
  /** Tax location override (checkout resolves billing/shipping/base). */
  taxLocation?: TaxLocation;
  vatExempt?: boolean;
}

export interface CalculatedLine extends CartLine {
  product: Product;
  variationRow: ProductVariation | null;
  unitPriceMinor: number;
  subtotalMinor: number;
  subtotalTaxMinor: number;
  totalMinor: number;
  totalTaxMinor: number;
  taxesByRate: Record<string, number>;
  subtotalTaxesByRate: Record<string, number>;
}

export interface CalculatedCart {
  cartId: string;
  state: CartState;
  lines: CalculatedLine[];
  coupons: Coupon[];
  totals: ComputedTotals;
  /** Codes removed during calculation because they no longer validate. */
  removedCoupons: string[];
  /** Lines dropped because the product vanished or became unpurchasable. */
  removedLineNotices: string[];
  cartHash: string;
  needsShipping: boolean;
  needsPayment: boolean;
}

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
  settings: SettingsService;
  sessions: SessionStore;
  products: ProductService;
  coupons: CouponService;
  tax?: TaxService;
  shipping?: ShippingService;
}

/**
 * Session-backed cart (WC_Cart; core-architecture report §6). The cart id is
 * the session key.
 *
 * Session cookie shape at the HTTP layer is the placeholder
 * `{customer_id}|{expiration}|{expiring}|{TODO_integrity_tag}` —
 * TODO:security-blocked — SECURITY_WORK item S2 supplies the integrity-tag
 * computation and the DB-backed store; core only ever sees the session key.
 */
export class CartService {
  constructor(private readonly deps: Deps) {}

  // --- Session state -------------------------------------------------------

  async getState(cartId: string): Promise<CartState> {
    const raw = await this.deps.sessions.get(cartId);
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Partial<CartState>).items)) {
      return structuredClone(EMPTY_STATE);
    }
    const state = raw as unknown as CartState;
    return {
      items: state.items ?? [],
      removed: state.removed ?? [],
      coupons: state.coupons ?? [],
      chosenShippingRate: state.chosenShippingRate ?? null,
    };
  }

  private async saveState(cartId: string, state: CartState): Promise<void> {
    const expiry = await this.deps.settings.getInt('session_expiration_seconds');
    await this.deps.sessions.set(
      cartId,
      state as unknown as Record<string, unknown>,
      expiry > 0 ? expiry : 60 * 60 * 48,
    );
  }

  async isEmpty(cartId: string): Promise<boolean> {
    return (await this.getState(cartId)).items.length === 0;
  }

  async contentsCount(cartId: string): Promise<number> {
    const state = await this.getState(cartId);
    const count = state.items.reduce((sum, line) => sum + line.quantity, 0);
    return this.deps.bus.applyFilters(filterCartContentsCount, count, undefined);
  }

  async emptyCart(cartId: string): Promise<void> {
    const { bus, sessions } = this.deps;
    await bus.emit(cartBeforeEmptied, { cartId });
    await sessions.destroy(cartId);
    await bus.emit(cartEmptied, { cartId });
  }

  // --- Item operations (§6 add_to_cart algorithm) --------------------------

  async addToCart(cartId: string, input: AddToCartInput): Promise<string> {
    const { bus, products } = this.deps;
    const quantity = await bus.applyFilters(
      filterAddToCartQuantity,
      input.quantity ?? 1,
      input.productId,
    );
    if (quantity <= 0) throw new SpcndError('Quantity must be positive', 'cart_invalid_quantity');

    const product = await products.find(input.productId);
    if (!product || product.status === 'trash') {
      throw new SpcndError('Sorry, this product cannot be purchased.', 'cart_invalid_product');
    }
    let variationRow: ProductVariation | null = null;
    let variation = input.variation ?? {};
    if (product.type === 'variable') {
      if (!input.variationId) {
        throw new SpcndError('Please choose product options.', 'cart_missing_variation');
      }
      variationRow = await products.getVariation(input.variationId);
      if (variationRow.productId !== product.id || !variationRow.enabled) {
        throw new SpcndError('Sorry, this product cannot be purchased.', 'cart_invalid_variation');
      }
      variation = this.mergeVariationAttributes(variationRow, variation);
    } else if (input.variationId) {
      variationRow = await products.getVariation(input.variationId);
      if (variationRow.productId !== product.id) {
        throw new SpcndError('Sorry, this product cannot be purchased.', 'cart_invalid_variation');
      }
    }

    const cartItemData = await bus.applyFilters(
      filterAddCartItemData,
      input.cartItemData ?? {},
      product.id,
      quantity,
      variationRow?.id ?? null,
    );
    const key = await bus.applyFilters(
      filterCartId,
      this.itemKey(product.id, variationRow?.id ?? null, variation, cartItemData),
      product.id,
      variationRow?.id ?? null,
      variation,
      cartItemData,
    );

    const state = await this.getState(cartId);
    const existing = state.items.find((line) => line.key === key);

    const soldIndividually = await bus.applyFilters(
      filterProductIsSoldIndividually,
      product.soldIndividually,
      product,
    );
    let addQuantity = quantity;
    if (soldIndividually) {
      addQuantity = 1;
      if (existing || state.items.some((line) => line.productId === product.id)) {
        throw new SpcndError(
          `You cannot add another "${product.name}" to your cart.`,
          'cart_sold_individually',
        );
      }
    }

    if (!(await products.isPurchasable(product))) {
      throw new SpcndError('Sorry, this product cannot be purchased.', 'cart_not_purchasable');
    }
    await this.assertStock(
      product,
      variationRow,
      addQuantity + (existing?.quantity ?? 0),
      state,
      existing?.key,
    );

    if (existing) {
      existing.quantity += addQuantity;
    } else {
      const line: CartLine = {
        key,
        productId: product.id,
        variationId: variationRow?.id ?? null,
        variation,
        quantity: addQuantity,
        cartItemData,
      };
      const filtered = await bus.applyFilters(
        filterAddCartItem,
        line as unknown as Record<string, unknown>,
        key,
      );
      state.items.push(filtered as unknown as CartLine);
    }
    await this.saveState(cartId, state);
    await bus.emit(cartItemAdded, {
      cartId,
      key,
      productId: product.id,
      variationId: variationRow?.id ?? null,
      quantity: addQuantity,
      variation,
      cartItemData,
    });
    return key;
  }

  async removeItem(cartId: string, key: string): Promise<void> {
    const { bus } = this.deps;
    const state = await this.getState(cartId);
    const idx = state.items.findIndex((line) => line.key === key);
    if (idx < 0) return;
    await bus.emit(cartItemRemove, { key, cartId });
    const [line] = state.items.splice(idx, 1);
    if (line) state.removed = [line, ...state.removed.filter((l) => l.key !== key)].slice(0, 10);
    await this.saveState(cartId, state);
    await bus.emit(cartItemRemoved, { key, cartId });
  }

  async restoreItem(cartId: string, key: string): Promise<boolean> {
    const { bus, products } = this.deps;
    const state = await this.getState(cartId);
    const idx = state.removed.findIndex((line) => line.key === key);
    if (idx < 0) return false;
    await bus.emit(cartItemRestore, { key, cartId });
    const [line] = state.removed.splice(idx, 1);
    if (!line) return false;
    const product = await products.find(line.productId);
    if (!product || product.status === 'trash') return false;
    state.items.push(line);
    await this.saveState(cartId, state);
    await bus.emit(cartItemRestored, { key, cartId });
    return true;
  }

  async setQuantity(cartId: string, key: string, quantity: number): Promise<void> {
    const { bus, products } = this.deps;
    if (quantity <= 0) {
      await this.removeItem(cartId, key);
      return;
    }
    const state = await this.getState(cartId);
    const line = state.items.find((l) => l.key === key);
    if (!line) throw new SpcndError('Cart item not found', 'cart_item_not_found');
    const product = await products.get(line.productId);
    const variationRow = line.variationId ? await products.getVariation(line.variationId) : null;
    if (product.soldIndividually && quantity > 1) quantity = 1;
    await this.assertStock(product, variationRow, quantity, state, key);
    line.quantity = quantity;
    await this.saveState(cartId, state);
    await bus.emit(cartItemSetQuantity, { key, quantity, cartId });
    await bus.emit(cartItemQuantityUpdated, { key, quantity, cartId });
  }

  async setChosenShippingRate(cartId: string, rateId: string | null): Promise<void> {
    const state = await this.getState(cartId);
    state.chosenShippingRate = rateId;
    await this.saveState(cartId, state);
  }

  // --- Coupons -------------------------------------------------------------

  async applyCoupon(cartId: string, code: string): Promise<void> {
    const { bus, settings, coupons } = this.deps;
    if (!(await settings.getBool('enable_coupons'))) {
      throw new SpcndError('Coupons are disabled.', 'coupons_disabled');
    }
    const formatted = code.trim().toLowerCase();
    if (!formatted) {
      throw new CouponError('Please enter a coupon code.', COUPON_ERROR_CODES.PLEASE_ENTER);
    }
    const state = await this.getState(cartId);
    if (state.coupons.includes(formatted)) {
      throw new CouponError(
        'Coupon code already applied!',
        COUPON_ERROR_CODES.ALREADY_APPLIED,
      );
    }
    const coupon = await coupons.findByCode(formatted);
    // Individual-use interplay (WC apply_coupon): an applied individual-use
    // coupon blocks new ones; a new individual-use coupon evicts the rest.
    const applied = await this.loadCoupons(state.coupons);
    if (applied.some((c) => c.individualUse)) {
      throw new CouponError(
        'Sorry, this coupon is not applicable to your cart contents.',
        COUPON_ERROR_CODES.ALREADY_APPLIED_INDIV_USE_ONLY,
      );
    }
    const ctx = await this.validationContext(cartId, state);
    await coupons.validate(coupon, ctx);
    if (coupon?.individualUse) state.coupons = [];
    state.coupons.push(formatted);
    await this.saveState(cartId, state);
    await bus.emit(cartCouponApplied, { code: formatted, cartId });
  }

  async removeCoupon(cartId: string, code: string): Promise<void> {
    const { bus } = this.deps;
    const formatted = code.trim().toLowerCase();
    const state = await this.getState(cartId);
    if (!state.coupons.includes(formatted)) return;
    state.coupons = state.coupons.filter((c) => c !== formatted);
    await this.saveState(cartId, state);
    await bus.emit(cartCouponRemoved, { code: formatted, cartId });
  }

  // --- Calculation ---------------------------------------------------------

  async calculate(
    cartId: string,
    opts: CalculateOptions = {},
    customer?: { id?: number | null; emails?: string[] },
  ): Promise<CalculatedCart> {
    const { bus, settings, coupons } = this.deps;
    await bus.emit(cartBeforeCalculateTotals, { cartId });
    await bus.emit(cartCheckItems, { cartId });

    const state = await this.getState(cartId);
    const { lines, removedLineNotices, changed } = await this.checkItems(state);
    if (changed) await this.saveState(cartId, state);

    // Re-validate applied coupons; silently drop the ones that stopped being
    // valid, reporting them in the result (WC check_cart_coupons, code 101).
    const validCoupons: Coupon[] = [];
    const removedCoupons: string[] = [];
    if (state.coupons.length > 0) {
      const ctx = await this.contextFromLines(lines, state, customer);
      for (const code of state.coupons) {
        const coupon = await coupons.findByCode(code);
        try {
          await coupons.validate(coupon, ctx);
          if (coupon) validCoupons.push(coupon);
        } catch {
          removedCoupons.push(code);
        }
      }
      if (removedCoupons.length > 0) {
        state.coupons = state.coupons.filter((c) => !removedCoupons.includes(c));
        await this.saveState(cartId, state);
        for (const code of removedCoupons) await bus.emit(cartCouponRemoved, { code, cartId });
      }
    }

    // Fees collected from plugins (woocommerce_cart_calculate_fees).
    const fees: TotalsFee[] = [];
    let feeSeq = 0;
    await bus.emit(cartCalculateFees, {
      cartId,
      fees: {
        addFee: (fee) => {
          fees.push({
            id: `fee-${++feeSeq}`,
            name: fee.name,
            amountMinor: Math.trunc(fee.amountMinor),
            taxable: fee.taxable ?? false,
            taxClass: fee.taxClass ?? '',
          });
        },
      },
    });

    const totalsItems = lines.map((line) => this.toTotalsItem(line));
    const needsShipping = await bus.applyFilters(
      filterCartNeedsShipping,
      lines.some((line) => !(line.variationRow?.virtual ?? line.product.virtual)),
      undefined,
    );

    // Shipping quotes for the single v1 package.
    const shippingLines: TotalsShippingLine[] = [];
    const { shipping } = this.deps;
    if (needsShipping && shipping && opts.destination?.country) {
      const freeShippingCoupon = validCoupons.some((c) => c.freeShipping);
      const quotes = await shipping.getRatesForPackage({
        items: lines.map((line) => ({
          productId: line.productId,
          variationId: line.variationId,
          quantity: line.quantity,
          lineTotalMinor: line.unitPriceMinor * line.quantity,
          weight: line.variationRow?.weight ?? line.product.weight,
          shippingClassId: line.variationRow?.shippingClassId ?? line.product.shippingClassId,
          needsShipping: !(line.variationRow?.virtual ?? line.product.virtual),
        })),
        destination: opts.destination,
        cartSubtotalMinor: totalsItems.reduce((sum, i) => sum + i.unitPriceMinor * i.quantity, 0),
        hasCouponFreeShipping: freeShippingCoupon,
      });
      const chosen =
        quotes.find((q) => q.rateId === state.chosenShippingRate) ?? quotes[0];
      if (chosen) {
        shippingLines.push({
          rateId: chosen.rateId,
          methodId: chosen.methodId,
          instanceId: chosen.instanceId,
          label: chosen.label,
          costMinor: chosen.costMinor,
          taxable: chosen.taxable,
        });
      }
    }

    const config = {
      calcTaxes: await settings.getBool('calc_taxes'),
      pricesIncludeTax: await settings.getBool('prices_include_tax'),
      roundAtSubtotal: await settings.getBool('tax_round_at_subtotal'),
      sequentialDiscounts: await settings.getBool('calc_discounts_sequentially'),
      taxLocation: opts.taxLocation ?? (await settings.baseLocation()),
      shippingTaxClass: await settings.getString('shipping_tax_class'),
      vatExempt: opts.vatExempt ?? false,
    };

    const engine = new TotalsEngine(this.deps.tax);
    const totals = await engine.calculate({
      items: totalsItems,
      coupons: validCoupons.map(toEngineCoupon),
      fees,
      shippingLines,
      config,
    });

    const byKey = new Map(totals.items.map((item) => [item.key, item]));
    const calculatedLines: CalculatedLine[] = lines.map((line) => {
      const computed = byKey.get(line.key);
      return {
        ...line,
        subtotalMinor: computed?.subtotalMinor ?? 0,
        subtotalTaxMinor: computed?.subtotalTaxMinor ?? 0,
        totalMinor: computed?.totalMinor ?? 0,
        totalTaxMinor: computed?.totalTaxMinor ?? 0,
        taxesByRate: computed?.taxesByRate ?? {},
        subtotalTaxesByRate: computed?.subtotalTaxesByRate ?? {},
      };
    });

    const needsPayment = await bus.applyFilters(filterCartNeedsPayment, totals.totalMinor > 0, undefined);
    const result: CalculatedCart = {
      cartId,
      state,
      lines: calculatedLines,
      coupons: validCoupons,
      totals,
      removedCoupons,
      removedLineNotices,
      cartHash: this.cartHash(state, totals.totalMinor),
      needsShipping,
      needsPayment,
    };
    await bus.emit(cartAfterCalculateTotals, { cartId });
    return result;
  }

  /** WC get_cart_hash: hash of contents + total, used for order resume. */
  cartHash(state: CartState, totalMinor: number): string {
    const contents = state.items.map((l) => [l.key, l.quantity]);
    return stableHash(`${JSON.stringify(contents)}:${totalMinor}`);
  }

  /** Cross-sell ids from cart items, minus products already in the cart. */
  async getCrossSells(cartId: string): Promise<number[]> {
    const { bus, products } = this.deps;
    const state = await this.getState(cartId);
    const inCart = new Set(state.items.map((l) => l.productId));
    const ids = new Set<number>();
    for (const line of state.items) {
      for (const id of await products.getCrosssellIds(line.productId)) {
        if (!inCart.has(id)) ids.add(id);
      }
    }
    return bus.applyFilters(filterCartCrosssellIds, [...ids], undefined);
  }

  // --- Internals -----------------------------------------------------------

  private itemKey(
    productId: number,
    variationId: number | null,
    variation: Record<string, string>,
    cartItemData: Record<string, unknown>,
  ): string {
    return stableHash(
      `${productId}:${variationId ?? 0}:${JSON.stringify(variation)}:${JSON.stringify(cartItemData)}`,
    );
  }

  /** Posted attributes must match the variation; empty stored value = "any". */
  private mergeVariationAttributes(
    variationRow: ProductVariation,
    posted: Record<string, string>,
  ): Record<string, string> {
    const merged: Record<string, string> = {};
    for (const [name, stored] of Object.entries(variationRow.attributes ?? {})) {
      if (stored) {
        merged[name] = stored;
        continue;
      }
      const value = posted[name];
      if (value === undefined || value === '') {
        throw new SpcndError(`Please choose a value for "${name}".`, 'cart_invalid_attribute');
      }
      merged[name] = value;
    }
    return merged;
  }

  /**
   * WC check_cart_item_stock: the stock-managing entity must cover the
   * requested quantity plus everything already in the cart for it.
   */
  private async assertStock(
    product: Product,
    variationRow: ProductVariation | null,
    requestedTotal: number,
    state: CartState,
    excludeKey?: string,
  ): Promise<void> {
    const stockStatus = variationRow?.stockStatus ?? product.stockStatus;
    if (stockStatus === 'outofstock') {
      throw new StockError(`Sorry, "${product.name}" is out of stock.`);
    }
    const managesOwn = variationRow ? variationRow.manageStock === 'yes' : product.manageStock;
    const parentManages = variationRow?.manageStock === 'parent' && product.manageStock;
    if (!managesOwn && !parentManages) return;
    const backorders = variationRow?.backorders ?? product.backorders;
    if (backorders === 'yes' || backorders === 'notify') return;
    const stock = managesOwn && variationRow ? variationRow.stockQuantity : product.stockQuantity;
    if (stock === null) return;

    // Everything already in the cart drawing on the same managed stock pool
    // (WC get_cart_item_quantities merges by stock_managed_by_id).
    let inCartForEntity = 0;
    if (managesOwn && variationRow) {
      for (const line of state.items) {
        if (line.key === excludeKey) continue;
        if (line.variationId === variationRow.id) inCartForEntity += line.quantity;
      }
    } else {
      for (const line of state.items) {
        if (line.key === excludeKey || line.productId !== product.id) continue;
        if (line.variationId && line.variationId !== variationRow?.id) {
          const other = await this.deps.products.getVariation(line.variationId).catch(() => null);
          if (other?.manageStock === 'yes') continue;
        }
        inCartForEntity += line.quantity;
      }
    }
    if (requestedTotal + inCartForEntity > stock) {
      throw new StockError(
        `Sorry, we do not have enough "${product.name}" in stock (${stock} available).`,
      );
    }
  }

  /** Drop lines whose product vanished/trashed; returns live joined lines. */
  private async checkItems(state: CartState): Promise<{
    lines: (CartLine & {
      product: Product;
      variationRow: ProductVariation | null;
      unitPriceMinor: number;
      onSale: boolean;
      categoryIds: number[];
    })[];
    removedLineNotices: string[];
    changed: boolean;
  }> {
    const { products } = this.deps;
    const lines = [];
    const removedLineNotices: string[] = [];
    let changed = false;
    const keep: CartLine[] = [];
    const categoryMap = await products.getCategoryIdMap(state.items.map((l) => l.productId));
    for (const line of state.items) {
      const product = await products.find(line.productId);
      if (!product || product.status === 'trash') {
        removedLineNotices.push(`An item is no longer available and was removed from your cart.`);
        changed = true;
        continue;
      }
      const variationRow = line.variationId
        ? await products.getVariation(line.variationId).catch(() => null)
        : null;
      if (line.variationId && !variationRow) {
        removedLineNotices.push(
          `"${product.name}" is no longer available and was removed from your cart.`,
        );
        changed = true;
        continue;
      }
      const source = variationRow ?? product;
      const { price, onSale } = products.resolveActivePrice(source);
      keep.push(line);
      lines.push({
        ...line,
        product,
        variationRow,
        unitPriceMinor: Money.fromDb(price).minor,
        onSale,
        categoryIds: categoryMap.get(product.id) ?? [],
      });
    }
    state.items = keep;
    return { lines, removedLineNotices, changed };
  }

  private toTotalsItem(line: {
    key: string;
    productId: number;
    variationId: number | null;
    quantity: number;
    product: Product;
    variationRow: ProductVariation | null;
    unitPriceMinor: number;
    onSale: boolean;
    categoryIds: number[];
  }): TotalsItem {
    const taxStatus = line.variationRow?.taxStatus ?? line.product.taxStatus;
    return {
      key: line.key,
      productId: line.productId,
      variationId: line.variationId,
      parentProductId: line.variationRow ? line.product.id : null,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      taxable: taxStatus === 'taxable',
      taxClass: line.variationRow?.taxClass || line.product.taxClass,
      onSale: line.onSale,
      categoryIds: line.categoryIds,
    };
  }

  private async loadCoupons(codes: string[]): Promise<Coupon[]> {
    const out: Coupon[] = [];
    for (const code of codes) {
      const coupon = await this.deps.coupons.findByCode(code);
      if (coupon) out.push(coupon);
    }
    return out;
  }

  /** Coupon-validation context from the current session state. */
  private async validationContext(
    cartId: string,
    state: CartState,
    customer?: { id?: number | null; emails?: string[] },
  ) {
    const { lines } = await this.checkItems(state);
    return this.contextFromLines(lines, state, customer);
  }

  private async contextFromLines(
    lines: {
      key: string;
      productId: number;
      variationId: number | null;
      quantity: number;
      product: Product;
      variationRow: ProductVariation | null;
      unitPriceMinor: number;
      onSale: boolean;
      categoryIds: number[];
    }[],
    _state: CartState,
    customer?: { id?: number | null; emails?: string[] },
  ) {
    return {
      items: lines.map((line) => ({
        key: line.key,
        productId: line.productId,
        variationId: line.variationId,
        parentProductId: line.variationRow ? line.product.id : null,
        quantity: line.quantity,
        priceMinor: line.unitPriceMinor * line.quantity,
        onSale: line.onSale,
        categoryIds: line.categoryIds,
      })),
      subtotalMinor: lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0),
      customerId: customer?.id ?? null,
      customerEmails: customer?.emails ?? [],
    };
  }
}

export { nowIso };
