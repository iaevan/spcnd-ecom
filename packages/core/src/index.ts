/**
 * @spacendigital/core — the framework-agnostic commerce engine.
 * `createSpcndCore` builds an isolated kernel; the `spcnd-ecom` meta-package
 * wraps it with api + default impl plugins as `createSpcndApp` (DECISION-7).
 */

export * from './entities.js';
export * from './errors.js';
export * from './events.js';
export * from './utils.js';
export * from './services/interfaces.js';
export * from './settings/defaults.js';
export * from './settings/service.js';

// i18n: countries + currencies only for now; the i18n barrel (states,
// address formats, country locale) lands with SECURITY_WORK item S8.
export * from './i18n/countries.js';
export * from './i18n/currencies.js';

export * from './catalog/product-service.js';
export * from './customers/customer-service.js';
export * from './coupons/coupon-service.js';
export * from './discounts/discounts.js';
export * from './cart/totals.js';
export * from './cart/cart-service.js';
export * from './checkout/checkout-service.js';
export * from './orders/order-service.js';
export * from './sessions/session-service.js';
export * from './media/media-service.js';
export * from './downloads/download-service.js';
export * from './queue/memory-queue.js';
export * from './cache/memory-cache.js';
export * from './search/db-search.js';
export * from './seo/jsonld.js';
export * from './gdpr/exporters.js';
export * from './jobs/scheduled.js';
export * from './app.js';
