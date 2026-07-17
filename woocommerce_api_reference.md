# WooCommerce REST API, Webhooks & Plugin/Hook System — Comprehensive Reference

> Source: `woocommerce/woocommerce` trunk branch, fetched July 2026
> Version: 11.1.0-dev

---

## 1. REST API ARCHITECTURE

### 1.1 API Versioning & Namespaces

The REST API uses WordPress's native `register_rest_route()` system. Four namespaces exist:

| Namespace | Status | Notes |
|-----------|--------|-------|
| `wc/v1` | Legacy | Original REST API |
| `wc/v2` | Legacy | Added system status, shipping zones, payment gateways |
| `wc/v3` | **Current stable** | Full CRUD, batch ops, all resources |
| `wc/v4` | **Experimental** | Feature-flagged (`rest-api-v4`), new architecture |
| `wc-telemetry` | Internal | Tracker endpoint only |

**Initialization flow:**
```
WooCommerce::__construct()
  → init_hooks()
    → add_action('init', [$this, 'load_rest_api'])
      → Server::instance()->init()
        → add_action('rest_api_init', [$this, 'register_rest_routes'], 10)
```

**Server.php** (`Automattic\WooCommerce\RestApi\Server`) is the central registry. It:
- Iterates all namespaces from `get_rest_namespaces()`
- Instantiates each controller via DI container or `LegacyProxy`
- Calls `register_routes()` on each controller
- Exposes filter: `woocommerce_rest_api_get_rest_namespaces`

### 1.2 Controller Inheritance Hierarchy (V3)

```
WP_REST_Controller (WordPress core)
  └── WC_REST_Controller (base for all WC V3 controllers)
        ├── WC_REST_Posts_Controller (post-based resources)
        │     └── WC_REST_CRUD_Controller (generic CRUD)
        │           ├── WC_REST_Products_V2_Controller
        │           │     └── WC_REST_Products_Controller (V3)
        │           ├── WC_REST_Orders_V2_Controller
        │           │     └── WC_REST_Orders_Controller (V3)
        │           ├── WC_REST_Coupons_V2_Controller
        │           │     └── WC_REST_Coupons_Controller (V3)
        │           └── ...
        ├── WC_REST_Customers_V2_Controller
        │     └── WC_REST_Customers_Controller (V3)
        ├── WC_REST_Terms_Controller (taxonomy-based)
        │     ├── WC_REST_Product_Categories_Controller
        │     ├── WC_REST_Product_Tags_Controller
        │     └── WC_REST_Product_Attribute_Terms_Controller
        └── WC_REST_Webhooks_Controller
```

### 1.3 Complete V3 Endpoint Registry

From `Server::get_v3_controllers()`:

| Controller Key | Controller Class | Resource |
|---|---|---|
| `coupons` | `WC_REST_Coupons_Controller` | Coupons |
| `customer-downloads` | `WC_REST_Customer_Downloads_Controller` | Customer downloads |
| `customers` | `WC_REST_Customers_Controller` | Customers |
| `network-orders` | `WC_REST_Network_Orders_Controller` | Network orders (multisite) |
| `order-notes` | `WC_REST_Order_Notes_Controller` | Order notes |
| `order-refunds` | `WC_REST_Order_Refunds_Controller` | Order refunds |
| `orders` | `WC_REST_Orders_Controller` | Orders |
| `product-attribute-terms` | `WC_REST_Product_Attribute_Terms_Controller` | Attribute terms |
| `product-attributes` | `WC_REST_Product_Attributes_Controller` | Attributes |
| `product-categories` | `WC_REST_Product_Categories_Controller` | Categories |
| `product-custom-fields` | `WC_REST_Product_Custom_Fields_Controller` | Custom fields |
| `product-reviews` | `WC_REST_Product_Reviews_Controller` | Reviews |
| `product-shipping-classes` | `WC_REST_Product_Shipping_Classes_Controller` | Shipping classes |
| `product-tags` | `WC_REST_Product_Tags_Controller` | Tags |
| `products` | `WC_REST_Products_Controller` | Products |
| `product-variations` | `WC_REST_Product_Variations_Controller` | Variations |
| `refunds` | `WC_REST_Refunds_Controller` | Refunds (standalone) |
| `reports-sales` | `WC_REST_Report_Sales_Controller` | Sales reports |
| `reports-top-sellers` | `WC_REST_Report_Top_Sellers_Controller` | Top sellers |
| `reports-orders-totals` | `WC_REST_Report_Orders_Totals_Controller` | Order totals |
| `reports-products-totals` | `WC_REST_Report_Products_Totals_Controller` | Product totals |
| `reports-customers-totals` | `WC_REST_Report_Customers_Totals_Controller` | Customer totals |
| `reports-coupons-totals` | `WC_REST_Report_Coupons_Totals_Controller` | Coupon totals |
| `reports-reviews-totals` | `WC_REST_Report_Reviews_Totals_Controller` | Review totals |
| `reports` | `WC_REST_Reports_Controller` | Reports index |
| `settings` | `WC_REST_Settings_Controller` | Settings groups |
| `settings-options` | `WC_REST_Setting_Options_Controller` | Setting options |
| `shipping-zones` | `WC_REST_Shipping_Zones_Controller` | Shipping zones |
| `shipping-zone-locations` | `WC_REST_Shipping_Zone_Locations_Controller` | Zone locations |
| `shipping-zone-methods` | `WC_REST_Shipping_Zone_Methods_Controller` | Zone methods |
| `tax-classes` | `WC_REST_Tax_Classes_Controller` | Tax classes |
| `taxes` | `WC_REST_Taxes_Controller` | Tax rates |
| `variations` | `WC_REST_Variations_Controller` | Variations (alt) |
| `webhooks` | `WC_REST_Webhooks_Controller` | Webhooks |
| `system-status` | `WC_REST_System_Status_Controller` | System status |
| `system-status-tools` | `WC_REST_System_Status_Tools_Controller` | Status tools |
| `shipping-methods` | `WC_REST_Shipping_Methods_Controller` | Shipping methods |
| `payment-gateways` | `WC_REST_Payment_Gateways_Controller` | Payment gateways |
| `data` | `WC_REST_Data_Controller` | Data index |
| `data-continents` | `WC_REST_Data_Continents_Controller` | Continents |
| `data-countries` | `WC_REST_Data_Countries_Controller` | Countries |
| `data-currencies` | `WC_REST_Data_Currencies_Controller` | Currencies |
| `paypal-standard` | `WC_REST_Paypal_Standard_Controller` | PayPal settings |
| `paypal-webhooks` | `WC_REST_Paypal_Webhooks_Controller` | PayPal webhooks |
| `paypal-buttons` | `WC_REST_Paypal_Buttons_Controller` | PayPal buttons |

