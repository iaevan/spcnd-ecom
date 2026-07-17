# WooCommerce Codebase Deep Analysis
## Database Schema, Settings, i18n, Blocks/Widgets System

---

## 1. DATABASE TABLE SCHEMAS (Complete)

All tables use the WordPress `$wpdb->prefix` (typically `wp_`). Collation is determined by `$wpdb->get_charset_collate()`.

### 1.1 `woocommerce_sessions`
```sql
session_id       bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
session_key      char(32) NOT NULL                            -- UNIQUE KEY
session_value    longtext NOT NULL                            -- serialized PHP data
session_expiry   bigint(20) unsigned NOT NULL                 -- KEY (unix timestamp)
```

### 1.2 `woocommerce_api_keys`
```sql
key_id           bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
user_id          bigint(20) unsigned NOT NULL
description      varchar(200) NULL
permissions      varchar(10) NOT NULL                         -- 'read','write','read_write'
consumer_key     char(64) NOT NULL                            -- KEY
consumer_secret  char(43) NOT NULL                            -- KEY
nonces           longtext NULL
truncated_key    char(7) NOT NULL
last_access      datetime NULL default null
```

### 1.3 `woocommerce_attribute_taxonomies`
```sql
attribute_id     bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
attribute_name   varchar(200) NOT NULL                        -- KEY(20)
attribute_label  varchar(200) NULL
attribute_type   varchar(20) NOT NULL                         -- 'select','text','color'
attribute_orderby varchar(20) NOT NULL                        -- 'menu_order','name','name_num','id'
attribute_public int(1) NOT NULL DEFAULT 1
```

### 1.4 `woocommerce_downloadable_product_permissions`
```sql
permission_id       bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
download_id         varchar(36) NOT NULL                         -- UUID
product_id          bigint(20) unsigned NOT NULL
order_id            bigint(20) unsigned NOT NULL DEFAULT 0
order_key           varchar(200) NOT NULL
user_email          varchar(200) NOT NULL                        -- KEY(100)
user_id             bigint(20) unsigned NULL
downloads_remaining varchar(9) NULL
access_granted      datetime NOT NULL default '0000-00-00 00:00:00'
access_expires      datetime NULL default null
download_count      bigint(20) unsigned NOT NULL DEFAULT 0
-- COMPOSITE KEYS:
-- (product_id, order_id, order_key(16), download_id)
-- (download_id, order_id, product_id)
-- (order_id)
-- (user_id, order_id, downloads_remaining, access_expires)
-- (user_email(100))
```

### 1.5 `woocommerce_order_items`
```sql
order_item_id    bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
order_item_name  text NOT NULL
order_item_type  varchar(200) NOT NULL DEFAULT ''             -- 'line_item','fee','shipping','tax','coupon'
order_id         bigint(20) unsigned NOT NULL                 -- KEY
```

### 1.6 `woocommerce_order_itemmeta`
```sql
meta_id          bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
order_item_id    bigint(20) unsigned NOT NULL                 -- KEY
meta_key         varchar(255) default NULL                    -- KEY(32)
meta_value       longtext NULL
```

### 1.7 `woocommerce_tax_rates`
```sql
tax_rate_id       bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
tax_rate_country  varchar(2) NOT NULL DEFAULT ''               -- KEY
tax_rate_state    varchar(200) NOT NULL DEFAULT ''             -- KEY(2)
tax_rate          varchar(8) NOT NULL DEFAULT ''               -- percentage
tax_rate_name     varchar(200) NOT NULL DEFAULT ''
tax_rate_priority bigint(20) unsigned NOT NULL                 -- KEY
tax_rate_compound int(1) NOT NULL DEFAULT 0
tax_rate_shipping int(1) NOT NULL DEFAULT 1
tax_rate_order    bigint(20) unsigned NOT NULL
tax_rate_class    varchar(200) NOT NULL DEFAULT ''             -- KEY(10)
```

### 1.8 `woocommerce_tax_rate_locations`
```sql
location_id      bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
location_code    varchar(200) NOT NULL
tax_rate_id      bigint(20) unsigned NOT NULL                 -- KEY
location_type    varchar(40) NOT NULL                         -- 'postcode','city','state','country'
-- KEY: (location_type(10), location_code(20))
```

### 1.9 `woocommerce_shipping_zones`
```sql
zone_id          bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
zone_name        varchar(200) NOT NULL
zone_order       bigint(20) unsigned NOT NULL                 -- KEY(zone_order, zone_id)
```

### 1.10 `woocommerce_shipping_zone_locations`
```sql
location_id      bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
zone_id          bigint(20) unsigned NOT NULL                 -- KEY
location_code    varchar(200) NOT NULL
location_type    varchar(40) NOT NULL                         -- 'postcode','state','country','continent'
-- KEY: (location_type(10), location_code(20))
```

### 1.11 `woocommerce_shipping_zone_methods`
```sql
zone_id          bigint(20) unsigned NOT NULL                 -- KEY
instance_id      bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
method_id        varchar(200) NOT NULL                        -- KEY(20)
method_order     bigint(20) unsigned NOT NULL
is_enabled       tinyint(1) NOT NULL DEFAULT '1'
```

### 1.12 `woocommerce_payment_tokens`
```sql
token_id         bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
gateway_id       varchar(200) NOT NULL
token            text NOT NULL
user_id          bigint(20) unsigned NOT NULL DEFAULT '0'     -- KEY
type             varchar(200) NOT NULL                        -- 'CC','eCheck'
is_default       tinyint(1) NOT NULL DEFAULT '0'
```

### 1.13 `woocommerce_payment_tokenmeta`
```sql
meta_id            bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
payment_token_id   bigint(20) unsigned NOT NULL                 -- KEY
meta_key           varchar(255) NULL                            -- KEY(32)
meta_value         longtext NULL
```

### 1.14 `woocommerce_log`
```sql
log_id           bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
timestamp        datetime NOT NULL
level            smallint(4) NOT NULL                         -- KEY (0=emergency..7=debug)
source           varchar(200) NOT NULL
message          longtext NOT NULL
context          longtext NULL
```

### 1.15 `wc_webhooks`
```sql
webhook_id       bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
status           varchar(200) NOT NULL                        -- 'active','paused','disabled'
name             text NOT NULL
user_id          bigint(20) unsigned NOT NULL                 -- KEY
delivery_url     text NOT NULL
secret           text NOT NULL
topic            varchar(200) NOT NULL
date_created     datetime NOT NULL DEFAULT '0000-00-00 00:00:00'
date_created_gmt datetime NOT NULL DEFAULT '0000-00-00 00:00:00'
date_modified    datetime NOT NULL DEFAULT '0000-00-00 00:00:00'
date_modified_gmt datetime NOT NULL DEFAULT '0000-00-00 00:00:00'
api_version      smallint(4) NOT NULL                         -- 1,2,3
failure_count    smallint(10) NOT NULL DEFAULT '0'
pending_delivery tinyint(1) NOT NULL DEFAULT '0'
```

