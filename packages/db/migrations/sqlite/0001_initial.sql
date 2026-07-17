CREATE TABLE `admin_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`source` text DEFAULT 'spcnd-ecom' NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`is_snoozable` integer DEFAULT false NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`severity` text,
	`date_created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`description` text,
	`permissions` text NOT NULL,
	`consumer_key` text NOT NULL,
	`consumer_secret` text NOT NULL,
	`truncated_key` text NOT NULL,
	`last_access` text,
	FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "api_keys_permissions_chk" CHECK("permissions" IN ('read', 'write', 'read_write'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_consumer_key_uq` ON `api_keys` (`consumer_key`);--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `attribute_taxonomies` (
	`attribute_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attribute_name` text NOT NULL,
	`attribute_label` text,
	`attribute_type` text DEFAULT 'select' NOT NULL,
	`attribute_orderby` text DEFAULT 'menu_order' NOT NULL,
	`attribute_public` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_uq` ON `auth_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `auth_sessions_customer_idx` ON `auth_sessions` (`customer_id`);--> statement-breakpoint
CREATE TABLE `category_lookup` (
	`category_id` integer PRIMARY KEY NOT NULL,
	`category_tree` text DEFAULT '' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `coupon_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`customer_id` integer,
	`used_by` text DEFAULT '' NOT NULL,
	`amount` integer DEFAULT '0.0000' NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `coupon_usage_coupon_idx` ON `coupon_usage` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `coupon_usage_order_idx` ON `coupon_usage` (`order_id`);--> statement-breakpoint
CREATE INDEX `coupon_usage_used_by_idx` ON `coupon_usage` (`used_by`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`amount` integer DEFAULT '0.0000' NOT NULL,
	`status` text DEFAULT 'publish' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`discount_type` text DEFAULT 'fixed_cart' NOT NULL,
	`date_expires` text,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`individual_use` integer DEFAULT false NOT NULL,
	`usage_limit` integer,
	`usage_limit_per_user` integer,
	`limit_usage_to_x_items` integer,
	`free_shipping` integer DEFAULT false NOT NULL,
	`exclude_sale_items` integer DEFAULT false NOT NULL,
	`minimum_amount` integer,
	`maximum_amount` integer,
	`email_restrictions` text DEFAULT '[]' NOT NULL,
	`product_ids` text DEFAULT '[]' NOT NULL,
	`excluded_product_ids` text DEFAULT '[]' NOT NULL,
	`product_categories` text DEFAULT '[]' NOT NULL,
	`excluded_product_categories` text DEFAULT '[]' NOT NULL,
	`date_created` text NOT NULL,
	`date_modified` text NOT NULL,
	CONSTRAINT "coupons_discount_type_chk" CHECK("discount_type" IN ('fixed_cart', 'percent', 'fixed_product'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_uq` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`type` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`address_1` text DEFAULT '' NOT NULL,
	`address_2` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`postcode` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`email` text,
	`phone` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "customer_addresses_type_chk" CHECK("type" IN ('billing', 'shipping'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_addresses_customer_type_uq` ON `customer_addresses` (`customer_id`,`type`);--> statement-breakpoint
CREATE TABLE `customer_lookup` (
	`customer_id` integer PRIMARY KEY NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`postcode` text DEFAULT '' NOT NULL,
	`total_spent` integer DEFAULT '0.0000' NOT NULL,
	`order_count` integer DEFAULT 0 NOT NULL,
	`avg_order_value` integer DEFAULT '0.0000' NOT NULL,
	`date_registered` text,
	`date_last_active` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_lookup_email_idx` ON `customer_lookup` (`email`);--> statement-breakpoint
CREATE TABLE `customer_meta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_meta_owner_key_idx` ON `customer_meta` (`customer_id`,`key`);--> statement-breakpoint
CREATE INDEX `customer_meta_key_idx` ON `customer_meta` (`key`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`username` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`is_paying_customer` integer DEFAULT false NOT NULL,
	`total_spent` integer DEFAULT '0.0000' NOT NULL,
	`order_count` integer DEFAULT 0 NOT NULL,
	`date_created` text NOT NULL,
	`date_modified` text NOT NULL,
	CONSTRAINT "customers_role_chk" CHECK("role" IN ('customer', 'shop_manager', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_email_uq` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customers_username_idx` ON `customers` (`username`);--> statement-breakpoint
CREATE TABLE `download_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`download_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`order_key` text NOT NULL,
	`user_id` integer,
	`user_email` text NOT NULL,
	`downloads_remaining` integer,
	`access_granted` text NOT NULL,
	`access_expires` text,
	`download_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `download_permissions_order_idx` ON `download_permissions` (`order_id`);--> statement-breakpoint
CREATE INDEX `download_permissions_email_order_key_idx` ON `download_permissions` (`user_email`,`order_key`);--> statement-breakpoint
CREATE INDEX `download_permissions_user_idx` ON `download_permissions` (`user_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	`name` text,
	`mime_type` text,
	`source` text DEFAULT 'local' NOT NULL,
	`source_id` text,
	`width` integer,
	`height` integer,
	`file_size` integer,
	`date_created` text NOT NULL,
	CONSTRAINT "media_source_chk" CHECK("source" IN ('local', 's3', 'r2', 'external'))
);
--> statement-breakpoint
CREATE TABLE `media_links` (
	`media_id` integer NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`media_id`, `owner_type`, `owner_id`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_links_owner_idx` ON `media_links` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `order_coupon_lookup` (
	`order_id` integer NOT NULL,
	`coupon_id` integer NOT NULL,
	`date_created` text NOT NULL,
	`discount_amount` integer DEFAULT '0.0000' NOT NULL,
	`discount_amount_tax` integer DEFAULT '0.0000' NOT NULL,
	PRIMARY KEY(`order_id`, `coupon_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_coupon_lookup_coupon_idx` ON `order_coupon_lookup` (`coupon_id`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`payload` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_events_order_event_uq` ON `order_events` (`order_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `order_item_meta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_item_id` integer NOT NULL,
	`key` text,
	`value` text,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_item_meta_owner_key_idx` ON `order_item_meta` (`order_item_id`,`key`);--> statement-breakpoint
CREATE INDEX `order_item_meta_key_idx` ON `order_item_meta` (`key`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`product_id` integer,
	`variation_id` integer,
	`quantity` integer,
	`subtotal` integer,
	`total` integer,
	`subtotal_tax` integer,
	`total_tax` integer,
	`tax_class` text,
	`tax_status` text,
	`taxes` text,
	`meta_data` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variation_id`) REFERENCES `product_variations`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "order_items_type_chk" CHECK("type" IN ('line_item', 'fee', 'shipping', 'tax', 'coupon'))
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`,`type`);--> statement-breakpoint
CREATE INDEX `order_items_product_idx` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `order_meta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_meta_owner_key_idx` ON `order_meta` (`order_id`,`key`);--> statement-breakpoint
CREATE INDEX `order_meta_key_idx` ON `order_meta` (`key`);--> statement-breakpoint
CREATE TABLE `order_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`note` text NOT NULL,
	`type` text DEFAULT 'private' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "order_notes_type_chk" CHECK("type" IN ('private', 'customer', 'system'))
);
--> statement-breakpoint
CREATE INDEX `order_notes_order_idx` ON `order_notes` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_product_lookup` (
	`order_item_id` integer PRIMARY KEY NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`variation_id` integer,
	`customer_id` integer,
	`qty` integer DEFAULT 0 NOT NULL,
	`total_sales` integer DEFAULT '0.0000' NOT NULL,
	`tax_total` integer DEFAULT '0.0000' NOT NULL,
	`shipping_total` integer DEFAULT '0.0000' NOT NULL,
	`coupon_amount` integer DEFAULT '0.0000' NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_product_lookup_order_idx` ON `order_product_lookup` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_product_lookup_product_idx` ON `order_product_lookup` (`product_id`);--> statement-breakpoint
CREATE INDEX `order_product_lookup_date_idx` ON `order_product_lookup` (`date_created`);--> statement-breakpoint
CREATE TABLE `order_refunds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`amount` integer DEFAULT '0.0000' NOT NULL,
	`reason` text,
	`refunded_by` integer,
	`refunded_payment` integer DEFAULT false NOT NULL,
	`line_items` text DEFAULT '[]' NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refunded_by`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_refunds_order_idx` ON `order_refunds` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_stats` (
	`order_id` integer PRIMARY KEY NOT NULL,
	`parent_id` integer,
	`status` text NOT NULL,
	`total_sales` integer DEFAULT '0.0000' NOT NULL,
	`tax_total` integer DEFAULT '0.0000' NOT NULL,
	`shipping_total` integer DEFAULT '0.0000' NOT NULL,
	`net_total` integer DEFAULT '0.0000' NOT NULL,
	`returning_customer` integer DEFAULT false NOT NULL,
	`customer_id` integer,
	`num_items_sold` integer DEFAULT 0 NOT NULL,
	`date_created` text NOT NULL,
	`date_paid` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_stats_date_idx` ON `order_stats` (`date_created`);--> statement-breakpoint
CREATE INDEX `order_stats_customer_idx` ON `order_stats` (`customer_id`);--> statement-breakpoint
CREATE INDEX `order_stats_status_idx` ON `order_stats` (`status`);--> statement-breakpoint
CREATE TABLE `order_tax_lookup` (
	`order_id` integer NOT NULL,
	`tax_rate_id` integer NOT NULL,
	`date_created` text NOT NULL,
	`shipping_tax` integer DEFAULT '0.0000' NOT NULL,
	`order_tax` integer DEFAULT '0.0000' NOT NULL,
	`total_tax` integer DEFAULT '0.0000' NOT NULL,
	PRIMARY KEY(`order_id`, `tax_rate_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_tax_lookup_rate_idx` ON `order_tax_lookup` (`tax_rate_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`prices_include_tax` integer DEFAULT false NOT NULL,
	`date_created` text NOT NULL,
	`date_modified` text NOT NULL,
	`date_paid` text,
	`date_completed` text,
	`discount_total` integer DEFAULT '0.0000' NOT NULL,
	`discount_tax` integer DEFAULT '0.0000' NOT NULL,
	`shipping_total` integer DEFAULT '0.0000' NOT NULL,
	`shipping_tax` integer DEFAULT '0.0000' NOT NULL,
	`cart_tax` integer DEFAULT '0.0000' NOT NULL,
	`total` integer DEFAULT '0.0000' NOT NULL,
	`total_tax` integer DEFAULT '0.0000' NOT NULL,
	`customer_id` integer,
	`order_key` text NOT NULL,
	`billing_first_name` text DEFAULT '' NOT NULL,
	`billing_last_name` text DEFAULT '' NOT NULL,
	`billing_company` text DEFAULT '' NOT NULL,
	`billing_address_1` text DEFAULT '' NOT NULL,
	`billing_address_2` text DEFAULT '' NOT NULL,
	`billing_city` text DEFAULT '' NOT NULL,
	`billing_state` text DEFAULT '' NOT NULL,
	`billing_postcode` text DEFAULT '' NOT NULL,
	`billing_country` text DEFAULT '' NOT NULL,
	`billing_email` text DEFAULT '' NOT NULL,
	`billing_phone` text DEFAULT '' NOT NULL,
	`shipping_first_name` text DEFAULT '' NOT NULL,
	`shipping_last_name` text DEFAULT '' NOT NULL,
	`shipping_company` text DEFAULT '' NOT NULL,
	`shipping_address_1` text DEFAULT '' NOT NULL,
	`shipping_address_2` text DEFAULT '' NOT NULL,
	`shipping_city` text DEFAULT '' NOT NULL,
	`shipping_state` text DEFAULT '' NOT NULL,
	`shipping_postcode` text DEFAULT '' NOT NULL,
	`shipping_country` text DEFAULT '' NOT NULL,
	`shipping_phone` text DEFAULT '' NOT NULL,
	`payment_method` text DEFAULT '' NOT NULL,
	`payment_method_title` text DEFAULT '' NOT NULL,
	`transaction_id` text,
	`customer_ip_address` text,
	`customer_user_agent` text,
	`created_via` text,
	`customer_note` text,
	`parent_id` integer,
	`cart_hash` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "orders_status_chk" CHECK("status" IN ('pending', 'failed', 'on-hold', 'processing', 'completed', 'cancelled', 'refunded', 'draft', 'auto-draft', 'checkout-draft', 'trash'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_key_uq` ON `orders` (`order_key`);--> statement-breakpoint
CREATE INDEX `orders_status_date_idx` ON `orders` (`status`,`date_created`);--> statement-breakpoint
CREATE INDEX `orders_customer_date_idx` ON `orders` (`customer_id`,`date_created`);--> statement-breakpoint
CREATE INDEX `orders_parent_idx` ON `orders` (`parent_id`);--> statement-breakpoint
CREATE INDEX `orders_billing_email_idx` ON `orders` (`billing_email`);--> statement-breakpoint
CREATE TABLE `payment_token_meta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`token_id`) REFERENCES `payment_tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_token_meta_owner_key_idx` ON `payment_token_meta` (`token_id`,`key`);--> statement-breakpoint
CREATE TABLE `payment_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`gateway` text NOT NULL,
	`token` text NOT NULL,
	`type` text DEFAULT 'CC' NOT NULL,
	`last4` text,
	`expiry` text,
	`card_type` text,
	`is_default` integer DEFAULT false NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_tokens_user_idx` ON `payment_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `product_attribute_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attribute_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_attribute_terms_attr_idx` ON `product_attribute_terms` (`attribute_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_attribute_terms_attr_slug_uq` ON `product_attribute_terms` (`attribute_id`,`slug`);--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`type` text DEFAULT 'select' NOT NULL,
	`order_by` text DEFAULT 'menu_order' NOT NULL,
	`has_archives` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_attributes_slug_uq` ON `product_attributes` (`slug`);--> statement-breakpoint
CREATE TABLE `product_attributes_lookup` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`attribute_id` integer NOT NULL,
	`term_id` integer NOT NULL,
	`is_variation` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_attributes_lookup_product_idx` ON `product_attributes_lookup` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_attributes_lookup_term_idx` ON `product_attributes_lookup` (`attribute_id`,`term_id`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`parent_id` integer,
	`thumbnail_id` integer,
	`display_type` text DEFAULT 'default' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thumbnail_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_slug_uq` ON `product_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `product_categories_parent_idx` ON `product_categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `product_category_map` (
	`product_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `category_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_category_map_category_idx` ON `product_category_map` (`category_id`);--> statement-breakpoint
CREATE TABLE `product_crosssell_map` (
	`product_id` integer NOT NULL,
	`crosssell_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `crosssell_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`crosssell_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_downloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`variation_id` integer,
	`download_id` text NOT NULL,
	`name` text NOT NULL,
	`file_url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variation_id`) REFERENCES `product_variations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_downloads_download_id_uq` ON `product_downloads` (`download_id`);--> statement-breakpoint
CREATE INDEX `product_downloads_product_idx` ON `product_downloads` (`product_id`);--> statement-breakpoint
CREATE TABLE `product_grouped_map` (
	`group_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`group_id`, `product_id`),
	FOREIGN KEY (`group_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_meta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_meta_owner_key_idx` ON `product_meta` (`product_id`,`key`);--> statement-breakpoint
CREATE INDEX `product_meta_key_idx` ON `product_meta` (`key`);--> statement-breakpoint
CREATE TABLE `product_meta_lookup` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`sku` text,
	`global_unique_id` text,
	`virtual` integer DEFAULT false NOT NULL,
	`downloadable` integer DEFAULT false NOT NULL,
	`min_price` integer,
	`max_price` integer,
	`onsale` integer DEFAULT false NOT NULL,
	`stock_quantity` integer,
	`stock_status` text DEFAULT 'instock' NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`average_rating` integer DEFAULT 0 NOT NULL,
	`total_sales` integer DEFAULT 0 NOT NULL,
	`tax_status` text DEFAULT 'taxable' NOT NULL,
	`tax_class` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_meta_lookup_min_price_idx` ON `product_meta_lookup` (`min_price`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_max_price_idx` ON `product_meta_lookup` (`max_price`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_onsale_idx` ON `product_meta_lookup` (`onsale`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_stock_status_idx` ON `product_meta_lookup` (`stock_status`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_sku_idx` ON `product_meta_lookup` (`sku`);--> statement-breakpoint
CREATE TABLE `product_tag_map` (
	`product_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `tag_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `product_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_tag_map_tag_idx` ON `product_tag_map` (`tag_id`);--> statement-breakpoint
CREATE TABLE `product_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_tags_slug_uq` ON `product_tags` (`slug`);--> statement-breakpoint
CREATE TABLE `product_upsell_map` (
	`product_id` integer NOT NULL,
	`upsell_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `upsell_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`upsell_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_variation_attributes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variation_id` integer NOT NULL,
	`attribute_id` integer,
	`term_id` integer,
	`attribute_name` text NOT NULL,
	`attribute_value` text NOT NULL,
	FOREIGN KEY (`variation_id`) REFERENCES `product_variations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pva_variation_idx` ON `product_variation_attributes` (`variation_id`);--> statement-breakpoint
CREATE TABLE `product_variations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`sku` text,
	`regular_price` integer,
	`sale_price` integer,
	`price` integer,
	`date_on_sale_from` text,
	`date_on_sale_to` text,
	`stock_quantity` integer,
	`stock_status` text DEFAULT 'instock' NOT NULL,
	`weight` integer,
	`weight_unit` text,
	`length` integer,
	`width` integer,
	`height` integer,
	`dimensions_unit` text,
	`image_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`virtual` integer DEFAULT false NOT NULL,
	`downloadable` integer DEFAULT false NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`download_limit` integer,
	`download_expiry` integer,
	`manage_stock` text DEFAULT 'parent' NOT NULL,
	`backorders` text,
	`tax_status` text DEFAULT 'taxable' NOT NULL,
	`tax_class` text DEFAULT '' NOT NULL,
	`shipping_class_id` integer,
	`attributes` text DEFAULT '{}' NOT NULL,
	`downloads` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shipping_class_id`) REFERENCES `shipping_classes`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "product_variations_manage_stock_chk" CHECK("manage_stock" IN ('parent', 'yes', 'no'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variations_sku_uq` ON `product_variations` (`sku`);--> statement-breakpoint
CREATE INDEX `product_variations_product_idx` ON `product_variations` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text DEFAULT 'simple' NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`short_description` text DEFAULT '' NOT NULL,
	`sku` text,
	`global_unique_id` text,
	`regular_price` integer,
	`sale_price` integer,
	`price` integer,
	`date_on_sale_from` text,
	`date_on_sale_to` text,
	`status` text DEFAULT 'publish' NOT NULL,
	`catalog_visibility` text DEFAULT 'visible' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`virtual` integer DEFAULT false NOT NULL,
	`downloadable` integer DEFAULT false NOT NULL,
	`tax_status` text DEFAULT 'taxable' NOT NULL,
	`tax_class` text DEFAULT '' NOT NULL,
	`manage_stock` integer DEFAULT false NOT NULL,
	`stock_quantity` integer,
	`stock_status` text DEFAULT 'instock' NOT NULL,
	`backorders` text DEFAULT 'no' NOT NULL,
	`low_stock_amount` integer,
	`sold_individually` integer DEFAULT false NOT NULL,
	`weight` integer,
	`weight_unit` text,
	`length` integer,
	`width` integer,
	`height` integer,
	`dimensions_unit` text,
	`shipping_class_id` integer,
	`purchase_note` text DEFAULT '' NOT NULL,
	`menu_order` integer DEFAULT 0 NOT NULL,
	`post_password` text,
	`reviews_allowed` integer DEFAULT true NOT NULL,
	`parent_id` integer,
	`image_id` integer,
	`gallery_image_ids` text DEFAULT '[]' NOT NULL,
	`download_limit` integer DEFAULT -1 NOT NULL,
	`download_expiry` integer DEFAULT -1 NOT NULL,
	`total_sales` integer DEFAULT 0 NOT NULL,
	`average_rating` integer DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`rating_counts` text DEFAULT '{}' NOT NULL,
	`default_attributes` text DEFAULT '[]' NOT NULL,
	`attributes` text DEFAULT '[]' NOT NULL,
	`downloads` text DEFAULT '[]' NOT NULL,
	`external_url` text,
	`button_text` text,
	`date_created` text NOT NULL,
	`date_modified` text NOT NULL,
	FOREIGN KEY (`shipping_class_id`) REFERENCES `shipping_classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "products_type_chk" CHECK("type" IN ('simple', 'variable', 'grouped', 'external', 'virtual', 'downloadable')),
	CONSTRAINT "products_status_chk" CHECK("status" IN ('publish', 'draft', 'pending', 'private', 'trash')),
	CONSTRAINT "products_catalog_visibility_chk" CHECK("catalog_visibility" IN ('visible', 'catalog', 'search', 'hidden')),
	CONSTRAINT "products_stock_status_chk" CHECK("stock_status" IN ('instock', 'outofstock', 'onbackorder')),
	CONSTRAINT "products_backorders_chk" CHECK("backorders" IN ('no', 'yes', 'notify')),
	CONSTRAINT "products_tax_status_chk" CHECK("tax_status" IN ('taxable', 'shipping', 'none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_uq` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_uq` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`,`date_created`);--> statement-breakpoint
CREATE INDEX `products_type_idx` ON `products` (`type`);--> statement-breakpoint
CREATE INDEX `products_parent_idx` ON `products` (`parent_id`);--> statement-breakpoint
CREATE INDEX `products_shipping_class_idx` ON `products` (`shipping_class_id`);--> statement-breakpoint
CREATE INDEX `products_image_idx` ON `products` (`image_id`);--> statement-breakpoint
CREATE TABLE `queue_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue` text DEFAULT 'default' NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text NOT NULL,
	`reserved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `queue_jobs_queue_available_idx` ON `queue_jobs` (`queue`,`available_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`customer_id` integer,
	`rating` integer NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`verified_owner` integer DEFAULT false NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`author_email` text DEFAULT '' NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reviews_rating_chk" CHECK("rating" BETWEEN 1 AND 5),
	CONSTRAINT "reviews_status_chk" CHECK("status" IN ('pending', 'approved', 'spam', 'trash'))
);
--> statement-breakpoint
CREATE INDEX `reviews_product_status_idx` ON `reviews` (`product_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_key` text NOT NULL,
	`session_value` text NOT NULL,
	`session_expiry` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_key_uq` ON `sessions` (`session_key`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`session_expiry`);--> statement-breakpoint
CREATE TABLE `settings_boolean` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings_general` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings_integer` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings_json` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings_string` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipping_classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_classes_slug_uq` ON `shipping_classes` (`slug`);--> statement-breakpoint
CREATE TABLE `shipping_zone_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zone_id` integer NOT NULL,
	`location_code` text NOT NULL,
	`location_type` text NOT NULL,
	FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shipping_zone_locations_type_chk" CHECK("location_type" IN ('postcode', 'state', 'country', 'continent'))
);
--> statement-breakpoint
CREATE INDEX `shipping_zone_locations_zone_idx` ON `shipping_zone_locations` (`zone_id`);--> statement-breakpoint
CREATE INDEX `shipping_zone_locations_type_code_idx` ON `shipping_zone_locations` (`location_type`,`location_code`);--> statement-breakpoint
CREATE TABLE `shipping_zone_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zone_id` integer NOT NULL,
	`method_id` text NOT NULL,
	`method_order` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shipping_zone_methods_zone_idx` ON `shipping_zone_methods` (`zone_id`);--> statement-breakpoint
CREATE TABLE `shipping_zones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zone_name` text NOT NULL,
	`zone_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`context` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `system_log_level_idx` ON `system_log` (`level`,`created_at`);--> statement-breakpoint
CREATE TABLE `tax_classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_classes_slug_uq` ON `tax_classes` (`slug`);--> statement-breakpoint
CREATE TABLE `tax_rate_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_rate_id` integer NOT NULL,
	`location_code` text NOT NULL,
	`location_type` text NOT NULL,
	FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rates`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tax_rate_locations_type_chk" CHECK("location_type" IN ('postcode', 'state', 'country', 'continent', 'city'))
);
--> statement-breakpoint
CREATE INDEX `tax_rate_locations_rate_idx` ON `tax_rate_locations` (`tax_rate_id`);--> statement-breakpoint
CREATE INDEX `tax_rate_locations_code_idx` ON `tax_rate_locations` (`location_code`,`location_type`);--> statement-breakpoint
CREATE TABLE `tax_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_class_id` integer,
	`country` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`name` text DEFAULT 'Tax' NOT NULL,
	`rate` text DEFAULT '0.0000' NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`compound` integer DEFAULT false NOT NULL,
	`shipping` integer DEFAULT true NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tax_rates_country_idx` ON `tax_rates` (`country`);--> statement-breakpoint
CREATE INDEX `tax_rates_class_idx` ON `tax_rates` (`tax_class_id`);--> statement-breakpoint
CREATE INDEX `tax_rates_priority_idx` ON `tax_rates` (`priority`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`name` text NOT NULL,
	`user_id` integer,
	`delivery_url` text NOT NULL,
	`secret` text DEFAULT '' NOT NULL,
	`topic` text NOT NULL,
	`api_version` integer DEFAULT 3 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`pending_delivery` integer DEFAULT false NOT NULL,
	`date_created` text NOT NULL,
	`date_modified` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "webhooks_status_chk" CHECK("status" IN ('active', 'paused', 'disabled'))
);
--> statement-breakpoint
CREATE INDEX `webhooks_status_idx` ON `webhooks` (`status`);--> statement-breakpoint
CREATE INDEX `webhooks_topic_idx` ON `webhooks` (`topic`);