---

## 2. PRODUCTS ENDPOINT — Detailed Analysis

**Route:** `/wc/v3/products`
**Controller:** `WC_REST_Products_Controller extends WC_REST_Products_V2_Controller`

### 2.1 Standard CRUD Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/wc/v3/products` | List products |
| `POST` | `/wc/v3/products` | Create product |
| `GET` | `/wc/v3/products/<id>` | Get single product |
| `PUT/PATCH` | `/wc/v3/products/<id>` | Update product |
| `DELETE` | `/wc/v3/products/<id>` | Delete product |
| `POST` | `/wc/v3/products/batch` | Batch create/update/delete |
| `GET` | `/wc/v3/products/suggested-products` | Get suggested products |
| `POST` | `/wc/v3/products/<id>/duplicate` | Duplicate a product |

### 2.2 Product Schema (Complete)

```json
{
  "id": "integer (readonly)",
  "name": "string",
  "slug": "string",
  "permalink": "string (readonly, uri)",
  "date_created": "date-time",
  "date_created_gmt": "date-time",
  "date_modified": "date-time (readonly)",
  "date_modified_gmt": "date-time (readonly)",
  "type": "string (enum: simple, grouped, external, variable, ...)",
  "status": "string (enum: draft, pending, private, publish, future, auto-draft, trash)",
  "featured": "boolean",
  "catalog_visibility": "string (enum: visible, catalog, search, hidden)",
  "description": "string",
  "short_description": "string",
  "sku": "string",
  "global_unique_id": "string (GTIN/UPC/EAN/ISBN)",
  "price": "string (readonly)",
  "regular_price": "string",
  "sale_price": "string",
  "date_on_sale_from": "date-time",
  "date_on_sale_from_gmt": "date-time",
  "date_on_sale_to": "date-time",
  "date_on_sale_to_gmt": "date-time",
  "price_html": "string (readonly)",
  "on_sale": "boolean (readonly)",
  "purchasable": "boolean (readonly)",
  "total_sales": "integer (readonly)",
  "virtual": "boolean",
  "downloadable": "boolean",
  "downloads": [{ "id": "string", "name": "string", "file": "string" }],
  "download_limit": "integer",
  "download_expiry": "integer",
  "external_url": "string (uri)",
  "button_text": "string",
  "tax_status": "string (enum: taxable, shipping, none)",
  "tax_class": "string",
  "manage_stock": "boolean",
  "stock_quantity": "integer|number",
  "stock_status": "string (enum: instock, outofstock, onbackorder)",
  "backorders": "string (enum: no, notify, yes)",
  "backorders_allowed": "boolean (readonly)",
  "backordered": "boolean (readonly)",
  "low_stock_amount": "integer|null",
  "sold_individually": "boolean",
  "weight": "string",
  "dimensions": { "length": "string", "width": "string", "height": "string" },
  "shipping_required": "boolean (readonly)",
  "shipping_taxable": "boolean (readonly)",
  "shipping_class": "string",
  "shipping_class_id": "string (readonly)",
  "reviews_allowed": "boolean",
  "post_password": "string",
  "average_rating": "string (readonly)",
  "rating_count": "integer (readonly)",
  "related_ids": ["integer (readonly)"],
  "upsell_ids": ["integer"],
  "cross_sell_ids": ["integer"],
  "parent_id": "integer",
  "purchase_note": "string",
  "categories": [{ "id": "integer", "name": "string (readonly)", "slug": "string (readonly)" }],
  "tags": [{ "id": "integer", "name": "string (readonly)", "slug": "string (readonly)" }],
  "images": [{
    "id": "integer",
    "date_created": "date-time",
    "date_created_gmt": "date-time",
    "date_modified": "date-time",
    "date_modified_gmt": "date-time",
    "src": "string (uri)",
    "name": "string",
    "alt": "string",
    "srcset": "string",
    "sizes": "string",
    "thumbnail": "string"
  }],
  "attributes": [{
    "id": "integer",
    "name": "string",
    "position": "integer",
    "visible": "boolean",
    "variation": "boolean",
    "options": ["string"]
  }],
  "default_attributes": [{ "id": "integer", "name": "string", "option": "string" }],
  "variations": ["integer (readonly)"],
  "grouped_products": ["integer"],
  "menu_order": "integer",
  "meta_data": [{ "id": "integer", "key": "string", "value": "mixed" }]
}
```