### 1.16 `wc_download_log`
```sql
download_log_id  bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
timestamp        datetime NOT NULL                            -- KEY
permission_id    bigint(20) unsigned NOT NULL                 -- KEY
user_id          bigint(20) unsigned NULL
user_ip_address  varchar(100) NULL DEFAULT ''
```

### 1.17 `wc_product_meta_lookup`
```sql
product_id       bigint(20) NOT NULL                          -- PRIMARY KEY
sku              varchar(100) NULL default ''                 -- KEY(50)
global_unique_id varchar(100) NULL default ''
virtual          tinyint(1) NULL default 0                    -- KEY
downloadable     tinyint(1) NULL default 0                    -- KEY
min_price        decimal(19,4) NULL default NULL              -- KEY(min_max_price)
max_price        decimal(19,4) NULL default NULL
onsale           tinyint(1) NULL default 0                    -- KEY
stock_quantity   double NULL default NULL                     -- KEY
stock_status     varchar(100) NULL default 'instock'          -- KEY ('instock','outofstock','onbackorder')
rating_count     bigint(20) NULL default 0
average_rating   decimal(3,2) NULL default 0.00
total_sales      bigint(20) NULL default 0
tax_status       varchar(100) NULL default 'taxable'
tax_class        varchar(100) NULL default ''
```

### 1.18 `wc_tax_rate_classes`
```sql
tax_rate_class_id bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
name             varchar(200) NOT NULL DEFAULT ''
slug             varchar(200) NOT NULL DEFAULT ''              -- UNIQUE KEY
```

### 1.19 `wc_reserved_stock`
```sql
order_id         bigint(20) NOT NULL                          -- COMPOSITE PRIMARY KEY (order_id, product_id)
product_id       bigint(20) NOT NULL
stock_quantity   double NOT NULL DEFAULT 0
timestamp        datetime NOT NULL DEFAULT '0000-00-00 00:00:00'
expires          datetime NOT NULL DEFAULT '0000-00-00 00:00:00'  -- KEY(product_id, expires)
```

### 1.20 `wc_rate_limits`
```sql
rate_limit_id        bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
rate_limit_key       varchar(200) NOT NULL                        -- UNIQUE KEY
rate_limit_expiry    bigint(20) unsigned NOT NULL
rate_limit_remaining smallint(10) NOT NULL DEFAULT '0'
```

### 1.21 `wc_product_download_directories`
```sql
url_id           bigint(20) unsigned NOT NULL auto_increment  -- PRIMARY KEY
url              varchar(256) NOT NULL                        -- KEY
enabled          tinyint(1) NOT NULL DEFAULT 0
```

### 1.22 `wc_order_stats` (Analytics)
```sql
order_id         bigint(20) unsigned NOT NULL                 -- PRIMARY KEY
parent_id        bigint(20) unsigned DEFAULT 0 NOT NULL
date_created     datetime DEFAULT '0000-00-00 00:00:00' NOT NULL  -- KEY
date_created_gmt datetime DEFAULT '0000-00-00 00:00:00' NOT NULL
date_paid        datetime DEFAULT '0000-00-00 00:00:00'
date_completed   datetime DEFAULT '0000-00-00 00:00:00'
num_items_sold   int(11) DEFAULT 0 NOT NULL
total_sales      double DEFAULT 0 NOT NULL
tax_total        double DEFAULT 0 NOT NULL
shipping_total   double DEFAULT 0 NOT NULL
net_total        double DEFAULT 0 NOT NULL
returning_customer tinyint(1) DEFAULT NULL
status           varchar(20) NOT NULL                         -- KEY
customer_id      bigint(20) unsigned NOT NULL                 -- KEY
-- KEY: idx_date_paid_status_parent (date_paid, status, parent_id)
```

### 1.23 `wc_order_product_lookup` (Analytics)
```sql
order_item_id        bigint(20) unsigned NOT NULL             -- COMPOSITE PRIMARY KEY (order_item_id, order_id)
order_id             bigint(20) unsigned NOT NULL             -- KEY
product_id           bigint(20) unsigned NOT NULL             -- KEY
variation_id         bigint(20) unsigned NOT NULL
customer_id          bigint(20) unsigned NULL                 -- KEY
date_created         datetime NOT NULL                        -- KEY
product_qty          int(11) NOT NULL
product_net_revenue  double DEFAULT 0 NOT NULL
product_gross_revenue double DEFAULT 0 NOT NULL
coupon_amount        double DEFAULT 0 NOT NULL
tax_amount           double DEFAULT 0 NOT NULL
shipping_amount      double DEFAULT 0 NOT NULL
shipping_tax_amount  double DEFAULT 0 NOT NULL
-- KEY: customer_product_date (customer_id, product_id, date_created)
```

### 1.24 `wc_order_tax_lookup`
```sql
order_id         bigint(20) unsigned NOT NULL                 -- COMPOSITE PRIMARY KEY
tax_rate_id      bigint(20) unsigned NOT NULL                 -- KEY
date_created     datetime DEFAULT '0000-00-00 00:00:00' NOT NULL  -- KEY
shipping_tax     double DEFAULT 0 NOT NULL
order_tax        double DEFAULT 0 NOT NULL
total_tax        double DEFAULT 0 NOT NULL
```

### 1.25 `wc_order_coupon_lookup`
```sql
order_id         bigint(20) unsigned NOT NULL                 -- COMPOSITE PRIMARY KEY
coupon_id        bigint(20) NOT NULL                          -- KEY
date_created     datetime DEFAULT '0000-00-00 00:00:00' NOT NULL  -- KEY
discount_amount  double DEFAULT 0 NOT NULL
```

### 1.26 `wc_admin_notes`
```sql
note_id          bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
name             varchar(255) NOT NULL
type             varchar(20) NOT NULL                         -- 'error','warning','update','info','marketing','survey'
locale           varchar(20) NOT NULL
title            longtext NOT NULL
content          longtext NOT NULL
content_data     longtext NULL default null
status           varchar(200) NOT NULL                        -- 'unactioned','actioned','snoozed'
source           varchar(200) NOT NULL
date_created     datetime NOT NULL default '0000-00-00 00:00:00'
date_reminder    datetime NULL default null
is_snoozable     tinyint(1) DEFAULT 0 NOT NULL
layout           varchar(20) DEFAULT '' NOT NULL              -- 'plain','banner','thumbnail'
image            varchar(200) NULL DEFAULT NULL
is_deleted       tinyint(1) DEFAULT 0 NOT NULL
is_read          tinyint(1) DEFAULT 0 NOT NULL
icon             varchar(200) NOT NULL default 'info'
```

