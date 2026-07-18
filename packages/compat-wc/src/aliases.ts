/**
 * The WC hook-name → canonical event-name table (docs/AGENTS.md §7.3).
 * Sources: comprehensive report §10.1–10.8, core-architecture report §10,
 * api_reference §7. One shared pipeline: `bus.alias()` makes a legacy
 * `woocommerce_*` listener and a typed listener share a priority chain.
 *
 * Names with no canonical counterpart are NOT listed — they pass through
 * unchanged, so `do_action('my_custom_hook')` works symmetrically.
 */

/** Static action aliases. */
export const WC_ACTION_ALIASES: Record<string, string> = {
  // --- Order lifecycle (§10.1) ---
  woocommerce_pre_payment_complete: 'order.payment_complete.before',
  woocommerce_payment_complete: 'order.payment_complete',
  woocommerce_order_status_changed: 'order.status.changed',
  woocommerce_order_payment_status_changed: 'order.payment_status.changed',
  woocommerce_order_edit_status: 'order.status.edited',
  woocommerce_order_before_calculate_totals: 'order.calculate_totals.before',
  woocommerce_order_after_calculate_totals: 'order.calculate_totals.after',
  woocommerce_order_before_calculate_taxes: 'order.calculate_taxes.before',
  woocommerce_before_order_object_save: 'order.save.before',
  woocommerce_after_order_object_save: 'order.save.after',
  woocommerce_order_note_added: 'order.note.added',
  woocommerce_new_customer_note: 'order.customer_note.added',
  woocommerce_order_applied_coupon: 'order.coupon.applied',
  woocommerce_removed_order_items: 'order.items.removed',
  woocommerce_remove_order_items: 'order.items.remove',
  woocommerce_payment_token_added_to_order: 'order.payment_token.added',
  woocommerce_new_order: 'order.created',
  woocommerce_update_order: 'order.updated',
  woocommerce_delete_order: 'order.deleted',
  woocommerce_order_refund_created: 'order.refund.created',
  woocommerce_order_fully_refunded: 'order.fully_refunded',
  woocommerce_order_partially_refunded: 'order.partially_refunded',

  // --- Shipping & tax (§10.2) ---
  woocommerce_shipping_init: 'shipping.init',
  woocommerce_load_shipping_methods: 'shipping.methods.load',
  woocommerce_before_get_rates_for_package: 'shipping.package.rates.before',
  woocommerce_after_get_rates_for_package: 'shipping.package.rates.after',
  woocommerce_tax_rate_added: 'tax.rate.added',
  woocommerce_tax_rate_updated: 'tax.rate.updated',
  woocommerce_tax_rate_deleted: 'tax.rate.deleted',
  woocommerce_order_item_after_calculate_taxes: 'order.item.taxes.calculated',

  // --- Products (core-architecture §10) ---
  woocommerce_before_product_object_save: 'product.save.before',
  woocommerce_after_product_object_save: 'product.save.after',
  woocommerce_new_product: 'product.created',
  woocommerce_update_product: 'product.updated',
  woocommerce_delete_product: 'product.deleted',
  woocommerce_trash_product: 'product.trashed',
  woocommerce_before_delete_product: 'product.delete.before',
  woocommerce_product_set_stock: 'product.stock.set',
  woocommerce_product_before_set_stock: 'product.stock.set.before',
  woocommerce_product_set_stock_status: 'product.stock_status.set',
  woocommerce_variation_set_stock: 'variation.stock.set',
  woocommerce_variation_before_set_stock: 'variation.stock.set.before',
  woocommerce_variation_set_stock_status: 'variation.stock_status.set',
  woocommerce_product_set_visibility: 'product.visibility.set',
  woocommerce_product_type_changed: 'product.type.changed',
  woocommerce_product_object_updated_props: 'product.updated_props',
  woocommerce_product_read: 'product.read',
  woocommerce_product_attributes_updated: 'product.attributes.updated',
  woocommerce_variable_product_sync_data: 'product.variable.synced',

  // --- Cart (core-architecture §10) ---
  woocommerce_add_to_cart: 'cart.item.added',
  woocommerce_remove_cart_item: 'cart.item.remove',
  woocommerce_cart_item_removed: 'cart.item.removed',
  woocommerce_restore_cart_item: 'cart.item.restore',
  woocommerce_cart_item_restored: 'cart.item.restored',
  woocommerce_after_cart_item_quantity_update: 'cart.item.quantity_updated',
  woocommerce_cart_item_set_quantity: 'cart.item.set_quantity',
  woocommerce_before_calculate_totals: 'cart.calculate.before',
  woocommerce_after_calculate_totals: 'cart.calculate.after',
  woocommerce_before_cart_emptied: 'cart.emptied.before',
  woocommerce_cart_emptied: 'cart.emptied',
  woocommerce_check_cart_items: 'cart.check_items',
  woocommerce_applied_coupon: 'cart.coupon.applied',
  woocommerce_removed_coupon: 'cart.coupon.removed',
  woocommerce_cart_calculate_fees: 'cart.calculate_fees',

  // --- Checkout (core-architecture §10) ---
  woocommerce_checkout_init: 'checkout.init',
  woocommerce_before_checkout_process: 'checkout.process.before',
  woocommerce_checkout_process: 'checkout.process',
  woocommerce_after_checkout_validation: 'checkout.validated',
  woocommerce_checkout_create_order: 'checkout.order.create',
  woocommerce_checkout_update_order_meta: 'checkout.order.update_meta',
  woocommerce_checkout_order_created: 'checkout.order.created',
  woocommerce_checkout_order_processed: 'checkout.order.processed',
  woocommerce_checkout_order_exception: 'checkout.order.exception',
  woocommerce_checkout_create_order_line_item: 'checkout.order.line_item.created',
  woocommerce_checkout_create_order_fee_item: 'checkout.order.fee_item.created',
  woocommerce_checkout_create_order_shipping_item: 'checkout.order.shipping_item.created',
  woocommerce_checkout_create_order_tax_item: 'checkout.order.tax_item.created',
  woocommerce_checkout_create_order_coupon_item: 'checkout.order.coupon_item.created',
  woocommerce_checkout_update_customer: 'checkout.customer.updated',
  woocommerce_resume_order: 'checkout.order.resumed',

  // --- Customers ---
  woocommerce_created_customer: 'customer.created',
  woocommerce_update_customer: 'customer.updated',
  woocommerce_delete_customer: 'customer.deleted',
  woocommerce_reset_password_notification: 'customer.reset_password',

  // --- Coupons ---
  woocommerce_new_coupon: 'coupon.created',
  woocommerce_update_coupon: 'coupon.updated',
  woocommerce_delete_coupon: 'coupon.deleted',
  woocommerce_coupon_loaded: 'coupon.loaded',

  // --- Webhooks & lifecycle (api_reference §7.1/7.3) ---
  woocommerce_webhook_delivery: 'webhook.delivered',
  woocommerce_init: 'app.init',
  woocommerce_loaded: 'app.loaded',
  woocommerce_register_post_type: 'app.register_post_type',
  woocommerce_after_register_post_type: 'app.register_post_type.after',
  woocommerce_register_taxonomy: 'app.register_taxonomy',
  woocommerce_after_register_taxonomy: 'app.register_taxonomy.after',
};