### 2.3 Product Collection Parameters (Filtering & Pagination)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `context` | string | `view` | `view` or `edit` |
| `page` | integer | 1 | Current page |
| `per_page` | integer | 10 | Items per page (max 100) |
| `search` | string | — | Search term |
| `after` | string | — | ISO8601 datetime, items published after |
| `before` | string | — | ISO8601 datetime, items published before |
| `modified_after` | string | — | Items modified after |
| `modified_before` | string | — | Items modified before |
| `dates_are_gmt` | boolean | false | Treat date params as GMT |
| `exclude` | array[int] | — | Exclude specific IDs |
| `include` | array[int] | — | Include only specific IDs |
| `offset` | integer | — | Offset results |
| `order` | string | `desc` | `asc` or `desc` |
| `orderby` | string | `date` | Sort field: `date`, `id`, `include`, `title`, `slug`, `price`, `popularity`, `rating`, `menu_order` |
| `parent` | array[int] | — | Filter by parent IDs |
| `parent_exclude` | array[int] | — | Exclude parent IDs |
| `status` | string | — | Post status filter |
| `type` | string | — | Product type slug |
| `include_types` | array[string] | — | List of product type slugs |
| `exclude_types` | array[string] | — | Exclude product type slugs |
| `sku` | string | — | Exact SKU match (comma-separated for multiple) |
| `search_sku` | string | — | Partial SKU match |
| `search_name_or_sku` | string | — | Tokenized search across name and SKU |
| `search_fields` | array[string] | — | Fields to search: `name`, `sku`, `global_unique_id`, `description`, `short_description` |
| `featured` | boolean | — | Filter featured products |
| `category` | string | — | Category term ID |
| `tag` | string | — | Tag term ID |
| `shipping_class` | string | — | Shipping class term ID |
| `attribute` | string | — | Attribute taxonomy name |
| `attribute_term` | string | — | Attribute term IDs |
| `tax_class` | string | — | Tax class slug |
| `on_sale` | boolean | — | Filter on-sale products |
| `min_price` | string | — | Minimum price |
| `max_price` | string | — | Maximum price |
| `stock_status` | string | — | Stock status filter |
| `downloadable` | boolean | — | Filter downloadable |
| `virtual` | boolean | — | Filter virtual |
| `include_status` | array[string] | — | Include specific statuses |
| `exclude_status` | array[string] | — | Exclude specific statuses |
| `global_unique_id` | string | — | Filter by GTIN/UPC/EAN/ISBN |
| `pos_products_only` | boolean | — | Filter POS-visible products |
| `image_size` | string | `full` | Image size for response |

### 2.4 Product prepare_object_for_database Flow

The `prepare_object_for_database()` method handles full product creation/update:

1. **Type resolution** — Uses `WC_Product_Factory::get_classname_from_product_type()` to instantiate correct class
2. **Basic fields** — name, description, short_description, status, slug, menu_order, reviews_allowed, post_password, virtual
3. **Tax** — tax_status, tax_class
4. **Visibility** — catalog_visibility, featured
5. **Shipping** — weight, dimensions, shipping_class
6. **SKU/IDs** — sku, global_unique_id
7. **Attributes** — Global attributes (by ID) and custom attributes (by name), with options, position, visible, variation flags
8. **Pricing** — regular_price, sale_price, date_on_sale_from/to (variable/grouped products have prices cleared)
9. **Stock** — manage_stock, backorders, stock_quantity, inventory_delta, low_stock_amount, stock_status
10. **Relations** — upsell_ids, cross_sell_ids, parent_id, grouped_products
11. **Taxonomy** — categories (by ID), tags (by ID or auto-created by name)
12. **Downloads** — downloadable files, download_limit, download_expiry
13. **External** — external_url, button_text
14. **Images** — Upload from URL or set by attachment ID, with alt text and name
15. **Meta data** — Via `MetaDataUtil::update()`
16. **Filter** — `woocommerce_rest_pre_insert_product_object`