### 1.27 `wc_admin_note_actions`
```sql
action_id        bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
note_id          bigint(20) unsigned NOT NULL                 -- KEY
name             varchar(255) NOT NULL
label            varchar(255) NOT NULL
query            longtext NOT NULL
status           varchar(255) NOT NULL
actioned_text    varchar(255) NOT NULL
nonce_action     varchar(255) NULL DEFAULT NULL
nonce_name       varchar(255) NULL DEFAULT NULL
```

### 1.28 `wc_customer_lookup`
```sql
customer_id      bigint(20) unsigned NOT NULL AUTO_INCREMENT  -- PRIMARY KEY
user_id          bigint(20) unsigned DEFAULT NULL             -- UNIQUE KEY
username         varchar(60) DEFAULT '' NOT NULL
first_name       varchar(255) NOT NULL
last_name        varchar(255) NOT NULL
email            varchar(100) NULL default NULL               -- KEY
date_last_active timestamp NULL default null
date_registered  timestamp NULL default null
country          char(2) DEFAULT '' NOT NULL
postcode         varchar(20) DEFAULT '' NOT NULL
city             varchar(100) DEFAULT '' NOT NULL
state            varchar(100) DEFAULT '' NOT NULL
```

### 1.29 `wc_category_lookup`
```sql
category_tree_id bigint(20) unsigned NOT NULL                 -- COMPOSITE PRIMARY KEY
category_id      bigint(20) unsigned NOT NULL
```

### 1.30 HPOS Tables (High-Performance Order Storage)
When HPOS is enabled, additional tables are created via `OrdersTableDataStore::get_database_schema()`:
- `wc_orders` — main orders table
- `wc_order_addresses` — billing/shipping addresses
- `wc_order_operational_data` — operational metadata
- `wc_orders_meta` — order meta key/value pairs

### 1.31 Additional Dynamic Tables
- **Product Attributes Lookup Table** — created via `DataRegenerator::get_table_creation_sql()`
- **Stock Notifications Table** — via `StockNotificationsDataStore::get_database_schema()`
- **Email Unsubscribes Table** — via `Unsubscribes\Storage::get_database_schema()`

---

## 2. PAGES CREATED DURING INSTALLATION

| Key | Slug | Title | Content | Status |
|-----|------|-------|---------|--------|
| `shop` | `shop` | Shop | (empty) | publish |
| `cart` | `cart` | Cart | Cart block content | publish |
| `checkout` | `checkout` | Checkout | Checkout block content | publish |
| `myaccount` | `my-account` | My account | `[woocommerce_my_account]` shortcode | publish |
| `refund_returns` | `refund_returns` | Refund and Returns Policy | Template policy content | **draft** |

Page IDs stored as options: `woocommerce_shop_page_id`, `woocommerce_cart_page_id`, `woocommerce_checkout_page_id`, `woocommerce_myaccount_page_id`, `woocommerce_refund_returns_page_id`.

---

## 3. DEFAULT OPTIONS / SETTINGS

### 3.1 Image Options
| Option | Default | Autoload |
|--------|---------|----------|
| `woocommerce_single_image_width` | `600` | yes |
| `woocommerce_thumbnail_image_width` | `300` | yes |

### 3.2 Checkout & Display
| Option | Default | Autoload |
|--------|---------|----------|
| `woocommerce_checkout_highlight_required_fields` | `yes` | yes |
| `woocommerce_demo_store` | `no` | no |

### 3.3 New Install Options
| Option | Default | Notes |
|--------|---------|-------|
| `woocommerce_coming_soon` | `yes` | Store visibility |
| `woocommerce_store_pages_only` | `yes` | Coming soon mode |
| `woocommerce_admin_install_timestamp` | `time()` | Install timestamp |
| `woocommerce_store_id` | UUID v4 | Unique store identifier |
| `woocommerce_newly_installed` | `yes` → `no` | Install tracking |
| `woocommerce_initial_installed_version` | WC version | First version installed |

### 3.4 Email Improvements (New Installs)
| Option | Default |
|--------|---------|
| `woocommerce_email_improvements_default_enabled` | `yes` |
| `woocommerce_email_auto_sync_with_theme` | `yes` |
| `woocommerce_email_improvements_first_enabled_at` | current datetime |
| `woocommerce_email_improvements_last_enabled_at` | current datetime |
| `woocommerce_email_improvements_enabled_count` | `1` |

### 3.5 Feature Flags (New Installs)
| Feature | Default |
|---------|---------|
| `custom_order_tables` (HPOS) | enabled |
| `email_improvements` | enabled |
| `woocommerce_back_in_stock_allow_signups` | `yes` |
| `woocommerce_analytics_scheduled_import` | `yes` |
| Product instance caching | enabled |

### 3.6 Tax Classes (New Installs)
- "Reduced rate"
- "Zero rate"

