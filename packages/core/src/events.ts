import { defineEvent, defineFilter } from '@spacendigital/plugin-system';
import type {
  Coupon,
  Customer,
  Order,
  OrderItem,
  OrderNote,
  OrderRefund,
  Product,
  ProductVariation,
  Review,
} from './entities.js';

/**
 * Canonical typed event catalog. `@spacendigital/compat-wc` aliases the ~150
 * WooCommerce hook names onto these canonical names, so a typed listener and a
 * `woocommerce_*` listener share one priority-ordered chain (docs/AGENTS.md §7).
 *
 * Dynamic hook families (`order.status.{to}` etc.) are built with the helper
 * functions at the bottom.
 */

// --- Product lifecycle -----------------------------------------------------
export const productCreated = defineEvent<Product>('product.created');
export const productUpdated = defineEvent<Product>('product.updated');
export const productDeleted = defineEvent<{ id: number }>('product.deleted');
export const productTrashed = defineEvent<{ id: number }>('product.trashed');
export const productBeforeDelete = defineEvent<{ id: number }>('product.delete.before');
export const productSaveBefore = defineEvent<Product>('product.save.before');
export const productSaveAfter = defineEvent<Product>('product.save.after');
export const productRead = defineEvent<Product>('product.read');
export const productStockSet = defineEvent<{ product: Product; quantity: number | null }>(
  'product.stock.set',
);
export const productBeforeStockSet = defineEvent<{ product: Product; quantity: number | null }>(
  'product.stock.set.before',
);
export const productStockStatusSet = defineEvent<{ productId: number; status: string }>(
  'product.stock_status.set',
);
export const variationStockSet = defineEvent<{ variation: ProductVariation; quantity: number | null }>(
  'variation.stock.set',
);
export const variationBeforeStockSet = defineEvent<{
  variation: ProductVariation;
  quantity: number | null;
}>('variation.stock.set.before');
export const variationStockStatusSet = defineEvent<{ variationId: number; status: string }>(
  'variation.stock_status.set',
);
export const productVisibilitySet = defineEvent<{ productId: number; visibility: string }>(
  'product.visibility.set',
);
export const productTypeChanged = defineEvent<{ product: Product; from: string; to: string }>(
  'product.type.changed',
);
export const productUpdatedProps = defineEvent<{ product: Product; updatedProps: string[] }>(
  'product.updated_props',
);
export const productAttributesUpdated = defineEvent<{ product: Product }>(
  'product.attributes.updated',
);
export const variableProductSync = defineEvent<{ product: Product }>('product.variable.synced');

// --- Cart ------------------------------------------------------------------
export interface CartItemPayload {
  cartId: string;
  key: string;
  productId: number;
  variationId: number | null;
  quantity: number;
  variation: Record<string, string>;
  cartItemData: Record<string, unknown>;
}
export const cartItemAdded = defineEvent<CartItemPayload>('cart.item.added');
export const cartItemRemoved = defineEvent<{ key: string; cartId: string }>('cart.item.removed');
export const cartItemRemove = defineEvent<{ key: string; cartId: string }>('cart.item.remove');
export const cartItemRestored = defineEvent<{ key: string; cartId: string }>('cart.item.restored');
export const cartItemRestore = defineEvent<{ key: string; cartId: string }>('cart.item.restore');
export const cartItemQuantityUpdated = defineEvent<{ key: string; quantity: number; cartId: string }>(
  'cart.item.quantity_updated',
);
export const cartItemSetQuantity = defineEvent<{ key: string; quantity: number; cartId: string }>(
  'cart.item.set_quantity',
);
export const cartBeforeCalculateTotals = defineEvent<{ cartId: string }>('cart.calculate.before');
export const cartAfterCalculateTotals = defineEvent<{ cartId: string }>('cart.calculate.after');
export const cartBeforeEmptied = defineEvent<{ cartId: string }>('cart.emptied.before');
export const cartEmptied = defineEvent<{ cartId: string }>('cart.emptied');
export const cartCheckItems = defineEvent<{ cartId: string }>('cart.check_items');
export const cartCouponApplied = defineEvent<{ code: string; cartId: string }>('cart.coupon.applied');
export const cartCouponRemoved = defineEvent<{ code: string; cartId: string }>('cart.coupon.removed');

