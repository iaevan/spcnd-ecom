# WooCommerce Core Architecture Report
## Product Management & Core Data Models — Exhaustive Analysis

---

## 1. DIRECTORY STRUCTURE (`includes/`)

```
includes/
├── abstracts/          # Base abstract classes (WC_Data, WC_Product, WC_Order, etc.)
├── admin/              # Admin panel classes
├── blocks/             # Gutenberg block integrations
├── cli/                # WP-CLI commands
├── customizer/         # Theme customizer integration
├── data-stores/        # Database persistence layer (CPT-based storage)
├── emails/             # Email notification classes
├── export/             # CSV/data export
├── gateways/           # Payment gateway implementations
├── import/             # CSV/data import
├── integrations/       # Third-party integrations (MaxMind geolocation)
├── interfaces/         # PHP interfaces for data stores
├── legacy/             # Deprecated/legacy code wrappers
├── libraries/          # Vendored third-party libraries
├── log-handlers/       # Logging handlers
├── payment-tokens/     # Payment token classes
├── product-usage/      # Product usage tracking
├── queue/              # Background job queue
├── react-admin/        # React-based admin (WC Admin)
├── rest-api/           # REST API controllers
├── shipping/           # Shipping method classes
├── shortcodes/         # WordPress shortcode handlers
├── theme-support/      # Theme compatibility
├── tracks/             # Analytics/tracking
├── traits/             # PHP traits
├── walkers/            # Custom WP walkers
├── wccom-site/         # WooCommerce.com integration
└── widgets/            # WordPress widgets
```

### Key Standalone Classes:
- `class-wc-product.php` → Now lives in `abstracts/abstract-wc-product.php`
- `class-wc-cart.php` — Cart management
- `class-wc-checkout.php` — Checkout processing
- `class-wc-customer.php` — Customer data model
- `class-wc-order.php` — Order data model
- `class-wc-coupon.php` — Coupon data model
- `class-wc-data-store.php` — Data store factory
- `class-wc-product-factory.php` — Product type factory
- `class-wc-product-attribute.php` — Product attribute model
- `class-wc-product-download.php` — Downloadable file model
- `class-wc-product-simple.php` — Simple product type
- `class-wc-product-variable.php` — Variable product type
- `class-wc-product-variation.php` — Product variation type
- `class-wc-product-grouped.php` — Grouped product type
- `class-wc-product-external.php` — External/affiliate product type
- `class-wc-product-query.php` — Product query builder
- `class-wc-cart-totals.php` — Cart totals calculator
- `class-wc-cart-fees.php` — Cart fees API
- `class-wc-cart-session.php` — Cart session handling
- `class-wc-discounts.php` — Discount/coupon calculation
- `class-wc-countries.php` — Country/state data
- `class-wc-install.php` — Installation/DB migrations
- `class-wc-post-types.php` — CPT/taxonomy registration

---

## 2. ABSTRACT BASE CLASS: `WC_Data` (abstract-wc-data.php)

The foundation for ALL WooCommerce data models (products, orders, customers, coupons, etc.).

### Properties:
| Property | Type | Description |
|---|---|---|
| `$id` | int | Object primary key |
| `$data` | array | Core data (name-value pairs with defaults) |
| `$changes` | array | Dirty tracking — only changed props |
| `$object_read` | bool | Whether loaded from DB |
| `$object_type` | string | Type identifier (e.g., 'product', 'order') |
| `$extra_data` | array | Subclass-specific extra data |
| `$default_data` | array | Snapshot of initial data for reset |
| `$data_store` | object | Reference to persistence layer |
| `$cache_group` | string | Cache invalidation group |
| `$meta_data` | WC_Meta_Data[]\|null | Lazy-loaded metadata |
| `$clone_mode` | string | `CLONE_MODE_DUPLICATE` or `CLONE_MODE_CACHE` |
| `$legacy_datastore_props` | array | Props migrated from meta to columns |

### Clone Mode Constants:
- `CLONE_MODE_DUPLICATE` — Clears meta IDs (for duplication workflows)
- `CLONE_MODE_CACHE` — Preserves meta IDs (for caching workflows)

### Public Methods:

| Method | Return | Description |
|---|---|---|
| `__construct($read)` | void | Merges data + extra_data, sets default_data |
| `__sleep()` | array | Only stores `id` for serialization |
| `__wakeup()` | void | Re-constructs from ID |
| `__clone()` | void | Clones meta; clears meta IDs in duplicate mode |
| `__toString()` | string | JSON representation |
| `get_id()` | int | Returns object ID |
| `get_data()` | array | All data merged with id and meta_data |
| `get_data_keys()` | array | Expected data key names |
| `get_extra_data_keys()` | array | Extra data key names |
| `get_data_store()` | object | Returns data store reference |
| `get_meta_data()` | array | All non-null meta entries |
| `get_meta($key, $single, $context)` | mixed | Get meta by key; redirects to getter for internal keys |
| `meta_exists($key)` | bool | Check if meta key exists |
| `set_meta_data($data)` | void | Bulk set meta from array |
| `add_meta_data($key, $value, $unique)` | void | Add meta entry |
| `update_meta_data($key, $value, $meta_id)` | void | Update existing or add new meta |
| `delete_meta_data($key)` | void | Soft-delete meta (sets value to null) |
| `delete_meta_data_value($key, $value)` | void | Delete meta matching key AND value |
| `delete_meta_data_by_mid($mid)` | void | Delete meta by meta ID |
| `read_meta_data($force_read)` | void | Read from DB with caching |
| `init_meta_data($filtered_meta_data)` | void | Initialize meta from raw data |
| `save_meta_data()` | void | Persist meta changes (add/update/delete) |
| `get_meta_cache_key()` | string | Cache key for meta |
| `delete($force_delete)` | bool | Delete object via data store |
| `save()` | int | Create or update via data store |
| `set_id($id)` | void | Set object ID |
| `set_defaults()` | void | Reset to default values |
| `set_object_read($read)` | void | Mark as loaded |
| `get_object_read()` | bool | Check if loaded |
| `set_props($props, $context)` | bool\|WP_Error | Bulk set props via setters |
| `get_changes()` | array | Return dirty properties |
| `apply_changes()` | void | Merge changes into data, clear changes |
| `set_clone_mode($mode)` | void | Set clone behavior |
| `get_clone_mode()` | string | Get current clone mode |

### Protected Methods:
| Method | Description |
|---|---|
| `set_prop($prop, $value)` | Set with dirty tracking |
| `get_prop($prop, $context)` | Get with filter in 'view' context |
| `set_date_prop($prop, $value)` | Handle date types (timestamp, ISO 8601, WC_DateTime) |
| `get_hook_prefix()` | Returns `woocommerce_{object_type}_get_` |
| `is_internal_meta_key($key)` | Check if meta is managed internally |
| `filter_null_meta($meta)` | Filter deleted meta |
| `error($code, $message, $http_status, $data)` | Throw WC_Data_Exception |

