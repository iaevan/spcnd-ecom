import type { SpcndDb } from '@spacendigital/db';
import type { createToken } from '@spacendigital/plugin-system';
import { createToken as token } from '@spacendigital/plugin-system';
import type { Address } from '@spacendigital/types';
import type { Order } from '../entities.js';

/**
 * Service interfaces owned by core (docs/AGENTS.md §3.1): checkout, cart and
 * order orchestration only ever talk to these — never to impl packages.
 */

// --- Tax -------------------------------------------------------------------

export interface TaxLocation {
  country: string;
  state: string;
  postcode: string;
  city: string;
}

/** A matched tax rate in WC's find_rates() output shape. */
export interface MatchedTaxRate {
  id: number;
  rate: number;
  label: string;
  shipping: boolean;
  compound: boolean;
}

export interface TaxService {
  /** WC_Tax::find_rates — one rate per priority, most specific match wins. */
  findRates(location: TaxLocation, taxClass: string): Promise<MatchedTaxRate[]>;
  /** WC_Tax::find_shipping_rates — findRates filtered to shipping=true. */
  findShippingRates(location: TaxLocation, taxClass: string): Promise<MatchedTaxRate[]>;
  /** Rates at the shop base address. */
  getBaseRates(taxClass: string): Promise<MatchedTaxRate[]>;
  /**
   * WC_Tax::calc_tax over integer minor units. Returns unrounded amounts per
   * rate id; callers round per the store rounding mode.
   */
  calcTax(
    priceMinor: number,
    rates: MatchedTaxRate[],
    priceIncludesTax: boolean,
  ): Map<number, number>;
}

// --- Shipping --------------------------------------------------------------

export interface ShippingPackageItem {
  productId: number;
  variationId: number | null;
  quantity: number;
  /** Line subtotal in minor units (after discounts when relevant). */
  lineTotalMinor: number;
  weight: number | null;
  shippingClassId: number | null;
  needsShipping: boolean;
}

export interface ShippingPackage {
  items: ShippingPackageItem[];
  destination: Address;
  /** Cart subtotal in minor units, used by free_shipping min_amount. */
  cartSubtotalMinor: number;
  hasCouponFreeShipping: boolean;
}

export interface ShippingRateQuote {
  /** `{method_id}:{instance_id}` — WC rate id shape. */
  rateId: string;
  methodId: string;
  instanceId: number;
  label: string;
  costMinor: number;
  /** Whether this method's cost is taxable. */
  taxable: boolean;
  /** Local pickup style methods change the tax location. */
  isLocalPickup: boolean;
  metaData?: Record<string, unknown>;
}

export interface ShippingService {
  getRatesForPackage(pkg: ShippingPackage): Promise<ShippingRateQuote[]>;
}

// --- Payments --------------------------------------------------------------

export interface PaymentResult {
  result: 'success' | 'failure';
  redirect?: string;
  message?: string;
}

export interface PaymentGatewayInfo {
  id: string;
  title: string;
  description: string;
  methodTitle: string;
  enabled: boolean;
  /** Features per WC $supports: products, refunds, tokenization... */
  supports: string[];
  hasFields: boolean;
  instructions?: string;
}

export interface PaymentService {
  availableGateways(): Promise<PaymentGatewayInfo[]>;
  processPayment(gatewayId: string, order: Order, context?: Record<string, unknown>): Promise<PaymentResult>;
  processRefund(
    gatewayId: string,
    order: Order,
    amountMinor: number,
    reason?: string,
  ): Promise<{ ok: boolean; message?: string }>;
  supports(gatewayId: string, feature: string): Promise<boolean>;
}

// --- Email -----------------------------------------------------------------

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string;
  bcc?: string;
  from?: string;
  fromName?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailService {
  /** Send one of the 22 transactional templates by id. */
  sendTransactional(templateId: string, payload: Record<string, unknown>): Promise<void>;
}