// --- Checkout --------------------------------------------------------------
export const checkoutInit = defineEvent<{ cartId: string }>('checkout.init');
export const checkoutBeforeProcess = defineEvent<{ cartId: string }>('checkout.process.before');
export const checkoutProcess = defineEvent<{ cartId: string }>('checkout.process');
export const checkoutAfterValidation = defineEvent<{ data: Record<string, unknown>; errors: string[] }>(
  'checkout.validated',
);
export const checkoutCreateOrder = defineEvent<{ order: Order; data: Record<string, unknown> }>(
  'checkout.order.create',
);
export const checkoutUpdateOrderMeta = defineEvent<{ orderId: number; data: Record<string, unknown> }>(
  'checkout.order.update_meta',
);
export const checkoutOrderCreated = defineEvent<Order>('checkout.order.created');
export const checkoutOrderProcessed = defineEvent<{
  orderId: number;
  postedData: Record<string, unknown>;
  order: Order;
}>('checkout.order.processed');
export const checkoutOrderException = defineEvent<{ error: unknown }>('checkout.order.exception');
export const checkoutCreateOrderLineItem = defineEvent<{
  item: OrderItem;
  cartItemKey: string;
  orderId: number;
}>('checkout.order.line_item.created');
export const checkoutCreateOrderFeeItem = defineEvent<{ item: OrderItem; orderId: number }>(
  'checkout.order.fee_item.created',
);
export const checkoutCreateOrderShippingItem = defineEvent<{ item: OrderItem; orderId: number }>(
  'checkout.order.shipping_item.created',
);
export const checkoutCreateOrderTaxItem = defineEvent<{ item: OrderItem; orderId: number }>(
  'checkout.order.tax_item.created',
);
export const checkoutCreateOrderCouponItem = defineEvent<{ item: OrderItem; orderId: number }>(
  'checkout.order.coupon_item.created',
);
export const checkoutUpdateCustomer = defineEvent<{ customer: Customer; data: Record<string, unknown> }>(
  'checkout.customer.updated',
);
export const resumeOrder = defineEvent<{ orderId: number }>('checkout.order.resumed');

// --- Orders ----------------------------------------------------------------
export const orderStatusChanged = defineEvent<{
  orderId: number;
  from: string;
  to: string;
  order: Order;
}>('order.status.changed');
export const orderPaymentStatusChanged = defineEvent<{ orderId: number; order: Order }>(
  'order.payment_status.changed',
);
export const prePaymentComplete = defineEvent<{ orderId: number; transactionId?: string }>(
  'order.payment_complete.before',
);
export const paymentComplete = defineEvent<{ orderId: number; transactionId?: string }>(
  'order.payment_complete',
);
export const orderBeforeCalculateTotals = defineEvent<{ andTaxes: boolean; order: Order }>(
  'order.calculate_totals.before',
);
export const orderAfterCalculateTotals = defineEvent<{ andTaxes: boolean; order: Order }>(
  'order.calculate_totals.after',
);
export const orderBeforeCalculateTaxes = defineEvent<{ args: Record<string, unknown>; order: Order }>(
  'order.calculate_taxes.before',
);
export const orderBeforeSave = defineEvent<Order>('order.save.before');
export const orderAfterSave = defineEvent<Order>('order.save.after');
export const orderNoteAdded = defineEvent<{ noteId: number; order: Order; note: OrderNote }>(
  'order.note.added',
);
export const newCustomerNote = defineEvent<{ orderId: number; customerNote: string }>(
  'order.customer_note.added',
);
export const orderAppliedCoupon = defineEvent<{ coupon: Coupon; order: Order }>(
  'order.coupon.applied',
);
export const orderItemsRemoved = defineEvent<{ order: Order; type: string | null }>(
  'order.items.removed',
);
export const orderRemoveItems = defineEvent<{ order: Order; type: string | null }>(
  'order.items.remove',
);
export const orderNew = defineEvent<Order>('order.created');
export const orderUpdated = defineEvent<Order>('order.updated');
export const orderDeleted = defineEvent<{ id: number }>('order.deleted');
export const orderRefundCreated = defineEvent<{ refund: OrderRefund; order: Order }>(
  'order.refund.created',
);
export const orderFullyRefunded = defineEvent<{ orderId: number; refundId: number }>(
  'order.fully_refunded',
);
export const orderPartiallyRefunded = defineEvent<{ orderId: number; refundId: number }>(
  'order.partially_refunded',
);
export const orderEditStatus = defineEvent<{ orderId: number; status: string }>('order.status.edited');
export const paymentTokenAddedToOrder = defineEvent<{
  orderId: number;
  tokenId: number;
}>('order.payment_token.added');