### Hooks:
- **Filter**: `woocommerce_pre_delete_{$object_type}` — Short-circuit deletion
- **Action**: `woocommerce_before_{$object_type}_object_save` — Before save
- **Action**: `woocommerce_after_{$object_type}_object_save` — After save
- **Action**: `added_{$object_type}_meta` — After meta added
- **Action**: `updated_{$object_type}_meta` — After meta updated
- **Action**: `deleted_{$object_type}_meta` — After meta deleted
- **Filter**: `woocommerce_{$object_type}_get_{$prop}` — Filter any getter in 'view' context

### Edge Cases:
- `__sleep` only stores ID to avoid serializing entire data store
- `__wakeup` re-constructs; sets ID to 0 if object no longer exists
- Meta deletion is soft (sets value to null) and only persisted on `save_meta_data()`
- `set_date_prop` handles: WC_DateTime objects, numeric timestamps (UTC), ISO 8601 strings with timezone offsets, WordPress local time strings
- `set_prop` only tracks changes when `object_read` is true
- Internal meta keys redirect to getter/setter methods with a `wc_doing_it_wrong` notice

---

## 3. PRODUCT DATA MODEL: `WC_Product` (abstract-wc-product.php)

Extends `WC_Abstract_Legacy_Product` → `WC_Data`.

### Object Type: `product`
### Cache Group: `products`
### Post Type: `product`

### Core Data Properties (`$data` array):

| Property | Default | Type | Description |
|---|---|---|---|
| `name` | `''` | string | Product title |
| `slug` | `''` | string | URL slug |
| `date_created` | `null` | WC_DateTime | Creation timestamp |
| `date_modified` | `null` | WC_DateTime | Last modification |
| `status` | `false` | string/false | Post status (publish, draft, etc.) |
| `featured` | `false` | bool | Featured product flag |
| `catalog_visibility` | `visible` | string | Visibility: visible, catalog, search, hidden |
| `description` | `''` | string | Full description |
| `short_description` | `''` | string | Short description/excerpt |
| `sku` | `''` | string | Stock Keeping Unit |
| `global_unique_id` | `''` | string | GTIN/UPC/EAN/ISBN |
| `price` | `''` | string | Active price (computed) |
| `regular_price` | `''` | string | Regular price |
| `sale_price` | `''` | string | Sale price |
| `date_on_sale_from` | `null` | WC_DateTime | Sale start date |
| `date_on_sale_to` | `null` | WC_DateTime | Sale end date |
| `total_sales` | `'0'` | int | Total units sold |
| `tax_status` | `taxable` | string | taxable, shipping, none |
| `tax_class` | `''` | string | Tax class slug |
| `manage_stock` | `false` | bool | Stock management enabled |
| `stock_quantity` | `null` | float/null | Stock level |
| `stock_status` | `instock` | string | instock, outofstock, onbackorder |
| `backorders` | `'no'` | string | no, yes, notify |
| `low_stock_amount` | `''` | int/string | Low stock threshold |
| `sold_individually` | `false` | bool | Limit to 1 per cart |
| `weight` | `''` | string | Weight |
| `length` | `''` | string | Length dimension |
| `width` | `''` | string | Width dimension |
| `height` | `''` | string | Height dimension |
| `upsell_ids` | `[]` | array | Upsell product IDs |
| `cross_sell_ids` | `[]` | array | Cross-sell product IDs |
| `parent_id` | `0` | int | Parent product ID |
| `reviews_allowed` | `true` | bool | Reviews enabled |
| `purchase_note` | `''` | string | Post-purchase message |
| `attributes` | `[]` | array | WC_Product_Attribute[] |
| `default_attributes` | `[]` | array | Default variation selections |
| `menu_order` | `0` | int | Sort order |
| `post_password` | `''` | string | Password protection |
| `virtual` | `false` | bool | Virtual product (no shipping) |
| `downloadable` | `false` | bool | Downloadable product |
| `category_ids` | `[]` | array | Product category term IDs |
| `tag_ids` | `[]` | array | Product tag term IDs |
| `brand_ids` | `[]` | array | Product brand term IDs |
| `shipping_class_id` | `0` | int | Shipping class term ID |
| `downloads` | `[]` | array | WC_Product_Download[] |
| `image_id` | `''` | string | Featured image attachment ID |
| `gallery_image_ids` | `[]` | array | Gallery attachment IDs |
| `download_limit` | `-1` | int | Download limit (-1 = unlimited) |
| `download_expiry` | `-1` | int | Download expiry days (-1 = never) |
| `rating_counts` | `[]` | array | Rating distribution |
| `average_rating` | `0` | float | Average review rating |
| `review_count` | `0` | int | Total review count |
| `cogs_value` | `null` | float/null | Cost of goods sold value |

### Enums/Constants:

**ProductStatus** (`Automattic\WooCommerce\Enums\ProductStatus`):
- `PUBLISH` = `'publish'`
- `DRAFT` = `'draft'`
- `PENDING` = `'pending'`
- `PRIVATE` = `'private'`
- `TRASH` = `'trash'`

**ProductType** (`Automattic\WooCommerce\Enums\ProductType`):
- `SIMPLE` = `'simple'`
- `VARIABLE` = `'variable'`
- `GROUPED` = `'grouped'`
- `EXTERNAL` = `'external'`
- `VARIATION` = `'variation'`

**ProductStockStatus** (`Automattic\WooCommerce\Enums\ProductStockStatus`):
- `IN_STOCK` = `'instock'`
- `OUT_OF_STOCK` = `'outofstock'`
- `ON_BACKORDER` = `'onbackorder'`

**ProductTaxStatus** (`Automattic\WooCommerce\Enums\ProductTaxStatus`):
- `TAXABLE` = `'taxable'`
- `SHIPPING` = `'shipping'`
- `NONE` = `'none'`

**CatalogVisibility** (`Automattic\WooCommerce\Enums\CatalogVisibility`):
- `VISIBLE` = `'visible'` — In catalog and search
- `CATALOG` = `'catalog'` — In catalog only
- `SEARCH` = `'search'` — In search only
- `HIDDEN` = `'hidden'` — Not visible anywhere

**TaxDisplayMode** (`Automattic\WooCommerce\Enums\TaxDisplayMode`):
- `INCLUSIVE` — Prices include tax
- `EXCLUSIVE` — Prices exclude tax

### Public Getters (all accept `$context = 'view'`):
`get_name`, `get_slug`, `get_date_created`, `get_date_modified`, `get_status`, `get_featured`, `get_catalog_visibility`, `get_description`, `get_short_description`, `get_sku`, `get_global_unique_id`, `get_price`, `get_regular_price`, `get_sale_price`, `get_date_on_sale_from`, `get_date_on_sale_to`, `get_total_sales`, `get_tax_status`, `get_tax_class`, `get_manage_stock`, `get_stock_quantity`, `get_stock_status`, `get_backorders`, `get_low_stock_amount`, `get_sold_individually`, `get_weight`, `get_length`, `get_width`, `get_height`, `get_dimensions`, `get_upsell_ids`, `get_cross_sell_ids`, `get_parent_id`, `get_reviews_allowed`, `get_purchase_note`, `get_attributes`, `get_default_attributes`, `get_menu_order`, `get_post_password`, `get_category_ids`, `get_tag_ids`, `get_brand_ids`, `get_virtual`, `get_gallery_image_ids`, `get_shipping_class_id`, `get_downloads`, `get_download_expiry`, `get_downloadable`, `get_download_limit`, `get_image_id`, `get_rating_counts`, `get_average_rating`, `get_review_count`

