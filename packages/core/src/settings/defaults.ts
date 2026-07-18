/**
 * Typed settings registry. Keys are WooCommerce option names with the
 * `woocommerce_` prefix stripped; `@spacendigital/compat-wc`'s `get_option()`
 * shim maps prefixed names back onto these. Each key declares which typed
 * settings table stores it (docs/AGENTS.md §5 "Settings").
 */

export type SettingKind = 'string' | 'boolean' | 'integer' | 'json';

export interface SettingDefinition {
  kind: SettingKind;
  default: unknown;
}

export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  // General
  store_name: { kind: 'string', default: 'spcnd-ecom store' },
  store_address: { kind: 'string', default: '' },
  store_address_2: { kind: 'string', default: '' },
  store_city: { kind: 'string', default: '' },
  store_postcode: { kind: 'string', default: '' },
  /** `COUNTRY` or `COUNTRY:STATE`, WC's woocommerce_default_country shape. */
  default_country: { kind: 'string', default: 'US:CA' },
  allowed_countries: { kind: 'string', default: 'all' },
  specific_allowed_countries: { kind: 'json', default: [] },
  ship_to_countries: { kind: 'string', default: '' },
  specific_ship_to_countries: { kind: 'json', default: [] },
  default_customer_address: { kind: 'string', default: 'base' },
  store_url: { kind: 'string', default: 'http://localhost:4321' },

  // Currency
  currency: { kind: 'string', default: 'USD' },
  currency_pos: { kind: 'string', default: 'left' },
  price_thousand_sep: { kind: 'string', default: ',' },
  price_decimal_sep: { kind: 'string', default: '.' },
  price_num_decimals: { kind: 'integer', default: 2 },

  // Tax
  calc_taxes: { kind: 'boolean', default: false },
  prices_include_tax: { kind: 'boolean', default: false },
  tax_based_on: { kind: 'string', default: 'shipping' },
  shipping_tax_class: { kind: 'string', default: 'inherit' },
  tax_round_at_subtotal: { kind: 'boolean', default: false },
  tax_display_shop: { kind: 'string', default: 'excl' },
  tax_display_cart: { kind: 'string', default: 'excl' },
  price_display_suffix: { kind: 'string', default: '' },
  tax_total_display: { kind: 'string', default: 'itemized' },

  // Coupons / discounts
  enable_coupons: { kind: 'boolean', default: true },
  calc_discounts_sequentially: { kind: 'boolean', default: false },

  // Checkout & accounts
  enable_guest_checkout: { kind: 'boolean', default: true },
  enable_checkout_login_reminder: { kind: 'boolean', default: false },
  enable_signup_and_login_from_checkout: { kind: 'boolean', default: false },
  enable_myaccount_registration: { kind: 'boolean', default: false },
  registration_generate_username: { kind: 'boolean', default: true },
  registration_generate_password: { kind: 'boolean', default: true },
  checkout_terms_page_id: { kind: 'integer', default: 0 },

  // Products & inventory
  shop_page_display: { kind: 'string', default: '' },
  default_catalog_orderby: { kind: 'string', default: 'menu_order' },
  weight_unit: { kind: 'string', default: 'kg' },
  dimension_unit: { kind: 'string', default: 'cm' },
  enable_reviews: { kind: 'boolean', default: true },
  review_rating_verification_label: { kind: 'boolean', default: true },
  review_rating_verification_required: { kind: 'boolean', default: false },
  enable_review_rating: { kind: 'boolean', default: true },
  review_rating_required: { kind: 'boolean', default: true },
  manage_stock: { kind: 'boolean', default: true },
  hold_stock_minutes: { kind: 'integer', default: 60 },
  notify_low_stock: { kind: 'boolean', default: true },
  notify_no_stock: { kind: 'boolean', default: true },
  stock_email_recipient: { kind: 'string', default: '' },
  notify_low_stock_amount: { kind: 'integer', default: 2 },
  notify_no_stock_amount: { kind: 'integer', default: 0 },
  hide_out_of_stock_items: { kind: 'boolean', default: false },
  stock_format: { kind: 'string', default: '' },

  // Downloads
  file_download_method: { kind: 'string', default: 'force' },
  downloads_require_login: { kind: 'boolean', default: false },
  downloads_grant_access_after_payment: { kind: 'boolean', default: true },
  downloads_deliver_inline: { kind: 'boolean', default: false },
  downloads_add_hash_to_filename: { kind: 'boolean', default: true },

  // Shipping
  enable_shipping_calc: { kind: 'boolean', default: true },
  shipping_cost_requires_address: { kind: 'boolean', default: false },
  ship_to_destination: { kind: 'string', default: 'billing' },
  shipping_debug_mode: { kind: 'boolean', default: false },

  // Email
  email_from_name: { kind: 'string', default: 'spcnd-ecom store' },
  email_from_address: { kind: 'string', default: 'store@example.com' },
  email_footer_text: { kind: 'string', default: '{site_title} — Built with spcnd-ecom' },
  email_base_color: { kind: 'string', default: '#720eec' },
  email_background_color: { kind: 'string', default: '#f7f7f7' },
  email_body_background_color: { kind: 'string', default: '#ffffff' },
  email_text_color: { kind: 'string', default: '#3c3c3c' },
  merchant_email: { kind: 'string', default: 'admin@example.com' },
  /** Per-template config for the 22 emails: {enabled, subject, heading, additional_content, cc, bcc}. */
  email_settings: { kind: 'json', default: {} },

  // Privacy / GDPR retention (value + unit, WC's relative date shape)
  erasure_request_removes_order_data: { kind: 'boolean', default: false },
  erasure_request_removes_download_data: { kind: 'boolean', default: false },
  anonymize_completed_orders: { kind: 'json', default: { number: '', unit: 'months' } },
  delete_inactive_accounts: { kind: 'json', default: { number: '', unit: 'months' } },
  trash_pending_orders: { kind: 'json', default: { number: '', unit: 'days' } },
  trash_failed_orders: { kind: 'json', default: { number: '', unit: 'days' } },
  trash_cancelled_orders: { kind: 'json', default: { number: '', unit: 'days' } },

  // Advanced / API
  api_enabled: { kind: 'boolean', default: true },
  cart_redirect_after_add: { kind: 'boolean', default: false },
  enable_ajax_add_to_cart: { kind: 'boolean', default: true },

  // Session / cart persistence
  session_expiration_seconds: { kind: 'integer', default: 60 * 60 * 48 },
  cart_hash_key: { kind: 'string', default: '' },

  // Site visibility
  coming_soon: { kind: 'boolean', default: false },
  store_pages_only: { kind: 'boolean', default: false },
};

export function settingKind(key: string): SettingKind | undefined {
  return SETTING_DEFINITIONS[key]?.kind;
}

export function settingDefault(key: string): unknown {
  return SETTING_DEFINITIONS[key]?.default;
}