---

## 3. ORDERS ENDPOINT — Detailed Analysis

**Route:** `/wc/v3/orders`
**Controller:** `WC_REST_Orders_Controller extends WC_REST_Orders_V2_Controller`

### 3.1 Standard CRUD Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/wc/v3/orders` | List orders |
| `POST` | `/wc/v3/orders` | Create order |
| `GET` | `/wc/v3/orders/<id>` | Get single order |
| `PUT/PATCH` | `/wc/v3/orders/<id>` | Update order |
| `DELETE` | `/wc/v3/orders/<id>` | Delete order |
| `POST` | `/wc/v3/orders/batch` | Batch operations |

### 3.2 Order-Specific Collection Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | array[string] | Filter by statuses: `any`, `trash`, `pending`, `processing`, `on-hold`, `completed`, `cancelled`, `refunded`, `failed` |
| `created_via` | array[string] | Filter by source (e.g. `checkout`, `admin`) |

### 3.3 Order Schema Additions (V3 vs V2)

- `created_via` — writable on creation only
- `coupon_lines[].discount` — readonly
- `manual_update` — boolean, marks order notes as "added by user"
- `set_paid` — boolean, triggers `payment_complete()`
- `transaction_id` — string, used with `set_paid`
- COGS fields (when enabled): `cost_of_goods_sold.total_value`, line item COGS

### 3.4 Order save_object Flow

1. `prepare_object_for_database()` — sets all writable props via schema keys
2. Address handling — billing/shipping via `update_address()`
3. Line items — create/update/remove with stock adjustment via `wc_maybe_adjust_line_item_product_stock()`
4. Shipping/fee lines — same pattern as line items
5. Meta data — via `MetaDataUtil::update()`
6. Filter: `woocommerce_rest_pre_insert_shop_order_object`
7. `save_object()`:
   - Load payment gateways
   - Validate customer_id exists
   - On create: set `created_via` to `rest-api`, set prices_include_tax, save, calculate_totals
   - On update: recalculate if billing/shipping/line_items/shipping_lines/fee_lines/coupon_lines changed
   - Apply coupons via `calculate_coupons()`
   - Set status (with optional `manual_update` flag)
   - Save
   - If `set_paid` is true: call `payment_complete(transaction_id)`
8. Error handling: On `WC_Data_Exception`, set status to `checkout-draft` and return `new_draft_order_id`

### 3.5 Coupon Handling

- Validates each coupon code via `WC_Discounts::is_coupon_valid()`
- Removes all existing coupons before re-applying
- Coupon item IDs are readonly (cannot be set directly)
- Throws `WC_REST_Exception` on invalid coupons

---

## 4. CUSTOMERS ENDPOINT — Detailed Analysis

**Route:** `/wc/v3/customers`
**Controller:** `WC_REST_Customers_Controller extends WC_REST_Customers_V2_Controller`

### 4.1 Customer Schema

```json
{
  "id": "integer (readonly)",
  "date_created": "date-time (readonly)",
  "date_created_gmt": "date-time (readonly)",
  "date_modified": "date-time (readonly)",
  "date_modified_gmt": "date-time (readonly)",
  "email": "string (email format)",
  "first_name": "string",
  "last_name": "string",
  "role": "string (readonly)",
  "username": "string",
  "password": "string (edit context only)",
  "billing": {
    "first_name": "string",
    "last_name": "string",
    "company": "string",
    "address_1": "string",
    "address_2": "string",
    "city": "string",
    "state": "string",
    "postcode": "string",
    "country": "string",
    "email": "string (email)",
    "phone": "string"
  },
  "shipping": {
    "first_name": "string",
    "last_name": "string",
    "company": "string",
    "address_1": "string",
    "address_2": "string",
    "city": "string",
    "state": "string",
    "postcode": "string",
    "country": "string",
    "phone": "string"
  },
  "is_paying_customer": "boolean (readonly)",
  "avatar_url": "string (readonly)",
  "meta_data": [{ "id": "integer", "key": "string", "value": "mixed" }]
}
```

---

## 5. AUTHENTICATION SYSTEM

### 5.1 Authentication Class

`WC_REST_Authentication` — singleton, instantiated at file load.

**Hooks registered:**
- `determine_current_user` (priority 15) → `authenticate()`
- `rest_authentication_errors` → `authentication_fallback()`
- `rest_authentication_errors` (priority 15) → `check_authentication_error()`
- `rest_post_dispatch` (priority 50) → `send_unauthorized_headers()`
- `rest_pre_dispatch` (priority 10) → `check_user_permissions()`

### 5.2 Two Authentication Methods

#### Method 1: Basic Authentication (SSL only)

- Requires HTTPS
- Credentials via `$_GET[consumer_key]` + `$_GET[consumer_secret]` OR HTTP Basic Auth headers (`PHP_AUTH_USER` / `PHP_AUTH_PW`)
- Consumer key looked up in `{prefix}woocommerce_api_keys` table (hashed via `wc_api_hash()`)
- Consumer secret validated with `hash_equals()`
- On failure: returns `WWW-Authenticate: Basic` header