// --- Customers -------------------------------------------------------------
export const customerCreated = defineEvent<Customer>('customer.created');
export const customerUpdated = defineEvent<Customer>('customer.updated');
export const customerDeleted = defineEvent<{ id: number }>('customer.deleted');
export const resetPasswordNotification = defineEvent<{ customer: Customer; resetKey: string }>(
  'customer.reset_password',
);

// --- Coupons ---------------------------------------------------------------
export const couponCreated = defineEvent<Coupon>('coupon.created');
export const couponUpdated = defineEvent<Coupon>('coupon.updated');
export const couponDeleted = defineEvent<{ id: number }>('coupon.deleted');
export const couponLoaded = defineEvent<Coupon>('coupon.loaded');

// --- Reviews ---------------------------------------------------------------
export const reviewCreated = defineEvent<Review>('review.created');
export const reviewUpdated = defineEvent<Review>('review.updated');

// --- Shipping / tax --------------------------------------------------------
export const shippingInit = defineEvent<undefined>('shipping.init');
export const loadShippingMethods = defineEvent<{ package: unknown }>('shipping.methods.load');
export const beforeGetRatesForPackage = defineEvent<{ package: unknown }>(
  'shipping.package.rates.before',
);
export const afterGetRatesForPackage = defineEvent<{ package: unknown }>(
  'shipping.package.rates.after',
);
export const taxRateAdded = defineEvent<{ taxRateId: number; taxRate: unknown }>('tax.rate.added');
export const taxRateUpdated = defineEvent<{ taxRateId: number; taxRate: unknown }>(
  'tax.rate.updated',
);
export const taxRateDeleted = defineEvent<{ taxRateId: number }>('tax.rate.deleted');
export const orderItemAfterCalculateTaxes = defineEvent<{
  item: OrderItem;
  calculateTaxFor: unknown;
}>('order.item.taxes.calculated');

// --- Webhooks / lifecycle --------------------------------------------------
export const webhookDelivered = defineEvent<{
  webhookId: number;
  responseStatus: number | null;
  ok: boolean;
}>('webhook.delivered');
export const appInit = defineEvent<undefined>('app.init');
export const appLoaded = defineEvent<undefined>('app.loaded');
export const registerPostType = defineEvent<undefined>('app.register_post_type');
export const afterRegisterPostType = defineEvent<undefined>('app.register_post_type.after');
export const registerTaxonomy = defineEvent<undefined>('app.register_taxonomy');
export const afterRegisterTaxonomy = defineEvent<undefined>('app.register_taxonomy.after');

// --- Dynamic hook families -------------------------------------------------
/** `order.status.{to}` — fired on entering a status. */
export const orderStatusEvent = (to: string) =>
  defineEvent<{ orderId: number; order: Order }>(`order.status.${to}`);
/** `order.status.{from}_to_{to}` — fired on a specific transition. */
export const orderStatusTransitionEvent = (from: string, to: string) =>
  defineEvent<{ orderId: number; order: Order }>(`order.status.${from}_to_${to}`);