### Public Setters:
`set_name`, `set_slug`, `set_date_created`, `set_date_modified`, `set_status`, `set_featured`, `set_catalog_visibility`, `set_description`, `set_short_description`, `set_sku`, `set_global_unique_id`, `set_price`, `set_regular_price`, `set_sale_price`, `set_date_on_sale_from`, `set_date_on_sale_to`, `set_total_sales`, `set_tax_status`, `set_tax_class`, `set_manage_stock`, `set_stock_quantity`, `set_stock_status`, `set_backorders`, `set_low_stock_amount`, `set_sold_individually`, `set_weight`, `set_length`, `set_width`, `set_height`, `set_upsell_ids`, `set_cross_sell_ids`, `set_parent_id`, `set_reviews_allowed`, `set_purchase_note`, `set_attributes`, `set_default_attributes`, `set_menu_order`, `set_post_password`, `set_category_ids`, `set_tag_ids`, `set_brand_ids`, `set_virtual`, `set_shipping_class_id`, `set_downloadable`, `set_downloads`, `set_gallery_image_ids`, `set_image_id`, `set_download_limit`, `set_download_expiry`, `set_rating_counts`, `set_average_rating`, `set_review_count`

### Validation Rules in Setters:

**`set_sku($sku)`**:
- Validates uniqueness via `wc_product_has_unique_sku()`
- Throws `product_invalid_sku` with suggested unique SKU in error data

**`set_global_unique_id($id)`**:
- Strips non-numeric chars except X/x and hyphens
- Validates X only valid as final ISBN-10 check digit
- Validates uniqueness via `wc_product_has_global_unique_id()`
- Throws `product_invalid_global_unique_id_format` or `product_invalid_global_unique_id`

**`set_catalog_visibility($visibility)`**:
- Must be one of: visible, catalog, search, hidden
- Throws `product_invalid_catalog_visibility`

**`set_tax_status($status)`**:
- Must be one of: taxable, shipping, none
- Empty defaults to taxable
- Throws `product_invalid_tax_status`

**`set_tax_class($class)`**:
- Sanitized via `sanitize_title`
- 'standard' maps to empty string
- Must be in `WC_Tax::get_tax_class_slugs()`

**`set_stock_status($status)`**:
- Must be in `wc_get_product_stock_status_options()`
- Defaults to `instock` if invalid

**`set_downloads($downloads_array)`**:
- Each download validated via `check_is_valid()`
- Invalid existing downloads are disabled
- New invalid downloads throw `product_invalid_download`

### Conditional Methods:

| Method | Return | Logic |
|---|---|---|
| `exists()` | bool | `status !== false` |
| `is_type($type)` | bool | Match against `get_type()` |
| `is_downloadable()` | bool | `downloadable === true` (filterable) |
| `is_virtual()` | bool | `virtual === true` (filterable) |
| `is_featured()` | bool | `featured === true` |
| `is_sold_individually()` | bool | `sold_individually === true` (filterable) |
| `is_viewable()` | bool | Published or user can edit; parent must also be viewable |
| `is_publicly_viewable()` | bool | Published and parent published |
| `is_visible()` | bool | Based on catalog_visibility, status, out-of-stock hiding (filterable) |
| `is_purchasable()` | bool | Exists + viewable + has price (filterable) |
| `is_on_sale($context)` | bool | Has sale_price < regular_price, within date range (filterable) |
| `is_in_stock()` | bool | `stock_status !== outofstock` (filterable) |
| `has_dimensions()` | bool | Has L/W/H and not virtual |
| `has_weight()` | bool | Has weight and not virtual |
| `needs_shipping()` | bool | Not virtual (filterable) |
| `is_taxable()` | bool | Tax status is taxable (filterable) |
| `is_shipping_taxable()` | bool | Tax status is taxable or shipping |
| `is_on_backorder()` | bool | Stock managed + status is onbackorder |
| `backorders_allowed()` | bool | Backorders is yes or notify |
| `backorders_require_notification()` | bool | Backorders is notify |
| `managing_stock()` | bool | manage_stock is true |
| `has_child()` | bool | Has parent_id > 0 |
| `has_attributes()` | bool | Has visible attributes |

### Price Methods:

| Method | Description |
|---|---|
| `get_price_html($price)` | Formatted HTML price with sale/regular display |
| `get_price_suffix($price, $qty)` | Tax suffix from `woocommerce_price_display_suffix` option |
| `get_price_including_tax($args)` | Price with tax added |
| `get_price_excluding_tax($args)` | Price without tax |
| `get_display_price($price, $qty)` | Based on `woocommerce_tax_display_shop` setting |
| `get_tax_rates($tax_class)` | Tax rates for this product's class |

### Stock Methods:

| Method | Description |
|---|---|
| `get_stock_managed_by_id()` | Returns own ID (overridden by variations) |
| `has_enough_stock($quantity)` | Check if requested qty available |
| `get_max_purchase_quantity()` | Max qty purchasable (considers stock, sold individually) |
| `get_min_purchase_quantity()` | Minimum qty (default 1) |
| `reduce_stock($amount)` | Reduce stock_quantity |
| `increase_stock($amount)` | Increase stock_quantity |

### Other Methods:

| Method | Description |
|---|---|
| `get_type()` | Returns product type string (overridden by subclasses) |
| `get_permalink()` | `get_permalink($this->get_id())` |
| `get_shipping_class()` | Shipping class slug |
| `get_shipping_class_slug()` | Shipping class term slug |
| `get_attribute($attribute)` | Single attribute value as string |
| `get_formatted_name()` | Admin-formatted name with SKU/ID |
| `supports($feature)` | Check feature support (filterable) |
| `get_add_to_cart_url()` | Abstract, overridden per type |
| `add_to_cart_text()` | Abstract, overridden per type |
| `add_to_cart_description()` | Aria description for add-to-cart button |
| `add_to_cart_success_message()` | Success message after adding to cart |
| `single_add_to_cart_text()` | Text for single product page button |
| `validate_props()` | Pre-save validation (stock status alignment) |
| `save()` | Override: calls validate_props, updates attributes lookup table |
| `delete($force_delete)` | Override: updates attributes lookup, defers parent sync |

### Hooks (Product-specific):

**Filters:**
- `woocommerce_is_downloadable`
- `woocommerce_is_virtual`
- `woocommerce_is_sold_individually`
- `woocommerce_product_is_visible`
- `woocommerce_is_purchasable`
- `woocommerce_product_is_on_sale`
- `woocommerce_product_is_in_stock`
- `woocommerce_product_needs_shipping`
- `woocommerce_product_is_taxable`
- `woocommerce_product_supports`
- `woocommerce_product_add_to_cart_url`
- `woocommerce_product_add_to_cart_text`
- `woocommerce_product_add_to_cart_description`
- `woocommerce_product_add_to_cart_success_message`
- `woocommerce_product_dimensions`
- `woocommerce_get_price_html`
- `woocommerce_get_price_suffix`
- `woocommerce_product_get_{prop}` (for every property)

