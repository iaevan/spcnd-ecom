/**
 * WC_Coupon error codes, reproduced verbatim
 * (woocommerce_comprehensive_report.md §8.3).
 */
export const COUPON_ERROR_CODES = {
  INVALID_FILTERED: 100,
  INVALID_REMOVED: 101,
  NOT_YOURS_REMOVED: 102,
  ALREADY_APPLIED: 103,
  ALREADY_APPLIED_INDIV_USE_ONLY: 104,
  NOT_EXIST: 105,
  USAGE_LIMIT_REACHED: 106,
  EXPIRED: 107,
  MIN_SPEND_LIMIT_NOT_MET: 108,
  NOT_APPLICABLE: 109,
  NOT_VALID_SALE_ITEMS: 110,
  PLEASE_ENTER: 111,
  MAX_SPEND_LIMIT_MET: 112,
  EXCLUDED_PRODUCTS: 113,
  EXCLUDED_CATEGORIES: 114,
  USAGE_LIMIT_COUPON_STUCK: 115,
  USAGE_LIMIT_COUPON_STUCK_GUEST: 116,
} as const;

export const COUPON_SUCCESS_CODES = { SUCCESS: 200, REMOVED: 201 } as const;

export type CouponErrorCode = (typeof COUPON_ERROR_CODES)[keyof typeof COUPON_ERROR_CODES];

export class SpcndError extends Error {
  constructor(
    message: string,
    readonly code = 'spcnd_error',
    readonly status = 400,
  ) {
    super(message);
    this.name = 'SpcndError';
  }
}

export class NotFoundError extends SpcndError {
  constructor(entity: string, id: string | number) {
    super(`${entity} ${id} not found`, `${entity.toLowerCase()}_not_found`, 404);
    this.name = 'NotFoundError';
  }
}

export class CouponError extends SpcndError {
  constructor(
    message: string,
    readonly couponCode: CouponErrorCode,
  ) {
    super(message, 'invalid_coupon', 400);
    this.name = 'CouponError';
  }
}

export class CheckoutError extends SpcndError {
  constructor(message: string, code = 'checkout_error') {
    super(message, code, 400);
    this.name = 'CheckoutError';
  }
}

export class StockError extends SpcndError {
  constructor(message: string) {
    super(message, 'out_of_stock', 400);
    this.name = 'StockError';
  }
}