#### Method 2: OAuth 1.0a One-Legged (non-SSL)

- Parameters from `$_GET`, `$_POST`, or `Authorization` header
- Required params: `oauth_consumer_key`, `oauth_timestamp`, `oauth_nonce`, `oauth_signature`, `oauth_signature_method`
- Signature methods: `HMAC-SHA1` or `HMAC-SHA256`
- Signature base string: `METHOD&base_uri&url_encoded_query_string`
- Timestamp validation: must be within **15 minutes** of server time
- Nonce validation: stored per-key in serialized format, expired nonces purged after 15 min window
- Replay attack prevention via nonce tracking in DB

### 5.3 Permission Scopes

| Scope | Read | Write |
|-------|------|-------|
| `read` | GET, HEAD | No |
| `write` | No | POST, PUT, PATCH, DELETE |
| `read_write` | Yes | Yes |

Permission check happens in `check_user_permissions()` via `rest_pre_dispatch` filter.

### 5.4 API Key Storage

Table: `{prefix}woocommerce_api_keys`

| Column | Description |
|--------|-------------|
| `key_id` | Primary key |
| `user_id` | WP user ID |
| `description` | Key description |
| `permissions` | `read`, `write`, `read_write` |
| `consumer_key` | Hashed consumer key (prefix `ck_`) |
| `consumer_secret` | Plain consumer secret (prefix `cs_`) |
| `truncated_key` | Last 7 chars of consumer key |
| `nonces` | Serialized nonce tracking |
| `last_access` | Last access timestamp |

### 5.5 Auth Endpoint Flow (WC_Auth class)

Endpoint: `/wc-auth/v1/{route}`

Routes:
1. **login** — Shows login form (or redirects to Jetpack SSO)
2. **authorize** — Shows permission grant form (requires `manage_woocommerce` capability)
3. **access_granted** — Creates API keys, POSTs credentials to callback_url, redirects to return_url

Required parameters: `app_name`, `user_id`, `return_url`, `callback_url`, `scope`
- `callback_url` must be HTTPS
- Nonce verification on `access_granted` via `wc_auth_grant_access`

---

## 6. WEBHOOK SYSTEM

### 6.1 Webhook Data Model

```php
WC_Webhook extends WC_Legacy_Webhook extends WC_Data

$data = [
  'date_created'     => null,
  'date_modified'    => null,
  'status'           => 'disabled',  // active | paused | disabled
  'delivery_url'     => '',
  'secret'           => '',
  'name'             => '',
  'topic'            => '',
  'hooks'            => '',
  'resource'         => '',
  'event'            => '',
  'failure_count'    => 0,
  'user_id'          => 0,
  'api_version'      => 3,
  'pending_delivery' => false,
]
```

Data store: `WC_Data_Store::load('webhook')` → `WC_Webhook_Data_Store`

### 6.2 Webhook Topics & Hook Mappings

| Topic | WordPress/WooCommerce Hooks |
|-------|---------------------------|
| `coupon.created` | `woocommerce_process_shop_coupon_meta`, `woocommerce_new_coupon` |
| `coupon.updated` | `woocommerce_process_shop_coupon_meta`, `woocommerce_update_coupon` |
| `coupon.deleted` | `wp_trash_post` |
| `coupon.restored` | `untrashed_post` |
| `customer.created` | `user_register`, `woocommerce_created_customer`, `woocommerce_new_customer` |
| `customer.updated` | `profile_update`, `woocommerce_update_customer` |
| `customer.deleted` | `delete_user` |
| `order.created` | `woocommerce_new_order` |
| `order.updated` | `woocommerce_update_order`, `woocommerce_order_refunded` |
| `order.deleted` | `wp_trash_post`, `woocommerce_trash_order` |
| `order.restored` | `untrashed_post`, `woocommerce_untrash_order` |
| `product.created` | `woocommerce_process_product_meta`, `woocommerce_new_product`, `woocommerce_new_product_variation` |
| `product.updated` | `woocommerce_process_product_meta`, `woocommerce_update_product`, `woocommerce_update_product_variation` |
| `product.deleted` | `wp_trash_post` |
| `product.restored` | `untrashed_post` |
| `product.published` | `woocommerce_product_published` |
| `action.{hook_name}` | Custom action hook (any WP action) |

**Extensibility:** Topic-to-hook mapping is filterable via `woocommerce_webhook_topic_hooks`.

### 6.3 Webhook Delivery Flow

