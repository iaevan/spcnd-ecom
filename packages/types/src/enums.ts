/**
 * Every CHECK-constrained column in the schema derives its allowed values from
 * the constant lists in this file, so the DB constraint and the TS union can
 * never drift apart.
 */

export const PRODUCT_TYPES = [
  'simple',
  'variable',
  'grouped',
  'external',
  'virtual',
  'downloadable',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ['publish', 'draft', 'pending', 'private', 'trash'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CATALOG_VISIBILITIES = ['visible', 'catalog', 'search', 'hidden'] as const;
export type CatalogVisibility = (typeof CATALOG_VISIBILITIES)[number];

export const STOCK_STATUSES = ['instock', 'outofstock', 'onbackorder'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const BACKORDER_MODES = ['no', 'yes', 'notify'] as const;
export type BackorderMode = (typeof BACKORDER_MODES)[number];

export const TAX_STATUSES = ['taxable', 'shipping', 'none'] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

/** 'parent' is WC's magic string for variations inheriting parent stock management. */
export const VARIATION_MANAGE_STOCK = ['parent', 'yes', 'no'] as const;
export type VariationManageStock = (typeof VARIATION_MANAGE_STOCK)[number];

export const ORDER_STATUSES = [
  'pending',
  'failed',
  'on-hold',
  'processing',
  'completed',
  'cancelled',
  'refunded',
  'draft',
  'auto-draft',
  'checkout-draft',
  'trash',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses WC treats as paid. */
export const PAID_ORDER_STATUSES: readonly OrderStatus[] = ['processing', 'completed'];

/** Statuses from which payment_complete() may transition. */
export const VALID_ORDER_STATUSES_FOR_PAYMENT_COMPLETE: readonly OrderStatus[] = [
  'on-hold',
  'pending',
  'failed',
  'cancelled',
];

/** Statuses that still require payment. */
export const VALID_ORDER_STATUSES_FOR_PAYMENT: readonly OrderStatus[] = ['pending', 'failed'];

export const ORDER_ITEM_TYPES = ['line_item', 'fee', 'shipping', 'tax', 'coupon'] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

export const ORDER_NOTE_TYPES = ['private', 'customer', 'system'] as const;
export type OrderNoteType = (typeof ORDER_NOTE_TYPES)[number];

/**
 * Append-only replacements for WC's five operational booleans on orders
 * (docs/AGENTS.md §4.1.11). UNIQUE(order_id, event_type) prevents double-fire.
 */
export const ORDER_EVENT_TYPES = [
  'stock_reduced',
  'download_permissions_granted',
  'new_order_email_sent',
  'recorded_sales',
  'recorded_coupon_usage_counts',
] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export const COUPON_DISCOUNT_TYPES = ['fixed_cart', 'percent', 'fixed_product'] as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

export const COUPON_STATUSES = ['publish', 'draft', 'trash'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'spam', 'trash'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const CUSTOMER_ROLES = ['customer', 'shop_manager', 'admin'] as const;
export type CustomerRole = (typeof CUSTOMER_ROLES)[number];

export const ADDRESS_TYPES = ['billing', 'shipping'] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const API_KEY_PERMISSIONS = ['read', 'write', 'read_write'] as const;
export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number];

export const WEBHOOK_STATUSES = ['active', 'paused', 'disabled'] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const MEDIA_SOURCES = ['local', 's3', 'r2', 'external'] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

export const MEDIA_OWNER_TYPES = ['product', 'product_variation', 'category'] as const;
export type MediaOwnerType = (typeof MEDIA_OWNER_TYPES)[number];

export const TAX_RATE_LOCATION_TYPES = [
  'postcode',
  'state',
  'country',
  'continent',
  'city',
] as const;
export type TaxRateLocationType = (typeof TAX_RATE_LOCATION_TYPES)[number];

export const SHIPPING_ZONE_LOCATION_TYPES = ['postcode', 'state', 'country', 'continent'] as const;
export type ShippingZoneLocationType = (typeof SHIPPING_ZONE_LOCATION_TYPES)[number];

export const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const DIMENSION_UNITS = ['m', 'cm', 'mm', 'in', 'yd'] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

export const ATTRIBUTE_TYPES = ['select', 'text', 'color'] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const CATEGORY_DISPLAY_TYPES = ['default', 'products', 'subcategories', 'both'] as const;
export type CategoryDisplayType = (typeof CATEGORY_DISPLAY_TYPES)[number];

export const TAX_BASED_ON = ['shipping', 'billing', 'base'] as const;
export type TaxBasedOn = (typeof TAX_BASED_ON)[number];

/** The 17 built-in webhook topics; `action.{hook}` custom topics are allowed on top. */
export const WEBHOOK_TOPICS = [
  'coupon.created',
  'coupon.updated',
  'coupon.deleted',
  'coupon.restored',
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'order.created',
  'order.updated',
  'order.deleted',
  'order.restored',
  'product.created',
  'product.updated',
  'product.deleted',
  'product.restored',
  'refund.created',
  'refund.deleted',
] as const;
export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number] | `action.${string}`;