### 3.7 Settings Populated via WC_Admin_Settings
All settings pages iterate through `WC_Settings_Page::get_settings()` and create options with their `default` values via `add_option()`. Key settings groups include:
- **General**: `woocommerce_currency`, `woocommerce_currency_pos`, `woocommerce_price_thousand_sep`, `woocommerce_price_decimal_sep`, `woocommerce_price_num_decimals`, `woocommerce_default_country`, `woocommerce_allowed_countries`, `woocommerce_ship_to_countries`, `woocommerce_store_address`, `woocommerce_store_city`, `woocommerce_store_postcode`, `woocommerce_weight_unit`, `woocommerce_dimension_unit`
- **Products**: `woocommerce_shop_page_display`, `woocommerce_default_catalog_orderby`, `woocommerce_default_catalog_order`, `woocommerce_enable_reviews`, `woocommerce_enable_review_rating`, `woocommerce_review_rating_required`, `woocommerce_review_rating_verification_required`, `woocommerce_manage_stock`, `woocommerce_hold_stock_minutes`, `woocommerce_notify_low_stock_amount`, `woocommerce_notify_no_stock_amount`, `woocommerce_stock_format`
- **Tax**: `woocommerce_calc_taxes`, `woocommerce_prices_include_tax`, `woocommerce_tax_display_shop`, `woocommerce_tax_display_cart`, `woocommerce_tax_total_display`, `woocommerce_tax_round_at_subtotal`
- **Shipping**: `woocommerce_enable_shipping_calc`, `woocommerce_shipping_cost_requires_address`
- **Checkout/Payments**: `woocommerce_enable_guest_checkout`, `woocommerce_enable_signup_and_login_from_checkout`, `woocommerce_force_ssl_checkout`, `woocommerce_checkout_pay_endpoint`, `woocommerce_checkout_order_received_endpoint`
- **Accounts**: `woocommerce_enable_signup_and_login_from_myaccount`, `woocommerce_registration_generate_username`, `woocommerce_registration_generate_password`, `woocommerce_myaccount_orders_endpoint`, `woocommerce_myaccount_view_order_endpoint`, `woocommerce_myaccount_downloads_endpoint`, `woocommerce_myaccount_edit_account_endpoint`, `woocommerce_myaccount_add_payment_method_endpoint`, `woocommerce_myaccount_delete_payment_method_endpoint`, `woocommerce_myaccount_set_default_payment_method_endpoint`
- **Downloads**: `woocommerce_file_download_method` (`force`), `woocommerce_downloads_require_login`, `woocommerce_downloads_redirect_fallback_allowed`, `woocommerce_downloads_deliver_inline`, `woocommerce_downloads_count_partial`
- **Advanced**: `woocommerce_default_customer_address`, `woocommerce_calc_shipping`, `woocommerce_cart_redirect_after_error`

### 3.8 Privacy/Retention Options
| Option | Purpose |
|--------|---------|
| `woocommerce_trash_pending_orders` | Relative date (number + unit) |
| `woocommerce_trash_failed_orders` | Relative date |
| `woocommerce_trash_cancelled_orders` | Relative date |
| `woocommerce_anonymize_completed_orders` | Relative date |
| `woocommerce_anonymize_refunded_orders` | Relative date |
| `woocommerce_delete_inactive_accounts` | Relative date |

---

## 4. CRON JOBS & SCHEDULED ACTIONS

### 4.1 Custom Cron Schedules Added
| Name | Interval | Display |
|------|----------|---------|
| `monthly` | `MONTH_IN_SECONDS` (2592000s) | Monthly |
| `fifteendays` | `15 * DAY_IN_SECONDS` (1296000s) | Every 15 Days |

### 4.2 Legacy Cron Jobs Cleared (migrated to Action Scheduler)
- `woocommerce_scheduled_sales`
- `woocommerce_cancel_unpaid_orders`
- `woocommerce_cleanup_sessions`
- `woocommerce_cleanup_personal_data`
- `woocommerce_cleanup_logs`
- `woocommerce_geoip_updater`
- `woocommerce_tracker_send_event`
- `woocommerce_cleanup_rate_limits`

### 4.3 Action Scheduler Actions
- `woocommerce_run_update_callback` — DB update callbacks
- `woocommerce_update_db_to_current_version` — Finalize DB version
- `woocommerce_cancel_unpaid_orders` — Cancel unpaid orders (scheduled based on hold stock minutes)
- `woocommerce_cleanup_personal_data` — GDPR cleanup (daily)
- `track_partial_download` — Deferred download tracking (30-minute window)
- `delete_version_transients` — Cleanup old transients (batched, 30s delay)
- DB update callbacks: 70+ versioned callbacks from 2.0.0 through 11.0.0

### 4.4 Installation Lock
- Uses `wc_installing` option as mutex (10-minute stale timeout)
- Also sets `wc_installing` transient for backward compatibility

---

## 5. COUNTRIES / STATES / INTERNATIONALIZATION

### 5.1 Data Sources
- **Countries**: `i18n/countries.php` — ISO 3166-1 alpha-2 → name mapping
- **States**: `i18n/states.php` — Country code → array of state code → name
- **Continents**: `i18n/continents.php` — Continent code → {name, countries[]}
- **Phone codes**: `i18n/phone.php` — Country code → calling code(s)
- **Currencies**: `i18n/currencies.php` — Currency code → name
- **Alpha-3 lookup**: Uses `League\ISO3166\ISO3166` vendor library

### 5.2 Country Data Structure
```php
// Countries: ['US' => 'United States', 'GB' => 'United Kingdom', ...]
// States: ['US' => ['AL' => 'Alabama', 'AK' => 'Alaska', ...], ...]
// Continents: ['AF' => ['name' => 'Africa', 'countries' => ['DZ','AO',...]], ...]
// Phone: ['US' => '+1', 'GB' => '+44', ...]
```

### 5.3 EU Countries (27 members)
`AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GR, HR, HU, IE, IT, LT, LU, LV, MT, NL, PL, PT, RO, SE, SI, SK`
- EU VAT adds: `MC` (Monaco)

### 5.4 VAT Countries (non-EU)
`AE, AL, AR, AZ, BB, BH, BO, BS, BY, CL, CO, EC, EG, ET, FJ, FO, GB, GH, GM, GT, IL, IM, IR, IS, KN, KR, KZ, LK, MC, MD, ME, MK, MN, MU, MX, NA, NG, NO, NP, PS, PY, RS, RU, RW, SA, SV, TH, TR, UA, UY, UZ, VE, VN, XK, ZA`

### 5.5 Allowed Countries Logic
- `woocommerce_allowed_countries`: `all` | `all_except` | `specific`
- `woocommerce_all_except_countries`: array of excluded codes
- `woocommerce_specific_allowed_countries`: array of allowed codes

### 5.6 Shipping Countries Logic
- `woocommerce_ship_to_countries`: `''` (same as selling) | `all` | `specific` | `disabled`
- `woocommerce_specific_ship_to_countries`: array

### 5.7 Address Formats (40+ country-specific)
Key formats:
- **Default**: `{name}\n{company}\n{address_1}\n{address_2}\n{city}\n{state}\n{postcode}\n{country}`
- **US**: `{name}\n{company}\n{address_1}\n{address_2}\n{city}, {state_code} {postcode}\n{country}`
- **JP**: `{postcode}\n{state} {city} {address_1}\n{address_2}\n{company}\n{last_name} {first_name}\n{country}`
- **CN**: `{country} {postcode}\n{state}, {city}, {address_2}, {address_1}\n{company}\n{name}`
- **FR**: `{company}\n{name}\n{address_1}\n{address_2}\n{postcode} {city_upper}\n{country}`
- **DE/AT/CH/NL/BE/DK/SE/NO/FI/PL/etc**: `{company}\n{name}\n{address_1}\n{address_2}\n{postcode} {city}\n{country}`
- **HU**: `{last_name} {first_name}\n{company}\n{city}\n{address_1}\n{address_2}\n{postcode}\n{country}`