```
1. enqueue() — registers add_action() for each mapped hook
2. process($arg) — called when hook fires
   a. should_deliver($arg) checks:
      - is_active() — status === 'active'
      - is_valid_topic() — wc_is_webhook_valid_topic()
      - is_valid_action($arg) — post type validation, user role validation, create vs update detection
      - is_valid_resource($arg) — post status validation, order type validation
      - is_already_processed($arg) — dedup within request
      - Filter: woocommerce_webhook_should_deliver
   b. do_action('woocommerce_webhook_process_delivery', $webhook, $arg)
      → wc_webhook_process_delivery() schedules background delivery
3. deliver($arg) — actual HTTP delivery
   a. build_payload($arg)
      - Sets current user to webhook creator
      - For resources: calls REST API endpoint internally via RestApiUtil::get_endpoint_data()
      - For 'action' resource: returns {action, arg}
      - For 'deleted' event: returns {id}
      - Filter: woocommerce_webhook_payload
   b. HTTP POST via wp_safe_remote_request()
      - Content-Type: application/json
      - Timeout: 60 seconds
      - HTTP version: 1.0
      - User-Agent: WooCommerce/{version} Hookshot (WordPress/{version})
   c. Custom headers:
      - X-WC-Webhook-Source: home_url
      - X-WC-Webhook-Topic: topic
      - X-WC-Webhook-Resource: resource
      - X-WC-Webhook-Event: event
      - X-WC-Webhook-Signature: HMAC-SHA256 base64 signature
      - X-WC-Webhook-ID: webhook_id
      - X-WC-Webhook-Delivery-ID: unique hash
   d. log_delivery() — logs to 'webhooks-delivery' source
   e. Filter: woocommerce_webhook_http_args
   f. Action: woocommerce_webhook_delivery
```

### 6.4 Webhook Signature Verification

```php
// Signature = base64(hmac_sha256(payload_body, secret))
$signature = base64_encode(hash_hmac('sha256', $payload, $secret, true));
```

Hash algorithm filterable via `woocommerce_webhook_hash_algorithm`.

### 6.5 Failure Handling

- Success: 2xx, 301, or 302 → reset failure_count to 0
- Failure: any other response → increment failure_count
- After **5 consecutive failures** (filterable via `woocommerce_max_webhook_delivery_failures`):
  - Status set to `disabled`
  - Action: `woocommerce_webhook_disabled_due_delivery_failures`

### 6.6 Webhook Loading

During `WooCommerce::init()`:
```php
load_webhooks() → wc_load_webhooks('active', $limit)
```
Limit filterable via `woocommerce_load_webhooks_limit`.

### 6.7 Delivery Ping

On webhook creation, `deliver_ping()` sends a test POST with body `webhook_id={id}` to validate the delivery URL. Returns `WP_Error` on failure.

---

## 7. HOOK/FILTER SYSTEM — Complete Registry

### 7.1 WooCommerce Lifecycle Hooks (Actions)

| Hook | When | Priority |
|------|------|----------|
| `woocommerce_loaded` | After all plugins loaded | -1 on `plugins_loaded` |
| `before_woocommerce_init` | Before `WC::init()` | — |
| `woocommerce_init` | After `WC::init()` completes | — |
| `woocommerce_register_taxonomy` | Before taxonomies registered | — |
| `woocommerce_after_register_taxonomy` | After taxonomies registered | — |
| `woocommerce_register_post_type` | Before post types registered | — |
| `woocommerce_after_register_post_type` | After post types registered | — |
| `woocommerce_shutdown_error` | On fatal error during shutdown | — |

### 7.2 REST API Hooks (Filters)

| Hook | Purpose |
|------|---------|
| `woocommerce_rest_api_get_rest_namespaces` | Modify list of API namespaces to load |
| `woocommerce_rest_is_request_to_rest_api` | Override REST API request detection |
| `woocommerce_rest_pre_insert_{post_type}_object` | Modify object before DB insert (products, orders, coupons) |
| `woocommerce_rest_suppress_image_upload_error` | Suppress image upload errors |
| `woocommerce_is_rest_api_request` | Override REST API request detection |

### 7.3 Webhook Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `woocommerce_webhook_topic_hooks` | Filter | Modify topic-to-hook mapping |
| `woocommerce_webhook_hooks` | Filter | Modify hooks for a webhook |
| `woocommerce_webhook_should_deliver` | Filter | Override delivery decision |
| `woocommerce_webhook_payload` | Filter | Modify webhook payload |
| `woocommerce_webhook_http_args` | Filter | Modify HTTP request args |
| `woocommerce_webhook_delivery` | Action | After delivery completes |
| `woocommerce_webhook_process_delivery` | Action | Process delivery (schedules background) |
| `woocommerce_webhook_disabled_due_delivery_failures` | Action | Webhook auto-disabled |
| `woocommerce_webhook_hash_algorithm` | Filter | Change signature hash algorithm |
| `woocommerce_webhook_name` | Filter | Modify webhook name |
| `woocommerce_webhook_status` | Filter | Modify webhook status |
| `woocommerce_webhook_secret` | Filter | Modify webhook secret |
| `woocommerce_webhook_topic` | Filter | Modify webhook topic |
| `woocommerce_webhook_delivery_url` | Filter | Modify delivery URL |
| `woocommerce_webhook_resource` | Filter | Modify resource extraction |
| `woocommerce_webhook_event` | Filter | Modify event extraction |
| `woocommerce_webhook_enable_delivery_log` | Filter | Enable/disable delivery logging |
| `woocommerce_load_webhooks_limit` | Filter | Limit webhooks loaded |
| `woocommerce_max_webhook_delivery_failures` | Filter | Max failures before disable (default: 5) |

