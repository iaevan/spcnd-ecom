declare const brand: unique symbol;

/**
 * Weak brand: documents intent at API boundaries while staying
 * assignment-compatible with plain numbers/strings, so Drizzle rows and
 * arithmetic don't need casts everywhere.
 */
export type Brand<T, B extends string> = T & { readonly [brand]?: B };

export type ProductId = Brand<number, 'ProductId'>;
export type VariationId = Brand<number, 'VariationId'>;
export type OrderId = Brand<number, 'OrderId'>;
export type OrderItemId = Brand<number, 'OrderItemId'>;
export type CustomerId = Brand<number, 'CustomerId'>;
export type CouponId = Brand<number, 'CouponId'>;
export type CategoryId = Brand<number, 'CategoryId'>;
export type TagId = Brand<number, 'TagId'>;
export type MediaId = Brand<number, 'MediaId'>;
export type ReviewId = Brand<number, 'ReviewId'>;
export type TaxRateId = Brand<number, 'TaxRateId'>;
export type TaxClassId = Brand<number, 'TaxClassId'>;
export type ShippingZoneId = Brand<number, 'ShippingZoneId'>;
export type ShippingMethodInstanceId = Brand<number, 'ShippingMethodInstanceId'>;
export type ShippingClassId = Brand<number, 'ShippingClassId'>;
export type WebhookId = Brand<number, 'WebhookId'>;
export type RefundId = Brand<number, 'RefundId'>;
export type AttributeId = Brand<number, 'AttributeId'>;
export type AttributeTermId = Brand<number, 'AttributeTermId'>;
export type DownloadPermissionId = Brand<number, 'DownloadPermissionId'>;
export type PaymentTokenId = Brand<number, 'PaymentTokenId'>;
export type ApiKeyId = Brand<number, 'ApiKeyId'>;