Available placeholders: `{first_name}`, `{last_name}`, `{name}`, `{company}`, `{address_1}`, `{address_2}`, `{city}`, `{state}`, `{postcode}`, `{country}`, plus `_upper` and `_code` variants.

### 5.8 Country Locale Overrides (80+ countries)
Per-country field modifications including:
- **Required/hidden fields**: Many countries hide `state` (AT, BE, CZ, DK, FR, NL, PL, SE, etc.) or `postcode` (AE, AO, BS, BW, BZ, etc.)
- **Label overrides**: US→"State"/"ZIP Code", AU→"Suburb"/"State", CA→"Province"/"Postal code", JP→"Prefecture", IE→"County"/"Eircode", IN→"State"/"PIN Code", GB→"County"/"Postcode"
- **Priority reordering**: JP, HU reverse first/last name order; many EU countries move postcode before city (priority 65)
- **Field validation**: `state`, `postcode`, `phone` validators per country

### 5.9 Default Address Fields
| Field | Label | Required | Autocomplete | Priority |
|-------|-------|----------|--------------|----------|
| first_name | First name | yes | given-name | 10 |
| last_name | Last name | yes | family-name | 20 |
| company | Company name | configurable | organization | 30 |
| country | Country / Region | yes | country | 40 |
| address_1 | Street address | yes | address-line1 | 50 |
| address_2 | Apartment, suite, unit | configurable | address-line2 | 60 |
| city | Town / City | yes | address-level2 | 70 |
| state | State / County | yes | address-level1 | 80 |
| postcode | Postcode / ZIP | yes | postal-code | 90 |
| phone | Phone | configurable | tel | 100 |

---

## 6. CURRENCY SYSTEM

### 6.1 Currency List
Loaded from `i18n/currencies.php`, filterable via `woocommerce_currencies`. Contains 150+ currencies following Unicode CLDR.

### 6.2 Currency Symbols (complete list, 140+)
Key symbols: USD→`$`, EUR→`€`, GBP→`£`, JPY→`¥`, CNY→`¥`, INR→`₹`, BRL→`R$`, RUB→`₽`, KRW→`₩`, THB→`฿`, BTC→`₿`, TRY→`₺`, PLN→`zł`, HUF→`Ft`, CZK→`Kč`, SEK/NOK/DKK→`kr`, ZAR→`R`, etc.

### 6.3 Price Formatting
- **Currency position** (`woocommerce_currency_pos`): `left` (`%1$s%2$s`), `right` (`%2$s%1$s`), `left_space` (`%1$s&nbsp;%2$s`), `right_space` (`%2$s&nbsp;%1$s`)
- **Thousand separator** (`woocommerce_price_thousand_sep`): configurable
- **Decimal separator** (`woocommerce_price_decimal_sep`): configurable
- **Number of decimals** (`woocommerce_price_num_decimals`): default 2
- **Trim zeros**: optional via `woocommerce_price_trim_zeros` filter

### 6.4 Price Output (`wc_price()`)
```html
<span class="woocommerce-Price-amount amount">
  <bdi>
    <span class="woocommerce-Price-currencySymbol" translate="no">$</span>1,234.56
  </bdi>
</span>
```
- Supports negative prices, tax labels, custom currency override
- Filters: `raw_woocommerce_price`, `formatted_woocommerce_price`, `wc_price`

---

## 7. SESSION HANDLING

### 7.1 Architecture
- **Storage**: Custom `woocommerce_sessions` table (not WP options)
- **Cookie**: `wp_woocommerce_session_{COOKIEHASH}`
- **Cookie format**: `{customer_id}|{expiration}|{expiring}|{hmac_hash}`
- **Hash**: HMAC-MD5 of `customer_id|expiration` using `wp_hash()`

### 7.2 Customer ID Generation
- **Logged-in users**: WordPress user ID (string)
- **Guests**: `t_` prefix + 30-char random hex (`wc_rand_hash('t_', 30)`)

### 7.3 Session Expiration
| User Type | Expiring | Expiration | Max |
|-----------|----------|------------|-----|
| Guest | 1 day | 2 days | 30 days |
| Logged-in | 1 day | 1 week | 30 days |

Filters: `wc_session_expiring`, `wc_session_expiration`

### 7.4 Session Lifecycle
1. Cookie check → restore from DB → validate expiry/ownership
2. Guest→logged-in migration: data copied, guest session deleted
3. Session token support: `?session=` query param for cart sharing (Store API)
4. Empty session destruction: removes cookie + DB data for guests with no cart data
5. Save on `shutdown` hook (only if `_dirty` flag set)
6. Cleanup: batched deletion of expired sessions (100/batch, 10ms sleep)

### 7.5 Cache Integration
- Uses `WC_SESSION_CACHE_GROUP` with `WC_Cache_Helper::get_cache_prefix()`
- Cache duration = session expiration - current time
- Full cache group invalidation on session cleanup

---

## 8. CACHE INVALIDATION PATTERNS

### 8.1 Page Caching Prevention
- Sets `DONOTCACHEPAGE`, `DONOTCACHEOBJECT`, `DONOTCACHEDB` constants
- Sends `no-cache` headers on cart, checkout, my-account pages
- Removes `no-store` for non-logged-in users (bfcache support)
- W3 Total Cache compatibility: warns about `_wc_session_` exclusion

### 8.2 Transient Versioning
```php
WC_Cache_Helper::get_transient_version($group, $refresh)
```
- Appends timestamp-based version to transient names
- Incrementing version invalidates all transients in a group
- Used for: shipping, product data, etc.

### 8.3 Geolocation Cache Busting
- URL parameter `?v={location_hash}` (12-char MD5 of country+state+postcode+city)
- Cookie `woocommerce_geo_hash` (1-hour TTL)
- Redirects with 307 if hash doesn't match when using "Geolocate with Page Caching"

### 8.4 Term Cache Cleaning
- `product_cat` taxonomy: clears `product-category-hierarchy-{id}` cache
- Includes ancestor hierarchy for complete invalidation

### 8.5 Layered Nav Counts
- Transient: `wc_layered_nav_counts_{attribute_key}`
- Queued for deletion on shutdown

### 8.6 Template Cache
- Object cache group `woocommerce` with keys like `template-part-{slug}-{name}-{version}`
- `cached_templates` tracks all cached template keys for bulk invalidation

---

## 9. DOWNLOAD HANDLING