/** `order.payment_complete.status.{status}` — payment complete on a non-valid status. */
export const paymentCompleteOrderStatusEvent = (status: string) =>
  defineEvent<{ orderId: number; transactionId?: string }>(
    `order.payment_complete.status.${status}`,
  );

// --- Filters ---------------------------------------------------------------
export const filterDefaultOrderStatus = defineFilter<string, []>('order.default_status');
export const filterPaymentCompleteOrderStatus = defineFilter<string, [number, Order]>(
  'order.payment_complete.status',
);
export const filterValidOrderStatusesForPaymentComplete = defineFilter<string[], [Order]>(
  'order.valid_statuses_for_payment_complete',
);
export const filterValidOrderStatusesForPayment = defineFilter<string[], [Order]>(
  'order.valid_statuses_for_payment',
);
export const filterOrderNumber = defineFilter<string, [Order]>('order.number');
export const filterOrderIsEditable = defineFilter<boolean, [Order]>('order.is_editable');
export const filterOrderIsPaid = defineFilter<boolean, [Order]>('order.is_paid');
export const filterOrderNeedsPayment = defineFilter<boolean, [Order, string[]]>(
  'order.needs_payment',
);
export const filterOrderIsDownloadPermitted = defineFilter<boolean, [Order]>(
  'order.is_download_permitted',
);
export const filterOrderIsVatExempt = defineFilter<boolean, [Order]>('order.is_vat_exempt');
export const filterOrderGetTaxLocation = defineFilter<Record<string, string>, [Order]>(
  'order.tax_location',
);
export const filterOrderGetItems = defineFilter<OrderItem[], [Order, string[]]>('order.get_items');

export const filterCartNeedsPayment = defineFilter<boolean, [unknown]>('cart.needs_payment');
export const filterCartNeedsShipping = defineFilter<boolean, [unknown]>('cart.needs_shipping');
export const filterCartContentsChanged = defineFilter<Record<string, unknown>, []>(
  'cart.contents_changed',
);
export const filterAddCartItemData = defineFilter<
  Record<string, unknown>,
  [number, number, number | null]
>('cart.add_item_data');
export const filterAddCartItem = defineFilter<Record<string, unknown>, [string]>('cart.add_item');
export const filterAddToCartQuantity = defineFilter<number, [number]>('cart.add_to_cart_quantity');
export const filterCartId = defineFilter<
  string,
  [number, number | null, Record<string, string>, Record<string, unknown>]
>('cart.item_key');
export const filterCartCrosssellIds = defineFilter<number[], [unknown]>('cart.crosssell_ids');
export const filterCartContentsCount = defineFilter<number, [unknown]>('cart.contents_count');
export const filterCartContentsWeight = defineFilter<number, [unknown]>('cart.contents_weight');

export const filterCalcTax = defineFilter<
  Record<string, number>,
  [number, unknown[], boolean]
>('tax.calc');
export const filterCalcShippingTax = defineFilter<Record<string, number>, [number, unknown[]]>(
  'tax.calc_shipping',
);
export const filterTaxRound = defineFilter<number, [number]>('tax.round');
export const filterFindRates = defineFilter<unknown, [Record<string, unknown>]>('tax.find_rates');
export const filterMatchedRates = defineFilter<unknown, [string, unknown]>('tax.matched_rates');
export const filterBaseTaxRates = defineFilter<unknown, [string]>('tax.base_rates');
export const filterShippingPricesIncludeTax = defineFilter<boolean, []>(
  'tax.shipping_prices_include_tax',
);
export const filterShippingTaxClass = defineFilter<string, [unknown]>('tax.shipping_tax_class');
export const filterGetTaxLocation = defineFilter<string[], [string, unknown]>('tax.location');
export const filterApplyBaseTaxForLocalPickup = defineFilter<boolean, []>(
  'tax.apply_base_for_local_pickup',
);
export const filterLocalPickupMethods = defineFilter<string[], []>('shipping.local_pickup_methods');

