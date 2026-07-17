import type { Schema } from '@spcnd-ecom/db';

type Tables = Schema;

/** Row-derived entity types — the DB schema is the single source of shape. */
export type Product = Tables['products']['$inferSelect'];
export type NewProduct = Tables['products']['$inferInsert'];
export type ProductVariation = Tables['productVariations']['$inferSelect'];
export type NewProductVariation = Tables['productVariations']['$inferInsert'];
export type ProductCategory = Tables['productCategories']['$inferSelect'];
export type ProductTag = Tables['productTags']['$inferSelect'];
export type ProductAttribute = Tables['productAttributes']['$inferSelect'];
export type ProductAttributeTerm = Tables['productAttributeTerms']['$inferSelect'];
export type Media = Tables['media']['$inferSelect'];
export type Order = Tables['orders']['$inferSelect'];
export type NewOrder = Tables['orders']['$inferInsert'];
export type OrderItem = Tables['orderItems']['$inferSelect'];
export type NewOrderItem = Tables['orderItems']['$inferInsert'];
export type OrderNote = Tables['orderNotes']['$inferSelect'];
export type OrderRefund = Tables['orderRefunds']['$inferSelect'];
export type OrderEvent = Tables['orderEvents']['$inferSelect'];
export type Customer = Tables['customers']['$inferSelect'];
export type CustomerAddress = Tables['customerAddresses']['$inferSelect'];
export type Coupon = Tables['coupons']['$inferSelect'];
export type Review = Tables['reviews']['$inferSelect'];
export type TaxRate = Tables['taxRates']['$inferSelect'];
export type TaxClass = Tables['taxClasses']['$inferSelect'];
export type TaxRateLocation = Tables['taxRateLocations']['$inferSelect'];
export type ShippingZone = Tables['shippingZones']['$inferSelect'];
export type ShippingZoneLocation = Tables['shippingZoneLocations']['$inferSelect'];
export type ShippingZoneMethod = Tables['shippingZoneMethods']['$inferSelect'];
export type ShippingClass = Tables['shippingClasses']['$inferSelect'];
export type Webhook = Tables['webhooks']['$inferSelect'];
export type ApiKey = Tables['apiKeys']['$inferSelect'];
export type PaymentToken = Tables['paymentTokens']['$inferSelect'];
export type DownloadPermission = Tables['downloadPermissions']['$inferSelect'];
export type AdminNote = Tables['adminNotes']['$inferSelect'];