### 9.1 Download URL Structure
```
?download_file={product_id}&order={order_key}&email={email}&key={download_id}
// OR with hashed email:
?download_file={product_id}&order={order_key}&uid={sha256(email)}&key={download_id}
```

### 9.2 Validation Chain
1. Product exists and has downloads
2. Download key is valid and enabled
3. Order key resolves to valid order
4. Email/UID matches order billing email
5. Download permission exists in `woocommerce_downloadable_product_permissions`
6. Order status permits downloads (`is_download_permitted()`)
7. Downloads remaining > 0 (skipped for range requests)
8. Access not expired
9. Login required check (`woocommerce_downloads_require_login`)

### 9.3 Download Methods
| Method | Hook | Description |
|--------|------|-------------|
| `force` (default) | `woocommerce_download_file_force` | PHP reads file in 1MB chunks |
| `xsendfile` | `woocommerce_download_file_xsendfile` | X-Sendfile/X-Accel-Redirect/X-Lighttpd-Sendfile |
| `redirect` | `woocommerce_download_file_redirect` | HTTP Location header |

### 9.4 Range Request Support
- Parses `HTTP_RANGE` header for partial downloads (iOS streaming)
- Single-range only (no multi-range)
- Returns 206 Partial Content with proper Content-Range headers
- Returns 416 for invalid ranges
- Partial download tracking deferred via Action Scheduler (30-min window)

### 9.5 File Path Resolution
1. Replace upload URLs with absolute paths
2. Replace site URLs with ABSPATH
3. Handle `//` protocol-relative URLs as remote
4. Check ABSPATH prefix, WP_CONTENT_DIR
5. Fallback: remote file detection

### 9.6 Security
- `X-Robots-Tag: noindex, nofollow`
- `nocache_headers()`
- Time limit removed (`wc_set_time_limit(0)`)
- Gzip disabled for downloads
- Session write closed before streaming
- IE SSL fix: `Cache-Control: private` for SSL downloads

---

## 10. PRIVACY / GDPR

### 10.1 Data Exporters (WP Privacy Tools)
1. **WooCommerce Customer Data** — customer profile data
2. **WooCommerce Customer Orders** — order data
3. **WooCommerce Customer Downloads** — download permissions
4. **WooCommerce Customer Payment Tokens** — saved payment methods

### 10.2 Data Erasers
1. **Customer Data Eraser** — removes customer profile
2. **Order Data Eraser** — anonymizes order personal data
3. **Download Data Eraser** — removes download permissions
4. **Customer Tokens Eraser** — removes payment tokens

### 10.3 Automated Data Retention (Background Process)
Triggered by `woocommerce_cleanup_personal_data` cron:

| Task | Option | Action |
|------|--------|--------|
| `trash_pending_orders` | `woocommerce_trash_pending_orders` | Trash old pending orders |
| `trash_failed_orders` | `woocommerce_trash_failed_orders` | Trash old failed orders |
| `trash_cancelled_orders` | `woocommerce_trash_cancelled_orders` | Trash old cancelled orders |
| `anonymize_refunded_orders` | `woocommerce_anonymize_refunded_orders` | Anonymize refunded orders |
| `anonymize_completed_orders` | `woocommerce_anonymize_completed_orders` | Anonymize completed orders |
| `delete_inactive_accounts` | `woocommerce_delete_inactive_accounts` | Delete inactive users |

All use relative date format: `{number: N, unit: 'days|weeks|months|years'}`.
Batch size: 20 per run.

### 10.4 Anonymization Rules
| Data Type | Anonymized Value |
|-----------|-----------------|
| `address_state` | `''` (empty) |
| `address_country` | `''` (empty) |
| `phone` | digits replaced with `0` |
| `numeric_id` | `0` |

### 10.5 Inactive Account Deletion
- Targets roles: `Customer`, `Subscriber` (filterable)
- Based on `wc_last_active` user meta
- Uses `wp_delete_user()` with content reassignment to user 0

### 10.6 Privacy Policy Template
Auto-generated suggested privacy policy text covering:
- Data collected during checkout
- Cookie usage for cart
- Account data storage
- Team access levels
- Third-party data sharing (payment processors)

---

## 11. REVIEW / COMMENT SYSTEM

### 11.1 Comment Types
| Type | Description | Excluded from queries |
|------|-------------|----------------------|
| `review` | Product reviews | No (but separated from general comments) |
| `order_note` | Order notes | Yes (from all public queries + feeds) |
| `webhook_delivery` | Webhook logs | Yes |
| `action_log` | Action logs | Yes |

### 11.2 Review Rating System
- Rating stored as comment meta: `rating` (1-5)
- Required ratings when `woocommerce_review_rating_required` = yes
- Average rating calculated per product: `SUM(meta_value) / count`
- Rating counts per star (1-5) stored per product
- Review count: `COUNT(*) WHERE comment_approved='1' AND comment_type IN ('review','','comment')`

### 11.3 Verified Purchase
- `verified` comment meta set via `wc_customer_bought_product()` check
- Option `woocommerce_review_rating_verification_required` restricts reviews to verified purchasers only
- Error: 403 "Only logged in customers who have purchased this product may leave a review"

### 11.4 Comment Count Caching
- Cache group: `wc_comment_counts`
- Keys: `wc_count_comments_{approved|unapproved|spam|trash|post-trashed}`
- TTL: 3 days
- Incremental updates on insert/status change
- Product reviews excluded from WP admin comment counts

### 11.5 Pending Reviews Counter
- Cache key: `woocommerce_product_reviews_pending_count`
- Group: `wc_comment_counts`
- TTL: 1 day
- Incremented/decremented on comment insert and status transitions

---

## 12. STRUCTURED DATA (JSON-LD)

### 12.1 Generated Schemas

#### Product (on single product pages)
```json
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "@id": "{permalink}#product",
  "name": "...",
  "url": "...",
  "description": "...",
  "image": "...",
  "sku": "...",
  "gtin": "...",
  "offers": [{
    "@type": "Offer|AggregateOffer",
    "price": "...",
    "priceCurrency": "...",
    "priceSpecification": [{
      "@type": "UnitPriceSpecification",
      "price": "...",
      "priceCurrency": "...",
      "validThrough": "YYYY-12-31",
      "valueAddedTaxIncluded": true|false,
      "priceType": "https://schema.org/ListPrice|SalePrice"
    }],
    "availability": "https://schema.org/InStock|OutOfStock|BackOrder",
    "url": "...",
    "seller": {"@type": "Organization", "name": "...", "url": "..."}
  }],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "...",
    "reviewCount": "..."
  },
  "review": [{
    "@type": "Review",
    "reviewRating": {"@type": "Rating", "bestRating": "5", "ratingValue": "...", "worstRating": "1"},
    "author": {"@type": "Person", "name": "..."},
    "reviewBody": "...",
    "datePublished": "..."
  }]
}
```

