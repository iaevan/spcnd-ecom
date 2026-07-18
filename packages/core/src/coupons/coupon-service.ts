import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import { Money, type PaginatedResult } from '@spacendigital/types';
import { and, asc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { type DiscountableItem, isProductCouponType, isValidForProduct, toEngineCoupon } from '../discounts/discounts.js';
import type { Coupon } from '../entities.js';
import { COUPON_ERROR_CODES, CouponError, NotFoundError, SpcndError } from '../errors.js';
import {
  couponCreated,
  couponDeleted,
  couponLoaded,
  couponUpdated,
  filterCouponIsValid,
} from '../events.js';
import type { SettingsService } from '../settings/service.js';
import { nowIso, randomString } from '../utils.js';

export interface CouponListQuery {
  page?: number;
  perPage?: number;
  search?: string;
}

export type CreateCouponInput = Partial<Omit<Coupon, 'id' | 'dateCreated' | 'dateModified'>> & {
  code: string;
};

/** What the validation pipeline sees of the current cart/order (§9.10). */
export interface CouponValidationContext {
  items: DiscountableItem[];
  /** Displayed subtotal in minor units (per store tax-display setting). */
  subtotalMinor: number;
  customerId?: number | null;
  /** Billing + account emails of the current customer, lowercased. */
  customerEmails?: string[];
}

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
  settings: SettingsService;
}

const HOLD_KEY_PREFIX = 'coupon_hold_';

/**
 * Coupon CRUD, the WC validation pipeline (comprehensive report §9.10 — order
 * preserved exactly), and usage tracking including tentative holds for
 * checkouts that have not become orders yet (§8.6).
 */
export class CouponService {
  constructor(private readonly deps: Deps) {}

  // --- Reads ---------------------------------------------------------------

  async get(id: number): Promise<Coupon> {
    const { db } = this.deps;
    const rows = await db.drizzle.select().from(db.schema.coupons).where(eq(db.schema.coupons.id, id));
    const coupon = rows[0];
    if (!coupon) throw new NotFoundError('Coupon', id);
    return coupon;
  }

  /** Codes are stored lowercase, matching `wc_format_coupon_code`. */
  async findByCode(code: string): Promise<Coupon | undefined> {
    const { db, bus } = this.deps;
    const rows = await db.drizzle
      .select()
      .from(db.schema.coupons)
      .where(eq(db.schema.coupons.code, formatCouponCode(code)));
    const coupon = rows[0];
    if (coupon) await bus.emit(couponLoaded, coupon);
    return coupon;
  }

