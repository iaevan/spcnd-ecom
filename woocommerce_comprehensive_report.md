# WooCommerce Core Systems — Comprehensive Architecture Report

> Source: `woocommerce/woocommerce` trunk branch, fetched July 2026
> Files analyzed: 10 core classes covering Orders, Payments, Shipping, Tax, Coupons, and Discounts

---

## Table of Contents

1. [Order System Architecture](#1-order-system-architecture)
2. [Order Status State Machine](#2-order-status-state-machine)
3. [Order Item System](#3-order-item-system)
4. [Refund System](#4-refund-system)
5. [Payment Gateway System](#5-payment-gateway-system)
6. [Shipping System](#6-shipping-system)
7. [Tax Calculation System](#7-tax-calculation-system)
8. [Coupon System](#8-coupon-system)
9. [Discount Calculation System](#9-discount-calculation-system)
10. [Hooks Reference](#10-hooks-reference)
11. [Calculation Algorithms](#11-calculation-algorithms)

---

## 1. Order System Architecture

### 1.1 Class Hierarchy

```
WC_Data (base CRUD)
  └─ WC_Abstract_Legacy_Order
       └─ WC_Abstract_Order (abstract)
            ├─ WC_Order (regular orders)
            └─ WC_Order_Refund (negative orders / refunds)
```

### 1.2 WC_Abstract_Order — Core Data Schema

**Properties (`$data` array):**

| Property | Type | Default | Description |
|---|---|---|---|
| `parent_id` | int | 0 | Parent order ID |
| `status` | string | `''` | Order status (no `wc-` prefix stored) |
| `currency` | string | `''` | ISO currency code |
| `version` | string | `''` | WC version at creation |
| `prices_include_tax` | bool | false | Whether stored prices include tax |
| `date_created` | WC_DateTime\|null | null | Creation timestamp |
| `date_modified` | WC_DateTime\|null | null | Last modification |
| `discount_total` | float | 0 | Total discount (ex tax) |
| `discount_tax` | float | 0 | Tax on discounts |
| `shipping_total` | float | 0 | Total shipping cost |
| `shipping_tax` | float | 0 | Tax on shipping |
| `cart_tax` | float | 0 | Tax on line items (not shipping) |
| `total` | float | 0 | Grand total |
| `total_tax` | float | 0 | Total tax (cart_tax + shipping_tax) |

**Internal Properties:**

| Property | Type | Description |
|---|---|---|
| `$items` | `array<string, array<WC_Order_Item>>` | In-memory item cache by group |
| `$items_to_delete` | `array<WC_Order_Item>` | Items queued for deletion on save |
| `$item_types_to_bulk_delete` | `array<string>` | Item types for bulk deletion |
| `$bulk_delete_all_items_pending` | bool | Flag to delete all items on save |
| `$cache_group` | string | `'orders'` |
| `$data_store_name` | string | `'order'` |
| `$object_type` | string | `'order'` |

**Item Type → Group Mapping:**

```php
'line_item' => 'line_items'
'tax'       => 'tax_lines'
'shipping'  => 'shipping_lines'
'fee'       => 'fee_lines'
'coupon'    => 'coupon_lines'
```

### 1.3 WC_Order — Extended Data Schema

Additional properties beyond abstract order:

| Property | Type | Default | Description |
|---|---|---|---|
| `customer_id` | int | 0 | WP user ID (0 = guest) |
| `order_key` | string | `''` | Unique key (max 22 chars) |
| `billing` | array | see below | Billing address |
| `shipping` | array | see below | Shipping address |
| `payment_method` | string | `''` | Gateway ID |
| `payment_method_title` | string | `''` | Gateway display name |
| `transaction_id` | string | `''` | Payment transaction ID |
| `customer_ip_address` | string | `''` | Customer IP |
| `customer_user_agent` | string | `''` | Browser UA string |
| `created_via` | string | `''` | Origin: `'checkout'`, `'admin'`, `'store-api'`, etc. |
| `customer_note` | string | `''` | Customer-provided note |
| `date_completed` | WC_DateTime\|null | null | When order was completed |
| `date_paid` | WC_DateTime\|null | null | When payment was received |
| `cart_hash` | string | `''` | Hash of cart contents at checkout |

**Operational flags (boolean):**

| Flag | Description |
|---|---|
| `order_stock_reduced` | Whether stock was reduced on payment |
| `download_permissions_granted` | Whether download permissions were generated |
| `new_order_email_sent` | Whether new order email was sent |
| `recorded_sales` | Whether sales were recorded |
| `recorded_coupon_usage_counts` | Whether coupon usage was counted |

**Billing/Shipping Address Schema:**

```php
'billing' => [
    'first_name' => '', 'last_name' => '', 'company' => '',
    'address_1' => '', 'address_2' => '', 'city' => '',
    'state' => '', 'postcode' => '', 'country' => '',
    'email' => '', 'phone' => '',
]
'shipping' => [
    'first_name' => '', 'last_name' => '', 'company' => '',
    'address_1' => '', 'address_2' => '', 'city' => '',
    'state' => '', 'postcode' => '', 'country' => '',
    'phone' => '',  // No email in shipping
]
```

### 1.4 CRUD Lifecycle

**`save()` flow:**
1. Call `maybe_set_user_billing_email()` — auto-fills billing email from WP user
2. Call `parent::save()` which:
   - Fires `woocommerce_before_order_object_save`
   - Calls `data_store->create()` or `data_store->update()`
   - Calls `save_items()` — persists all items, processes deletions
   - Fires `woocommerce_after_order_object_save`
3. Call `status_transition()` — fires all status change hooks

**`save_items()` flow:**
1. If `bulk_delete_all_items_pending` → `data_store->delete_items($this)` + fire `woocommerce_removed_order_items`
2. Else process `item_types_to_bulk_delete` one type at a time
3. Delete individual items in `$items_to_delete`
4. Save each item, re-keying if ID changed (new items get real DB IDs)
5. If items changed → invalidate order cache

### 1.5 Key Public Methods — WC_Order

#### Payment

| Method | Params | Return | Description |
|---|---|---|---|
| `payment_complete($transaction_id='')` | string | bool | Marks order paid. Sets status to processing/completed, records date_paid, reduces stock, fires hooks |
| `needs_payment()` | — | bool | True if status is pending/failed AND total > 0 |
| `is_paid()` | — | bool | True if status is in paid statuses list |
| `needs_processing()` | — | bool | True if any line item is NOT virtual+downloadable |

#### Status

| Method | Params | Return | Description |
|---|---|---|---|
| `set_status($new_status, $note='', $manual_update=false)` | string, string\|false, bool | array `{from, to}` | Sets status, tracks transition, auto-sets date_paid/date_completed |
| `update_status($new_status, $note='', $manual=false)` | string, string, bool | bool | Sets status + saves immediately |
| `is_editable()` | — | bool | True if pending, on-hold, or auto-draft |

#### Getters (all accept `$context = 'view'`)

| Method | Return | Notes |
|---|---|---|
| `get_order_number()` | string | Filtered via `woocommerce_order_number` |
| `get_order_key()` | string | Max 22 chars |
| `get_customer_id()` / `get_user_id()` | int | |
| `get_user()` | WP_User\|false | |
| `get_billing_*()` | string | first_name, last_name, company, address_1/2, city, state, postcode, country, email, phone |
| `get_shipping_*()` | string | Same fields minus email, plus phone |
| `get_payment_method()` | string | Gateway ID |
| `get_payment_method_title()` | string | |
| `get_transaction_id()` | string | |
| `get_customer_ip_address()` | string | |
| `get_customer_user_agent()` | string | |
| `get_created_via()` | string | |
| `get_customer_note()` | string | |
| `get_date_completed()` | WC_DateTime\|null | |
| `get_date_paid()` | WC_DateTime\|null | Falls back to date_created for pre-3.0 orders |
| `get_cart_hash()` | string | |
| `get_formatted_order_total($tax_display, $display_refunded)` | string | HTML with refunded strikethrough |
| `get_address($type)` | array | Raw billing or shipping address |
| `get_formatted_billing_address($empty_content)` | string | |
| `get_formatted_shipping_address($empty_content)` | string | |
| `get_shipping_address_map_url()` | string | Google Maps URL |
| `get_formatted_billing_full_name()` | string | |
| `get_formatted_shipping_full_name()` | string | |
| `has_billing_address()` | bool | |
| `has_shipping_address()` | bool | |

#### Operational Flags

| Method | Return |
|---|---|
| `get_order_stock_reduced()` | bool |
| `get_download_permissions_granted()` | bool |
| `get_new_order_email_sent()` | bool |
| `get_recorded_sales()` | bool |
| `get_recorded_coupon_usage_counts()` | bool |

#### URLs

| Method | Return | Description |
|---|---|---|
| `get_checkout_payment_url($on_checkout)` | string | Pay-for-order URL |
| `get_checkout_order_received_url()` | string | Thank-you page URL |
| `get_cancel_order_url($redirect)` | string | Nonced cancel URL |
| `get_cancel_order_url_raw($redirect)` | string | Raw unescaped cancel URL |
| `get_view_order_url()` | string | My Account view-order URL |
| `get_edit_order_url()` | string | Admin edit URL |

#### Conditionals

| Method | Return | Description |
|---|---|---|
| `key_is_valid($key)` | bool | Timing-safe comparison |
| `has_cart_hash($hash)` | bool | Timing-safe comparison |
| `is_download_permitted()` | bool | Completed OR (processing + grant-after-payment setting) |
| `needs_shipping_address()` | bool | False for local pickup methods |
| `has_downloadable_item()` | bool | Any line item with downloadable product |
| `is_created_via($modus)` | bool | Check creation origin |

#### Order Notes

| Method | Params | Return |
|---|---|---|
| `add_order_note($note, $is_customer_note, $added_by_user, $meta_data)` | string, int, bool, array | int (comment ID) |
| `get_customer_order_notes()` | — | array |

---

## 2. Order Status State Machine

### 2.1 Core Statuses (OrderStatus enum)

| Status | Internal Key | Description |
|---|---|---|
| Pending | `pending` | Awaiting payment |
| Failed | `failed` | Payment failed |
| On Hold | `on-hold` | Awaiting verification/stock |
| Processing | `processing` | Payment received, preparing |
| Completed | `completed` | Fulfilled/delivered |
| Cancelled | `cancelled` | Cancelled by user/admin |
| Refunded | `refunded` | Fully refunded |
| Draft | `draft` | Draft status |
| Auto Draft | `auto-draft` | WordPress auto-draft |
| New | `new` | New (alias) |
| Trash | `trash` | Trashed |
| Checkout Draft | `checkout-draft` | Draft during checkout |

### 2.2 Status Transition Flow

```
                    ┌──────────────┐
                    │  auto-draft  │
                    └──────┬───────┘
                           │ checkout
                    ┌──────▼───────┐
          ┌────────►│   pending    │◄──────────────┐
          │         └──────┬───────┘               │
          │                │ payment               │ retry
          │         ┌──────▼───────┐               │
          │         │  processing  │───────────────┤
          │         └──────┬───────┘               │
          │                │ fulfill               │
          │         ┌──────▼───────┐               │
          │         │  completed   │               │
          │         └──────────────┘               │
          │                                        │
          │  ┌──────────┐  ┌───────────┐  ┌───────▼──┐
          └──│ cancelled│  │  on-hold  │  │  failed  │
             └──────────┘  └───────────┘  └──────────┘
                                            │ refund
                                     ┌──────▼───────┐
                                     │   refunded   │
                                     └──────────────┘
```

### 2.3 Transition Hooks (fired in `status_transition()`)

Fired in this exact order:

1. `woocommerce_order_status_{to}` — `($order_id, $order, $status_transition)`
2. Status transition note added (unless `note` was `false`)
3. `woocommerce_order_status_{from}_to_{to}` — `($order_id, $order)`
4. `woocommerce_order_status_changed` — `($order_id, $from, $to, $order)`
5. If from pending/failed → paid status: `woocommerce_order_payment_status_changed` — `($order_id, $order)`

**Special transition behaviors:**

- `set_status()` auto-calls `maybe_set_date_paid()` — sets date_paid when reaching payment-complete status (processing or completed)
- `set_status()` auto-calls `maybe_set_date_completed()` — sets date_completed when reaching completed
- Notes are skipped when transitioning from `draft`, `auto-draft`, `new`, or `checkout-draft`
- `woocommerce_order_edit_status` fires on manual status changes

### 2.4 Payment Complete Flow (`payment_complete()`)

1. Fire `woocommerce_pre_payment_complete` — `($order_id, $transaction_id)`
2. Clear `order_awaiting_payment` session
3. Check order is in valid status for payment complete (filterable: `woocommerce_valid_order_statuses_for_payment_complete`)
4. Set transaction_id if provided
5. Set date_paid if not already set
6. Determine next status (filterable: `woocommerce_payment_complete_order_status`)
   - Default: `processing` if `needs_processing()`, else `completed`
7. Add payment note
8. Save order
9. Fire `woocommerce_payment_complete` — `($order_id, $transaction_id)`

---

## 3. Order Item System

### 3.1 WC_Order_Item Base Class

**Data:**
```php
$data = [
    'order_id' => 0,
    'name'     => '',
    // 'cogs_value' => null  (added if COGS enabled)
]
```

**Properties:**
- `$cache_group` = `'order-items'`
- `$meta_type` = `'order_item'`
- `$object_type` = `'order_item'`
- `$order` — WeakReference to parent WC_Order (avoids circular references)
- `$legacy_values`, `$legacy_cart_item_key`, `$legacy_package_key` — deprecated

**Key Methods:**

| Method | Return | Description |
|---|---|---|
| `get_order_id()` | int | |
| `get_name()` | string | Item name |
| `get_type()` | string | Overridden by subclasses |
| `get_quantity()` | int | Always 1 in base class |
| `get_tax_status()` | string | Default `'taxable'` |
| `get_tax_class()` | string | Default `''` (standard) |
| `get_order()` | WC_Order | Via WeakReference or fresh load |
| `set_order($order)` | void | Sets order_id + WeakReference |
| `is_type($type)` | bool | |
| `calculate_taxes($calculate_tax_for)` | bool | Calculates item taxes using WC_Tax |
| `get_all_formatted_meta_data($hideprefix, $include_all)` | array | |
| `get_formatted_meta_data($hideprefix, $include_all)` | array | Expands term slugs, attribute labels |

**Tax Calculation for Items (`calculate_taxes()`):**
1. Requires: country, state, postcode, city in `$calculate_tax_for`
2. If tax class is not `'0'` AND tax status is `'taxable'` AND tax is enabled:
   - Find rates via `WC_Tax::find_rates()`
   - Calculate taxes on `get_total()` and `get_subtotal()` via `WC_Tax::calc_tax()`
   - Set taxes with both `total` and `subtotal` arrays
3. Else: set taxes to false
4. Fire `woocommerce_order_item_after_calculate_taxes`

**ArrayAccess Implementation** — backward compatibility with legacy array-style access:
- `offsetSet` — routes to setters or meta
- `offsetGet` — routes to getters, meta, or type
- `offsetExists` — checks data keys and meta
- `offsetUnset` — removes from data/changes/meta

**COGS (Cost of Goods Sold):**
- `has_cogs()` → false (base), overridden in subclasses
- `calculate_cogs_value()` → calls `calculate_cogs_value_core()`, filterable
- `get_cogs_value()` → float (0 if COGS disabled)
- `set_cogs_value(float)` → void

### 3.2 Item Types (subclass hierarchy)

```
WC_Order_Item
  ├─ WC_Order_Item_Product (line_item) — product_id, variation_id, quantity, subtotal, total, taxes
  ├─ WC_Order_Item_Coupon (coupon) — code, discount, discount_tax
  ├─ WC_Order_Item_Fee (fee) — amount, total, total_tax, tax_class, tax_status
  ├─ WC_Order_Item_Shipping (shipping) — method_id, total, total_tax, taxes
  └─ WC_Order_Item_Tax (tax) — rate_id, rate_code, label, compound, tax_total, shipping_tax_total, rate_percent
```

### 3.3 Item Management on Abstract Order

| Method | Description |
|---|---|
| `get_items($types='line_item')` | Lazy-loads from data store, primes product cache for line_items, sets back-references |
| `get_coupons()` | Alias for `get_items('coupon')` |
| `get_fees()` | Alias for `get_items('fee')` |
| `get_taxes()` | Alias for `get_items('tax')` |
| `get_shipping_methods()` | Alias for `get_items('shipping')` |
| `get_item($item_id, $load_from_db)` | Get single item by ID |
| `add_item($item)` | Append item (persists on save) |
| `remove_item($item_id)` | Queue item for deletion |
| `remove_order_items($type=null)` | Clear items from memory, defer DB deletion to save() |
| `get_item_count($item_type)` | Sum of quantities |
| `get_shipping_method()` | Comma-joined shipping method names |
| `get_coupon_codes()` | Array of coupon code strings |

### 3.4 Product Line Items (`add_product()`)

```php
add_product(WC_Product $product, int $qty = 1, array $args = [])
```

Default args populated from product:
- `name`, `tax_class`, `product_id`, `variation_id`, `variation`
- `subtotal` and `total` — uses `wc_get_price_excluding_tax()` (or fixed-end-price mode)
- `quantity`

Backward-compatible `totals` array mapping:
- `tax` → `total_tax`
- `tax_data` → `taxes`

---

## 4. Refund System

### 4.1 WC_Order_Refund

Extends `WC_Abstract_Order` — refunds are essentially negative orders.

**Data Store:** `'order-refund'`
**Object Type:** `'order_refund'`
**Internal Type:** `'shop_order_refund'`

**Extra Properties:**

| Property | Type | Default | Description |
|---|---|---|---|
| `amount` | string | `''` | Refund amount (decimal) |
| `reason` | string | `''` | Refund reason |
| `refunded_by` | int | 0 | User ID who created refund |
| `refunded_payment` | bool | false | Whether refunded via gateway API |

**Key Behaviors:**
- `get_status()` always returns `'completed'`
- `get_type()` returns `'shop_order_refund'`
- `has_cogs()` returns `true`

### 4.2 Refund Query Methods on WC_Order

| Method | Return | Description |
|---|---|---|
| `get_refunds()` | `WC_Order_Refund[]` | Cached array of refund objects |
| `get_total_refunded()` | float | Sum of all refund amounts |
| `get_total_tax_refunded()` | float | Sum of all refunded tax |
| `get_total_shipping_tax_refunded()` | float | Sum of refunded shipping tax |
| `get_total_shipping_refunded()` | float | Sum of refunded shipping costs |
| `get_item_count_refunded($item_type)` | int | Total refunded item count |
| `get_total_qty_refunded($item_type)` | int | Total refunded quantity |
| `get_qty_refunded_for_item($item_id, $item_type)` | int | Qty refunded for specific item (by `_refunded_item_id` meta) |
| `get_total_refunded_for_item($item_id, $item_type)` | float | Amount refunded for specific item (negated) |
| `get_tax_refunded_for_item($item_id, $tax_id, $item_type)` | float | Tax refunded for specific item+rate (negated) |
| `get_total_tax_refunded_by_rate_id($rate_id)` | float | Tax refunded by tax rate ID |
| `get_remaining_refund_amount()` | float | `total - total_refunded` |
| `get_remaining_refund_items()` | int | `item_count - item_count_refunded` |
| `get_cogs_refunded_for_item($item_id, $item_type)` | float | COGS value of refunded items |

### 4.3 Refund Item Linkage

Refund items link back to original order items via meta key `_refunded_item_id`. This is the critical join for per-item refund tracking.

---

## 5. Payment Gateway System

### 5.1 WC_Payment_Gateway (Abstract)

Extends `WC_Settings_API`.

**Properties:**

| Property | Type | Default | Description |
|---|---|---|---|
| `$order_button_text` | string | — | Custom place order button text |
| `$has_custom_place_order_button` | bool | false | Hides default button if true |
| `$enabled` | string | `'yes'` | `'yes'` or `'no'` |
| `$title` | string | — | Frontend title |
| `$description` | string | — | Frontend description |
| `$chosen` | bool | — | Whether currently selected |
| `$method_title` | string | `''` | Admin title |
| `$method_description` | string | `''` | Admin description |
| `$has_fields` | bool | — | Shows fields on checkout |
| `$countries` | array | — | Allowed countries |
| `$availability` | string | — | `'all'`, `'specific'`, etc. |
| `$icon` | string | — | Icon URL |
| `$supports` | array | `['products']` | Feature support list |
| `$max_amount` | int | 0 | Max transaction amount (0=unlimited) |
| `$view_transaction_url` | string | `''` | URL template for transaction view |
| `$new_method_label` | string | `''` | Label for new payment method |
| `$pay_button_id` | string | `''` | Pay button ID |
| `$tokens` | array | `[]` | Cached payment tokens |

**Supported Features (PaymentGatewayFeature enum values):**
- `'products'` — default
- `'refunds'` — can process refunds
- `'tokenization'` — saved payment methods
- `'default_credit_card_form'` — shows CC form (deprecated)
- `'subscriptions'` — recurring payments
- `'subscription_cancellation'`
- `'subscription_suspension'`
- `'subscription_reactivation'`
- `'subscription_amount_changes'`
- `'subscription_date_changes'`
- `'subscription_payment_method_change'`
- `'subscription_payment_method_change_customer'`
- `'subscription_payment_method_change_admin'`
- `'multiple_subscriptions'`

### 5.2 Key Methods

| Method | Return | Description |
|---|---|---|
| `process_payment($order_id)` | array | **Override in subclass.** Return `['result'=>'success', 'redirect'=>url]` |
| `process_refund($order_id, $amount, $reason)` | bool\|WP_Error | **Override.** Return true/false/WP_Error |
| `validate_fields()` | bool | Validate frontend fields |
| `payment_fields()` | void | Render payment form HTML |
| `is_available()` | bool | Check enabled + max_amount |
| `supports($feature)` | bool | Check feature support (filterable) |
| `can_refund_order($order)` | bool | Check if gateway supports refunds for order |
| `get_return_url($order)` | string | Thank-you page URL |
| `get_transaction_url($order)` | string | 3rd-party transaction URL |
| `get_order_total()` | float | From pay-for-order page or cart |
| `get_title()` | string | Sanitized title (filterable) |
| `get_description()` | string | Sanitized description (filterable) |
| `get_icon()` | string | Icon HTML (filterable) |
| `add_payment_method()` | array | For account page. Return `['result'=>'failure', 'redirect'=>url]` |
| `needs_setup()` | bool | Whether gateway needs configuration |
| `get_tokens()` | array | Saved payment tokens for current user |

### 5.3 Tokenization

| Method | Description |
|---|---|
| `tokenization_script()` | Enqueues tokenization JS |
| `saved_payment_methods()` | Renders saved token list |
| `get_saved_payment_method_option_html($token)` | HTML for single token radio |
| `get_new_payment_method_option_html()` | HTML for "use new" radio |
| `save_payment_method_checkbox()` | HTML for "save to account" checkbox |

### 5.4 Payment Processing Flow

```
1. Customer selects gateway on checkout
2. Gateway's payment_fields() renders form
3. validate_fields() checks input
4. process_payment($order_id) called:
   a. Gateway processes with external provider
   b. Returns ['result'=>'success', 'redirect'=>url]
   c. On success: order->payment_complete($transaction_id)
      - Sets status to processing/completed
      - Sets date_paid
      - Reduces stock
      - Records sales
      - Grants download permissions
      - Fires woocommerce_payment_complete
   d. Customer redirected to thank-you page
```

---

## 6. Shipping System

### 6.1 WC_Shipping_Method (Abstract)

Extends `WC_Settings_API`.

**Properties:**

| Property | Type | Default | Description |
|---|---|---|---|
| `$supports` | array | `['settings']` | Features: `'shipping-zones'`, `'instance-settings'`, `'settings'`, `'instance-settings-modal'` |
| `$id` | string | `''` | Unique method ID |
| `$method_title` | string | `''` | Admin title |
| `$method_description` | string | `''` | Admin description |
| `$enabled` | string | `'yes'` | |
| `$title` | string | — | Frontend title |
| `$rates` | array | `[]` | Calculated rates |
| `$tax_status` | string | `'taxable'` | `'taxable'` or `'none'` |
| `$fee` | string\|null | null | Additional fee |
| `$minimum_fee` | string\|null | null | Minimum fee floor |
| `$instance_id` | int | 0 | Zone instance ID |
| `$instance_form_fields` | array | `[]` | Instance-specific settings |
| `$instance_settings` | array | `[]` | Saved instance values |
| `$method_order` | int | — | Sort order |

### 6.2 Key Methods

| Method | Return | Description |
|---|---|---|
| `calculate_shipping($package)` | void | **Override.** Call `add_rate()` to register rates |
| `is_taxable()` | bool | Tax enabled + taxable status + customer not VAT exempt |
| `is_enabled()` | bool | |
| `get_rates_for_package($package)` | array | Clears rates, checks availability, calls calculate_shipping |
| `get_rate_id($suffix)` | string | Format: `{id}:{instance_id}:{suffix}` |
| `add_rate($args)` | void | Creates WC_Shipping_Rate, auto-calculates taxes |
| `is_available($package)` | bool | Checks enabled + country availability |
| `get_fee($fee, $total)` | float | Supports percentage fees (`'5%'`) with minimum |
| `supports($feature)` | bool | |

### 6.3 `add_rate()` Algorithm

```
Args: id, label, cost, taxes, calc_tax, meta_data, package, price_decimals

1. Require id + label
2. Total cost = sum(cost) if array, else cost
3. If taxes not array and not false and cost > 0 and taxable:
   a. If calc_tax == 'per_item': get_taxes_per_item(costs)
   b. Else: WC_Tax::calc_shipping_tax(total_cost, WC_Tax::get_shipping_tax_rates())
   c. If shipping_prices_include_tax filter returns true: subtract taxes from cost
4. Round total cost
5. Create WC_Shipping_Rate with id, method_id, instance_id, label, cost, taxes, tax_status
6. Add meta_data
7. Add package items summary
8. Store in $this->rates[id]
```

### 6.4 Per-Item Tax Calculation (`get_taxes_per_item()`)

For each cost key → look up cart item → get product tax class → get shipping tax rates for that class → calculate tax → sum all taxes. Special `'order'` key for order-level costs.

### 6.5 WC_Shipping (Singleton Manager)

**Properties:**

| Property | Type | Description |
|---|---|---|
| `$enabled` | bool | Whether shipping is enabled |
| `$shipping_methods` | array\|null | Loaded method instances |
| `$shipping_classes` | array | Product shipping class terms |
| `$packages` | array | Calculated packages with rates |

**Built-in Methods:**
- `flat_rate` → `WC_Shipping_Flat_Rate`
- `free_shipping` → `WC_Shipping_Free_Shipping`
- `local_pickup` → `WC_Shipping_Local_Pickup`
- Legacy methods loaded if enabled: `legacy_flat_rate`, `legacy_free_shipping`, `legacy_international_delivery`, `legacy_local_delivery`, `legacy_local_pickup`

### 6.6 Shipping Calculation Flow

```
calculate_shipping($packages):
  1. For each package:
     a. calculate_shipping_for_package($package, $package_key)
        - Check if package is shippable (country in allowed list)
        - Check session cache (package_hash comparison)
        - If stale: load_shipping_methods($package)
          → WC_Shipping_Zones::get_zone_matching_package($package)
          → Get zone's shipping methods
        - For each method: get_rates_for_package($package)
        - If non-shippable: skip non-local-pickup methods
        - Hide rates when free shipping available (optional)
        - Filter: woocommerce_package_rates
        - Store in session with hash
  2. Filter: woocommerce_shipping_packages
  3. Return packages array
```

**Package Hash** — excludes: `subtotal`, `total`, `package_id`, `package_name`, `rates`, `package_index`. Also strips `data` objects from cart contents for consistent hashing.

---

## 7. Tax Calculation System

### 7.1 WC_Tax (Static Class)

**Static Properties:**
- `$precision` — rounding precision (from `wc_get_rounding_precision()`)
- `$round_at_subtotal` — bool from `woocommerce_tax_round_at_subtotal` option

### 7.2 Core Tax Calculation

#### `calc_tax($price, $rates, $price_includes_tax, $deprecated)`

Routes to either inclusive or exclusive calculation. Returns array keyed by rate ID.

#### `calc_inclusive_tax($price, $rates)`

Algorithm for extracting tax from tax-inclusive prices:

1. Separate compound and regular rates
2. **Compound rates** (processed in reverse order):
   - `tax = price - (price / (1 + rate/100))`
   - Subtract tax from working price
3. **Regular rates**:
   - `regular_tax_rate = 1 + (sum(regular_rates) / 100)`
   - For each: `the_rate = (rate/100) / regular_tax_rate`
   - `net_price = price - (the_rate * non_compound_price)`
   - `tax = price - net_price`
4. Round all to precision

#### `calc_exclusive_tax($price, $rates)`

Algorithm for adding tax to tax-exclusive prices:

1. **Non-compound rates first**:
   - `tax = price * (rate / 100)`
2. **Compound rates** (applied on top):
   - `price_inc_tax = price + sum(non_compound_taxes)`
   - `tax = price_inc_tax * (rate / 100)`
3. Round all to precision

#### `calc_shipping_tax($price, $rates)`

Same as `calc_tax` but respects `woocommerce_shipping_prices_include_tax` filter. If shipping prices include tax → uses inclusive calculation.

#### `round($in)`

`NumberUtil::round($in, wc_get_rounding_precision())` — filterable via `woocommerce_tax_round`.

### 7.3 Rate Finding

#### `find_rates($args)`

Args: `country`, `state`, `city`, `postcode`, `tax_class`

1. Normalize postcode
2. Check cache (`wc_tax_rates_{hash}`)
3. If miss → `get_matched_tax_rates()`
4. Filter: `woocommerce_find_rates`

#### `get_matched_tax_rates()` — SQL Query Logic

**Main criteria (ANDed):**
- `tax_rate_country IN (country, '')`
- `tax_rate_state IN (state, '')`
- `tax_rate_class = tax_class`

**Location criteria (ORed):**
1. No postcode/city locations (rate applies everywhere)
2. Matching postcode + matching city (or no city restriction)
3. Matching city + no postcode restriction

**Postcode matching:**
- Supports wildcards via `wc_get_wildcard_postcodes()`
- Supports ranges (`...` notation)
- Normalized for comparison

**Sort order (priority):**
1. `tax_rate_priority` ASC
2. `tax_rate_country` (specific before empty)
3. `tax_rate_state` (specific before empty)
4. `postcode_count` DESC (more specific first)
5. `city_count` DESC (more specific first)
6. `tax_rate_id` ASC

**One rate per priority** — only the first matching rate at each priority level is returned.

**Output per rate:**
```php
[
    'rate'     => float,
    'label'    => string,
    'shipping' => 'yes'|'no',
    'compound' => 'yes'|'no',
]
```

#### `find_shipping_rates($args)`

Filters `find_rates()` results to only rates where `shipping == 'yes'`.

### 7.4 Tax Location Determination

#### `get_tax_location($tax_class, $customer)`

Priority:
1. Customer taxable address (if customer object available)
2. If prices include tax OR default customer address is base OR tax_based_on is base → shop base address

#### Shipping Tax Rates (`get_shipping_tax_rates()`)

1. Check `woocommerce_shipping_tax_class` option
2. If `'inherit'` → determine from cart items:
   - Standard class takes priority
   - If multiple classes → use first matching configured class slug
   - If no taxable items → return empty
3. Get tax location
4. Filter: `woocommerce_shipping_tax_class`
5. Call `find_shipping_rates()`

### 7.5 Tax Rate CRUD

| Method | Description |
|---|---|
| `_insert_tax_rate($tax_rate)` | Insert new rate, invalidate cache |
| `_get_tax_rate($tax_rate_id, $output_type)` | Get single rate |
| `_update_tax_rate($tax_rate_id, $tax_rate)` | Update rate |
| `_delete_tax_rate($tax_rate_id)` | Delete rate + locations |
| `_update_tax_rate_postcodes($tax_rate_id, $postcodes)` | Set postcodes |
| `_update_tax_rate_cities($tax_rate_id, $cities)` | Set cities |

### 7.6 Tax Class Management

| Method | Description |
|---|---|
| `get_tax_rate_classes()` | All classes from DB (cached) |
| `get_tax_classes()` | Class names |
| `get_tax_class_slugs()` | Class slugs |
| `create_tax_class($name, $slug)` | Create new class |
| `get_tax_class_by($field, $item)` | Get by id/name/slug |
| `delete_tax_class_by($field, $item)` | Delete class + associated rates |

### 7.7 Rate Code Format

`COUNTRY-STATE-NAME-PRIORITY` (e.g., `GB-VAT-1`, `US-AL-TAX-1`)

### 7.8 Tax Formatting

| Method | Description |
|---|---|
| `format_tax_rate_city($city)` | `strtoupper(trim())` |
| `format_tax_rate_state($state)` | `strtoupper()`, `'*'` → `''` |
| `format_tax_rate_country($country)` | `strtoupper()`, `'*'` → `''` |
| `format_tax_rate_name($name)` | Default `'Tax'` |
| `format_tax_rate($rate)` | `number_format($rate, 4, '.', '')` |
| `format_tax_rate_priority($priority)` | `absint()` |
| `format_tax_rate_class($class)` | Sanitize, validate against existing, `'standard'` → `''` |

---

## 8. Coupon System

### 8.1 WC_Coupon Data Schema

```php
$data = [
    'code'                        => '',
    'amount'                      => 0,
    'status'                      => null,
    'date_created'                => null,
    'date_modified'               => null,
    'date_expires'                => null,
    'discount_type'               => 'fixed_cart',
    'description'                 => '',
    'usage_count'                 => 0,
    'individual_use'              => false,
    'product_ids'                 => [],
    'excluded_product_ids'        => [],
    'usage_limit'                 => 0,
    'usage_limit_per_user'        => 0,
    'limit_usage_to_x_items'      => null,
    'free_shipping'               => false,
    'product_categories'          => [],
    'excluded_product_categories' => [],
    'exclude_sale_items'          => false,
    'minimum_amount'              => '',
    'maximum_amount'              => '',
    'email_restrictions'          => [],
    'used_by'                     => null,  // lazy-loaded
    'virtual'                     => false,
]
```

### 8.2 Discount Types

| Type | Description |
|---|---|
| `fixed_cart` | Fixed amount off entire cart |
| `percent` | Percentage off (was `percent_product`) |
| `fixed_product` | Fixed amount per product |
| Custom types | Via `woocommerce_coupon_get_discount_amount` filter |

### 8.3 Error Codes

| Code | Constant | Description |
|---|---|---|
| 100 | `E_WC_COUPON_INVALID_FILTERED` | Invalid (filtered out) |
| 101 | `E_WC_COUPON_INVALID_REMOVED` | Invalid, removed |
| 102 | `E_WC_COUPON_NOT_YOURS_REMOVED` | Email restriction failed |
| 103 | `E_WC_COUPON_ALREADY_APPLIED` | Already applied |
| 104 | `E_WC_COUPON_ALREADY_APPLIED_INDIV_USE_ONLY` | Individual use conflict |
| 105 | `E_WC_COUPON_NOT_EXIST` | Does not exist |
| 106 | `E_WC_COUPON_USAGE_LIMIT_REACHED` | Usage limit hit |
| 107 | `E_WC_COUPON_EXPIRED` | Past expiry date |
| 108 | `E_WC_COUPON_MIN_SPEND_LIMIT_NOT_MET` | Below minimum spend |
| 109 | `E_WC_COUPON_NOT_APPLICABLE` | Not applicable to cart |
| 110 | `E_WC_COUPON_NOT_VALID_SALE_ITEMS` | Excludes sale items |
| 111 | `E_WC_COUPON_PLEASE_ENTER` | No code entered |
| 112 | `E_WC_COUPON_MAX_SPEND_LIMIT_MET` | Above maximum spend |
| 113 | `E_WC_COUPON_EXCLUDED_PRODUCTS` | Contains excluded products |
| 114 | `E_WC_COUPON_EXCLUDED_CATEGORIES` | Contains excluded categories |
| 115 | `E_WC_COUPON_USAGE_LIMIT_COUPON_STUCK` | Limit reached (pending order) |
| 116 | `E_WC_COUPON_USAGE_LIMIT_COUPON_STUCK_GUEST` | Limit reached (guest) |
| 200 | `WC_COUPON_SUCCESS` | Applied successfully |
| 201 | `WC_COUPON_REMOVED` | Removed successfully |

### 8.4 Validation Rules

**`is_valid_for_cart()`** — Must be a cart coupon type (`wc_get_cart_coupon_types()`)

**`is_valid_for_product($product, $values)`** — Product coupon validation:
1. Must be a product coupon type
2. Check `product_ids` — product or parent ID must be in list
3. Check `product_categories` — product cats must intersect
4. If no product_ids AND no product_categories → valid for all
5. Check `excluded_product_ids` — reject if product in exclusion list
6. Check `excluded_product_categories` — reject if category in exclusion list
7. Check `exclude_sale_items` — reject if product is on sale

### 8.5 Discount Amount Calculation (`get_discount_amount()`)

```
percent:
  discount = amount * (discounting_amount / 100)

fixed_cart:
  discount_percent = (item_price * qty) / cart_subtotal
  discount = (amount * discount_percent) / qty
  // Uses price inc/ex tax based on store settings

fixed_product:
  discount = min(amount, discounting_amount)
  if not single: discount *= qty
```

All capped at `discounting_amount`, rounded to precision.

### 8.6 Coupon Usage Tracking

| Method | Description |
|---|---|
| `increase_usage_count($used_by, $order)` | Increment usage, bypass set_prop |
| `decrease_usage_count($used_by)` | Decrement if count > 0 |
| `get_used_by()` | Lazy-loaded from `_used_by` post meta |

### 8.7 Coupon Short Info (for order reapplication)

`get_short_info()` → JSON: `[id, code, type|null, amount, free_shipping?]`

Used to reconstruct coupon from order line item meta when original coupon is deleted.

### 8.8 Virtual Coupons

`read_manual_coupon($code, $coupon)` — creates coupon from array (via `woocommerce_get_shop_coupon_data` filter). Handles backward compatibility for old key names and type coercion.

---

## 9. Discount Calculation System

### 9.1 WC_Discounts

**Properties:**
- `$object` — WC_Cart or WC_Order
- `$items` — array of stdClass items (key, object, product, quantity, price)
- `$discounts` — `array[coupon_code][item_key] => discount_amount` (in cents/precision)

### 9.2 Item Normalization

**From Cart:**
```php
$item->price = wc_add_number_precision_deep(product_price * quantity)
```

**From Order:**
```php
$item->price = wc_add_number_precision_deep(order_item_subtotal)
if prices_include_tax:
    $item->price += wc_add_number_precision_deep(order_item_subtotal_tax)
```

Items sorted by price DESC (highest first) for fair discount distribution.

### 9.3 Coupon Application (`apply_coupon()`)

1. Validate coupon (if `$validate` is true)
2. Initialize discount array for coupon code
3. Get items to apply (filtered by product/category validity)
4. Route by discount type:
   - `percent` → `apply_coupon_percent()`
   - `fixed_product` → `apply_coupon_fixed_product()`
   - `fixed_cart` → `apply_coupon_fixed_cart()`
   - default → `apply_coupon_custom()`

### 9.4 Percent Discount Algorithm

```
For each item:
  1. discounted_price = remaining price after prior discounts
  2. price_to_discount = discounted_price (sequential) or original price
  3. apply_quantity = min(remaining limit, item qty)
  4. price_to_discount = (price_to_discount / qty) * apply_quantity
  5. discount = floor(price_to_discount * (coupon_amount / 100))
  6. Apply legacy filter if present
  7. discount = min(discounted_price, discount)
  8. Accumulate

Remainder correction:
  cart_total_discount = round(cart_total * amount / 100)
  if total_discount < cart_total_discount:
    apply_coupon_remainder() for the difference
```

### 9.5 Fixed Product Discount Algorithm

```
For each item:
  1. discounted_price = remaining price
  2. price_to_discount = discounted_price (sequential) or original
  3. If limit_usage_qty:
     apply_quantity = min(remaining, item qty)
     discount = min(amount, item_price/qty) * apply_quantity
  4. Else:
     apply_quantity = item qty
     discount = amount * apply_quantity
  5. Apply legacy filter if present
  6. discount = min(discounted_price, discount)
  7. Accumulate
```

### 9.6 Fixed Cart Discount Algorithm

```
1. Filter items with remaining price > 0
2. item_count = sum of quantities
3. per_item_discount = floor(amount / item_count)
4. If per_item_discount > 0:
   a. Apply as fixed_product with per_item_discount
   b. If remaining discount: recurse with (amount - total_discount)
5. Else if amount > 0:
   apply_coupon_remainder() — distribute 1 cent at a time
```

### 9.7 Remainder Distribution (`apply_coupon_remainder()`)

Distributes remaining discount 1 cent at a time across items, iterating through each item's quantity. Stops when total reaches target amount.

### 9.8 Custom Coupon Type

Calls `$coupon->get_discount_amount()` per item (delegates to coupon class), respects `limit_usage_to_x_items`, then applies `woocommerce_coupon_custom_discounts_array` filter.

### 9.9 Sequential vs Parallel Discount Calculation

Controlled by `woocommerce_calc_discounts_sequentially` option:
- **Sequential** (yes): Each coupon discounts the already-discounted price
- **Parallel** (no, default): Each coupon discounts from the original price

### 9.10 Coupon Validation Pipeline (`is_coupon_valid()`)

Executed in order, each throws Exception on failure:

1. `validate_coupon_exists()` — coupon ID exists, not trashed
2. `validate_coupon_usage_limit()` — global usage limit (checks tentative usage)
3. `validate_coupon_user_usage_limit()` — per-user limit
4. `validate_coupon_expiry_date()` — not expired
5. `validate_coupon_minimum_amount()` — cart meets minimum spend
6. `validate_coupon_maximum_amount()` — cart under maximum spend
7. `validate_coupon_product_ids()` — cart has required products
8. `validate_coupon_product_categories()` — cart has required categories
9. `validate_coupon_excluded_items()` — product coupons pass exclusion rules
10. `validate_coupon_eligible_items()` — cart coupons pass sale/exclusion checks
11. `validate_coupon_allowed_emails()` — email restrictions match
12. Filter: `woocommerce_coupon_is_valid` — final boolean check

Returns `true` or `WP_Error` with code `'invalid_coupon'`.

---

## 10. Hooks Reference

### 10.1 Actions — Order Lifecycle

| Hook | Params | When |
|---|---|---|
| `woocommerce_pre_payment_complete` | `$order_id, $transaction_id` | Before payment complete |
| `woocommerce_payment_complete` | `$order_id, $transaction_id` | After payment complete |
| `woocommerce_payment_complete_order_status_{status}` | `$order_id, $transaction_id` | Payment complete on non-valid status |
| `woocommerce_order_status_{to}` | `$order_id, $order, $transition` | Status changed to {to} |
| `woocommerce_order_status_{from}_to_{to}` | `$order_id, $order` | Specific transition |
| `woocommerce_order_status_changed` | `$order_id, $from, $to, $order` | Any status change |
| `woocommerce_order_payment_status_changed` | `$order_id, $order` | Pending/failed → paid |
| `woocommerce_order_edit_status` | `$order_id, $new_status` | Manual status edit |
| `woocommerce_order_before_calculate_totals` | `$and_taxes, $order` | Before total calculation |
| `woocommerce_order_after_calculate_totals` | `$and_taxes, $order` | After total calculation |
| `woocommerce_order_before_calculate_taxes` | `$args, $order` | Before tax calculation |
| `woocommerce_before_order_object_save` | `$order, $data_store` | Before save |
| `woocommerce_after_order_object_save` | `$order, $data_store` | After save |
| `woocommerce_order_note_added` | `$comment_id, $order` | Note added |
| `woocommerce_new_customer_note` | `array{order_id, customer_note}` | Customer note created |
| `woocommerce_order_applied_coupon` | `$coupon, $order` | Coupon applied to order |
| `woocommerce_removed_order_items` | `$order, $type\|null` | Items removed |
| `woocommerce_remove_order_items` | `$order, $type\|null` | Before items removed |
| `woocommerce_payment_token_added_to_order` | `$order_id, $token_id, $token, $token_ids` | Payment token added |

### 10.2 Actions — Shipping

| Hook | Params | When |
|---|---|---|
| `woocommerce_shipping_init` | — | Shipping initialized |
| `woocommerce_load_shipping_methods` | `$package` | Methods being loaded |
| `woocommerce_before_get_rates_for_package` | `$package, $method` | Before rate calculation |
| `woocommerce_after_get_rates_for_package` | `$package, $method` | After rate calculation |
| `woocommerce_tax_rate_added` | `$tax_rate_id, $tax_rate` | Tax rate inserted |
| `woocommerce_tax_rate_updated` | `$tax_rate_id, $tax_rate` | Tax rate updated |
| `woocommerce_tax_rate_deleted` | `$tax_rate_id` | Tax rate deleted |
| `woocommerce_order_item_after_calculate_taxes` | `$item, $calculate_tax_for` | Item taxes calculated |

### 10.3 Filters — Order

| Filter | Params | Description |
|---|---|---|
| `woocommerce_valid_order_statuses_for_payment_complete` | `$statuses, $order` | Statuses eligible for payment complete |
| `woocommerce_payment_complete_order_status` | `$status, $order_id, $order` | Status after payment |
| `woocommerce_valid_order_statuses_for_payment` | `$statuses, $order` | Statuses that need payment |
| `woocommerce_order_number` | `$id, $order` | Display order number |
| `woocommerce_get_formatted_order_total` | `$formatted, $order, $tax_display, $display_refunded` | Formatted total HTML |
| `woocommerce_default_order_status` | `$status` | Default for new orders |
| `woocommerce_order_is_editable` | `$is_editable, $order` | Editability check |
| `woocommerce_order_is_paid` | `$is_paid, $order` | Payment check |
| `woocommerce_order_is_download_permitted` | `$permitted, $order` | Download check |
| `woocommerce_order_needs_payment` | `$needs, $order, $statuses` | Payment needed check |
| `woocommerce_order_item_needs_processing` | `$needs, $product, $order_id` | Processing check per item |
| `woocommerce_order_hide_zero_taxes` | `bool` | Hide zero-tax lines |
| `woocommerce_order_get_tax_totals` | `$totals, $order` | Tax totals array |
| `woocommerce_order_get_items` | `$items, $order, $types` | Items array |
| `woocommerce_order_type_to_group` | `$mapping` | Item type→group mapping |
| `woocommerce_order_is_vat_exempt` | `$is_exempt, $order` | VAT exemption |
| `woocommerce_apply_base_tax_for_local_pickup` | `bool` | Base tax for pickup |
| `woocommerce_local_pickup_methods` | `$method_ids` | Local pickup method IDs |
| `woocommerce_order_get_tax_location` | `$args, $order` | Tax location override |
| `woocommerce_adjust_non_base_location_prices` | `bool` | Fixed-end-price mode |

### 10.4 Filters — Tax

| Filter | Params | Description |
|---|---|---|
| `woocommerce_calc_tax` | `$taxes, $price, $rates, $includes_tax` | Tax calculation result |
| `woocommerce_calc_shipping_tax` | `$taxes, $price, $rates` | Shipping tax result |
| `woocommerce_tax_round` | `$rounded, $in` | Tax rounding |
| `woocommerce_price_inc_tax_amount` | `$amount, $key, $rate, $price` | Inclusive tax amount |
| `woocommerce_price_ex_tax_amount` | `$amount, $key, $rate, $price` | Exclusive tax amount |
| `woocommerce_find_rates` | `$rates, $args` | Found rates |
| `woocommerce_matched_tax_rates` | `$rates, $country, $state, $postcode, $city, $class` | Matched rates |
| `woocommerce_matched_rates` | `$rates, $tax_class, $customer` | Final matched rates |
| `woocommerce_base_tax_rates` | `$rates, $tax_class` | Base location rates |
| `woocommerce_get_tax_location` | `$location, $tax_class, $customer` | Tax location |
| `woocommerce_shipping_prices_include_tax` | `bool` | Shipping prices are gross |
| `woocommerce_shipping_tax_class` | `$tax_class, $cart, $customer, $location` | Shipping tax class |
| `woocommerce_rate_compound` | `$compound, $key` | Is compound |
| `woocommerce_rate_label` | `$label, $key` | Rate label |
| `woocommerce_rate_percent` | `$percent, $key` | Rate percent display |
| `woocommerce_rate_code` | `$code, $key` | Rate code |

### 10.5 Filters — Shipping

| Filter | Params | Description |
|---|---|---|
| `woocommerce_shipping_methods` | `$methods` | Registered method classes |
| `woocommerce_shipping_method_supports` | `$supports, $feature, $method` | Feature check |
| `woocommerce_shipping_method_add_rate_args` | `$args, $method` | Rate args before creation |
| `woocommerce_shipping_method_add_rate` | `$rate, $args, $method` | Created rate object |
| `woocommerce_shipping_{id}_is_available` | `$available, $package, $method` | Availability |
| `woocommerce_shipping_{id}_option` | `$value, $key, $method` | Global option |
| `woocommerce_shipping_{id}_instance_option` | `$value, $key, $method` | Instance option |
| `woocommerce_shipping_{id}_instance_settings_values` | `$settings, $method` | Settings to save |
| `woocommerce_package_rates` | `$rates, $package` | Calculated rates |
| `woocommerce_shipping_packages` | `$packages` | All packages |
| `woocommerce_order_shipping_method` | `$methods, $order` | Shipping method display |
| `woocommerce_shipping_address_map_url_parts` | `$address, $order` | Map URL parts |
| `woocommerce_shipping_address_map_url` | `$url, $order` | Map URL |

### 10.6 Filters — Coupon/Discount

| Filter | Params | Description |
|---|---|---|
| `woocommerce_coupon_get_discount_amount` | `$discount, $price, $item, $single, $coupon` | Discount amount |
| `woocommerce_coupon_is_valid` | `$valid, $coupon, $discounts` | Final validity |
| `woocommerce_coupon_error` | `$message, $code, $coupon` | Error message |
| `woocommerce_coupon_message` | `$message, $code, $coupon` | Success message |
| `woocommerce_coupon_get_items_to_validate` | `$items, $discounts` | Items for validation |
| `woocommerce_coupon_get_items_to_apply` | `$items, $coupon, $discounts` | Items for discount |
| `woocommerce_coupon_get_apply_quantity` | `$qty, $item, $coupon, $discounts` | Apply quantity |
| `woocommerce_coupon_custom_discounts_array` | `$discounts, $coupon` | Custom type post-process |
| `woocommerce_coupon_validate_expiry_date` | `$expired, $coupon, $discounts` | Expiry check |
| `woocommerce_coupon_validate_minimum_amount` | `$fails, $coupon, $subtotal` | Min spend check |
| `woocommerce_coupon_validate_maximum_amount` | `$fails, $coupon` | Max spend check |
| `woocommerce_coupon_validate_user_usage_limit` | `$check, $user_id, $coupon, $discounts` | Per-user check |
| `woocommerce_coupon_is_valid_for_product_ids` | `$valid, $coupon, $discounts` | Product ID check |
| `woocommerce_coupon_is_valid_for_product_categories` | `$valid, $coupon, $discounts` | Category check |
| `woocommerce_coupon_is_valid_for_sale_items` | `$valid, $coupon, $discounts` | Sale items check |
| `woocommerce_coupon_is_valid_for_excluded_items` | `$valid, $coupon, $discounts` | Exclusion check |
| `woocommerce_coupon_is_valid_for_excluded_product_ids` | `$valid, $coupon, $discounts` | Excluded products |
| `woocommerce_coupon_is_valid_for_excluded_product_categories` | `$valid, $coupon, $discounts` | Excluded categories |
| `woocommerce_get_shop_coupon_data` | `$false, $data, $coupon` | Virtual coupon creation |
| `woocommerce_order_recalculate_coupons_coupon_object` | `$coupon, $code, $item, $order` | Coupon for recalculation |
| `woocommerce_coupon_get_discount_amount` | `$discount, $price, $item, $single, $coupon` | Legacy discount filter |

### 10.7 Filters — Payment Gateway

| Filter | Params | Description |
|---|---|---|
| `woocommerce_gateway_title` | `$title, $id` | Gateway title |
| `woocommerce_gateway_description` | `$description, $id` | Gateway description |
| `woocommerce_gateway_icon` | `$icon, $id` | Gateway icon |
| `woocommerce_gateway_method_title` | `$title, $gateway` | Admin title |
| `woocommerce_gateway_method_description` | `$description, $gateway` | Admin description |
| `woocommerce_get_return_url` | `$url, $order` | Return URL |
| `woocommerce_get_transaction_url` | `$url, $order, $gateway` | Transaction URL |
| `woocommerce_payment_gateway_supports` | `$supports, $feature, $gateway` | Feature support |
| `woocommerce_gateway_get_saved_payment_method_option_html` | `$html, $token, $gateway` | Token HTML |

### 10.8 Filters — Order Items

| Filter | Params | Description |
|---|---|---|
| `woocommerce_order_item_display_meta_key` | `$key, $meta, $item` | Meta display key |
| `woocommerce_order_item_display_meta_value` | `$value, $meta, $item` | Meta display value |
| `woocommerce_order_item_get_formatted_meta_data` | `$meta, $item` | Formatted meta |
| `woocommerce_get_items_key` | `$key, $item` | Item storage key |
| `woocommerce_get_item_count` | `$count, $type, $order` | Item count |
| `woocommerce_get_item_count_refunded` | `$count, $type, $order` | Refunded count |

---

## 11. Calculation Algorithms

### 11.1 Order Total Calculation (`calculate_totals()`)

```
1. cart_subtotal = sum of all line item subtotals (before discounts)
2. cart_total = sum of all line item totals (after discounts)

3. shipping_total = sum of all shipping method totals

4. For each fee:
   - If negative fee: cap at -(cart_total + fees_so_far + shipping_total)
   - Accumulate fees_total

5. If and_taxes: calculate_taxes()

6. Re-read cart totals (fees may have been capped)

7. Sum all item taxes:
   - cart_total_tax = sum of item total taxes
   - cart_subtotal_tax = sum of item subtotal taxes

8. If fixed-end-prices:
   - cart_subtotal -= cart_subtotal_tax
   - cart_total -= cart_total_tax

9. discount_total = round(cart_subtotal - cart_total)
10. discount_tax = round(cart_subtotal_tax - cart_total_tax)

11. grand_total = round(
      cart_total
    + fees_total
    + shipping_total
    + cart_tax (from tax lines)
    + shipping_tax
    )

12. save()
```

### 11.2 Tax Calculation on Order (`calculate_taxes()`)

```
1. Get tax location (billing/shipping/base, with local pickup override)
2. Determine shipping_tax_class:
   - If 'inherit': use first matching class from order items
3. Check VAT exemption (meta 'is_vat_exempt')
4. For each line_item and fee:
   - If not VAT exempt: item->calculate_taxes(location)
   - Else: item->set_taxes(false)
5. For each shipping method:
   - If shipping_tax_class is valid and not VAT exempt:
     item->calculate_taxes(location + tax_class)
   - Else: item->set_taxes(false)
6. update_taxes() — consolidate tax lines
```

### 11.3 Tax Line Consolidation (`update_taxes()`)

```
1. Aggregate cart taxes by rate_id from all line_item/fee items
   - Uses round_line_tax() for per-line rounding
2. Aggregate shipping taxes by rate_id from all shipping methods
   - Uses wc_round_tax_total() unless round_at_subtotal
3. For existing tax lines:
   - Update rate_code, label, compound, rate_percent from DB
   - Set tax_total and shipping_tax_total
   - Remove if no longer applicable
4. Create new tax lines for new rate_ids
5. set_shipping_tax(sum of shipping taxes)
6. set_cart_tax(sum of cart taxes)
   → This auto-updates total_tax = cart_tax + shipping_tax
7. save()
```

### 11.4 Coupon Application to Order

```
apply_coupon($raw_coupon):
  1. Create/load WC_Coupon
  2. Check not already applied
  3. Create WC_Discounts($this)
  4. discounts->apply_coupon($coupon) — validates + calculates
  5. For guests: check per-user email usage limit
  6. Fire woocommerce_order_applied_coupon
  7. set_coupon_discount_amounts($discounts)
     - For each coupon's discount:
       - Calculate discount_tax from item tax rates
       - If prices_include_tax: subtract tax from discount amount
       - Create/update WC_Order_Item_Coupon with discount + discount_tax
  8. save()
  9. recalculate_coupons()
     - Reset all line item totals to subtotals
     - Re-apply all coupons via new WC_Discounts
     - set_item_discount_amounts() — subtract discounts from item totals
     - calculate_totals(true)
  10. Record coupon usage count
```

### 11.5 Grand Total Formula

```
total = cart_total + fees_total + shipping_total + cart_tax + shipping_tax

Where:
  cart_total     = sum(line_item.total) — after discounts
  fees_total     = sum(fee.total) — capped to prevent negative grand total
  shipping_total = sum(shipping.total)
  cart_tax       = sum(tax_line.tax_total)
  shipping_tax   = sum(tax_line.shipping_tax_total)

  discount_total = cart_subtotal - cart_total (before tax)
  discount_tax   = cart_subtotal_tax - cart_total_tax
  total_tax      = cart_tax + shipping_tax
```

### 11.6 Rounding Strategy

- **Per-line rounding**: `round_line_tax()` — used for line item taxes during consolidation
- **Subtotal rounding**: When `woocommerce_tax_round_at_subtotal` is `'yes'`, taxes are NOT rounded per-line, only at subtotal level
- **Precision**: `wc_get_rounding_precision()` (typically 4 decimal places for intermediate calculations)
- **Display rounding**: `wc_get_price_decimals()` (typically 2) for final display
- **Tax round filter**: `woocommerce_tax_round` allows custom rounding (e.g., 5-cent rounding)

### 11.7 Fee Capping

Negative fees are capped to prevent the grand total from going below zero:
```
max_discount = -(cart_total + fees_total_so_far + shipping_total)
if fee_total < max_discount AND max_discount < 0:
    fee_total = max_discount
```

---

## Appendix: Key Design Patterns

### Data Store Pattern
All entities use `WC_Data_Store` for persistence. The data store is swappable (posts, custom tables). Methods: `read()`, `create()`, `update()`, `read_items()`, `delete_items()`.

### Context Pattern (view/edit)
All getters accept `$context`:
- `'view'` — applies filters, may compute fallbacks
- `'edit'` — returns raw stored value

### Change Tracking
`WC_Data` tracks `$changes` separately from `$data`. `apply_changes()` merges them. `get_changes()` returns only modified properties.

### WeakReference for Circular Prevention
`WC_Order_Item::$order` uses `WeakReference<WC_Order>` to prevent memory leaks in batch operations.

### Number Precision
Internal calculations use `wc_add_number_precision()` (multiply by 10^precision) to work in integer cents, then `wc_remove_number_precision()` to convert back. This avoids floating-point errors.