**Actions:**
- `woocommerce_before_product_object_save`
- `woocommerce_after_product_object_save`
- `woocommerce_new_product`
- `woocommerce_update_product`
- `woocommerce_product_set_stock`
- `woocommerce_product_set_stock_status`
- `woocommerce_variation_set_stock`
- `woocommerce_variation_set_stock_status`
- `woocommerce_product_set_visibility`
- `woocommerce_product_type_changed`
- `woocommerce_product_object_updated_props`
- `woocommerce_product_before_set_stock`
- `woocommerce_variation_before_set_stock`
- `woocommerce_product_read`
- `woocommerce_process_product_file_download_paths`
- `woocommerce_product_attributes_updated`
- `woocommerce_variable_product_sync_data`

### `validate_props()` Logic:
1. If `manage_stock` is false: clear stock_quantity, backorders, low_stock_amount
2. If stock > notification threshold: status = `instock`
3. If backorders allowed: status = `onbackorder`
4. Otherwise: status = `outofstock`

### `save()` Logic:
1. Call `validate_props()`
2. Fire `woocommerce_before_product_object_save`
3. Call `before_data_store_save_or_update()`
4. If ID exists: `data_store->update()`, else: `data_store->create()`
5. Call `after_data_store_save_or_update()`
6. Update product attributes lookup table
7. Fire `woocommerce_after_product_object_save`

---

## 4. PRODUCT TYPE SUBCLASSES

### 4a. `WC_Product_Simple`
- **Type**: `simple`
- **Supports**: `ajax_add_to_cart`
- **add_to_cart_url**: Direct add-to-cart URL if purchasable and in stock, otherwise permalink
- **add_to_cart_text**: "Add to cart" or "Read more"

### 4b. `WC_Product_Variable`
- **Type**: `variable`
- **Extra Properties**: `$children`, `$visible_children`, `$variation_attributes` (all lazy-loaded)
- **Cannot be**: downloadable, virtual (always returns false)
- **Key Methods**:
  - `get_variation_prices($for_display)` — All variation prices (price, regular_price, sale_price)
  - `get_variation_regular_price($min_or_max)` — Min/max regular price
  - `get_variation_sale_price($min_or_max)` — Min/max sale price
  - `get_variation_price($min_or_max)` — Min/max active price
  - `get_children()` — All child variation IDs
  - `get_visible_children()` — Visible child IDs only
  - `get_variation_attributes()` — Attributes used for variations
  - `get_available_variations($return)` — Full variation data ('array') or objects ('objects')
  - `get_available_variation($variation)` — Single variation data array
  - `has_purchasable_variations()` — Check if any purchasable variation exists
  - `has_options()` — Always true
  - `child_is_in_stock()` — Any child in stock
  - `child_is_on_backorder()` — Any child on backorder
  - `child_has_weight()` / `child_has_dimensions()` — Cached via transients
- **is_on_sale**: Compares variation price arrays
- **get_price_html**: Shows price range or single price with sale
- **Static sync methods**: `sync($product)`, `sync_stock_status($product)`
- **validate_props**: Calls parent + `sync_stock_status`
- **after_save**: Syncs variation names and managed stock status

### 4c. `WC_Product_Variation`
- **Type**: `variation`
- **Post Type**: `product_variation`
- **Extends**: `WC_Product_Simple`
- **Extra Data**: `attribute_summary`, `cogs_value_is_additive`
- **Default tax_class**: `'parent'` (inherits from parent)
- **Parent Data Array**: title, sku, manage_stock, backorders, stock_quantity, weight, length, width, height, tax_class, shipping_class_id, image_id, purchase_note
- **Inheritance Pattern**: Many getters fall back to parent data in 'view' context:
  - `get_sku` → parent SKU
  - `get_weight` → parent weight
  - `get_length/width/height` → parent dimensions
  - `get_tax_class` → parent tax class (when set to 'parent')
  - `get_manage_stock` → returns `'parent'` when parent manages stock
  - `get_stock_quantity` → parent quantity when parent manages stock
  - `get_backorders` → parent backorders when parent manages stock
  - `get_image_id` → parent image
  - `get_purchase_note` → parent note
  - `get_shipping_class_id` → parent shipping class
  - `get_catalog_visibility` → always parent's visibility
- **`get_stock_managed_by_id()`**: Returns parent_id when manage_stock is 'parent'
- **`get_permalink()`**: Parent URL with variation attributes as query params
- **`set_attributes()`**: Strips `attribute_` prefix, stores as name-value pairs
- **`is_purchasable()`**: Must be visible AND parent purchasable
- **`variation_is_active()`**: Filterable, default true
- **`variation_is_visible()`**: Published AND has price
- **Valid tax classes**: Standard classes + `'parent'`

### 4d. `WC_Product_Grouped`
- **Type**: `grouped`
- **Extra Data**: `children` (array of product IDs)
- **is_purchasable**: Always false (wrapper only)
- **is_on_sale**: Checks if any purchasable non-child child is on sale
- **get_price_html**: Shows min-max range from visible children; handles "Free!" display
- **Key Methods**: `get_children()`, `get_visible_children()`, `get_min_price()`, `get_max_price()`
- **Static sync**: `sync($product)` — syncs price from children

### 4e. `WC_Product_External`
- **Type**: `external`
- **Extra Data**: `product_url`, `button_text`
- **is_purchasable**: Always false (links offsite)
- **Cannot**: manage stock, be out of stock, be backordered (all throw errors)
- **add_to_cart_url**: Returns `product_url`
- **add_to_cart_text**: Returns `button_text` or "Buy product"

---

## 5. DATA STORE LAYER: `WC_Product_Data_Store_CPT`

Custom Post Type (CPT) based storage. Implements `WC_Object_Data_Store_Interface` and `WC_Product_Data_Store_Interface`.

### Internal Meta Keys (stored as post meta but treated as props):
`_sku`, `_global_unique_id`, `_price`, `_regular_price`, `_sale_price`, `_sale_price_dates_from`, `_sale_price_dates_to`, `total_sales`, `_tax_status`, `_tax_class`, `_manage_stock`, `_stock`, `_stock_status`, `_backorders`, `_low_stock_amount`, `_sold_individually`, `_weight`, `_length`, `_width`, `_height`, `_upsell_ids`, `_crosssell_ids`, `_purchase_note`, `_default_attributes`, `_product_attributes`, `_virtual`, `_downloadable`, `_download_limit`, `_download_expiry`, `_featured`, `_downloadable_files`, `_wc_rating_count`, `_wc_average_rating`, `_wc_review_count`, `_variation_description`, `_thumbnail_id`, `_product_image_gallery`, `_product_version`, `_cogs_total_value`

### Must-Exist Meta Keys: `_tax_class`

### CRUD Operations:

**`create(&$product)`**:
1. Set date_created if not set
2. `wp_insert_post` with filtered data (`woocommerce_new_product_data`)
3. SKU concurrency lock via `wc_product_meta_lookup` table (3 retry attempts)
4. Update post meta, terms, visibility, attributes, version/type
5. Save meta data, apply changes
6. Fire `woocommerce_new_product`

**`read(&$product)`**:
1. Set defaults
2. Load post object, validate post_type is 'product'
3. Set props from post fields (title→name, content→description, etc.)
4. Read attributes, downloads, visibility, product data, extra data
5. Set object_read = true
6. Fire `woocommerce_product_read`