  async list(query: CouponListQuery = {}): Promise<PaginatedResult<Coupon>> {
    const { db } = this.deps;
    const s = db.schema;
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 10));
    const where = query.search
      ? or(like(s.coupons.code, `%${query.search}%`), like(s.coupons.description, `%${query.search}%`))
      : undefined;
    const base = db.drizzle.select().from(s.coupons);
    const rows = await (where ? base.where(where) : base)
      .orderBy(asc(s.coupons.id))
      .limit(perPage)
      .offset((page - 1) * perPage);
    const countBase = db.drizzle.select({ count: sql<number>`count(*)` }).from(s.coupons);
    const total = Number((await (where ? countBase.where(where) : countBase))[0]?.count ?? 0);
    return { items: rows, total, totalPages: Math.ceil(total / perPage), page, perPage };
  }

  // --- Writes --------------------------------------------------------------

  async create(input: CreateCouponInput): Promise<Coupon> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const code = formatCouponCode(input.code);
    if (!code) throw new CouponError('Please enter a coupon code.', COUPON_ERROR_CODES.PLEASE_ENTER);
    if (await this.findByCode(code)) {
      throw new SpcndError(`Coupon code "${code}" already exists`, 'coupon_code_exists');
    }
    const now = nowIso();
    await db.drizzle.insert(s.coupons).values({ ...input, code, dateCreated: now, dateModified: now });
    const coupon = (await db.drizzle.select().from(s.coupons).where(eq(s.coupons.code, code)))[0];
    if (!coupon) throw new SpcndError('Coupon insert failed', 'coupon_insert_failed', 500);
    await bus.emit(couponCreated, coupon);
    return coupon;
  }

  async update(id: number, input: Partial<CreateCouponInput>): Promise<Coupon> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const existing = await this.get(id);
    const patch = { ...input };
    if (patch.code) {
      patch.code = formatCouponCode(patch.code);
      if (patch.code !== existing.code && (await this.findByCode(patch.code))) {
        throw new SpcndError(`Coupon code "${patch.code}" already exists`, 'coupon_code_exists');
      }
    }
    await db.drizzle
      .update(s.coupons)
      .set({ ...patch, dateModified: nowIso() })
      .where(eq(s.coupons.id, id));
    const coupon = await this.get(id);
    await bus.emit(couponUpdated, coupon);
    return coupon;
  }

  async delete(id: number): Promise<void> {
    const { db, bus } = this.deps;
    await this.get(id);
    await db.drizzle.delete(db.schema.coupons).where(eq(db.schema.coupons.id, id));
    await bus.emit(couponDeleted, { id });
  }

  // --- Validation pipeline (§9.10, order is contractual) -------------------

  /**
   * Throws CouponError with the WC error code on the first failing step;
   * resolves true when the coupon is valid for the given context.
   */
  async validate(coupon: Coupon | undefined, ctx: CouponValidationContext): Promise<true> {
    const c = this.validateExists(coupon);
    await this.validateUsageLimit(c, ctx);
    await this.validateUserUsageLimit(c, ctx);
    this.validateExpiry(c);
    this.validateMinimumAmount(c, ctx);
    this.validateMaximumAmount(c, ctx);
    this.validateProductIds(c, ctx);
    this.validateProductCategories(c, ctx);
    this.validateExcludedItems(c, ctx);
    this.validateEligibleItems(c, ctx);
    this.validateAllowedEmails(c, ctx);
    const valid = await this.deps.bus.applyFilters(filterCouponIsValid, true, c, ctx);
    if (!valid) {
      throw new CouponError('Coupon is not valid.', COUPON_ERROR_CODES.INVALID_FILTERED);
    }
    return true;
  }

  private validateExists(coupon: Coupon | undefined): Coupon {
    if (!coupon || coupon.status !== 'publish') {
      throw new CouponError(
        `Coupon "${coupon?.code ?? ''}" does not exist!`,
        COUPON_ERROR_CODES.NOT_EXIST,
      );
    }
    return coupon;
  }

  private async validateUsageLimit(coupon: Coupon, ctx: CouponValidationContext): Promise<void> {
    if (coupon.usageLimit === null || coupon.usageLimit <= 0) return;
    if (coupon.usageCount >= coupon.usageLimit) {
      throw new CouponError('Coupon usage limit has been reached.', COUPON_ERROR_CODES.USAGE_LIMIT_REACHED);
    }
    const holds = await this.activeHoldCount(coupon.id);
    if (coupon.usageCount + holds >= coupon.usageLimit) {
      // Limit only reached because other checkouts hold tentative usages.
      throw new CouponError(
        'Coupon usage limit has been reached.',
        ctx.customerId
          ? COUPON_ERROR_CODES.USAGE_LIMIT_COUPON_STUCK
          : COUPON_ERROR_CODES.USAGE_LIMIT_COUPON_STUCK_GUEST,
      );
    }
  }

  private async validateUserUsageLimit(coupon: Coupon, ctx: CouponValidationContext): Promise<void> {
    if (coupon.usageLimitPerUser === null || coupon.usageLimitPerUser <= 0) return;
    const used = await this.usageCountFor(coupon.id, ctx.customerId ?? null, ctx.customerEmails ?? []);
    if (used >= coupon.usageLimitPerUser) {
      throw new CouponError('Coupon usage limit has been reached.', COUPON_ERROR_CODES.USAGE_LIMIT_REACHED);
    }
  }

  private validateExpiry(coupon: Coupon): void {
    if (coupon.dateExpires && Date.now() > new Date(coupon.dateExpires).getTime()) {
      throw new CouponError('This coupon has expired.', COUPON_ERROR_CODES.EXPIRED);
    }
  }

  private validateMinimumAmount(coupon: Coupon, ctx: CouponValidationContext): void {
    if (!coupon.minimumAmount) return;
    const min = Money.fromDb(coupon.minimumAmount).minor;
    if (min > 0 && ctx.subtotalMinor < min) {
      throw new CouponError(
        `The minimum spend for this coupon is ${Money.fromMinor(min).toFixed(2)}.`,
        COUPON_ERROR_CODES.MIN_SPEND_LIMIT_NOT_MET,
      );
    }
  }

  private validateMaximumAmount(coupon: Coupon, ctx: CouponValidationContext): void {
    if (!coupon.maximumAmount) return;
    const max = Money.fromDb(coupon.maximumAmount).minor;
    if (max > 0 && ctx.subtotalMinor > max) {
      throw new CouponError(
        `The maximum spend for this coupon is ${Money.fromMinor(max).toFixed(2)}.`,
        COUPON_ERROR_CODES.MAX_SPEND_LIMIT_MET,
      );
    }
  }

  private validateProductIds(coupon: Coupon, ctx: CouponValidationContext): void {
    if ((coupon.productIds ?? []).length === 0) return;
    const wanted = coupon.productIds;
    const found = ctx.items.some((item) =>
      [item.productId, item.variationId, item.parentProductId].some(
        (id) => id !== null && wanted.includes(id),
      ),
    );
    if (!found) {
      throw new CouponError(
        'Sorry, this coupon is not applicable to your cart contents.',
        COUPON_ERROR_CODES.NOT_APPLICABLE,
      );
    }
  }

  private validateProductCategories(coupon: Coupon, ctx: CouponValidationContext): void {
    if ((coupon.productCategories ?? []).length === 0) return;
    const wanted = coupon.productCategories;
    const found = ctx.items.some((item) => item.categoryIds.some((c) => wanted.includes(c)));
    if (!found) {
      throw new CouponError(
        'Sorry, this coupon is not applicable to your cart contents.',
        COUPON_ERROR_CODES.NOT_APPLICABLE,
      );
    }
  }

  /** Product-type coupons: at least one line must pass the product rules. */
  private validateExcludedItems(coupon: Coupon, ctx: CouponValidationContext): void {
    if (ctx.items.length === 0 || !isProductCouponType(coupon.discountType)) return;
    const engine = toEngineCoupon(coupon);
    if (!ctx.items.some((item) => isValidForProduct(engine, item))) {
      throw new CouponError(
        'Sorry, this coupon is not applicable to selected products.',
        COUPON_ERROR_CODES.NOT_APPLICABLE,
      );
    }
  }

  /** Cart-type coupons: sale-item and exclusion checks (§9.10 step 10). */
  private validateEligibleItems(coupon: Coupon, ctx: CouponValidationContext): void {
    if (isProductCouponType(coupon.discountType)) return;
    if (coupon.excludeSaleItems && ctx.items.length > 0) {
      if (!ctx.items.some((item) => !item.onSale)) {
        throw new CouponError(
          'Sorry, this coupon is not valid for sale items.',
          COUPON_ERROR_CODES.NOT_VALID_SALE_ITEMS,
        );
      }
    }
    const excludedIds = coupon.excludedProductIds ?? [];
    if (excludedIds.length > 0) {
      const hit = ctx.items.filter((item) =>
        [item.productId, item.variationId, item.parentProductId].some(
          (id) => id !== null && excludedIds.includes(id),
        ),
      );
      if (hit.length === ctx.items.length && ctx.items.length > 0) {
        throw new CouponError(
          'Sorry, this coupon is not applicable to the products in your cart.',
          COUPON_ERROR_CODES.EXCLUDED_PRODUCTS,
        );
      }
    }
    const excludedCats = coupon.excludedProductCategories ?? [];
    if (excludedCats.length > 0 && ctx.items.length > 0) {
      const allExcluded = ctx.items.every((item) =>
        item.categoryIds.some((c) => excludedCats.includes(c)),
      );
      if (allExcluded) {
        throw new CouponError(
          'Sorry, this coupon is not applicable to the categories in your cart.',
          COUPON_ERROR_CODES.EXCLUDED_CATEGORIES,
        );
      }
    }
  }

  private validateAllowedEmails(coupon: Coupon, ctx: CouponValidationContext): void {
    const restrictions = coupon.emailRestrictions ?? [];
    if (restrictions.length === 0) return;
    const emails = (ctx.customerEmails ?? []).map((e) => e.trim().toLowerCase());
    const matched = emails.some((email) => couponEmailMatches(email, restrictions));
    if (!matched) {
      throw new CouponError(
        'Please enter a valid email to use this coupon.',
        COUPON_ERROR_CODES.NOT_YOURS_REMOVED,
      );
    }
  }

  // --- Usage tracking ------------------------------------------------------

  /** Rows recorded for a customer (by id or by any of their emails). */
  async usageCountFor(couponId: number, customerId: number | null, emails: string[]): Promise<number> {
    const { db } = this.deps;
    const s = db.schema;
    const conds = [];
    if (customerId) conds.push(eq(s.couponUsage.customerId, customerId));
    const lowered = emails.map((e) => e.toLowerCase()).filter(Boolean);
    if (lowered.length > 0) conds.push(inArray(s.couponUsage.usedBy, lowered));
    if (conds.length === 0) return 0;
    const rows = await db.drizzle
      .select({ count: sql<number>`count(*)` })
      .from(s.couponUsage)
      .where(and(eq(s.couponUsage.couponId, couponId), or(...conds)));
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Record real usage inside the caller's transaction (order creation) and
   * bump the denormalized usage_count.
   */
  async increaseUsage(
    tx: SpcndDb,
    coupon: Coupon,
    usedBy: { customerId?: number | null; email?: string },
    orderId: number,
    amount: string,
  ): Promise<void> {
    const s = tx.schema;
    await tx.drizzle.insert(s.couponUsage).values({
      couponId: coupon.id,
      orderId,
      customerId: usedBy.customerId ?? null,
      usedBy: (usedBy.email ?? '').toLowerCase(),
      amount,
      dateCreated: nowIso(),
    });
    await tx.drizzle
      .update(s.coupons)
      .set({ usageCount: sql`${s.coupons.usageCount} + 1` })
      .where(eq(s.coupons.id, coupon.id));
  }

  /** Reverse usage when an order is cancelled/refunded before completion. */
  async decreaseUsage(tx: SpcndDb, couponId: number, orderId: number): Promise<void> {
    const s = tx.schema;
    const rows = await tx.drizzle
      .select({ id: s.couponUsage.id })
      .from(s.couponUsage)
      .where(and(eq(s.couponUsage.couponId, couponId), eq(s.couponUsage.orderId, orderId)));
    if (rows.length === 0) return;
    await tx.drizzle
      .delete(s.couponUsage)
      .where(and(eq(s.couponUsage.couponId, couponId), eq(s.couponUsage.orderId, orderId)));
    await tx.drizzle
      .update(s.coupons)
      .set({ usageCount: sql`MAX(0, ${s.coupons.usageCount} - ${rows.length})` })
      .where(eq(s.coupons.id, couponId));
  }

  /**
   * Tentative usage hold while a checkout is in flight (WC's
   * `check_and_hold_coupon`). Stored in settings_general with an expiry so
   * abandoned checkouts release the slot; returns the hold key for release.
   */
  async holdUsage(couponId: number): Promise<string> {
    const { db, settings } = this.deps;
    const s = db.schema;
    const minutes = Math.max(1, await settings.getInt('hold_stock_minutes'));
    const key = `${HOLD_KEY_PREFIX}${couponId}_${randomString(8)}`;
    const expires = new Date(Date.now() + minutes * 60_000).toISOString();
    await db.drizzle.insert(s.settingsGeneral).values({ key, value: expires });
    return key;
  }

  async releaseHold(key: string): Promise<void> {
    const { db } = this.deps;
    const s = db.schema;
    await db.drizzle.delete(s.settingsGeneral).where(eq(s.settingsGeneral.key, key));
  }

  private async activeHoldCount(couponId: number): Promise<number> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select()
      .from(s.settingsGeneral)
      .where(like(s.settingsGeneral.key, `${HOLD_KEY_PREFIX}${couponId}_%`));
    const now = Date.now();
    let active = 0;
    for (const row of rows) {
      if (new Date(row.value).getTime() > now) {
        active++;
      } else {
        await db.drizzle.delete(s.settingsGeneral).where(eq(s.settingsGeneral.key, row.key));
      }
    }
    return active;
  }
}

/** `wc_format_coupon_code`: lowercase, trimmed. */
export function formatCouponCode(code: string): string {
  return code.trim().toLowerCase();
}

/** WC `is_coupon_emails_allowed`: exact match or `*` wildcard patterns. */
export function couponEmailMatches(email: string, restrictions: string[]): boolean {
  for (const raw of restrictions) {
    const restriction = raw.trim().toLowerCase();
    if (!restriction) continue;
    if (restriction === email) return true;
    if (restriction.includes('*')) {
      const pattern = `^${restriction
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`;
      if (new RegExp(pattern).test(email)) return true;
    }
  }
  return false;
}