### 7.4 Authentication Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `woocommerce_api_permissions_in_scope` | Filter | Modify permissions list for a scope |
| `woocommerce_disable_rest_api_access_log` | Filter | Disable last_access logging |

### 7.5 Order-Specific Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `woocommerce_rest_remove_order_item` | Action | Before order item removal |
| `woocommerce_register_shop_order_post_statuses` | Filter | Modify registered order statuses |

### 7.6 Taxonomy/Post Type Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `woocommerce_taxonomy_objects_{taxonomy}` | Filter | Modify post types for taxonomy |
| `woocommerce_taxonomy_args_{taxonomy}` | Filter | Modify taxonomy registration args |
| `woocommerce_register_post_type_product` | Filter | Modify product post type args |
| `woocommerce_register_post_type_product_variation` | Filter | Modify variation post type args |
| `woocommerce_register_post_type_shop_order` | Filter | Modify order post type args |
| `woocommerce_register_post_type_shop_order_refund` | Filter | Modify refund post type args |
| `woocommerce_register_post_type_shop_coupon` | Filter | Modify coupon post type args |

### 7.7 Session & Environment Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `woocommerce_session_handler` | Filter | Override session handler class |
| `woocommerce_template_path` | Filter | Override template directory |
| `woocommerce_api_request_url` | Filter | Override API request URL |
| `plugin_locale` | Filter | Override plugin locale |

---

## 8. BATCH OPERATIONS

### 8.1 Pattern

All CRUD controllers support batch operations via `POST /wc/v3/{resource}/batch`:

```json
{
  "create": [ { ... }, { ... } ],
  "update": [ { "id": 123, ... }, { "id": 456, ... } ],
  "delete": [ 123, 456 ]
}
```

Response:
```json
{
  "create": [ { ... }, { "error": { ... } } ],
  "update": [ { ... } ],
  "delete": [ { "id": 123 } ]
}
```

Each operation is independent — partial failures are returned inline rather than failing the entire batch.

### 8.2 Implementation

Inherited from `WC_REST_CRUD_Controller::batch()` which:
1. Iterates `create`, `update`, `delete` arrays
2. Calls `create_item()`, `update_item()`, `delete_item()` for each
3. Catches `WP_Error` per-item and includes error in response
4. Returns combined response with all results

---

## 9. PAGINATION & RESPONSE PATTERNS

### 9.1 Pagination

Standard WordPress REST API pagination via headers:
- `X-WP-Total` — Total number of items
- `X-WP-TotalPages` — Total number of pages
- `Link` header with `rel="next"` and `rel="prev"` URLs

Default: 10 per page, max 100.

### 9.2 Error Handling

- Uses `WP_Error` for standard errors
- Uses `WC_REST_Exception` for domain-specific errors (extends `WP_Error`)
- Error format: `{ "code": "error_code", "message": "...", "data": { "status": 400 } }`
- Order creation failures: sets order to `checkout-draft` status, returns `new_draft_order_id`

### 9.3 Response Caching

Products controller uses `$this->with_cache()` wrapper for `get_suggested_products` endpoint with `endpoint_id` and `relevant_version_strings` for cache invalidation.

---

## 10. CUSTOM POST TYPES & TAXONOMIES

### 10.1 Post Types

| Post Type | Public | Capability Type | Description |
|-----------|--------|-----------------|-------------|
| `product` | Yes | `product` | Main product type |
| `product_variation` | No | `product` | Product variations |
| `shop_order` | No | `shop_order` | Orders (via `wc_register_order_type`) |
| `shop_order_refund` | No | `shop_order` | Refunds (via `wc_register_order_type`) |
| `shop_coupon` | No | `shop_coupon` | Coupons (if enabled) |

### 10.2 Taxonomies

| Taxonomy | Hierarchical | Post Types | Public |
|----------|-------------|------------|--------|
| `product_type` | No | product | No |
| `product_visibility` | No | product, product_variation | No |
| `product_cat` | Yes | product | Yes (REST enabled) |
| `product_tag` | No | product | Yes (REST enabled) |
| `product_shipping_class` | No | product, product_variation | No |
| `pos_product_visibility` | No | product, product_variation | No |
| `pa_{attribute_name}` | No | product | Varies |

### 10.3 Order Statuses (Post Statuses)

| Status | Label |
|--------|-------|
| `wc-pending` | Pending payment |
| `wc-processing` | Processing |
| `wc-on-hold` | On hold |
| `wc-completed` | Completed |
| `wc-cancelled` | Cancelled |
| `wc-refunded` | Refunded |
| `wc-failed` | Failed |

All registered via `register_post_status()` with `public => false`.

---