/** Static filter aliases. */
export const WC_FILTER_ALIASES: Record<string, string> = {
  // --- Order filters (§10.3) ---
  woocommerce_valid_order_statuses_for_payment_complete:
    'order.valid_statuses_for_payment_complete',
  woocommerce_payment_complete_order_status: 'order.payment_complete.status',
  woocommerce_valid_order_statuses_for_payment: 'order.valid_statuses_for_payment',
  woocommerce_order_number: 'order.number',
  woocommerce_default_order_status: 'order.default_status',
  woocommerce_order_is_editable: 'order.is_editable',
  woocommerce_order_is_paid: 'order.is_paid',
  woocommerce_order_is_download_permitted: 'order.is_download_permitted',
  woocommerce_order_needs_payment: 'order.needs_payment',
  woocommerce_order_get_items: 'order.get_items',
  woocommerce_order_is_vat_exempt: 'order.is_vat_exempt',
  woocommerce_order_get_tax_location: 'order.tax_location',
  woocommerce_apply_base_tax_for_local_pickup: 'tax.apply_base_for_local_pickup',
  woocommerce_local_pickup_methods: 'shipping.local_pickup_methods',

  // --- Tax filters (§10.4) ---
  woocommerce_calc_tax: 'tax.calc',
  woocommerce_calc_shipping_tax: 'tax.calc_shipping',
  woocommerce_tax_round: 'tax.round',
  woocommerce_find_rates: 'tax.find_rates',
  woocommerce_matched_rates: 'tax.matched_rates',
  woocommerce_base_tax_rates: 'tax.base_rates',
  woocommerce_get_tax_location: 'tax.location',
  woocommerce_shipping_prices_include_tax: 'tax.shipping_prices_include_tax',
  woocommerce_shipping_tax_class: 'tax.shipping_tax_class',

  // --- Shipping filters (§10.5) ---
  woocommerce_shipping_methods: 'shipping.methods',
  woocommerce_package_rates: 'shipping.package_rates',
  woocommerce_shipping_packages: 'shipping.packages',

  // --- Coupon filters (§10.6) ---
  woocommerce_coupon_get_discount_amount: 'coupon.discount_amount',
  woocommerce_coupon_is_valid: 'coupon.is_valid',
  woocommerce_coupon_error: 'coupon.error_message',
  woocommerce_coupon_get_items_to_validate: 'coupon.items_to_validate',
  woocommerce_coupon_get_apply_quantity: 'coupon.apply_quantity',
  woocommerce_coupon_custom_discounts_array: 'coupon.custom_discounts',
  woocommerce_get_shop_coupon_data: 'coupon.virtual_data',

  // --- Payment gateway filters (§10.7) ---
  woocommerce_gateway_title: 'payment.gateway_title',
  woocommerce_gateway_description: 'payment.gateway_description',
  woocommerce_gateway_icon: 'payment.gateway_icon',
  woocommerce_get_return_url: 'payment.return_url',
  woocommerce_payment_gateways: 'payment.gateways',

  // --- Checkout filters ---
  woocommerce_checkout_registration_required: 'checkout.registration_required',
  woocommerce_checkout_registration_enabled: 'checkout.registration_enabled',
  woocommerce_checkout_fields: 'checkout.fields',
  woocommerce_checkout_customer_id: 'checkout.customer_id',
  woocommerce_checkout_posted_data: 'checkout.posted_data',
  woocommerce_create_order: 'checkout.create_order',
  woocommerce_payment_successful_result: 'checkout.payment_result',

  // --- Cart filters ---
  woocommerce_cart_id: 'cart.item_key',
  woocommerce_add_to_cart_quantity: 'cart.add_to_cart_quantity',
  woocommerce_add_cart_item_data: 'cart.add_item_data',
  woocommerce_add_cart_item: 'cart.add_item',
  woocommerce_cart_contents_changed: 'cart.contents_changed',
  woocommerce_cart_crosssell_ids: 'cart.crosssell_ids',
  woocommerce_cart_needs_payment: 'cart.needs_payment',
  woocommerce_cart_needs_shipping: 'cart.needs_shipping',
  woocommerce_cart_contents_count: 'cart.contents_count',
  woocommerce_cart_contents_weight: 'cart.contents_weight',

  // --- Product filters ---
  woocommerce_product_is_visible: 'product.is_visible',
  woocommerce_is_purchasable: 'product.is_purchasable',
  woocommerce_product_is_on_sale: 'product.is_on_sale',
  woocommerce_product_is_in_stock: 'product.is_in_stock',
  woocommerce_product_needs_shipping: 'product.needs_shipping',
  woocommerce_product_is_taxable: 'product.is_taxable',
  woocommerce_is_sold_individually: 'product.is_sold_individually',
  woocommerce_get_price_html: 'product.price_html',
  woocommerce_get_product_id_by_sku: 'product.id_by_sku',
  woocommerce_file_download_path: 'product.file_download_path',
};