**`update(&$product)`**:
1. Save meta data
2. If post-level changes: `wp_update_post` (or `$wpdb->update` during `save_post` to prevent loops)
3. Otherwise: just update post_modified timestamps
4. Update meta, terms, visibility, attributes, version/type
5. Schedule download permissions adjustment
6. Apply changes, fire `woocommerce_update_product`

**`delete(&$product, $args)`**:
- Force delete: `wp_delete_post` + fire `woocommerce_delete_product`
- Soft delete: `wp_trash_post` + set status to trash + fire `woocommerce_trash_product`

### Key Data Store Methods:
- `read_product_data` — Maps post meta to product props
- `read_extra_data` — Loads type-specific extra data (product_url, button_text)
- `read_visibility` — Reads `product_visibility` taxonomy terms
- `read_attributes` — Reads `_product_attributes` meta, creates WC_Product_Attribute objects
- `read_downloads` — Reads `_downloadable_files` meta
- `update_post_meta` — Persists changed props to meta
- `update_terms` — Syncs category, tag, brand, shipping class terms
- `update_visibility` — Sets product_visibility terms (featured, outofstock, rated-N, exclude-*)
- `update_attributes` — Writes taxonomy terms and meta for attributes
- `handle_updated_props` — Price sync logic, stock status hooks, lookup table updates
- `clear_caches` — Invalidates transients, cache groups, product instance cache
- `find_matching_product_variation` — Finds variation matching attribute values
- `get_on_sale_products` — SQL query against lookup table
- `get_featured_product_ids` — Tax query for featured products
- `is_existing_sku` / `is_existing_global_unique_id` — Uniqueness checks
- `get_product_id_by_sku` / `get_product_id_by_global_unique_id` — ID lookups
- `get_starting_sales` / `get_ending_sales` — Scheduled sale transitions
- `read_price_data` — Variation price arrays (cached)
- `read_children` — Child variation IDs (all + visible)
- `read_variation_attributes` — Available attribute values
- `sync_price` / `sync_stock_status` — Parent sync from children
- `child_is_in_stock` / `child_has_weight` / `child_has_dimensions` — Child checks

### Visibility Logic:
Stored as `product_visibility` taxonomy terms:
- `featured` — Product is featured
- `outofstock` — Product is out of stock
- `rated-1` through `rated-5` — Average rating bucket
- `exclude-from-search` — Hidden from search
- `exclude-from-catalog` — Hidden from catalog

---

## 6. CART: `WC_Cart`

Extends `WC_Legacy_Cart`.

### Properties:
| Property | Type | Description |
|---|---|---|
| `$cart_context` | string | `'shortcode'` or `'store-api'` |
| `$cart_contents` | array | Cart items keyed by cart_id |
| `$removed_cart_contents` | array | Removed items for undo |
| `$applied_coupons` | array | Applied coupon codes |
| `$shipping_methods` | array | Chosen shipping methods |
| `$has_calculated_shipping` | bool | Whether shipping was calculated |
| `$default_totals` | array | Default total values |
| `$totals` | array | Calculated totals |
| `$session` | WC_Cart_Session | Session handler |
| `$fees_api` | WC_Cart_Fees | Fees API |

### Default Totals Structure:
```
subtotal, subtotal_tax, shipping_total, shipping_tax, shipping_taxes[],
discount_total, discount_tax, cart_contents_total, cart_contents_tax,
cart_contents_taxes[], fee_total, fee_tax, fee_taxes[], total, total_tax
```

### Cart Item Structure:
```php
array(
    'key'          => $cart_item_key,  // MD5 hash
    'product_id'   => $product_id,
    'variation_id' => $variation_id,
    'variation'    => $variation,       // Attribute key-value pairs
    'quantity'     => $quantity,
    'data'         => $product_data,    // WC_Product instance
    'data_hash'    => $data_hash,       // For detecting product changes
)
```

### Constructor Hooks:
- `woocommerce_add_to_cart` → `calculate_totals` (priority 20)
- `woocommerce_applied_coupon` → `calculate_totals` (priority 20)
- `woocommerce_removed_coupon` → `calculate_totals` (priority 20)
- `woocommerce_cart_item_removed` → `calculate_totals` (priority 20)
- `woocommerce_cart_item_restored` → `calculate_totals` (priority 20)
- `woocommerce_check_cart_items` → `check_cart_items` + `check_cart_coupons`
- `woocommerce_after_checkout_validation` → `check_customer_coupons`

### Key Public Methods:

**Getters (all filterable via `woocommerce_cart_{method}`):**
`get_cart_contents`, `get_removed_cart_contents`, `get_applied_coupons`, `get_coupon_discount_totals`, `get_coupon_discount_tax_totals`, `get_totals`, `get_subtotal`, `get_subtotal_tax`, `get_discount_total`, `get_discount_tax`, `get_shipping_total`, `get_shipping_tax`, `get_cart_contents_total`, `get_cart_contents_tax`, `get_total($context)`, `get_total_tax`, `get_fee_total`, `get_fee_tax`, `get_shipping_taxes`, `get_cart_contents_taxes`, `get_fee_taxes`, `display_prices_including_tax`

**Cart Operations:**
| Method | Description |
|---|---|
| `get_cart()` | Get cart contents (loads from session if needed) |
| `get_cart_item($key)` | Get specific cart item |
| `is_empty()` | Check if cart has no items |
| `empty_cart($clear_persistent)` | Clear everything, destroy persistent cart |
| `get_cart_contents_count()` | Total item quantities |
| `get_cart_contents_weight()` | Total weight |
| `get_cart_item_quantities()` | Merged quantities by stock_managed_by_id |
| `get_cross_sells()` | Cross-sell IDs excluding items already in cart |
| `get_tax_totals()` | Formatted tax totals by rate |
| `get_cart_hash()` | MD5 hash of cart contents for order matching |

**Validation Methods:**
| Method | Description |
|---|---|
| `check_cart_items()` | Validate all cart items (validity, sold individually, stock) |
| `check_cart_coupons()` | Validate applied coupons, remove invalid ones |
| `check_cart_item_validity()` | Check items not trashed/deleted |
| `check_cart_item_sold_individually()` | Ensure individually-sold items have qty 1 |
| `check_cart_item_stock()` | Verify stock levels for all items |

**`add_to_cart($product_id, $quantity, $variation_id, $variation, $cart_item_data)`**:
1. Handle `product_variation` post type → swap IDs
2. Filter quantity via `woocommerce_add_to_cart_quantity`
3. Reject if qty ≤ 0, no product, or trashed
4. Variable products require variation_id
5. Validate variation attributes (posted vs. valid values)
6. Handle 'any' variations (empty valid values)
7. Validate variation belongs to parent
8. Filter cart_item_data via `woocommerce_add_cart_item_data`
9. Generate cart_id (MD5 of product_id + variation_id + variation + cart_item_data)
10. Check if already in cart
11. Sold individually: force qty 1, reject if already in cart
12. Check purchasable, in stock, enough stock (including already-in-cart)
13. If existing: increment quantity; else: add new item
14. Filter via `woocommerce_add_cart_item` and `woocommerce_cart_contents_changed`
15. Fire `woocommerce_add_to_cart`

