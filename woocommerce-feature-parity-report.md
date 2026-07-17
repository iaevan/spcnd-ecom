# WooCommerce Feature-Parity Clone — Comprehensive Architecture Report

> Generated from the WooCommerce `trunk` branch (July 2026). All paths relative to `plugins/woocommerce/`.

---

## TABLE OF CONTENTS

1. [Admin UI Architecture](#1-admin-ui-architecture)
2. [Settings System](#2-settings-system)
3. [Email Templates](#3-email-templates)
4. [Frontend Templates](#4-frontend-templates)
5. [Shortcodes](#5-shortcodes)
6. [Form Handling](#6-form-handling)
7. [Frontend Scripts & Assets](#7-frontend-scripts--assets)
8. [Installation Logic](#8-installation-logic)
9. [Analytics & Reporting](#9-analytics--reporting)
10. [Key Patterns & Architecture Notes](#10-key-patterns--architecture-notes)

---

## 1. ADMIN UI ARCHITECTURE

### 1.1 Admin Directory Structure (`includes/admin/`)

```
admin/
├── helper/                    # WooCommerce.com helper/connection
├── importers/                 # CSV product importers
├── list-tables/               # Custom WP_List_Table subclasses
├── marketplace-suggestions/   # Marketplace suggestion engine
├── meta-boxes/                # Product/Order/Coupon meta boxes
├── notes/                     # Admin inbox notes
├── plugin-updates/            # Plugin update checks
├── reports/                   # Legacy reports
├── settings/                  # Settings page classes
│   ├── class-wc-settings-page.php (base)
│   ├── class-wc-settings-general.php
│   ├── class-wc-settings-products.php
│   ├── class-wc-settings-tax.php
│   ├── class-wc-settings-shipping.php
│   ├── class-wc-settings-payment-gateways.php
│   ├── class-wc-settings-accounts.php
│   ├── class-wc-settings-emails.php
│   ├── class-wc-settings-integrations.php
│   ├── class-wc-settings-site-visibility.php
│   ├── class-wc-settings-point-of-sale.php
│   └── class-wc-settings-advanced.php
├── views/                     # Admin HTML view partials
├── class-wc-admin.php         # Main admin bootstrap
├── class-wc-admin-addons.php
├── class-wc-admin-api-keys.php
├── class-wc-admin-api-keys-table-list.php
├── class-wc-admin-assets.php  # Admin CSS/JS enqueuing
├── class-wc-admin-attributes.php
├── class-wc-admin-brands.php
├── class-wc-admin-customize.php
├── class-wc-admin-dashboard.php
├── class-wc-admin-dashboard-setup.php
├── class-wc-admin-duplicate-product.php
├── class-wc-admin-exporters.php
├── class-wc-admin-help.php
├── class-wc-admin-importers.php
├── class-wc-admin-log-table-list.php
├── class-wc-admin-marketplace-promotions.php
├── class-wc-admin-menus.php   # Admin menu registration
├── class-wc-admin-meta-boxes.php
├── class-wc-admin-notices.php
├── class-wc-admin-permalink-settings.php
├── class-wc-admin-pointers.php
├── class-wc-admin-post-types.php
├── class-wc-admin-profile.php
├── class-wc-admin-reports.php
├── class-wc-admin-settings.php # Settings engine
├── class-wc-admin-setup-wizard.php
├── class-wc-admin-status.php
├── class-wc-admin-taxonomies.php
├── class-wc-admin-upload-downloadable-product.php
├── class-wc-admin-webhooks.php
├── class-wc-admin-webhooks-table-list.php
├── wc-admin-functions.php
├── wc-meta-box-functions.php
└── woocommerce-legacy-reports.php
```

### 1.2 WC_Admin Main Class

**Bootstrap sequence** (constructor hooks):
- `init` → `includes()` — loads all admin class files
- `admin_menu` (priority 1) → `init_page_controller()` — PageController for WC Admin pages
- `current_screen` → `conditional_includes()` — screen-specific includes
- `admin_init` → `buffer()`, `preview_emails()`, `prevent_admin_access()`, `admin_redirects()`
- `admin_footer` → `wc_print_js()`
- `admin_footer_text` → custom footer on WC pages
- `admin_body_class` → WP version compatibility classes

**Access control**: Users without `edit_posts`, `manage_woocommerce`, or `view_admin_dashboard` are redirected to My Account.

**Conditional includes by screen**:
| Screen ID | Include |
|-----------|---------|
| `dashboard` / `dashboard-network` | `class-wc-admin-dashboard-setup.php`, `class-wc-admin-dashboard.php` |
| `options-permalink` | `class-wc-admin-permalink-settings.php` |
| `plugins` | `plugin-updates/class-wc-plugins-screen-updates.php` |
| `update-core` | `plugin-updates/class-wc-updates-screen-updates.php` |
| `users` / `user` / `profile` / `user-edit` | `class-wc-admin-profile.php` |

---

## 2. SETTINGS SYSTEM

### 2.1 WC_Admin_Settings Engine

**Core methods**:
- `get_settings_pages()` — returns array of `WC_Settings_Page` subclasses
- `output()` — renders settings page with tabs
- `output_fields($options)` — renders individual field types
- `save_fields($options, $data)` — saves posted values
- `get_option($option_name, $default)` — retrieves option with array notation support

**Supported field types**:
| Type | Description |
|------|-------------|
| `title` | Section heading, opens `<table>` |
| `sectionend` | Closes `</table>` |
| `text`, `password`, `email`, `url`, `tel`, `number`, `date`, `datetime`, etc. | Standard HTML inputs |
| `color` | Color picker with preview |
| `textarea` | Multi-line text |
| `select` / `multiselect` | Dropdown / multi-select |
| `radio` | Radio button group |
| `checkbox` | Checkbox with group support |
| `image_width` | Width × Height + crop checkbox (deprecated) |
| `single_select_page` | Page dropdown |
| `single_select_page_with_search` | Searchable page select |
| `single_select_country` | Country + state dropdown |
| `multi_select_countries` | Multi-select country list |
| `relative_date_selector` | Number + unit (days/weeks/months/years) |
| `slotfill_placeholder` | React mount point `<div>` |
| `notice` | Admin notice (info/warning/error/success) |
| `info` | Informational text row |

### 2.2 Settings Tabs (11 pages)

#### Tab 1: General (`general`)
**Sections**: Default only

**Store Address**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_store_address` | text | `''` |
| `woocommerce_store_address_2` | text | `''` |
| `woocommerce_store_city` | text | `''` |
| `woocommerce_default_country` | single_select_country | `'US:CA'` |
| `woocommerce_store_postcode` | text | `''` |

**General Options**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_allowed_countries` | select | `'all'` (all/all_except/specific) |
| `woocommerce_all_except_countries` | multi_select_countries | `''` |
| `woocommerce_specific_allowed_countries` | multi_select_countries | `''` |
| `woocommerce_ship_to_countries` | select | `''` (''/all/specific/disabled) |
| `woocommerce_specific_ship_to_countries` | multi_select_countries | `''` |
| `woocommerce_default_customer_address` | select | `geolocation` (no_default/base/geolocation/geolocation_ajax) |
| `woocommerce_address_autocomplete_enabled` | checkbox | `'no'` |
| `woocommerce_address_autocomplete_provider` | select | (first provider) |

**Taxes and Coupons**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_calc_taxes` | checkbox | `'no'` |
| `woocommerce_enable_coupons` | checkbox | `'yes'` |
| `woocommerce_calc_discounts_sequentially` | checkbox | `'no'` |

**Currency Options**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_currency` | select | `'USD'` |
| `woocommerce_currency_pos` | select | `'left'` (left/right/left_space/right_space) |
| `woocommerce_price_thousand_sep` | text | `','` |
| `woocommerce_price_decimal_sep` | text | `'.'` |
| `woocommerce_price_num_decimals` | number | `'2'` |

#### Tab 2: Products (`products`)
**Sections**: General, Inventory, Downloadable products

**General section — Shop pages**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_shop_page_id` | single_select_page | `''` |
| `woocommerce_cart_redirect_after_add` | checkbox | `'no'` |
| `woocommerce_enable_ajax_add_to_cart` | checkbox | `'yes'` |
| `woocommerce_placeholder_image` | text | `''` |

**Measurements**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_weight_unit` | select | `'lbs'` (kg/g/lbs/oz) |
| `woocommerce_dimension_unit` | select | `'in'` (m/cm/mm/in/yd) |

**Reviews**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_enable_reviews` | checkbox | `'yes'` |
| `woocommerce_review_rating_verification_label` | checkbox | `'yes'` |
| `woocommerce_review_rating_verification_required` | checkbox | `'no'` |
| `woocommerce_enable_review_rating` | checkbox | `'yes'` |
| `woocommerce_review_rating_required` | checkbox | `'yes'` |

**Inventory section**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_manage_stock` | checkbox | `'yes'` |
| `woocommerce_hold_stock_minutes` | number | `'60'` |
| `woocommerce_notify_low_stock` | checkbox | `'yes'` |
| `woocommerce_notify_no_stock` | checkbox | `'yes'` |
| `woocommerce_notify_backorder` | checkbox | `'yes'` |
| `woocommerce_stock_email_recipient` | text | admin_email |
| `woocommerce_notify_low_stock_amount` | number | `'2'` |
| `woocommerce_notify_no_stock_amount` | number | `'0'` |
| `woocommerce_hide_out_of_stock_items` | checkbox | `'no'` |
| `woocommerce_stock_format` | select | `''` (''/low_amount/no_amount) |

**Downloadable products section**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_file_download_method` | select | `'force'` (force/xsendfile/redirect) |
| `woocommerce_downloads_redirect_fallback_allowed` | checkbox | `'no'` |
| `woocommerce_downloads_require_login` | checkbox | `'no'` |
| `woocommerce_downloads_grant_access_after_payment` | checkbox | `'yes'` |
| `woocommerce_downloads_deliver_inline` | checkbox | `false` |
| `woocommerce_downloads_add_hash_to_filename` | checkbox | `'yes'` |
| `woocommerce_downloads_count_partial` | checkbox | `'yes'` |

#### Tab 3: Tax (`tax`)
**Sections**: Tax options, Standard rates, [dynamic tax class rates]

Only visible when `wc_tax_enabled()`. Tax rates are stored in `{prefix}woocommerce_tax_rates` and `{prefix}woocommerce_tax_rate_locations` tables. Settings include prices_include_tax, tax display options, etc.

#### Tab 4: Shipping (`shipping`)
**Sections**: Shipping zones, Shipping settings, Classes, [dynamic shipping methods]

**Shipping settings**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_enable_shipping_calc` | checkbox | `'yes'` |
| `woocommerce_shipping_cost_requires_address` | checkbox | `'no'` |
| `woocommerce_shipping_hide_rates_when_free` | checkbox | `'no'` |
| `woocommerce_ship_to_destination` | radio | `'billing'` (shipping/billing/billing_only) |
| `woocommerce_shipping_debug_mode` | checkbox | `'no'` |

#### Tab 5: Payment Gateways (`payment_gateways`)
Lists available payment gateways with enable/disable toggles. Each gateway has its own settings screen.

#### Tab 6: Accounts & Privacy (`account`)

**Account registration**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_enable_guest_checkout` | checkbox | `'yes'` |
| `woocommerce_enable_checkout_login_reminder` | checkbox | `'no'` |
| `woocommerce_enable_delayed_account_creation` | checkbox | `'no'` |
| `woocommerce_enable_signup_and_login_from_checkout` | checkbox | `'no'` |
| `woocommerce_enable_myaccount_registration` | checkbox | `'no'` |
| `woocommerce_registration_generate_password` | checkbox | `'yes'` |
| `woocommerce_registration_generate_username` | checkbox | `'yes'` |
| `woocommerce_erasure_request_removes_order_data` | checkbox | `'no'` |
| `woocommerce_erasure_request_removes_download_data` | checkbox | `'no'` |
| `woocommerce_allow_bulk_remove_personal_data` | checkbox | `'no'` |

**Privacy policy**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_registration_privacy_policy_text` | textarea | (default text with [privacy_policy]) |
| `woocommerce_checkout_privacy_policy_text` | textarea | (default text with [privacy_policy]) |

**Personal data retention** (all `relative_date_selector`):
| Option ID | Default |
|-----------|---------|
| `woocommerce_delete_inactive_accounts` | `''` (months) |
| `woocommerce_trash_pending_orders` | `''` |
| `woocommerce_trash_failed_orders` | `''` |
| `woocommerce_trash_cancelled_orders` | `''` |
| `woocommerce_anonymize_refunded_orders` | `''` (months) |
| `woocommerce_anonymize_completed_orders` | `''` (months) |

#### Tab 7: Emails (`email`)

**Email sender options**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_email_from_name` | text | blog name |
| `woocommerce_email_from_address` | email | admin_email |
| `woocommerce_email_reply_to_enabled` | checkbox | `'no'` |
| `woocommerce_email_reply_to_name` | text | `''` |
| `woocommerce_email_reply_to_address` | email | `''` |

**Email template options** (when block editor disabled):
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_email_header_image` | email_image_url | `''` |
| `woocommerce_email_header_image_width` | number | `'120'` |
| `woocommerce_email_header_alignment` | select | `'left'` |
| `woocommerce_email_font_family` | email_font_family | `'Helvetica'` |
| `woocommerce_email_footer_text` | textarea | `'{site_title}<br />{store_address}'` |
| `woocommerce_email_base_color` | color | (from EmailColors defaults) |
| `woocommerce_email_background_color` | color | (from EmailColors defaults) |
| `woocommerce_email_body_background_color` | color | (from EmailColors defaults) |
| `woocommerce_email_text_color` | color | (from EmailColors defaults) |
| `woocommerce_email_footer_text_color` | color | (from EmailColors defaults) |
| `woocommerce_email_auto_sync_with_theme` | hidden | `'no'` |

#### Tab 8: Integrations (`integrations`)
Dynamic — loaded from registered integration classes.

#### Tab 9: Site Visibility (`site-visibility`)
Controls coming soon / maintenance mode settings.

#### Tab 10: Point of Sale (`point-of-sale`)
POS-specific settings (when feature enabled).

#### Tab 11: Advanced (`advanced`)
**Sections**: Page setup, REST API keys, REST API caching, Webhooks, Legacy API, WooCommerce.com, Blueprint

**Page setup**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_cart_page_id` | single_select_page_with_search | `''` |
| `woocommerce_checkout_page_id` | single_select_page_with_search | checkout page ID |
| `woocommerce_myaccount_page_id` | single_select_page_with_search | `''` |
| `woocommerce_terms_page_id` | single_select_page_with_search | `''` |

**Checkout endpoints**:
| Option ID | Default |
|-----------|---------|
| `woocommerce_checkout_pay_endpoint` | `'order-pay'` |
| `woocommerce_checkout_order_received_endpoint` | `'order-received'` |
| `woocommerce_myaccount_add_payment_method_endpoint` | `'add-payment-method'` |
| `woocommerce_myaccount_delete_payment_method_endpoint` | `'delete-payment-method'` |
| `woocommerce_myaccount_set_default_payment_method_endpoint` | `'set-default-payment-method'` |

**Account endpoints**:
| Option ID | Default |
|-----------|---------|
| `woocommerce_myaccount_orders_endpoint` | `'orders'` |
| `woocommerce_myaccount_view_order_endpoint` | `'view-order'` |
| `woocommerce_myaccount_downloads_endpoint` | `'downloads'` |
| `woocommerce_myaccount_edit_account_endpoint` | `'edit-account'` |
| `woocommerce_myaccount_edit_address_endpoint` | `'edit-address'` |
| `woocommerce_myaccount_payment_methods_endpoint` | `'payment-methods'` |
| `woocommerce_myaccount_lost_password_endpoint` | `'lost-password'` |
| `woocommerce_logout_endpoint` | `'customer-logout'` |

**SSL**:
| Option ID | Default |
|-----------|---------|
| `woocommerce_force_ssl_checkout` | `'no'` |
| `woocommerce_unforce_ssl_checkout` | `'no'` |

**WooCommerce.com section**:
| Option ID | Type | Default |
|-----------|------|---------|
| `woocommerce_allow_tracking` | checkbox | `'no'` |
| `woocommerce_show_marketplace_suggestions` | checkbox | `'yes'` |

---

## 3. EMAIL TEMPLATES

### 3.1 Base Email Class (`WC_Email`)

Extends `WC_Settings_API`. Key properties:
- `$id` — email method ID
- `$title`, `$description`
- `$enabled` — `'yes'`/`'no'`
- `$subject`, `$heading` — with placeholder support
- `$template_html`, `$template_plain`, `$template_block`
- `$template_base` — defaults to `WC()->plugin_path() . '/templates/'`
- `$recipient`, `$cc`, `$bcc`
- `$object` — the order/customer/product this email is for
- `$manual` — true if manually sent only
- `$customer_email` — true if customer-facing
- `$email_group` — grouping slug
- `$placeholders` — `{site_title}`, `{site_address}`, `{site_url}`, `{store_email}` (always present)

**Email types**: `plain`, `html`, `multipart`

**Form fields** (per-email configurable):
- `enabled` (checkbox, default `'yes'`)
- `subject` (text, placeholder shows available placeholders)
- `heading` (text)
- `additional_content` (textarea)
- `email_type` (select: plain/html/multipart)
- `cc` (text, when email_improvements enabled)
- `bcc` (text, when email_improvements enabled)
- `preheader` (text, when block_email_editor enabled)

**Email groups**: `accounts`, `orders`, `order-updates`, `order-changes`, `payments`

**CSS inlining**: Uses Emogrifier (CssInliner + CssToAttributeConverter + HtmlPruner) for HTML emails. Styles from `emails/email-styles.php` template + `woocommerce_email_styles` filter.

### 3.2 All Email Classes (22 total)

| # | Class | ID | Type | Trigger | Customer? | Template (HTML) | Template (Plain) |
|---|-------|----|------|---------|-----------|-----------------|------------------|
| 1 | `WC_Email_New_Order` | `new_order` | Admin | `woocommerce_order_status_pending_to_processing`, `..._completed`, `..._on-hold` | No | `emails/admin-new-order.php` | `emails/plain/admin-new-order.php` |
| 2 | `WC_Email_Cancelled_Order` | `cancelled_order` | Admin | `woocommerce_order_status_pending_to_cancelled`, `..._on-hold_to_cancelled` | No | `emails/admin-cancelled-order.php` | `emails/plain/admin-cancelled-order.php` |
| 3 | `WC_Email_Failed_Order` | `failed_order` | Admin | `woocommerce_order_status_failed` | No | `emails/admin-failed-order.php` | `emails/plain/admin-failed-order.php` |
| 4 | `WC_Email_Customer_On_Hold_Order` | `customer_on_hold_order` | Customer | `woocommerce_order_status_on-hold` | Yes | `emails/customer-on-hold-order.php` | `emails/plain/customer-on-hold-order.php` |
| 5 | `WC_Email_Customer_Processing_Order` | `customer_processing_order` | Customer | `woocommerce_order_status_processing` | Yes | `emails/customer-processing-order.php` | `emails/plain/customer-processing-order.php` |
| 6 | `WC_Email_Customer_Completed_Order` | `customer_completed_order` | Customer | `woocommerce_order_status_completed` | Yes | `emails/customer-completed-order.php` | `emails/plain/customer-completed-order.php` |
| 7 | `WC_Email_Customer_Refunded_Order` | `customer_refunded_order` | Customer | `woocommerce_order_fully_refunded` | Yes | `emails/customer-refunded-order.php` | `emails/plain/customer-refunded-order.php` |
| 8 | `WC_Email_Customer_Partially_Refunded_Order` | `customer_partially_refunded_order` | Customer | `woocommerce_order_partially_refunded` | Yes | `emails/customer-partially-refunded-order.php` | `emails/plain/customer-partially-refunded-order.php` |
| 9 | `WC_Email_Customer_Invoice` | `customer_invoice` | Customer | Manual / `woocommerce_order_status_..._to_pending`, `..._to_processing`, `..._to_on-hold` | Yes | `emails/customer-invoice.php` | `emails/plain/customer-invoice.php` |
| 10 | `WC_Email_Customer_Note` | `customer_note` | Customer | `woocommerce_new_customer_note` | Yes | `emails/customer-note.php` | `emails/plain/customer-note.php` |
| 11 | `WC_Email_Customer_New_Account` | `customer_new_account` | Customer | `woocommerce_created_customer` | Yes | `emails/customer-new-account.php` | `emails/plain/customer-new-account.php` |
| 12 | `WC_Email_Customer_Reset_Password` | `customer_reset_password` | Customer | `woocommerce_reset_password_notification` | Yes | `emails/customer-reset-password.php` | `emails/plain/customer-reset-password.php` |
| 13 | `WC_Email_Customer_Cancelled_Order` | `customer_cancelled_order` | Customer | `woocommerce_order_status_cancelled` | Yes | `emails/customer-cancelled-order.php` | `emails/plain/customer-cancelled-order.php` |
| 14 | `WC_Email_Customer_Failed_Order` | `customer_failed_order` | Customer | `woocommerce_order_status_failed` | Yes | `emails/customer-failed-order.php` | `emails/plain/customer-failed-order.php` |
| 15 | `WC_Email_Customer_Review_Request` | `customer_review_request` | Customer | `woocommerce_order_status_completed` (delayed) | Yes | `emails/customer-review-request.php` | `emails/plain/customer-review-request.php` |
| 16 | `WC_Email_Customer_Abandoned_Cart_Recovery` | `customer_abandoned_cart_recovery` | Customer | Scheduled abandoned cart | Yes | `emails/customer-abandoned-cart-recovery.php` | — |
| 17 | `WC_Email_Customer_Fulfillment_Created` | `customer_fulfillment_created` | Customer | Fulfillment created | Yes | `emails/customer-fulfillment-created.php` | — |
| 18 | `WC_Email_Customer_Fulfillment_Updated` | `customer_fulfillment_updated` | Customer | Fulfillment updated | Yes | `emails/customer-fulfillment-updated.php` | — |
| 19 | `WC_Email_Customer_Fulfillment_Deleted` | `customer_fulfillment_deleted` | Customer | Fulfillment deleted | Yes | `emails/customer-fulfillment-deleted.php` | — |
| 20 | `WC_Email_Customer_POS_Completed_Order` | `customer_pos_completed_order` | Customer | POS order completed | Yes | `emails/customer-pos-completed-order.php` | — |
| 21 | `WC_Email_Customer_POS_Refunded_Order` | `customer_pos_refunded_order` | Customer | POS order refunded | Yes | `emails/customer-pos-refunded-order.php` | — |
| 22 | `WC_Email_Admin_Payment_Gateway_Enabled` | `admin_payment_gateway_enabled` | Admin | Payment gateway activated | No | `emails/admin-payment-gateway-enabled.php` | — |

### 3.3 Email Template Files (`templates/emails/`)

**Shared partials**:
- `email-header.php` — email header with logo/site title
- `email-footer.php` — email footer with footer text
- `email-styles.php` — CSS styles for email
- `email-addresses.php` — billing/shipping addresses
- `email-button.php` — reusable button component
- `email-customer-details.php` — customer details table
- `email-downloads.php` — downloadable products table
- `email-order-details.php` — order details table
- `email-order-items.php` — order line items table
- `email-fulfillment-details.php` — fulfillment details
- `email-fulfillment-items.php` — fulfillment items
- `email-mobile-messaging.php` — mobile messaging CTA

**Subdirectories**:
- `block/` — block email editor templates
  - `general-block-email.php`
- `plain/` — plain text versions of all email templates

**Stock notification templates** (new):
- `customer-stock-notification.php`
- `customer-stock-notification-verify.php`
- `customer-stock-notification-verified.php`
- `customer-verify-email.php`

---

## 4. FRONTEND TEMPLATES

### 4.1 Template Directory Structure (`templates/`)

```
templates/
├── auth/                          # OAuth authorization page
├── block-notices/                 # Block-based notice templates
├── brands/                        # Brand taxonomy templates
├── cart/                          # Cart page templates
├── checkout/                      # Checkout page templates
├── emails/                        # Email templates (see §3)
├── global/                        # Global wrapper templates
├── loop/                          # Product loop/archive templates
├── myaccount/                     # My Account page templates
├── notices/                       # Frontend notice templates
├── order/                         # Order detail/tracking templates
├── parts/                         # Block theme parts
├── product-form/                  # Product form templates
├── single-product/                # Single product page templates
├── templates/                     # Block theme templates
├── archive-product.php            # Product archive page
├── content-product-cat.php        # Product category in loop
├── content-product.php            # Product in loop
├── content-single-product.php     # Single product content
├── content-widget-price-filter.php
├── content-widget-product.php
├── content-widget-reviews.php
├── dashboard-widget-reviews.php
├── product-searchform.php         # Product search form
├── single-product-reviews.php     # Product reviews
├── single-product.php             # Single product page
├── taxonomy-product-attribute.php # Attribute taxonomy archive
├── taxonomy-product-cat.php       # Category taxonomy archive
└── taxonomy-product-tag.php       # Tag taxonomy archive
```

### 4.2 Checkout Templates (`templates/checkout/`)

| File | Purpose |
|------|---------|
| `form-checkout.php` | Main checkout form wrapper |
| `form-billing.php` | Billing address fields |
| `form-shipping.php` | Shipping address fields |
| `form-coupon.php` | Coupon code input |
| `form-login.php` | Login form (for returning customers) |
| `form-pay.php` | Pay for existing order form |
| `form-verify-email.php` | Email verification form |
| `payment.php` | Payment methods list |
| `payment-method.php` | Individual payment method |
| `review-order.php` | Order review table |
| `terms.php` | Terms & conditions checkbox |
| `thankyou.php` | Order confirmation/thank you page |
| `order-received.php` | Order received details |
| `order-receipt.php` | Order receipt |
| `cart-errors.php` | Cart error display |

### 4.3 My Account Templates (`templates/myaccount/`)

| File | Purpose |
|------|---------|
| `my-account.php` | Main My Account wrapper |
| `dashboard.php` | Dashboard overview |
| `navigation.php` | Account navigation menu |
| `orders.php` | Order history list |
| `view-order.php` | Single order view |
| `downloads.php` | Downloadable products list |
| `my-downloads.php` | Legacy downloads |
| `my-orders.php` | Legacy orders |
| `my-address.php` | Address management |
| `payment-methods.php` | Saved payment methods |
| `form-login.php` | Login/register form |
| `form-edit-account.php` | Edit account details form |
| `form-edit-address.php` | Edit billing/shipping address form |
| `form-add-payment-method.php` | Add payment method form |
| `form-lost-password.php` | Lost password form |
| `form-reset-password.php` | Reset password form |
| `lost-password-confirmation.php` | Lost password confirmation |

### 4.4 Template Override System

Templates can be overridden in themes at: `yourtheme/woocommerce/`

The `wc_get_template()` / `wc_get_template_html()` functions search:
1. `yourtheme/woocommerce/{template}`
2. `woocommerce/templates/{template}` (plugin default)

---

## 5. SHORTCODES

### 5.1 Registered Shortcodes (20 total)

| Shortcode | Method | Description | Key Attributes |
|-----------|--------|-------------|----------------|
| `[product]` | `product()` | Single product display | `id`, `sku` |
| `[product_page]` | `product_page()` | Full single product page | `id`, `sku`, `status`, `show_title` |
| `[product_category]` | `product_category()` | Products in a category | `category`, `limit` (12), `columns` (4), `orderby`, `order`, `cat_operator` |
| `[product_categories]` | `product_categories()` | List product categories | `limit` (-1), `orderby` (name), `order`, `columns` (4), `hide_empty` (1), `parent`, `ids` |
| `[add_to_cart]` | `product_add_to_cart()` | Product price + add to cart button | `id`, `sku`, `class`, `quantity` (1), `style`, `show_price` |
| `[add_to_cart_url]` | `product_add_to_cart_url()` | Just the add to cart URL | `id`, `sku` |
| `[products]` | `products()` | Multiple products (generic) | `limit` (12), `columns` (4), `orderby`, `order`, `category`, `cat_operator`, `on_sale`, `best_selling`, `top_rated`, `ids`, `skus`, `class`, `paginate`, `cache` |
| `[recent_products]` | `recent_products()` | Recently added products | `limit` (12), `columns` (4), `orderby` (date), `order` (DESC), `category`, `cat_operator` |
| `[sale_products]` | `sale_products()` | Products on sale | `limit` (12), `columns` (4), `orderby` (title), `order` (ASC), `category`, `cat_operator` |
| `[best_selling_products]` | `best_selling_products()` | Best selling products | `limit` (12), `columns` (4), `category`, `cat_operator` |
| `[top_rated_products]` | `top_rated_products()` | Top rated products | `limit` (12), `columns` (4), `orderby` (title), `order` (ASC), `category`, `cat_operator` |
| `[featured_products]` | `featured_products()` | Featured products | `limit` (12), `columns` (4), `orderby` (date), `order` (DESC), `category`, `cat_operator` |
| `[product_attribute]` | `product_attribute()` | Products by attribute | `attribute`, `terms`, `limit` (12), `columns` (4), `orderby` (title), `order` (ASC) |
| `[related_products]` | `related_products()` | Related products | `limit` (4), `columns` (4), `orderby` (rand) |
| `[shop_messages]` | `shop_messages()` | WooCommerce notices | (none) |
| `[woocommerce_order_tracking]` | `order_tracking()` | Order tracking form | (none) |
| `[woocommerce_cart]` | `cart()` | Cart page | (none) |
| `[woocommerce_checkout]` | `checkout()` | Checkout page | (none) |
| `[woocommerce_my_account]` | `my_account()` | My Account page | (none) |
| `[woocommerce_messages]` | `shop_messages()` | (alias, pre-2.1 compat) | (none) |

All product shortcodes delegate to `WC_Shortcode_Products` class for query building.

---

## 6. FORM HANDLING

### 6.1 WC_Form_Handler — All Frontend Form Actions

Hooked on `template_redirect` and `wp_loaded`:

| Method | Hook | Nonce | Purpose |
|--------|------|-------|---------|
| `redirect_reset_password_link()` | `template_redirect` | — | Redirects `?key=&id=` to clean URL |
| `resend_set_password()` | `template_redirect` | `wc-resend-set-password` | Resend password setup link (rate-limited: 60s) |
| `save_address()` | `template_redirect` | `woocommerce-edit_address` | Save billing/shipping address |
| `save_account_details()` | `template_redirect` | `save_account_details` | Save account details (name, email, password) |
| `checkout_action()` | `wp_loaded` (20) | — | Process checkout form |
| `process_login()` | `wp_loaded` (20) | `woocommerce-login` | Login form processing |
| `process_registration()` | `wp_loaded` (20) | `woocommerce-register` | Registration form processing |
| `process_lost_password()` | `wp_loaded` (20) | `lost_password` | Lost password form |
| `process_reset_password()` | `wp_loaded` (20) | `reset_password` | Reset password form |
| `cancel_order()` | `wp_loaded` (20) | `woocommerce-cancel_order` | Cancel pending/failed order |
| `update_cart_action()` | `wp_loaded` (20) | `woocommerce-cart` | Cart update/remove/coupon/undo |
| `add_to_cart_action()` | `wp_loaded` (20) | — | Add to cart (simple/variable/grouped) |
| `pay_action()` | `wp` (20) | `woocommerce-pay` | Pay for existing order |
| `add_payment_method_action()` | `wp` (20) | `woocommerce-add-payment-method` | Add payment method (rate-limited: 20s) |
| `delete_payment_method_action()` | `wp` (20) | `delete-payment-method-{id}` | Delete saved payment method |
| `set_default_payment_method_action()` | `wp` (20) | `set-default-payment-method-{id}` | Set default payment method |

### 6.2 Add to Cart Handlers

- **Simple**: `add_to_cart_handler_simple()` — validates, adds to cart
- **Variable**: `add_to_cart_handler_variable()` — requires `variation_id` + `attribute_*` params
- **Grouped**: `add_to_cart_handler_grouped()` — iterates `quantity[]` array
- **Custom**: `woocommerce_add_to_cart_handler_{type}` action hook

### 6.3 Cart Actions

- `apply_coupon` — applies coupon code
- `remove_coupon` — removes coupon
- `remove_item` — removes cart item (with undo link)
- `undo_item` — restores removed cart item
- `update_cart` — updates quantities
- `proceed` — redirects to checkout

---

## 7. FRONTEND SCRIPTS & ASSETS

### 7.1 Registered Scripts (30+ handles)

| Handle | Source | Dependencies | Purpose |
|--------|--------|-------------|---------|
| `woocommerce` | `frontend/woocommerce.js` | jquery, jquery-blockui, js-cookie | Core frontend JS |
| `wc-cart` | `frontend/cart.js` | jquery, woocommerce, country-select, address-i18n | Cart page |
| `wc-checkout` | `frontend/checkout.js` | jquery, woocommerce, country-select, address-i18n, custom-place-order-button | Checkout page |
| `wc-add-to-cart` | `frontend/add-to-cart.js` | jquery, jquery-blockui | AJAX add to cart |
| `wc-add-to-cart-variation` | `frontend/add-to-cart-variation.js` | jquery, wp-util, jquery-blockui | Variable product variations |
| `wc-single-product` | `frontend/single-product.js` | jquery | Single product page (gallery, ratings) |
| `wc-cart-fragments` | `frontend/cart-fragments.js` | jquery, js-cookie | Cart widget refresh |
| `wc-country-select` | `frontend/country-select.js` | jquery | Country/state selects |
| `wc-address-i18n` | `frontend/address-i18n.js` | jquery, country-select | Address field i18n |
| `wc-account-i18n` | `frontend/account-i18n.js` | jquery | Account page i18n |
| `wc-password-strength-meter` | `frontend/password-strength-meter.js` | jquery, password-strength-meter | Password strength |
| `wc-lost-password` | `frontend/lost-password.js` | jquery, woocommerce | Lost password page |
| `wc-add-payment-method` | `frontend/add-payment-method.js` | jquery, woocommerce, custom-place-order-button | Add payment method |
| `wc-geolocation` | `frontend/geolocation.js` | jquery | Geolocation (with page caching) |
| `wc-credit-card-form` | `frontend/credit-card-form.js` | jquery, jquery-payment | Credit card formatting |
| `wc-custom-place-order-button` | `frontend/utils/custom-place-order-button.js` | jquery | Custom place order buttons |
| `wc-back-in-stock-form` | `frontend/back-in-stock-form.js` | jquery | Back in stock notifications |
| `wc-address-autocomplete` | `frontend/address-autocomplete.js` | address-autocomplete-common, dompurify | Address autocomplete |
| `wc-address-autocomplete-common` | `frontend/utils/address-autocomplete-common.js` | — | Shared autocomplete |
| `selectWoo` | `selectWoo/selectWoo.full.js` | jquery | Enhanced select (Select2 fork) |
| `wc-flexslider` | `flexslider/jquery.flexslider.js` | jquery | Product gallery slider |
| `wc-zoom` | `zoom/jquery.zoom.js` | jquery | Product image zoom |
| `wc-photoswipe` | `photoswipe/photoswipe.js` | — | Lightbox gallery |
| `wc-photoswipe-ui-default` | `photoswipe/photoswipe-ui-default.js` | photoswipe | Lightbox UI |
| `wc-select2` | `select2/select2.full.js` | jquery | Select2 (legacy) |
| `wc-jquery-blockui` | `jquery-blockui/jquery.blockUI.js` | jquery | Block UI overlay |
| `wc-js-cookie` | `js-cookie/js.cookie.js` | — | Cookie management |
| `wc-jquery-payment` | `jquery-payment/jquery.payment.js` | jquery | Payment card formatting |
| `wc-jquery-tiptip` | `jquery-tiptip/jquery.tipTip.js` | jquery, dompurify | Tooltips |
| `wc-jquery-cookie` | `jquery-cookie/jquery.cookie.js` | jquery | Cookie (legacy) |
| `wc-dompurify` | `dompurify/purify.js` | — | HTML sanitization |

**Legacy aliases** (registered with `src=false`, depends on real handle):
`flexslider`, `zoom`, `photoswipe`, `photoswipe-ui-default`, `select2`, `jquery-blockui`, `jquery-cookie`, `jquery-payment`, `jquery-tiptip`, `js-cookie`, `prettyPhoto`, `prettyPhoto-init`

### 7.2 CSS Stylesheets

| Handle | File | Media |
|--------|------|-------|
| `woocommerce-layout` | `assets/css/woocommerce-layout.css` | all |
| `woocommerce-smallscreen` | `assets/css/woocommerce-smallscreen.css` | `max-width: 768px` |
| `woocommerce-general` | `assets/css/woocommerce.css` | all |
| `woocommerce-blocktheme` | `assets/css/woocommerce-blocktheme.css` | all (block themes only) |
| `select2` | `assets/css/select2.css` | all |
| `photoswipe` | `assets/css/photoswipe/photoswipe.min.css` | all |
| `photoswipe-default-skin` | `assets/css/photoswipe/default-skin/default-skin.min.css` | all |
| `woocommerce-inline` | (inline) | — (required field visibility) |
| `wc-address-autocomplete` | `assets/css/address-autocomplete.css` | all (when enabled) |

### 7.3 Conditional Loading Rules

| Condition | Scripts Enqueued |
|-----------|-----------------|
| Always | `woocommerce` |
| AJAX add to cart enabled | `wc-add-to-cart` |
| Cart page | `wc-cart` |
| Cart/Checkout/Account | `selectWoo`, `select2` CSS, `wc-password-strength-meter` (conditional) |
| Account page | `wc-account-i18n` |
| Checkout page | `wc-checkout` |
| Add payment method page | `wc-add-payment-method` |
| Lost password page | `wc-lost-password` |
| Single product (non-block theme) | Gallery scripts (zoom/flexslider/photoswipe), `wc-single-product` |
| Geolocation AJAX mode | `wc-geolocation` (non-bot user agents) |
| Address autocomplete enabled | `wc-address-autocomplete`, `wc-address-autocomplete-common` |

### 7.4 Localized Script Data

Each script receives localized data via `wp_localize_script()`:

**`woocommerce`**: `ajax_url`, `wc_ajax_url`, `i18n_password_show/hide`

**`wc-checkout`**: `ajax_url`, `wc_ajax_url`, `update_order_review_nonce`, `apply_coupon_nonce`, `remove_coupon_nonce`, `option_guest_checkout`, `checkout_url`, `is_checkout`, `debug_mode`, `i18n_checkout_error`, `gateways_with_custom_place_order_button`

**`wc-cart`**: `ajax_url`, `wc_ajax_url`, `update_shipping_method_nonce`, `apply_coupon_nonce`, `remove_coupon_nonce`

**`wc-add-to-cart`**: `ajax_url`, `wc_ajax_url`, `i18n_view_cart`, `cart_url`, `is_cart`, `cart_redirect_after_add`

**`wc-single-product`**: `i18n_required_rating_text`, `i18n_rating_options`, `i18n_product_gallery_trigger_text`, `review_rating_required`, `flexslider` options, `zoom_enabled/options`, `photoswipe_enabled/options`, `flexslider_enabled`

**`wc-country-select`**: `countries` (states), `i18n_select_state_text`, various Select2 i18n strings

**`wc-address-i18n`**: `locale` (country locale data), `locale_fields`, `i18n_required_text`, `i18n_optional_text`

---

## 8. INSTALLATION LOGIC

### 8.1 Installation Flow

`WC_Install::install()` → `install_core()`:
1. Set `woocommerce_newly_installed` option
2. Fix WPDB tables
3. Remove admin notices
4. **Create database tables** (`create_tables()`)
5. Verify base tables
6. **Create default options** (`create_options()`)
7. Migrate options
8. **Create roles** (`create_roles()`)
9. Setup environment (post types, taxonomies, endpoints)
10. Create default terms
11. Clear cron jobs
12. Delete obsolete notes
13. Create files (`.htaccess` for downloads directory)
14. **Create pages** (`maybe_create_pages()`)
15. Set activation transients
16. Set PayPal Standard eligibility
17. Update WC version
18. Maybe update DB version
19. Set store ID

### 8.2 Database Tables Created

Core tables (from `get_schema()`):

| Table | Purpose |
|-------|---------|
| `{prefix}woocommerce_sessions` | Session data |
| `{prefix}woocommerce_attribute_taxonomies` | Product attribute definitions |
| `{prefix}woocommerce_downloadable_product_permissions` | Download permissions per customer/order |
| `{prefix}woocommerce_order_items` | Order line items |
| `{prefix}woocommerce_order_itemmeta` | Order item meta |
| `{prefix}woocommerce_tax_rates` | Tax rate definitions |
| `{prefix}woocommerce_tax_rate_locations` | Tax rate location mappings |
| `{prefix}woocommerce_shipping_zones` | Shipping zones |
| `{prefix}woocommerce_shipping_zone_locations` | Zone location mappings |
| `{prefix}woocommerce_shipping_zone_methods` | Zone shipping methods |
| `{prefix}woocommerce_payment_tokens` | Saved payment tokens |
| `{prefix}woocommerce_payment_tokenmeta` | Payment token meta |
| `{prefix}woocommerce_log` | System logs |
| `{prefix}wc_download_log` | Download access logs |
| `{prefix}wc_product_meta_lookup` | Product meta denormalized for queries |
| `{prefix}wc_tax_rate_classes` | Tax rate classes |
| `{prefix}wc_reserved_stock` | Reserved stock tracking |
| `{prefix}wc_rate_limits` | Rate limiting |
| `{prefix}wc_product_attributes_lookup` | Product attribute lookup |
| `{prefix}wc_product_download_directories` | Approved download directories |
| `{prefix}wc_stock_notifications` | Stock notification signups |

**Analytics tables** (wc-admin):

| Table | Purpose |
|-------|---------|
| `{prefix}wc_order_stats` | Order statistics (order_id, date_created, date_paid, date_completed, num_items_sold, total_sales, tax_total, shipping_total, net_total, returning_customer, status, customer_id, fulfillment_status) |
| `{prefix}wc_order_product_lookup` | Product-level order data |
| `{prefix}wc_order_tax_lookup` | Tax-level order data |
| `{prefix}wc_order_coupon_lookup` | Coupon-level order data |
| `{prefix}wc_order_addresses` | Order addresses (HPOS) |
| `{prefix}wc_order_operational_data` | Order operational data (HPOS) |
| `{prefix}wc_customer_lookup` | Customer lookup |
| `{prefix}wc_category_lookup` | Category hierarchy |

**HPOS (High-Performance Order Storage) tables**:
| Table | Purpose |
|-------|---------|
| `{prefix}wc_orders` | Orders (replaces wp_posts) |
| `{prefix}wc_order_addresses` | Order addresses |
| `{prefix}wc_order_operational_data` | Order operational data |
| `{prefix}wc_orders_meta` | Order meta |

**Admin tables**:
| Table | Purpose |
|-------|---------|
| `{prefix}wc_admin_notes` | Admin inbox notes |
| `{prefix}wc_admin_note_actions` | Note action tracking |

### 8.3 Pages Created on Install

| Slug | Title | Content | Option Key |
|------|-------|---------|------------|
| `shop` | Shop | `''` | `woocommerce_shop_page_id` |
| `cart` | Cart | Cart block content | `woocommerce_cart_page_id` |
| `checkout` | Checkout | Checkout block content | `woocommerce_checkout_page_id` |
| `my-account` | My account | `[woocommerce_my_account]` | `woocommerce_myaccount_page_id` |
| `refund_returns` | Refund and Returns Policy | (policy template) — **draft** | `woocommerce_refund_returns_page_id` |

### 8.4 Default Options Created

Options are created from all settings pages' `default` values, plus:

| Option | Default |
|--------|---------|
| `woocommerce_single_image_width` | `'600'` |
| `woocommerce_thumbnail_image_width` | `'300'` |
| `woocommerce_checkout_highlight_required_fields` | `'yes'` |
| `woocommerce_demo_store` | `'no'` |

**New install extras**:
- Tax classes: "Reduced rate", "Zero rate"
- `woocommerce_coming_soon` = `'yes'`
- `woocommerce_store_pages_only` = `'yes'`
- Email improvements enabled
- `woocommerce_email_auto_sync_with_theme` = `'yes'`
- `woocommerce_back_in_stock_allow_signups` = `'yes'`
- `woocommerce_analytics_scheduled_import` = `'yes'`
- HPOS enabled (for new shops)
- Product instance caching enabled

### 8.5 Roles Created

- **Shop Manager** (`shop_manager`) — full store management capabilities
- **Customer** (`customer`) — read + view order capabilities

### 8.6 Cron Schedules Added

- `monthly` — every 30 days
- `fifteendays` — every 15 days

---

## 9. ANALYTICS & REPORTING

### 9.1 Analytics Data Aggregation

The analytics system uses dedicated lookup tables populated via scheduled imports:

**`wc_order_stats`** — Primary aggregation table:
- Columns: `order_id`, `parent_id`, `date_created`, `date_created_gmt`, `date_paid`, `date_completed`, `num_items_sold`, `total_sales`, `tax_total`, `shipping_total`, `net_total`, `returning_customer`, `status`, `customer_id`, `fulfillment_status`
- Indexes: `date_created`, `customer_id`, `status`, `fulfillment_status`, `idx_date_paid_status_parent`

**`wc_order_product_lookup`** — Per-product-per-order:
- Product ID, variation ID, order ID, quantity, net revenue, date created

**`wc_order_tax_lookup`** — Per-tax-rate-per-order

**`wc_order_coupon_lookup`** — Per-coupon-per-order

**`wc_customer_lookup`** — Denormalized customer data

**`wc_category_lookup`** — Category hierarchy for category-based reports

### 9.2 Report Types (via WC Admin REST API)

Reports are served via REST API endpoints under `/wc-analytics/reports/`:
- Orders (stats, products, revenue)
- Products (sales, variations)
- Revenue
- Categories
- Coupons
- Taxes
- Downloads
- Stock
- Customers
- Reviews

### 9.3 Legacy Reports (`includes/admin/reports/`)

Legacy report classes in `admin/reports/` provide:
- Sales by date
- Sales by product
- Sales by category
- Coupons
- Customers vs guests
- Stock levels
- Taxes

### 9.4 Scheduled Import

New installations default to `woocommerce_analytics_scheduled_import = 'yes'`, which processes orders into lookup tables via Action Scheduler background jobs.

---

## 10. KEY PATTERNS & ARCHITECTURE NOTES

### 10.1 Settings API Pattern

All settings pages extend `WC_Settings_Page`:
```php
class WC_Settings_MyPage extends WC_Settings_Page {
    public function __construct() {
        $this->id = 'my_page';
        $this->label = 'My Page';
        parent::__construct();
    }
    protected function get_own_sections() { return ['' => 'Default']; }
    protected function get_settings_for_default_section() { return [...]; }
}
```

### 10.2 Email Extension Pattern

All emails extend `WC_Email`:
```php
class WC_Email_My_Email extends WC_Email {
    public function __construct() {
        $this->id = 'my_email';
        $this->title = 'My Email';
        $this->description = '...';
        $this->template_html = 'emails/my-email.php';
        $this->template_plain = 'emails/plain/my-email.php';
        $this->placeholders = array_merge(['{order_date}' => '', '{order_number}' => ''], $this->placeholders);
        parent::__construct();
        add_action('woocommerce_order_status_X', [$this, 'trigger'], 10, 2);
    }
    public function trigger($order_id, $order = false) { ... }
    public function get_content_html() { return wc_get_template_html($this->template_html, [...]); }
    public function get_content_plain() { return wc_get_template_html($this->template_plain, [...]); }
}
```

### 10.3 Template Override Pattern

```php
wc_get_template('checkout/form-checkout.php', ['checkout' => $checkout]);
```

Searches: `theme/woocommerce/checkout/form-checkout.php` → `plugin/templates/checkout/form-checkout.php`

### 10.4 Form Handler Pattern

All form handlers:
1. Check nonce
2. Validate input
3. Process action
4. Add notices via `wc_add_notice()`
5. Redirect

### 10.5 Hook Naming Conventions

- `woocommerce_settings_{tab}` — settings output
- `woocommerce_update_options_{tab}` — settings save
- `woocommerce_email_{id}` — email-specific hooks
- `woocommerce_process_{action}` — form processing
- `woocommerce_before/after_{action}` — before/after hooks

### 10.6 Data Store Pattern

WooCommerce uses a data store abstraction:
- `WC_Data_Store::load('product')` → product data store
- `WC_Data_Store::load('order')` → order data store (HPOS or posts)
- `WC_Data_Store::load('customer')` → customer data store

HPOS (High-Performance Order Storage) stores orders in custom tables instead of `wp_posts`.

### 10.7 Feature Flags

Key feature flags (via `FeaturesUtil::feature_is_enabled()`):
- `email_improvements` — new email templates
- `block_email_editor` — block-based email editor
- `custom_order_tables` (HPOS) — high-performance order storage
- `fulfillments` — fulfillment tracking
- `rest_api_caching` — REST API response caching
- `blueprint` — Blueprint import/export

---

## APPENDIX A: Complete Option Index

All `woocommerce_*` options with defaults (consolidated from all settings pages):

```
woocommerce_store_address = ''
woocommerce_store_address_2 = ''
woocommerce_store_city = ''
woocommerce_default_country = 'US:CA'
woocommerce_store_postcode = ''
woocommerce_allowed_countries = 'all'
woocommerce_all_except_countries = ''
woocommerce_specific_allowed_countries = ''
woocommerce_ship_to_countries = ''
woocommerce_specific_ship_to_countries = ''
woocommerce_default_customer_address = 'geolocation'
woocommerce_address_autocomplete_enabled = 'no'
woocommerce_calc_taxes = 'no'
woocommerce_enable_coupons = 'yes'
woocommerce_calc_discounts_sequentially = 'no'
woocommerce_currency = 'USD'
woocommerce_currency_pos = 'left'
woocommerce_price_thousand_sep = ','
woocommerce_price_decimal_sep = '.'
woocommerce_price_num_decimals = '2'
woocommerce_shop_page_id = ''
woocommerce_cart_redirect_after_add = 'no'
woocommerce_enable_ajax_add_to_cart = 'yes'
woocommerce_placeholder_image = ''
woocommerce_weight_unit = 'lbs' (locale-dependent)
woocommerce_dimension_unit = 'in' (locale-dependent)
woocommerce_enable_reviews = 'yes'
woocommerce_review_rating_verification_label = 'yes'
woocommerce_review_rating_verification_required = 'no'
woocommerce_enable_review_rating = 'yes'
woocommerce_review_rating_required = 'yes'
woocommerce_manage_stock = 'yes'
woocommerce_hold_stock_minutes = '60'
woocommerce_notify_low_stock = 'yes'
woocommerce_notify_no_stock = 'yes'
woocommerce_notify_backorder = 'yes'
woocommerce_stock_email_recipient = (admin_email)
woocommerce_notify_low_stock_amount = '2'
woocommerce_notify_no_stock_amount = '0'
woocommerce_hide_out_of_stock_items = 'no'
woocommerce_stock_format = ''
woocommerce_file_download_method = 'force'
woocommerce_downloads_redirect_fallback_allowed = 'no'
woocommerce_downloads_require_login = 'no'
woocommerce_downloads_grant_access_after_payment = 'yes'
woocommerce_downloads_deliver_inline = false
woocommerce_downloads_add_hash_to_filename = 'yes'
woocommerce_downloads_count_partial = 'yes'
woocommerce_enable_shipping_calc = 'yes'
woocommerce_shipping_cost_requires_address = 'no'
woocommerce_shipping_hide_rates_when_free = 'no'
woocommerce_ship_to_destination = 'billing'
woocommerce_shipping_debug_mode = 'no'
woocommerce_enable_guest_checkout = 'yes'
woocommerce_enable_checkout_login_reminder = 'no'
woocommerce_enable_delayed_account_creation = 'no'
woocommerce_enable_signup_and_login_from_checkout = 'no'
woocommerce_enable_myaccount_registration = 'no'
woocommerce_registration_generate_password = 'yes'
woocommerce_registration_generate_username = 'yes'
woocommerce_erasure_request_removes_order_data = 'no'
woocommerce_erasure_request_removes_download_data = 'no'
woocommerce_allow_bulk_remove_personal_data = 'no'
woocommerce_registration_privacy_policy_text = (default text)
woocommerce_checkout_privacy_policy_text = (default text)
woocommerce_delete_inactive_accounts = ''
woocommerce_trash_pending_orders = ''
woocommerce_trash_failed_orders = ''
woocommerce_trash_cancelled_orders = ''
woocommerce_anonymize_refunded_orders = ''
woocommerce_anonymize_completed_orders = ''
woocommerce_email_from_name = (blog name)
woocommerce_email_from_address = (admin_email)
woocommerce_email_reply_to_enabled = 'no'
woocommerce_email_reply_to_name = ''
woocommerce_email_reply_to_address = ''
woocommerce_email_header_image = ''
woocommerce_email_header_image_width = '120'
woocommerce_email_header_alignment = 'left'
woocommerce_email_font_family = 'Helvetica'
woocommerce_email_footer_text = '{site_title}<br />{store_address}'
woocommerce_email_base_color = (theme-derived)
woocommerce_email_background_color = (theme-derived)
woocommerce_email_body_background_color = (theme-derived)
woocommerce_email_text_color = (theme-derived)
woocommerce_email_footer_text_color = (theme-derived)
woocommerce_cart_page_id = ''
woocommerce_checkout_page_id = (checkout page)
woocommerce_myaccount_page_id = ''
woocommerce_terms_page_id = ''
woocommerce_force_ssl_checkout = 'no'
woocommerce_unforce_ssl_checkout = 'no'
woocommerce_checkout_pay_endpoint = 'order-pay'
woocommerce_checkout_order_received_endpoint = 'order-received'
woocommerce_myaccount_add_payment_method_endpoint = 'add-payment-method'
woocommerce_myaccount_delete_payment_method_endpoint = 'delete-payment-method'
woocommerce_myaccount_set_default_payment_method_endpoint = 'set-default-payment-method'
woocommerce_myaccount_orders_endpoint = 'orders'
woocommerce_myaccount_view_order_endpoint = 'view-order'
woocommerce_myaccount_downloads_endpoint = 'downloads'
woocommerce_myaccount_edit_account_endpoint = 'edit-account'
woocommerce_myaccount_edit_address_endpoint = 'edit-address'
woocommerce_myaccount_payment_methods_endpoint = 'payment-methods'
woocommerce_myaccount_lost_password_endpoint = 'lost-password'
woocommerce_logout_endpoint = 'customer-logout'
woocommerce_allow_tracking = 'no'
woocommerce_show_marketplace_suggestions = 'yes'
woocommerce_single_image_width = '600'
woocommerce_thumbnail_image_width = '300'
woocommerce_checkout_highlight_required_fields = 'yes'
woocommerce_demo_store = 'no'
woocommerce_coming_soon = 'yes' (new installs)
woocommerce_store_pages_only = 'yes' (new installs)
woocommerce_back_in_stock_allow_signups = 'yes' (new installs)
woocommerce_analytics_scheduled_import = 'yes' (new installs)
```

---

*End of report.*