## 11. PLUGIN/EXTENSION REGISTRATION PATTERN

### 11.1 Extension Points

1. **DI Container** — `wc_get_container()` returns PSR-11 compatible container. Extensions register services via container.

2. **Controller Registration** — New REST controllers extend `RestApiControllerBase` and call `->register()` in `init_hooks()`.

3. **Feature Flags** — `FeaturesController` manages feature gates. Check via `FeaturesUtil::feature_is_enabled()`.

4. **Webhook Topics** — Extend via `woocommerce_webhook_topic_hooks` filter to add custom topics.

5. **Custom Action Webhooks** — Topic format `action.{hook_name}` allows webhooks on any WordPress action.

6. **REST Namespace Extension** — Filter `woocommerce_rest_api_get_rest_namespaces` to add custom API namespaces.

7. **Product Types** — Register via `WC_Product_Factory` and `product_type` taxonomy.

8. **Order Types** — Register via `wc_register_order_type()`.

9. **Data Stores** — Custom data stores implement `WC_Object_Data_Store_Interface`.

### 11.2 Dependency Injection Pattern

```php
// In WooCommerce::init_hooks()
$container = wc_get_container();

// Auto-registering classes (hooks on instantiation)
$container->get(SomeController::class);

// Explicit registration pattern
$container->get(SomeController::class)->register();

// REST API controllers inheriting from RestApiControllerBase
$container->get(SomeRestController::class)->register();
```

### 11.3 V4 API Architecture (Experimental)

V4 controllers use a different pattern:
- Namespace: `Automattic\WooCommerce\Internal\RestApi\Routes\V4\`
- Feature-gated behind `rest-api-v4`
- Controllers: Products, Orders, Customers, Refunds, OrderNotes, ShippingZones, Fulfillments, Settings (multiple sub-controllers)
- Also includes GraphQL API via `Automattic\WooCommerce\Api\Infrastructure\Main::register()`

---

## 12. RATE LIMITING & THROTTLING

**WooCommerce core does NOT implement rate limiting.** There is no built-in throttle mechanism for REST API requests. Rate limiting must be implemented at:
- Server level (nginx/Apache)
- WordPress plugin level (e.g., WP REST API rate limiting plugins)
- CDN/WAF level (Cloudflare, etc.)

The only throttling-adjacent feature is:
- OAuth nonce tracking: 15-minute window prevents exact replay attacks
- Webhook failure backoff: auto-disable after 5 consecutive failures

---

## 13. KEY DATABASE TABLES

| Table | Purpose |
|-------|---------|
| `{prefix}woocommerce_api_keys` | REST API key storage |
| `{prefix}wc_product_meta_lookup` | Denormalized product meta for fast queries (SKU, price, stock) |
| `{prefix}woocommerce_order_itemmeta` | Order item metadata |
| `{prefix}woocommerce_payment_tokenmeta` | Payment token metadata |
| `{prefix}wc_tax_rate_classes` | Tax rate classes |
| `{prefix}wc_reserved_stock` | Reserved stock tracking |
| `{prefix}wc_webhooks` | Webhook storage (via WC_Data_Store) |
| `{prefix}wc_order_stats` | Order statistics (via Analytics) |

---

## 14. SEARCH & QUERY OPTIMIZATION PATTERNS

### 14.1 Product Search

The products controller implements sophisticated search with precedence:
1. `search_fields` + `search` — Multi-field tokenized search (name, sku, global_unique_id, description, short_description)
2. `search_name_or_sku` — Tokenized search across name and SKU
3. `search_sku` — Partial SKU match via `wc_product_meta_lookup` table
4. `sku` — Exact SKU match (comma-separated for multiple)

Implementation uses `posts_join` and `posts_where` filters to join `wc_product_meta_lookup` table for SKU-based searches, with proper cleanup after query execution.

### 14.2 Cache Priming

- `_prime_post_caches()` for attachment IDs before image processing
- `ProductUtil::prime_image_caches()` for batch image cache priming across collections
- `WC_Product_Factory` for product type resolution caching

---

## 15. CONSTANTS

| Constant | Value | Purpose |
|----------|-------|---------|
| `WC_ABSPATH` | Plugin directory path | Base path |
| `WC_PLUGIN_BASENAME` | Plugin basename | Plugin identifier |
| `WC_VERSION` | `11.1.0-dev` | Current version |
| `WOOCOMMERCE_VERSION` | Same as WC_VERSION | Alias |
| `WC_ROUNDING_PRECISION` | 6 | Decimal precision |
| `WC_DISCOUNT_ROUNDING_MODE` | 2 | Discount rounding |
| `WC_TAX_ROUNDING_MODE` | 1 or 2 | Tax rounding |
| `WC_DELIMITER` | `\|` | Attribute delimiter |
| `WC_SESSION_CACHE_GROUP` | `wc_session_id` | Cache group |
| `WC_TEMPLATE_DEBUG_MODE` | false | Template debug |
| `WC_LOG_DIR` | Log directory | Log file location |