// --- Media -----------------------------------------------------------------

export interface MediaAdapter {
  put(key: string, data: Uint8Array, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
  /**
   * Streamed body for force-download delivery. Web ReadableStream so the
   * local-fs impl (Node) and R2/S3 impls (edge) are interchangeable
   * (docs/EDGE_V2_HARDENING.md gaps 3–4) — services never touch `fs`.
   */
  stream?(key: string): Promise<ReadableStream<Uint8Array>>;
  /** Signed URL for protected downloads; falls back to the public URL. */
  getSignedUrl?(key: string, expiresInSeconds: number): Promise<string>;
}

// --- Cache -----------------------------------------------------------------

export interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Invalidate an entity scope, e.g. 'products' (WC DONOTCACHE* semantics). */
  invalidateScope(scope: string): Promise<void>;
  clear(): Promise<void>;
}

// --- Search ----------------------------------------------------------------

export interface SearchQuery {
  term: string;
  fields?: ('name' | 'sku' | 'global_unique_id' | 'description' | 'short_description')[];
  limit?: number;
}

export interface SearchAdapter {
  searchProducts(query: SearchQuery): Promise<number[]>;
}

// --- Observability ---------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

// --- Queue -----------------------------------------------------------------

export interface QueueJob {
  id: number | string;
  queue: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface QueueAdapter {
  enqueue(queue: string, payload: Record<string, unknown>, delaySeconds?: number): Promise<void>;
  /** Register a handler; the adapter decides polling/consumption strategy. */
  process(queue: string, handler: (job: QueueJob) => Promise<void>): void;
  /** Drain ready jobs once (used by tests and the in-process adapter). */
  runPending?(): Promise<number>;
}

// --- Sessions --------------------------------------------------------------

export interface SessionStore {
  get(key: string): Promise<Record<string, unknown> | undefined>;
  set(key: string, value: Record<string, unknown>, expirySeconds: number): Promise<void>;
  destroy(key: string): Promise<void>;
}

// --- Analytics -------------------------------------------------------------

/** Lookup-table sync engine; runs inside the same transaction as the parent write. */
export interface AnalyticsSync {
  syncOrder(tx: SpcndDb, orderId: number): Promise<void>;
  syncCustomer(tx: SpcndDb, customerId: number): Promise<void>;
  deleteOrder(tx: SpcndDb, orderId: number): Promise<void>;
}

// --- Reviews ---------------------------------------------------------------

export interface ReviewsService {
  create(input: {
    productId: number;
    rating: number;
    content: string;
    authorName: string;
    authorEmail: string;
    customerId?: number | null;
  }): Promise<number>;
  setStatus(reviewId: number, status: string): Promise<void>;
  /** Recompute average_rating / rating_counts / review_count on the product. */
  syncProductRating(productId: number): Promise<void>;
}

// --- Tokens ----------------------------------------------------------------

export const TAX_SERVICE = token<TaxService>('TaxService');
export const SHIPPING_SERVICE = token<ShippingService>('ShippingService');
export const PAYMENT_SERVICE = token<PaymentService>('PaymentService');
export const EMAIL_SERVICE = token<EmailService>('EmailService');
export const EMAIL_TRANSPORT = token<EmailTransport>('EmailTransport');
export const MEDIA_ADAPTER = token<MediaAdapter>('MediaAdapter');
export const CACHE_ADAPTER = token<CacheAdapter>('CacheAdapter');
export const SEARCH_ADAPTER = token<SearchAdapter>('SearchAdapter');
export const LOGGER = token<Logger>('Logger');
export const QUEUE_ADAPTER = token<QueueAdapter>('QueueAdapter');
export const SESSION_STORE = token<SessionStore>('SessionStore');
export const ANALYTICS_SYNC = token<AnalyticsSync>('AnalyticsSync');
export const REVIEWS_SERVICE = token<ReviewsService>('ReviewsService');

export type { createToken };