export const WC_HOOK_ALIASES: Record<string, string> = {
  ...WC_ACTION_ALIASES,
  ...WC_FILTER_ALIASES,
};

/**
 * Dynamic hook families, checked after the static table. Order matters:
 * `{from}_to_{to}` must win over the plain `{to}` status pattern.
 */
const DYNAMIC_PATTERNS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^woocommerce_order_status_([a-z0-9-]+)_to_([a-z0-9-]+)$/, (m) => `order.status.${m[1]}_to_${m[2]}`],
  [/^woocommerce_order_status_([a-z0-9-]+)$/, (m) => `order.status.${m[1]}`],
  [
    /^woocommerce_payment_complete_order_status_([a-z0-9-]+)$/,
    (m) => `order.payment_complete.status.${m[1]}`,
  ],
  [/^woocommerce_product_variation_get_([a-z0-9_]+)$/, (m) => `variation.get_${m[1]}`],
  [/^woocommerce_product_get_([a-z0-9_]+)$/, (m) => `product.get_${m[1]}`],
  [/^woocommerce_customer_get_([a-z0-9_]+)$/, (m) => `customer.get_${m[1]}`],
  [/^woocommerce_order_get_([a-z0-9_]+)$/, (m) => `order.get_${m[1]}`],
  [/^woocommerce_cart_get_([a-z0-9_]+)$/, (m) => `cart.get_${m[1]}`],
];

/**
 * Canonical name for a WC hook: static table first, then the dynamic
 * families, otherwise the name itself (unknown hooks pass through so custom
 * plugin hooks work on the same bus).
 */
export function resolveWcHookName(name: string): string {
  const staticHit = WC_HOOK_ALIASES[name];
  if (staticHit) return staticHit;
  for (const [pattern, build] of DYNAMIC_PATTERNS) {
    const match = pattern.exec(name);
    if (match) return build(match);
  }
  return name;
}