export const filterCouponIsValid = defineFilter<boolean, [Coupon, unknown]>('coupon.is_valid');
export const filterCouponErrorMessage = defineFilter<string, [number, Coupon | null]>(
  'coupon.error_message',
);
export const filterCouponGetDiscountAmount = defineFilter<
  number,
  [number, unknown, boolean, Coupon]
>('coupon.discount_amount');
export const filterCouponGetItemsToValidate = defineFilter<unknown[], [unknown]>(
  'coupon.items_to_validate',
);
export const filterCouponGetApplyQuantity = defineFilter<number, [unknown, Coupon, unknown]>(
  'coupon.apply_quantity',
);
export const filterGetShopCouponData = defineFilter<Record<string, unknown> | false, [string]>(
  'coupon.virtual_data',
);
export const filterCouponCustomDiscountsArray = defineFilter<Record<string, number>, [Coupon]>(
  'coupon.custom_discounts',
);

export const filterShippingMethods = defineFilter<unknown[], []>('shipping.methods');
export const filterPackageRates = defineFilter<Record<string, unknown>, [unknown]>(
  'shipping.package_rates',
);
export const filterShippingPackages = defineFilter<unknown[], []>('shipping.packages');

export const filterGatewayTitle = defineFilter<string, [string]>('payment.gateway_title');
export const filterGatewayDescription = defineFilter<string, [string]>(
  'payment.gateway_description',
);
export const filterGatewayIcon = defineFilter<string, [string]>('payment.gateway_icon');
export const filterGetReturnUrl = defineFilter<string, [Order | null]>('payment.return_url');
export const filterPaymentGateways = defineFilter<unknown[], []>('payment.gateways');

export const filterCheckoutFields = defineFilter<Record<string, unknown>, []>('checkout.fields');
export const filterCheckoutPostedData = defineFilter<Record<string, unknown>, []>(
  'checkout.posted_data',
);
export const filterCheckoutCustomerId = defineFilter<number | null, []>('checkout.customer_id');
export const filterCheckoutRegistrationRequired = defineFilter<boolean, []>(
  'checkout.registration_required',
);
export const filterCheckoutRegistrationEnabled = defineFilter<boolean, []>(
  'checkout.registration_enabled',
);
export const filterCreateOrder = defineFilter<number | null, [unknown]>('checkout.create_order');
export const filterPaymentSuccessfulResult = defineFilter<Record<string, unknown>, [number]>(
  'checkout.payment_result',
);

export const filterProductIsOnSale = defineFilter<boolean, [Product | ProductVariation]>(
  'product.is_on_sale',
);
export const filterProductIsInStock = defineFilter<boolean, [Product]>('product.is_in_stock');
export const filterProductIsPurchasable = defineFilter<boolean, [Product]>(
  'product.is_purchasable',
);
export const filterProductIsVisible = defineFilter<boolean, [number]>('product.is_visible');
export const filterProductIsTaxable = defineFilter<boolean, [Product]>('product.is_taxable');
export const filterProductNeedsShipping = defineFilter<boolean, [Product]>(
  'product.needs_shipping',
);
export const filterProductIsSoldIndividually = defineFilter<boolean, [Product]>(
  'product.is_sold_individually',
);
export const filterGetPriceHtml = defineFilter<string, [Product]>('product.price_html');
export const filterProductIdBySku = defineFilter<number, [string]>('product.id_by_sku');
export const filterFileDownloadPath = defineFilter<string, [number, string]>(
  'product.file_download_path',
);

/** `product.get_{prop}` / `customer.get_{prop}` getter filter names. */
export const productGetterFilter = (prop: string) => `product.get_${prop}`;
export const variationGetterFilter = (prop: string) => `variation.get_${prop}`;
export const customerGetterFilter = (prop: string) => `customer.get_${prop}`;
export const orderGetterFilter = (prop: string) => `order.get_${prop}`;
export const cartGetterFilter = (prop: string) => `cart.get_${prop}`;