**`remove_cart_item($key)`**: Move to removed_cart_contents, fire hooks
**`restore_cart_item($key)`**: Restore from removed, re-fetch product
**`set_quantity($key, $qty, $refresh_totals)`**: Update qty or remove if 0

**`calculate_totals()`**: Reset totals, fire before/after hooks, create `WC_Cart_Totals`

**Shipping:**
- `needs_shipping()` — Any item needs shipping
- `show_shipping()` — Should shipping be shown
- `calculate_shipping()` — Calculate via WC_Shipping
- `get_shipping_packages()` — Build shipping packages
- `get_chosen_shipping_methods()` — Extract chosen methods

**Coupon Methods:**
- `apply_coupon($code)` — Apply coupon with validation
- `remove_coupon($code)` — Remove applied coupon
- `has_discount($code)` — Check if coupon is applied
- `get_coupons()` — Get WC_Coupon objects
- `get_coupon_discount_amount($code)` — Discount amount
- `get_coupon_discount_tax_amount($code)` — Discount tax

**Fee Methods:**
- `add_fee($args)` — Via fees_api
- `get_fees()` — Via fees_api

### Cart Hooks:
**Actions:**
- `woocommerce_before_cart_emptied`
- `woocommerce_cart_emptied`
- `woocommerce_remove_cart_item`
- `woocommerce_cart_item_removed`
- `woocommerce_restore_cart_item`
- `woocommerce_cart_item_restored`
- `woocommerce_after_cart_item_quantity_update`
- `woocommerce_cart_item_set_quantity`
- `woocommerce_add_to_cart`
- `woocommerce_before_calculate_totals`
- `woocommerce_after_calculate_totals`

**Filters:**
- `woocommerce_get_cart_contents`
- `woocommerce_cart_id` (cart item key generation)
- `woocommerce_add_to_cart_quantity`
- `woocommerce_add_cart_item_data`
- `woocommerce_add_cart_item`
- `woocommerce_cart_contents_changed`
- `woocommerce_add_to_cart_sold_individually_quantity`
- `woocommerce_add_to_cart_sold_individually_found_in_cart`
- `woocommerce_cart_product_cannot_add_another_message`
- `woocommerce_cart_product_cannot_be_purchased_message`
- `woocommerce_cart_product_out_of_stock_message`
- `woocommerce_cart_product_not_enough_stock_message`
- `woocommerce_cart_product_not_enough_stock_already_in_cart_message`
- `woocommerce_cart_item_required_stock_is_not_enough`
- `woocommerce_cart_crosssell_ids`
- `woocommerce_cart_needs_payment`
- `woocommerce_cart_needs_shipping`
- `woocommerce_cart_needs_shipping_address`
- `woocommerce_cart_show_shipping`
- `woocommerce_cart_get_taxes`
- `woocommerce_cart_contents_count`
- `woocommerce_cart_contents_weight`
- `woocommerce_cart_total`
- `woocommerce_cart_hide_zero_taxes`
- `woocommerce_cart_tax_totals`
- `woocommerce_cart_remove_taxes_zero_rate_id`

### Edge Cases:
- `get_cart()` warns if called before `wp_loaded`
- Cart ID generation uses MD5 of concatenated parts
- Persistent cart stored in user meta for logged-in users
- Stock checks consider held stock from pending orders
- Variable product add-to-cart validates each attribute against parent's attribute slugs
- Sold individually check re-fetches product to detect post-add changes

---

## 7. CHECKOUT: `WC_Checkout`

Singleton class. Uses `CogsAwareTrait`.

### Properties:
- `$instance` — Singleton instance
- `$fields` — Checkout field definitions (lazy-initialized)
- `$legacy_posted_data` — Backwards compat posted data
- `$logged_in_customer` — Cached customer object
- `SHIPPING_FIELDS_EXCLUDED_FROM_META` — `['shipping_method', 'shipping_total', 'shipping_tax']`

### Key Methods:

**`instance()`** — Singleton with init hooks for billing/shipping forms

**`is_registration_required()`** — Based on `woocommerce_enable_guest_checkout` option (filterable)
**`is_registration_enabled()`** — Based on `woocommerce_enable_signup_and_login_from_checkout` option (filterable)

**`get_checkout_fields($fieldset)`** — Returns billing, shipping, account, order fields
- Fields initialized based on billing/shipping country
- Account fields conditionally include username/password based on registration settings
- All fields filterable via `woocommerce_checkout_fields`
- Sorted by priority within each fieldset

**`get_posted_data()`** — Collects and sanitizes POST data:
- Special handling for: terms, createaccount, payment_method, shipping_method, ship_to_different_address
- Field types handled: checkbox, multiselect, textarea, password, default (wc_clean)
- If shipping skipped, copies billing to shipping fields
- Filterable via `woocommerce_checkout_posted_data`

**`validate_checkout(&$data, &$errors)`**:
1. `validate_posted_data` — Field-level validation
2. `check_cart_items` — Cart validation
3. Terms acceptance check
4. Shipping country validation (must be in allowed shipping countries)
5. Shipping method selection validation
6. Payment method validation (gateway must exist and validate_fields)
7. Fire `woocommerce_after_checkout_validation`

**`validate_posted_data(&$data, &$errors)`**:
- Country: Must be valid ISO code
- Postcode: `WC_Validation::is_postcode()` with country-specific formatting; IE gets Eircode link
- Phone: `WC_Validation::is_phone()` with country validation
- Email: `is_email()` validation
- State: Must match valid states for country (supports both codes and names)
- Required fields: Error if empty

**`process_checkout()`** — Main checkout flow:
1. Verify nonce (`woocommerce-process_checkout`)
2. Check cart not empty (session expiry detection)
3. Fire `woocommerce_before_checkout_process`
4. Fire `woocommerce_checkout_process`
5. Get posted data
6. Update session (customer address, shipping/payment methods)
7. Validate checkout
8. If no errors:
   - `process_customer` — Create account if needed
   - `create_order` — Build order from cart
   - Fire `woocommerce_checkout_order_processed`
   - If needs payment: `process_order_payment`
   - Else: `process_order_without_payment`
9. On exception: add error notice

**`create_order($data)`** — Order creation:
- Error codes: 520-529 for various item creation failures
- Resume existing pending/failed order if cart hash matches
- Set all order props from data
- Hold applied coupons
- Set: created_via, cart_hash, customer_id, currency, prices_include_tax, IP, user agent, customer note, payment method
- `set_data_from_cart` — Copy line items, fees, shipping, tax, coupons from cart
- Defense-in-depth: verify order has items after save
- On error: release coupons, fire `woocommerce_checkout_order_exception`

**`process_customer($data)`**:
- Create new customer if registration required or requested
- Handle `registration-error-email-exists` specially
- Set auth cookie, trigger reload_checkout
- On multisite: add user to current blog
- Update customer billing/shipping from posted data
- Fire `woocommerce_checkout_update_customer`

**`process_order_payment($order_id, $payment_method)`**:
- Store order_awaiting_payment in session
- Save session early (prevents duplicate orders on gateway hang)
- Call gateway's `process_payment()`
- On success: redirect or JSON response

**`process_order_without_payment($order_id)`**:
- `payment_complete()`, empty cart
- Redirect to order received page