**Variable products**: Uses `AggregateOffer` with `lowPrice`/`highPrice`/`offerCount`, or single `Offer` when a specific variation is selected via URL params.

**Grouped products**: Uses minimum child price as `ListPrice`, sale price as `SalePrice`.

**GTIN validation**: Must be 8, 12, 13, or 14 digits.

#### BreadcrumbList
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [{
    "@type": "ListItem",
    "position": 1,
    "item": {"name": "...", "@id": "..."}
  }]
}
```

#### WebSite (shop front page)
```json
{
  "@type": "WebSite",
  "name": "...",
  "url": "...",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "{home}?s={search_term_string}&post_type=product",
    "query-input": "required name=search_term_string"
  }
}
```

#### Order (in email)
```json
{
  "@type": "Order",
  "url": "...",
  "orderStatus": "https://schema.org/OrderPaymentDue|Processing|Problem|Delivered|Cancelled|Returned",
  "orderNumber": "...",
  "orderDate": "...",
  "acceptedOffer": [{"@type": "Offer", "price": "...", "priceCurrency": "...", ...}],
  "discount": "...",
  "price": "...",
  "priceCurrency": "...",
  "billingAddress": {"@type": "PostalAddress", ...},
  "customer": {"@type": "Person", "name": "..."},
  "merchant": {"@type": "Organization", ...},
  "potentialAction": {"@type": "ViewAction", ...}
}
```

### 12.2 Output
- Frontend: `<script type="application/ld+json">` in `wp_footer`
- Email: Hidden `<div>` in order details (not plain text)
- Multiple types wrapped in `@graph`

---

## 13. FORMATTING FUNCTIONS

### 13.1 Price Formatting
| Function | Purpose |
|----------|---------|
| `wc_price($price, $args)` | Full HTML price with currency symbol |
| `wc_format_decimal($number, $dp, $trim_zeros)` | DB-ready decimal string |
| `wc_format_localized_price($value)` | Localized decimal separator |
| `wc_format_sale_price($regular, $sale)` | `<del>` + `<ins>` with a11y |
| `wc_format_price_range($from, $to)` | "X – Y" with a11y |
| `wc_trim_zeros($price)` | Remove trailing `.00` |
| `wc_format_refund_total($amount)` | Negate amount |
| `wc_round_tax_total($value, $precision)` | Round with tax rounding mode |
| `get_woocommerce_price_format()` | Format string based on currency position |
| `wc_get_price_thousand_separator()` | Thousand separator |
| `wc_get_price_decimal_separator()` | Decimal separator |
| `wc_get_price_decimals()` | Number of decimals (default 2) |

### 13.2 Weight Formatting
| Function | Purpose |
|----------|---------|
| `wc_get_weight($weight, $to_unit, $from_unit)` | Convert between g/kg/lbs/oz |
| `wc_format_weight($weight)` | Display string: "2.72 kg" |

Conversion chain: all → kg → target unit.
- g→kg: ×0.001, lbs→kg: ×0.453592, oz→kg: ×0.0283495
- kg→g: ×1000, kg→lbs: ×2.20462, kg→oz: ×35.274

### 13.3 Dimension Formatting
| Function | Purpose |
|----------|---------|
| `wc_get_dimension($dim, $to_unit, $from_unit)` | Convert between in/mm/cm/m/yd |
| `wc_format_dimensions($dims)` | Display: "L × W × H cm" |

Conversion chain: all → cm → target unit.
- in→cm: ×2.54, m→cm: ×100, mm→cm: ×0.1, yd→cm: ×91.44
- cm→in: ×0.3937, cm→m: ×0.01, cm→mm: ×10, cm→yd: ×0.010936133

### 13.4 Date/Time Formatting
| Function | Purpose |
|----------|---------|
| `wc_date_format()` | WP date format (filterable) |
| `wc_time_format()` | WP time format (filterable) |
| `wc_format_datetime($date, $format)` | Format WC_DateTime |
| `wc_string_to_timestamp($str, $from)` | Parse to UTC timestamp |
| `wc_string_to_datetime($str)` | Parse to WC_DateTime object |
| `wc_timezone_string()` | Get PHP timezone string |
| `wc_timezone_offset()` | Get UTC offset in seconds |

### 13.5 Address/Postcode Formatting
| Function | Purpose |
|----------|---------|
| `wc_format_postcode($postcode, $country)` | Country-specific formatting |
| `wc_normalize_postcode($postcode)` | Uppercase, strip spaces/dashes |
| `wc_format_phone_number($phone)` | Sanitize and format phone |
| `wc_sanitize_phone_number($phone)` | Digits and + only |

Postcode rules: SE→space before last 2, CA/GB→space before last 3, IE→space after 3, BR/PL→dash before last 3, JP→dash after 3, PT→dash after 4, US→dash after 5, NL→space after 4, LV→prefix "LV-", CZ/SK→prefix + space, DK→prefix "DK-"

### 13.6 Stock Formatting
| Function | Purpose |
|----------|---------|
| `wc_format_stock_for_display($product)` | "In stock", "X in stock", "Only X left" |
| `wc_format_stock_quantity_for_display($qty, $product)` | Filterable quantity display |

Stock format options: `''` (always show), `'low_amount'` (only when low), `'no'` (never show).

### 13.7 String Utilities
| Function | Purpose |
|----------|---------|
| `wc_string_to_bool($str)` | 'yes'/'true'/1 → true |
| `wc_bool_to_string($bool)` | true → 'yes' |
| `wc_clean($var)` | sanitize_text_field (recursive) |
| `wc_sanitize_textarea($var)` | Clean lines preserving breaks |
| `wc_sanitize_tooltip($var)` | HTML-safe tooltip |
| `wc_sanitize_coupon_code($val)` | Post-title sanitization + entity decode |
| `wc_strtoupper($str)` | mb_strtoupper wrapper |
| `wc_strtolower($str)` | mb_strtolower wrapper |
| `wc_trim_string($str, $chars, $suffix)` | Truncate with ellipsis |
| `wc_float_to_string($float)` | Locale-safe float conversion |
| `wc_remove_non_displayable_chars($str)` | Strip BOM, zero-width, directional chars |

### 13.8 Color Utilities
| Function | Purpose |
|----------|---------|
| `wc_rgb_from_hex($color)` | HEX → [R,G,B] |
| `wc_hex_darker($color, $factor)` | Darken hex color |
| `wc_hex_lighter($color, $factor)` | Lighten hex color |
| `wc_hex_is_light($color)` | Brightness > 155 |
| `wc_light_or_dark($color, $dark, $light)` | Contrast text color |
| `wc_format_hex($hex)` | Normalize 3→6 digit hex |

---

## 14. CONDITIONAL FUNCTIONS

### 14.1 Page Detection
| Function | Logic |
|----------|-------|
| `is_woocommerce()` | `is_shop() \|\| is_product_taxonomy() \|\| is_product()` |
| `is_shop()` | `is_post_type_archive('product') \|\| is_page(shop_page_id)` |
| `is_product_taxonomy()` | `is_tax(get_object_taxonomies('product'))` |
| `is_product_category($term)` | `is_tax('product_cat', $term)` |
| `is_product_tag($term)` | `is_tax('product_tag', $term)` |
| `is_product()` | `is_singular('product')` |
| `is_cart()` | Filter + `WOOCOMMERCE_CART` constant + `CartCheckoutUtils::is_cart_page()` |
| `is_checkout()` | Filter + `WOOCOMMERCE_CHECKOUT` constant + `CartCheckoutUtils::is_checkout_page()` |
| `is_checkout_pay_page()` | `$wp->query_vars['order-pay']` + `is_checkout()` |
| `is_account_page()` | `is_page(myaccount_page_id)` or has `[woocommerce_my_account]` |
| `is_view_order_page()` | myaccount page + `view-order` query var |
| `is_edit_account_page()` | myaccount page + `edit-account` query var |
| `is_order_received_page()` | checkout page + `order-received` query var |
| `is_payment_methods_page()` | myaccount page + `payment-methods` query var |
| `is_add_payment_method_page()` | myaccount page + `payment-methods` or `add-payment-method` |
| `is_lost_password_page()` | myaccount page + `lost-password` query var |
| `is_wc_endpoint_url($endpoint)` | Check WP query vars against WC endpoints |
| `is_wc_admin_settings_page()` | `$_REQUEST['page'] === 'wc-settings'` + admin |

### 14.2 Feature Detection
| Function | Logic |
|----------|-------|
| `wc_tax_enabled()` | `woocommerce_calc_taxes === 'yes'` |
| `wc_shipping_enabled()` | `woocommerce_ship_to_countries !== 'disabled'` |
| `wc_prices_include_tax()` | Tax enabled + `woocommerce_prices_include_tax === 'yes'` |
| `wc_reviews_enabled()` | `woocommerce_enable_reviews === 'yes'` |
| `wc_review_ratings_enabled()` | Reviews enabled + `woocommerce_enable_review_rating === 'yes'` |
| `wc_review_ratings_required()` | `woocommerce_review_rating_required === 'yes'` |
| `is_store_notice_showing()` | `woocommerce_demo_store !== 'no'` |
| `is_filtered()` | Layered nav attributes or price/rating filters active |

### 14.3 Theme/Environment Detection
| Function | Logic |
|----------|-------|
| `wc_current_theme_supports_woocommerce_or_fse()` | `current_theme_supports('woocommerce')` or block theme |
| `wc_site_is_https()` | Home URL contains `https:` |
| `wc_checkout_is_https()` | Site HTTPS or force SSL or checkout permalink HTTPS |
| `is_ajax()` | `wp_doing_ajax()` |
| `wc_is_valid_url($url)` | Starts with http(s) + passes `FILTER_VALIDATE_URL` |
| `wc_is_file_valid_csv($file)` | Checks file type against csv/txt |

### 14.4 Attribute Detection
| Function | Logic |
|----------|-------|
| `taxonomy_is_product_attribute($name)` | Checks `$wc_product_attributes` global |
| `meta_is_product_attribute($name, $value, $id)` | Checks product variation attributes |

---

## 15. WIDGETS

### 15.1 Widget Files (15 widgets)
| File | Widget |
|------|--------|
| `class-wc-widget-cart.php` | Cart widget |
| `class-wc-widget-layered-nav.php` | Layered nav (attribute filter) |
| `class-wc-widget-layered-nav-filters.php` | Active filters widget |
| `class-wc-widget-price-filter.php` | Price range filter |
| `class-wc-widget-product-categories.php` | Product categories list |
| `class-wc-widget-product-search.php` | Product search |
| `class-wc-widget-product-tag-cloud.php` | Product tag cloud |
| `class-wc-widget-products.php` | Products list (recent, featured, on-sale, etc.) |
| `class-wc-widget-rating-filter.php` | Star rating filter |
| `class-wc-widget-recent-reviews.php` | Recent reviews |
| `class-wc-widget-recently-viewed.php` | Recently viewed products |
| `class-wc-widget-top-rated-products.php` | Top rated products |
| `class-wc-widget-brand-description.php` | Brand description |
| `class-wc-widget-brand-nav.php` | Brand navigation |
| `class-wc-widget-brand-thumbnails.php` | Brand thumbnails |

---

## 16. KEY ARCHITECTURAL PATTERNS

### 16.1 Database Update System
- 70+ versioned callbacks from `2.0.0` through `11.0.0`
- Uses Action Scheduler for async processing
- Auto-update enabled by default (filterable via `woocommerce_enable_auto_update_db`)
- Lock mechanism prevents concurrent installs (10-minute stale timeout)

### 16.2 Roles Created
- `shop_manager` — full store management
- `customer` — default customer role

### 16.3 Post Types
- `product` — main product type
- `product_variation` — variable product variations
- `shop_order` — orders (legacy, before HPOS)
- `shop_order_refund` — refunds
- `shop_coupon` — coupons

### 16.4 Taxonomies
- `product_cat` — product categories (hierarchical)
- `product_tag` — product tags
- `product_type` — simple, variable, grouped, external
- `product_visibility` — visible, catalog, search, hidden, featured, outofstock
- `product_shipping_class` — shipping classes
- Dynamic: `pa_{attribute_name}` — product attribute taxonomies

### 16.5 Endpoints
- Cart: `order-pay`, `order-received`
- My Account: `orders`, `view-order`, `downloads`, `edit-account`, `edit-address`, `payment-methods`, `add-payment-method`, `delete-payment-method`, `set-default-payment-method`, `lost-password`

---

*This report covers WooCommerce trunk as of the latest fetch. HPOS table schemas, stock notifications, and email unsubscribes tables are generated dynamically by their respective DataStore classes and should be fetched separately for complete schema details.*