### Checkout Hooks:
**Actions:**
- `woocommerce_checkout_init`
- `woocommerce_checkout_billing`
- `woocommerce_checkout_shipping`
- `woocommerce_before_checkout_process`
- `woocommerce_checkout_process`
- `woocommerce_check_cart_items`
- `woocommerce_after_checkout_validation`
- `woocommerce_checkout_create_order`
- `woocommerce_checkout_update_order_meta`
- `woocommerce_checkout_order_created`
- `woocommerce_checkout_order_processed`
- `woocommerce_checkout_create_order_line_item`
- `woocommerce_checkout_create_order_fee_item`
- `woocommerce_checkout_create_order_shipping_item`
- `woocommerce_checkout_create_order_tax_item`
- `woocommerce_checkout_create_order_coupon_item`
- `woocommerce_checkout_update_customer`
- `woocommerce_checkout_update_user_meta`
- `woocommerce_resume_order`
- `woocommerce_checkout_order_exception`

**Filters:**
- `woocommerce_checkout_registration_required`
- `woocommerce_checkout_registration_enabled`
- `woocommerce_checkout_fields`
- `woocommerce_checkout_customer_id`
- `woocommerce_checkout_posted_data`
- `woocommerce_process_checkout_{type}_field`
- `woocommerce_process_checkout_field_{key}`
- `woocommerce_checkout_postcode_validation_notice`
- `woocommerce_checkout_required_field_notice`
- `woocommerce_create_order`
- `woocommerce_payment_successful_result`
- `woocommerce_checkout_no_payment_needed_redirect`
- `woocommerce_cart_needs_payment`
- `woocommerce_checkout_update_customer_data`
- `woocommerce_registration_error_email_exists`

---

## 8. CUSTOMER: `WC_Customer`

Extends `WC_Legacy_Customer` → `WC_Data`.

### Object Type: `customer`

### Core Data Properties:
| Property | Default | Description |
|---|---|---|
| `date_created` | null | Account creation date |
| `date_modified` | null | Last modification |
| `email` | `''` | Email address |
| `first_name` | `''` | First name |
| `last_name` | `''` | Last name |
| `display_name` | `''` | Display name |
| `role` | `'customer'` | WordPress role |
| `username` | `''` | WordPress username |
| `billing` | (nested array) | Billing address fields |
| `shipping` | (nested array) | Shipping address fields |
| `is_paying_customer` | false | Has made a purchase |

### Billing Address Fields:
`first_name`, `last_name`, `company`, `address_1`, `address_2`, `city`, `postcode`, `country`, `state`, `email`, `phone`

### Shipping Address Fields:
`first_name`, `last_name`, `company`, `address_1`, `address_2`, `city`, `postcode`, `country`, `state`, `phone`

### Non-persisted Properties:
- `$password` — Write-only, for password changes
- `$is_vat_exempt` — Session-based VAT exemption
- `$calculated_shipping` — Session flag

### Constructor:
- Accepts: WC_Customer instance, numeric ID, or 0 for new
- Loads from DB if ID provided
- If `$is_session` is true: switches data store to `customer-session` (session-based, not persisted)

### Key Methods:

**Tax/Location:**
- `is_customer_outside_base()` — Compares taxable address to store base
- `get_taxable_address()` — Returns [country, state, postcode, city] based on `woocommerce_tax_based_on` setting
  - Special handling for local pickup: forces base tax
  - Filterable via `woocommerce_customer_taxable_address`
- `is_vat_exempt()` / `get_is_vat_exempt()`
- `has_shipping_address()` — Any shipping field non-empty
- `has_full_shipping_address()` — All required fields per locale (city, state, postcode, country)

**Data Access:**
- `get_last_order()` — Via data store
- `get_order_count()` — Via data store
- `get_total_spent()` — Via data store
- `get_downloadable_products()` — Available downloads
- `get_avatar_url()` — Gravatar URL from email
- `delete_and_reassign($reassign)` — Delete customer, reassign posts

**Getters (all accept `$context`):**
`get_username`, `get_email`, `get_first_name`, `get_last_name`, `get_display_name`, `get_role`, `get_date_created`, `get_date_modified`, `get_billing` (full array), `get_billing_first_name`, `get_billing_last_name`, `get_billing_company`, `get_billing_address` (alias for address_1), `get_billing_address_1`, `get_billing_address_2`, `get_billing_city`, `get_billing_state`, `get_billing_postcode`, `get_billing_country`, `get_billing_email`, `get_billing_phone`, `get_shipping` (full array), `get_shipping_first_name`, `get_shipping_last_name`, `get_shipping_company`, `get_shipping_address`, `get_shipping_address_1`, `get_shipping_address_2`, `get_shipping_city`, `get_shipping_state`, `get_shipping_postcode`, `get_shipping_country`, `get_shipping_phone`, `get_is_paying_customer`, `get_password`, `get_calculated_shipping`, `get_is_vat_exempt`

**Setters:**
All corresponding setters plus:
- `set_email` — Validates with `is_email()`, throws `customer_invalid_email`
- `set_billing_email` — Validates, throws `customer_invalid_billing_email`
- `set_role` — Validates against `$wp_roles`, throws `customer_invalid_role`
- `set_display_name` — If email, replaces with "first last"
- `set_billing_address_to_base` / `set_shipping_address_to_base` — Set to store base
- `set_billing_location` / `set_shipping_location` — Bulk set country/state/postcode/city

### Customer Hooks:
**Filters:**
- `woocommerce_customer_get_billing_{prop}` / `woocommerce_customer_get_shipping_{prop}` — Per address field
- `woocommerce_customer_get_{prop}` — For top-level props
- `woocommerce_customer_taxable_address`
- `woocommerce_customer_get_downloadable_products`
- `woocommerce_apply_base_tax_for_local_pickup`
- `woocommerce_local_pickup_methods`

### Edge Cases:
- Address props use nested array access (`$this->data['billing']['first_name']`)
- Changes tracked in nested `$this->changes['billing']` array
- Session data store doesn't persist to DB
- `has_full_shipping_address` respects country-specific locale settings for required/hidden fields
- `set_display_name` prevents email addresses from being used as display names

---

## 9. DATA STORE ARCHITECTURE

### Data Store Files:
```
data-stores/
├── abstract-wc-order-data-store-cpt.php     # Base order storage
├── abstract-wc-order-item-type-data-store.php # Base order item storage
├── class-wc-coupon-data-store-cpt.php       # Coupon storage
├── class-wc-customer-data-store.php         # Customer (WP_User) storage
├── class-wc-customer-data-store-session.php # Customer session storage
├── class-wc-customer-download-data-store.php # Download permissions
├── class-wc-customer-download-log-data-store.php # Download logs
├── class-wc-data-store-wp.php              # Base WP data store (meta, terms)
├── class-wc-order-data-store-cpt.php       # Order storage
├── class-wc-order-item-*-data-store.php    # Order item type stores
├── class-wc-order-refund-data-store-cpt.php # Refund storage
├── class-wc-payment-token-data-store.php   # Payment tokens
├── class-wc-product-data-store-cpt.php     # Product storage (CPT)
├── class-wc-product-grouped-data-store-cpt.php # Grouped product
├── class-wc-product-variable-data-store-cpt.php # Variable product
├── class-wc-product-variation-data-store-cpt.php # Variation storage
├── class-wc-shipping-zone-data-store.php   # Shipping zones
└── class-wc-webhook-data-store.php         # Webhooks
```

### Data Store Pattern:
1. `WC_Data_Store::load($type)` — Factory that resolves store class
2. Store implements `WC_Object_Data_Store_Interface` with: `create()`, `read()`, `update()`, `delete()`
3. `WC_Data_Store_WP` — Base class providing meta CRUD, term handling, lookup table updates
4. Products stored as `product` CPT with meta
5. Variations stored as `product_variation` CPT with parent_id
6. Orders stored as `shop_order` CPT
7. Customers stored as WordPress users with user meta
8. Product meta lookup table (`wc_product_meta_lookup`) for performant queries

---

## 10. SUMMARY OF ALL HOOKS

### Product Hooks (Actions):
- `woocommerce_before_product_object_save`
- `woocommerce_after_product_object_save`
- `woocommerce_new_product`
- `woocommerce_update_product`
- `woocommerce_delete_product` / `woocommerce_trash_product`
- `woocommerce_before_delete_product`
- `woocommerce_product_set_stock`
- `woocommerce_product_set_stock_status`
- `woocommerce_product_before_set_stock`
- `woocommerce_variation_set_stock`
- `woocommerce_variation_set_stock_status`
- `woocommerce_variation_before_set_stock`
- `woocommerce_product_set_visibility`
- `woocommerce_product_type_changed`
- `woocommerce_product_object_updated_props`
- `woocommerce_product_read`
- `woocommerce_process_product_file_download_paths`
- `woocommerce_product_attributes_updated`
- `woocommerce_variable_product_sync_data`

### Cart Hooks (Actions):
- `woocommerce_before_cart_emptied` / `woocommerce_cart_emptied`
- `woocommerce_add_to_cart`
- `woocommerce_remove_cart_item` / `woocommerce_cart_item_removed`
- `woocommerce_restore_cart_item` / `woocommerce_cart_item_restored`
- `woocommerce_after_cart_item_quantity_update`
- `woocommerce_cart_item_set_quantity`
- `woocommerce_before_calculate_totals` / `woocommerce_after_calculate_totals`
- `woocommerce_check_cart_items`

### Checkout Hooks (Actions):
- `woocommerce_checkout_init`
- `woocommerce_before_checkout_process` / `woocommerce_checkout_process`
- `woocommerce_after_checkout_validation`
- `woocommerce_checkout_create_order`
- `woocommerce_checkout_update_order_meta`
- `woocommerce_checkout_order_created`
- `woocommerce_checkout_order_processed`
- `woocommerce_checkout_order_exception`
- `woocommerce_checkout_create_order_line_item`
- `woocommerce_checkout_create_order_fee_item`
- `woocommerce_checkout_create_order_shipping_item`
- `woocommerce_checkout_create_order_tax_item`
- `woocommerce_checkout_create_order_coupon_item`
- `woocommerce_checkout_update_customer`
- `woocommerce_resume_order`

### Customer Hooks (Actions):
- `woocommerce_checkout_update_customer`
- `woocommerce_checkout_update_user_meta`

### Product Hooks (Filters):
- `woocommerce_is_downloadable`, `woocommerce_is_virtual`
- `woocommerce_is_sold_individually`, `woocommerce_product_is_visible`
- `woocommerce_is_purchasable`, `woocommerce_product_is_on_sale`
- `woocommerce_product_is_in_stock`, `woocommerce_product_needs_shipping`
- `woocommerce_product_is_taxable`, `woocommerce_product_supports`
- `woocommerce_product_add_to_cart_url/text/description/success_message`
- `woocommerce_product_dimensions`, `woocommerce_get_price_html`
- `woocommerce_get_price_suffix`, `woocommerce_product_get_{prop}`
- `woocommerce_new_product_data`
- `woocommerce_product_read_attribute`, `woocommerce_product_read_download`
- `woocommerce_file_download_path`
- `woocommerce_get_product_id_by_sku`
- `woocommerce_get_variation_{regular,sale,}_price`
- `woocommerce_variable_price_html`, `woocommerce_variable_empty_price_html`
- `woocommerce_available_variation`, `woocommerce_hide_invisible_variations`
- `woocommerce_variation_is_purchasable`, `woocommerce_variation_is_visible`, `woocommerce_variation_is_active`
- `woocommerce_show_variation_price`
- `woocommerce_grouped_price_html`, `woocommerce_grouped_free_price_html`, `woocommerce_grouped_empty_price_html`

### Cart Hooks (Filters):
- `woocommerce_get_cart_contents`, `woocommerce_cart_id`
- `woocommerce_add_to_cart_quantity`, `woocommerce_add_cart_item_data`
- `woocommerce_add_cart_item`, `woocommerce_cart_contents_changed`
- `woocommerce_cart_product_cannot_add_another_message`
- `woocommerce_cart_product_cannot_be_purchased_message`
- `woocommerce_cart_product_out_of_stock_message`
- `woocommerce_cart_product_not_enough_stock_message`
- `woocommerce_cart_product_not_enough_stock_already_in_cart_message`
- `woocommerce_cart_item_required_stock_is_not_enough`
- `woocommerce_cart_crosssell_ids`, `woocommerce_cart_needs_payment`
- `woocommerce_cart_needs_shipping`, `woocommerce_cart_needs_shipping_address`
- `woocommerce_cart_get_taxes`, `woocommerce_cart_tax_totals`
- `woocommerce_cart_contents_count/weight`
- `woocommerce_cart_total`, `woocommerce_cart_hide_zero_taxes`
- `woocommerce_cart_remove_taxes_zero_rate_id`
- `woocommerce_cart_{getter_name}` (for every totals getter)

### Checkout Hooks (Filters):
- `woocommerce_checkout_registration_required/enabled`
- `woocommerce_checkout_fields`, `woocommerce_checkout_customer_id`
- `woocommerce_checkout_posted_data`
- `woocommerce_process_checkout_{type}_field`, `woocommerce_process_checkout_field_{key}`
- `woocommerce_checkout_postcode_validation_notice`
- `woocommerce_checkout_required_field_notice`
- `woocommerce_create_order`
- `woocommerce_payment_successful_result`
- `woocommerce_checkout_no_payment_needed_redirect`
- `woocommerce_checkout_update_customer_data`
- `woocommerce_registration_error_email_exists`

### Customer Hooks (Filters):
- `woocommerce_customer_get_{billing,shipping}_{prop}`
- `woocommerce_customer_get_{prop}`
- `woocommerce_customer_taxable_address`
- `woocommerce_customer_get_downloadable_products`
- `woocommerce_apply_base_tax_for_local_pickup`
- `woocommerce_local_pickup_methods`

### Data Store Hooks:
- `woocommerce_pre_delete_{object_type}`
- `woocommerce_before_{object_type}_object_save`
- `woocommerce_after_{object_type}_object_save`
- `added_{object_type}_meta`, `updated_{object_type}_meta`, `deleted_{object_type}_meta`
- `wc_product_pre_lock_on_sku`
- `woocommerce_load_product_cogs_value`
- `woocommerce_save_product_cogs_value`
