CREATE TABLE `admin_notes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(20) NOT NULL DEFAULT 'info',
	`source` varchar(200) NOT NULL DEFAULT 'spcnd-ecom',
	`title` text NOT NULL,
	`content` text,
	`is_snoozable` boolean NOT NULL DEFAULT false,
	`is_read` boolean NOT NULL DEFAULT false,
	`severity` varchar(20),
	`date_created` datetime(3) NOT NULL,
	CONSTRAINT `admin_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`description` varchar(200),
	`permissions` varchar(10) NOT NULL,
	`consumer_key` varchar(64) NOT NULL,
	`consumer_secret` varchar(43) NOT NULL,
	`truncated_key` varchar(7) NOT NULL,
	`last_access` datetime(3),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_consumer_key_uq` UNIQUE(`consumer_key`),
	CONSTRAINT `api_keys_permissions_chk` CHECK(`permissions` IN ('read', 'write', 'read_write'))
);
--> statement-breakpoint
CREATE TABLE `attribute_taxonomies` (
	`attribute_id` bigint AUTO_INCREMENT NOT NULL,
	`attribute_name` varchar(200) NOT NULL,
	`attribute_label` varchar(200),
	`attribute_type` varchar(20) NOT NULL DEFAULT 'select',
	`attribute_orderby` varchar(20) NOT NULL DEFAULT 'menu_order',
	`attribute_public` int NOT NULL DEFAULT 0,
	CONSTRAINT `attribute_taxonomies_attribute_id` PRIMARY KEY(`attribute_id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`customer_id` bigint NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_uq` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `category_lookup` (
	`category_id` bigint NOT NULL,
	`category_tree` text NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `category_lookup_category_id` PRIMARY KEY(`category_id`)
);
--> statement-breakpoint
CREATE TABLE `coupon_usage` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`coupon_id` bigint NOT NULL,
	`order_id` bigint NOT NULL,
	`customer_id` bigint,
	`used_by` varchar(320) NOT NULL DEFAULT '',
	`amount` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`date_created` datetime(3) NOT NULL,
	CONSTRAINT `coupon_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`code` varchar(200) NOT NULL,
	`amount` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`status` varchar(20) NOT NULL DEFAULT 'publish',
	`description` text NOT NULL,
	`discount_type` varchar(30) NOT NULL DEFAULT 'fixed_cart',
	`date_expires` datetime(3),
	`usage_count` int NOT NULL DEFAULT 0,
	`individual_use` boolean NOT NULL DEFAULT false,
	`usage_limit` int,
	`usage_limit_per_user` int,
	`limit_usage_to_x_items` int,
	`free_shipping` boolean NOT NULL DEFAULT false,
	`exclude_sale_items` boolean NOT NULL DEFAULT false,
	`minimum_amount` decimal(19,4),
	`maximum_amount` decimal(19,4),
	`email_restrictions` json NOT NULL,
	`product_ids` json NOT NULL,
	`excluded_product_ids` json NOT NULL,
	`product_categories` json NOT NULL,
	`excluded_product_categories` json NOT NULL,
	`date_created` datetime(3) NOT NULL,
	`date_modified` datetime(3) NOT NULL,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_uq` UNIQUE(`code`),
	CONSTRAINT `coupons_discount_type_chk` CHECK(`discount_type` IN ('fixed_cart', 'percent', 'fixed_product'))
);
--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`customer_id` bigint NOT NULL,
	`type` varchar(20) NOT NULL,
	`first_name` varchar(255) NOT NULL DEFAULT '',
	`last_name` varchar(255) NOT NULL DEFAULT '',
	`company` varchar(255) NOT NULL DEFAULT '',
	`address_1` varchar(255) NOT NULL DEFAULT '',
	`address_2` varchar(255) NOT NULL DEFAULT '',
	`city` varchar(255) NOT NULL DEFAULT '',
	`state` varchar(255) NOT NULL DEFAULT '',
	`postcode` varchar(20) NOT NULL DEFAULT '',
	`country` varchar(20) NOT NULL DEFAULT '',
	`email` varchar(320),
	`phone` varchar(100) NOT NULL DEFAULT '',
	CONSTRAINT `customer_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_addresses_customer_type_uq` UNIQUE(`customer_id`,`type`),
	CONSTRAINT `customer_addresses_type_chk` CHECK(`type` IN ('billing', 'shipping'))
);
--> statement-breakpoint
CREATE TABLE `customer_lookup` (
	`customer_id` bigint NOT NULL,
	`username` varchar(60) NOT NULL DEFAULT '',
	`first_name` varchar(255) NOT NULL DEFAULT '',
	`last_name` varchar(255) NOT NULL DEFAULT '',
	`email` varchar(320) NOT NULL DEFAULT '',
	`country` varchar(20) NOT NULL DEFAULT '',
	`city` varchar(255) NOT NULL DEFAULT '',
	`state` varchar(255) NOT NULL DEFAULT '',
	`postcode` varchar(20) NOT NULL DEFAULT '',
	`total_spent` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`order_count` int NOT NULL DEFAULT 0,
	`avg_order_value` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`date_registered` datetime(3),
	`date_last_active` datetime(3),
	CONSTRAINT `customer_lookup_customer_id` PRIMARY KEY(`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `customer_meta` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`customer_id` bigint NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text,
	CONSTRAINT `customer_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`email` varchar(200) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`first_name` varchar(200) NOT NULL DEFAULT '',
	`last_name` varchar(200) NOT NULL DEFAULT '',
	`display_name` varchar(200) NOT NULL DEFAULT '',
	`username` varchar(60),
	`role` varchar(50) NOT NULL DEFAULT 'customer',
	`is_paying_customer` boolean NOT NULL DEFAULT false,
	`total_spent` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`order_count` int NOT NULL DEFAULT 0,
	`date_created` datetime(3) NOT NULL,
	`date_modified` datetime(3) NOT NULL,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_email_uq` UNIQUE(`email`),
	CONSTRAINT `customers_role_chk` CHECK(`role` IN ('customer', 'shop_manager', 'admin'))
);
--> statement-breakpoint
CREATE TABLE `download_permissions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`download_id` varchar(36) NOT NULL,
	`product_id` bigint NOT NULL,
	`order_id` bigint NOT NULL,
	`order_key` varchar(22) NOT NULL,
	`user_id` bigint,
	`user_email` varchar(320) NOT NULL,
	`downloads_remaining` int,
	`access_granted` datetime(3) NOT NULL,
	`access_expires` datetime(3),
	`download_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `download_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`url` text NOT NULL,
	`alt` varchar(500),
	`name` varchar(500),
	`mime_type` varchar(100),
	`source` varchar(50) NOT NULL DEFAULT 'local',
	`source_id` varchar(255),
	`width` int,
	`height` int,
	`file_size` bigint,
	`date_created` datetime(3) NOT NULL,
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_source_chk` CHECK(`source` IN ('local', 's3', 'r2', 'external'))
);
--> statement-breakpoint
CREATE TABLE `media_links` (
	`media_id` bigint NOT NULL,
	`owner_type` varchar(50) NOT NULL,
	`owner_id` bigint NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `media_links_media_id_owner_type_owner_id_pk` PRIMARY KEY(`media_id`,`owner_type`,`owner_id`)
);
--> statement-breakpoint
CREATE TABLE `order_coupon_lookup` (
	`order_id` bigint NOT NULL,
	`coupon_id` bigint NOT NULL,
	`date_created` datetime(3) NOT NULL,
	`discount_amount` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`discount_amount_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	CONSTRAINT `order_coupon_lookup_order_id_coupon_id_pk` PRIMARY KEY(`order_id`,`coupon_id`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`payload` json,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_events_order_event_uq` UNIQUE(`order_id`,`event_type`)
);
--> statement-breakpoint
CREATE TABLE `order_item_meta` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_item_id` bigint NOT NULL,
	`key` varchar(255),
	`value` text,
	CONSTRAINT `order_item_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`name` text NOT NULL,
	`type` varchar(200) NOT NULL,
	`product_id` bigint,
	`variation_id` bigint,
	`quantity` int,
	`subtotal` decimal(19,4),
	`total` decimal(19,4),
	`subtotal_tax` decimal(19,4),
	`total_tax` decimal(19,4),
	`tax_class` varchar(200),
	`tax_status` varchar(20),
	`taxes` json,
	`meta_data` json,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_items_type_chk` CHECK(`type` IN ('line_item', 'fee', 'shipping', 'tax', 'coupon'))
);
--> statement-breakpoint
CREATE TABLE `order_meta` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text,
	CONSTRAINT `order_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_notes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`note` text NOT NULL,
	`type` varchar(20) NOT NULL DEFAULT 'private',
	`created_by` varchar(200),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `order_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_notes_type_chk` CHECK(`type` IN ('private', 'customer', 'system'))
);
--> statement-breakpoint
CREATE TABLE `order_product_lookup` (
	`order_item_id` bigint NOT NULL,
	`order_id` bigint NOT NULL,
	`product_id` bigint NOT NULL,
	`variation_id` bigint,
	`customer_id` bigint,
	`qty` int NOT NULL DEFAULT 0,
	`total_sales` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`tax_total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`shipping_total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`coupon_amount` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`date_created` datetime(3) NOT NULL,
	CONSTRAINT `order_product_lookup_order_item_id` PRIMARY KEY(`order_item_id`)
);
--> statement-breakpoint
CREATE TABLE `order_refunds` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`order_id` bigint NOT NULL,
	`amount` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`reason` text,
	`refunded_by` bigint,
	`refunded_payment` boolean NOT NULL DEFAULT false,
	`line_items` json NOT NULL,
	`date_created` datetime(3) NOT NULL,
	CONSTRAINT `order_refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_stats` (
	`order_id` bigint NOT NULL,
	`parent_id` bigint,
	`status` varchar(20) NOT NULL,
	`total_sales` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`tax_total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`shipping_total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`net_total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`returning_customer` boolean NOT NULL DEFAULT false,
	`customer_id` bigint,
	`num_items_sold` int NOT NULL DEFAULT 0,
	`date_created` datetime(3) NOT NULL,
	`date_paid` datetime(3),
	CONSTRAINT `order_stats_order_id` PRIMARY KEY(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `order_tax_lookup` (
	`order_id` bigint NOT NULL,
	`tax_rate_id` bigint NOT NULL,
	`date_created` datetime(3) NOT NULL,
	`shipping_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`order_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`total_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	CONSTRAINT `order_tax_lookup_order_id_tax_rate_id_pk` PRIMARY KEY(`order_id`,`tax_rate_id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`prices_include_tax` boolean NOT NULL DEFAULT false,
	`date_created` datetime(3) NOT NULL,
	`date_modified` datetime(3) NOT NULL,
	`date_paid` datetime(3),
	`date_completed` datetime(3),
	`discount_total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`discount_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`shipping_total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`shipping_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`cart_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`total` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`total_tax` decimal(19,4) NOT NULL DEFAULT '0.0000',
	`customer_id` bigint,
	`order_key` varchar(22) NOT NULL,
	`billing_first_name` varchar(255) NOT NULL DEFAULT '',
	`billing_last_name` varchar(255) NOT NULL DEFAULT '',
	`billing_company` varchar(255) NOT NULL DEFAULT '',
	`billing_address_1` varchar(255) NOT NULL DEFAULT '',
	`billing_address_2` varchar(255) NOT NULL DEFAULT '',
	`billing_city` varchar(255) NOT NULL DEFAULT '',
	`billing_state` varchar(255) NOT NULL DEFAULT '',
	`billing_postcode` varchar(20) NOT NULL DEFAULT '',
	`billing_country` varchar(20) NOT NULL DEFAULT '',
	`billing_email` varchar(320) NOT NULL DEFAULT '',
	`billing_phone` varchar(100) NOT NULL DEFAULT '',
	`shipping_first_name` varchar(255) NOT NULL DEFAULT '',
	`shipping_last_name` varchar(255) NOT NULL DEFAULT '',
	`shipping_company` varchar(255) NOT NULL DEFAULT '',
	`shipping_address_1` varchar(255) NOT NULL DEFAULT '',
	`shipping_address_2` varchar(255) NOT NULL DEFAULT '',
	`shipping_city` varchar(255) NOT NULL DEFAULT '',
	`shipping_state` varchar(255) NOT NULL DEFAULT '',
	`shipping_postcode` varchar(20) NOT NULL DEFAULT '',
	`shipping_country` varchar(20) NOT NULL DEFAULT '',
	`shipping_phone` varchar(100) NOT NULL DEFAULT '',
	`payment_method` varchar(200) NOT NULL DEFAULT '',
	`payment_method_title` varchar(500) NOT NULL DEFAULT '',
	`transaction_id` varchar(200),
	`customer_ip_address` varchar(45),
	`customer_user_agent` text,
	`created_via` varchar(200),
	`customer_note` text,
	`parent_id` bigint,
	`cart_hash` varchar(32),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_key_uq` UNIQUE(`order_key`),
	CONSTRAINT `orders_status_chk` CHECK(`status` IN ('pending', 'failed', 'on-hold', 'processing', 'completed', 'cancelled', 'refunded', 'draft', 'auto-draft', 'checkout-draft', 'trash'))
);
--> statement-breakpoint
CREATE TABLE `payment_token_meta` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`token_id` bigint NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text,
	CONSTRAINT `payment_token_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_tokens` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`gateway` varchar(200) NOT NULL,
	`token` text NOT NULL,
	`type` varchar(50) NOT NULL DEFAULT 'CC',
	`last4` varchar(4),
	`expiry` varchar(7),
	`card_type` varchar(50),
	`is_default` boolean NOT NULL DEFAULT false,
	`date_created` datetime(3) NOT NULL,
	CONSTRAINT `payment_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_attribute_terms` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`attribute_id` bigint NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_attribute_terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_attribute_terms_attr_slug_uq` UNIQUE(`attribute_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`type` varchar(20) NOT NULL DEFAULT 'select',
	`order_by` varchar(20) NOT NULL DEFAULT 'menu_order',
	`has_archives` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_attributes_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_attributes_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_attributes_lookup` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`attribute_id` bigint NOT NULL,
	`term_id` bigint NOT NULL,
	`is_variation` boolean NOT NULL DEFAULT false,
	CONSTRAINT `product_attributes_lookup_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`parent_id` bigint,
	`thumbnail_id` bigint,
	`display_type` varchar(20) NOT NULL DEFAULT 'default',
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_categories_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_category_map` (
	`product_id` bigint NOT NULL,
	`category_id` bigint NOT NULL,
	CONSTRAINT `product_category_map_product_id_category_id_pk` PRIMARY KEY(`product_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `product_crosssell_map` (
	`product_id` bigint NOT NULL,
	`crosssell_id` bigint NOT NULL,
	CONSTRAINT `product_crosssell_map_product_id_crosssell_id_pk` PRIMARY KEY(`product_id`,`crosssell_id`)
);
--> statement-breakpoint
CREATE TABLE `product_downloads` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`variation_id` bigint,
	`download_id` varchar(36) NOT NULL,
	`name` varchar(500) NOT NULL,
	`file_url` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_downloads_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_downloads_download_id_uq` UNIQUE(`download_id`)
);
--> statement-breakpoint
CREATE TABLE `product_grouped_map` (
	`group_id` bigint NOT NULL,
	`product_id` bigint NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_grouped_map_group_id_product_id_pk` PRIMARY KEY(`group_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `product_meta` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text,
	CONSTRAINT `product_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_meta_lookup` (
	`product_id` bigint NOT NULL,
	`sku` varchar(100),
	`global_unique_id` varchar(100),
	`virtual` boolean NOT NULL DEFAULT false,
	`downloadable` boolean NOT NULL DEFAULT false,
	`min_price` decimal(19,4),
	`max_price` decimal(19,4),
	`onsale` boolean NOT NULL DEFAULT false,
	`stock_quantity` decimal(12, 3),
	`stock_status` varchar(100) NOT NULL DEFAULT 'instock',
	`rating_count` bigint NOT NULL DEFAULT 0,
	`average_rating` decimal(3, 2) NOT NULL DEFAULT 0,
	`total_sales` bigint NOT NULL DEFAULT 0,
	`tax_status` varchar(100) NOT NULL DEFAULT 'taxable',
	`tax_class` varchar(100) NOT NULL DEFAULT '',
	CONSTRAINT `product_meta_lookup_product_id` PRIMARY KEY(`product_id`)
);
--> statement-breakpoint
CREATE TABLE `product_tag_map` (
	`product_id` bigint NOT NULL,
	`tag_id` bigint NOT NULL,
	CONSTRAINT `product_tag_map_product_id_tag_id_pk` PRIMARY KEY(`product_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `product_tags` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `product_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_tags_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_upsell_map` (
	`product_id` bigint NOT NULL,
	`upsell_id` bigint NOT NULL,
	CONSTRAINT `product_upsell_map_product_id_upsell_id_pk` PRIMARY KEY(`product_id`,`upsell_id`)
);
--> statement-breakpoint
CREATE TABLE `product_variation_attributes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`variation_id` bigint NOT NULL,
	`attribute_id` bigint,
	`term_id` bigint,
	`attribute_name` varchar(200) NOT NULL,
	`attribute_value` varchar(500) NOT NULL,
	CONSTRAINT `product_variation_attributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`sku` varchar(100),
	`regular_price` decimal(19,4),
	`sale_price` decimal(19,4),
	`price` decimal(19,4),
	`date_on_sale_from` datetime(3),
	`date_on_sale_to` datetime(3),
	`stock_quantity` decimal(12, 3),
	`stock_status` varchar(20) NOT NULL DEFAULT 'instock',
	`weight` decimal(12, 3),
	`weight_unit` varchar(2),
	`length` decimal(12, 3),
	`width` decimal(12, 3),
	`height` decimal(12, 3),
	`dimensions_unit` varchar(2),
	`image_id` bigint,
	`sort_order` int NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`virtual` boolean NOT NULL DEFAULT false,
	`downloadable` boolean NOT NULL DEFAULT false,
	`description` text NOT NULL,
	`download_limit` int,
	`download_expiry` int,
	`manage_stock` varchar(10) NOT NULL DEFAULT 'parent',
	`backorders` varchar(10),
	`tax_status` varchar(20) NOT NULL DEFAULT 'taxable',
	`tax_class` varchar(200) NOT NULL DEFAULT '',
	`shipping_class_id` bigint,
	`attributes` json NOT NULL,
	`downloads` json NOT NULL,
	CONSTRAINT `product_variations_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_variations_sku_uq` UNIQUE(`sku`),
	CONSTRAINT `product_variations_manage_stock_chk` CHECK(`manage_stock` IN ('parent', 'yes', 'no'))
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`type` varchar(50) NOT NULL DEFAULT 'simple',
	`name` varchar(500) NOT NULL,
	`slug` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`short_description` text NOT NULL,
	`sku` varchar(100),
	`global_unique_id` varchar(100),
	`regular_price` decimal(19,4),
	`sale_price` decimal(19,4),
	`price` decimal(19,4),
	`date_on_sale_from` datetime(3),
	`date_on_sale_to` datetime(3),
	`status` varchar(20) NOT NULL DEFAULT 'publish',
	`catalog_visibility` varchar(20) NOT NULL DEFAULT 'visible',
	`featured` boolean NOT NULL DEFAULT false,
	`virtual` boolean NOT NULL DEFAULT false,
	`downloadable` boolean NOT NULL DEFAULT false,
	`tax_status` varchar(20) NOT NULL DEFAULT 'taxable',
	`tax_class` varchar(200) NOT NULL DEFAULT '',
	`manage_stock` boolean NOT NULL DEFAULT false,
	`stock_quantity` decimal(12, 3),
	`stock_status` varchar(20) NOT NULL DEFAULT 'instock',
	`backorders` varchar(10) NOT NULL DEFAULT 'no',
	`low_stock_amount` int,
	`sold_individually` boolean NOT NULL DEFAULT false,
	`weight` decimal(12, 3),
	`weight_unit` varchar(2),
	`length` decimal(12, 3),
	`width` decimal(12, 3),
	`height` decimal(12, 3),
	`dimensions_unit` varchar(2),
	`shipping_class_id` bigint,
	`purchase_note` text NOT NULL,
	`menu_order` int NOT NULL DEFAULT 0,
	`post_password` varchar(255),
	`reviews_allowed` boolean NOT NULL DEFAULT true,
	`parent_id` bigint,
	`image_id` bigint,
	`gallery_image_ids` json NOT NULL,
	`download_limit` int NOT NULL DEFAULT -1,
	`download_expiry` int NOT NULL DEFAULT -1,
	`total_sales` bigint NOT NULL DEFAULT 0,
	`average_rating` decimal(3, 2) NOT NULL DEFAULT 0,
	`review_count` int NOT NULL DEFAULT 0,
	`rating_counts` json NOT NULL,
	`default_attributes` json NOT NULL,
	`attributes` json NOT NULL,
	`downloads` json NOT NULL,
	`external_url` varchar(500),
	`button_text` varchar(200),
	`date_created` datetime(3) NOT NULL,
	`date_modified` datetime(3) NOT NULL,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `products_sku_uq` UNIQUE(`sku`),
	CONSTRAINT `products_type_chk` CHECK(`type` IN ('simple', 'variable', 'grouped', 'external', 'virtual', 'downloadable')),
	CONSTRAINT `products_status_chk` CHECK(`status` IN ('publish', 'draft', 'pending', 'private', 'trash')),
	CONSTRAINT `products_catalog_visibility_chk` CHECK(`catalog_visibility` IN ('visible', 'catalog', 'search', 'hidden')),
	CONSTRAINT `products_stock_status_chk` CHECK(`stock_status` IN ('instock', 'outofstock', 'onbackorder')),
	CONSTRAINT `products_backorders_chk` CHECK(`backorders` IN ('no', 'yes', 'notify')),
	CONSTRAINT `products_tax_status_chk` CHECK(`tax_status` IN ('taxable', 'shipping', 'none'))
);
--> statement-breakpoint
CREATE TABLE `queue_jobs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`queue` varchar(100) NOT NULL DEFAULT 'default',
	`payload` json NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`available_at` datetime(3) NOT NULL,
	`reserved_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `queue_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`customer_id` bigint,
	`rating` int NOT NULL,
	`content` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`verified_owner` boolean NOT NULL DEFAULT false,
	`author_name` varchar(200) NOT NULL DEFAULT '',
	`author_email` varchar(320) NOT NULL DEFAULT '',
	`date_created` datetime(3) NOT NULL,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_rating_chk` CHECK(`rating` BETWEEN 1 AND 5),
	CONSTRAINT `reviews_status_chk` CHECK(`status` IN ('pending', 'approved', 'spam', 'trash'))
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`session_key` varchar(64) NOT NULL,
	`session_value` text NOT NULL,
	`session_expiry` bigint NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_session_key_uq` UNIQUE(`session_key`)
);
--> statement-breakpoint
CREATE TABLE `settings_boolean` (
	`key` varchar(255) NOT NULL,
	`value` boolean NOT NULL,
	CONSTRAINT `settings_boolean_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `settings_general` (
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `settings_general_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `settings_integer` (
	`key` varchar(255) NOT NULL,
	`value` bigint NOT NULL,
	CONSTRAINT `settings_integer_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `settings_json` (
	`key` varchar(255) NOT NULL,
	`value` json NOT NULL,
	CONSTRAINT `settings_json_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `settings_string` (
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `settings_string_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `shipping_classes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `shipping_classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_classes_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `shipping_zone_locations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`zone_id` bigint NOT NULL,
	`location_code` varchar(200) NOT NULL,
	`location_type` varchar(40) NOT NULL,
	CONSTRAINT `shipping_zone_locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_zone_locations_type_chk` CHECK(`location_type` IN ('postcode', 'state', 'country', 'continent'))
);
--> statement-breakpoint
CREATE TABLE `shipping_zone_methods` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`zone_id` bigint NOT NULL,
	`method_id` varchar(200) NOT NULL,
	`method_order` int NOT NULL DEFAULT 0,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`settings` json NOT NULL,
	CONSTRAINT `shipping_zone_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipping_zones` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`zone_name` varchar(200) NOT NULL,
	`zone_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `shipping_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`level` varchar(20) NOT NULL,
	`source` varchar(200) NOT NULL DEFAULT '',
	`message` text NOT NULL,
	`context` json,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `system_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tax_classes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	CONSTRAINT `tax_classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_classes_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `tax_rate_locations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tax_rate_id` bigint NOT NULL,
	`location_code` varchar(200) NOT NULL,
	`location_type` varchar(40) NOT NULL,
	CONSTRAINT `tax_rate_locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_rate_locations_type_chk` CHECK(`location_type` IN ('postcode', 'state', 'country', 'continent', 'city'))
);
--> statement-breakpoint
CREATE TABLE `tax_rates` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tax_class_id` bigint,
	`country` varchar(2) NOT NULL DEFAULT '',
	`state` varchar(200) NOT NULL DEFAULT '',
	`name` varchar(200) NOT NULL DEFAULT 'Tax',
	`rate` varchar(20) NOT NULL DEFAULT '0.0000',
	`priority` int NOT NULL DEFAULT 1,
	`compound` boolean NOT NULL DEFAULT false,
	`shipping` boolean NOT NULL DEFAULT true,
	`order` int NOT NULL DEFAULT 0,
	CONSTRAINT `tax_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`name` varchar(200) NOT NULL,
	`user_id` bigint,
	`delivery_url` text NOT NULL,
	`secret` varchar(255) NOT NULL DEFAULT '',
	`topic` varchar(200) NOT NULL,
	`api_version` int NOT NULL DEFAULT 3,
	`failure_count` int NOT NULL DEFAULT 0,
	`pending_delivery` boolean NOT NULL DEFAULT false,
	`date_created` datetime(3) NOT NULL,
	`date_modified` datetime(3) NOT NULL,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhooks_status_chk` CHECK(`status` IN ('active', 'paused', 'disabled'))
);
--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_id_customers_id_fk` FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category_lookup` ADD CONSTRAINT `category_lookup_category_id_product_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupon_usage` ADD CONSTRAINT `coupon_usage_coupon_id_coupons_id_fk` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupon_usage` ADD CONSTRAINT `coupon_usage_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupon_usage` ADD CONSTRAINT `coupon_usage_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_lookup` ADD CONSTRAINT `customer_lookup_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_meta` ADD CONSTRAINT `customer_meta_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `download_permissions` ADD CONSTRAINT `download_permissions_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `download_permissions` ADD CONSTRAINT `download_permissions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `download_permissions` ADD CONSTRAINT `download_permissions_user_id_customers_id_fk` FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_links` ADD CONSTRAINT `media_links_media_id_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_coupon_lookup` ADD CONSTRAINT `order_coupon_lookup_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_item_meta` ADD CONSTRAINT `order_item_meta_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variation_id_product_variations_id_fk` FOREIGN KEY (`variation_id`) REFERENCES `product_variations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_meta` ADD CONSTRAINT `order_meta_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_notes` ADD CONSTRAINT `order_notes_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_product_lookup` ADD CONSTRAINT `order_product_lookup_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_product_lookup` ADD CONSTRAINT `order_product_lookup_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_product_lookup` ADD CONSTRAINT `order_product_lookup_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_refunds` ADD CONSTRAINT `order_refunds_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_refunds` ADD CONSTRAINT `order_refunds_refunded_by_customers_id_fk` FOREIGN KEY (`refunded_by`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_stats` ADD CONSTRAINT `order_stats_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_stats` ADD CONSTRAINT `order_stats_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_tax_lookup` ADD CONSTRAINT `order_tax_lookup_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_parent_id_orders_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_token_meta` ADD CONSTRAINT `payment_token_meta_token_id_payment_tokens_id_fk` FOREIGN KEY (`token_id`) REFERENCES `payment_tokens`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_tokens` ADD CONSTRAINT `payment_tokens_user_id_customers_id_fk` FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_attribute_terms` ADD CONSTRAINT `product_attribute_terms_attribute_id_product_attributes_id_fk` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_attributes_lookup` ADD CONSTRAINT `product_attributes_lookup_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_parent_id_product_categories_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `product_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_thumbnail_id_media_id_fk` FOREIGN KEY (`thumbnail_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_category_map` ADD CONSTRAINT `product_category_map_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_category_map` ADD CONSTRAINT `product_category_map_category_id_product_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_crosssell_map` ADD CONSTRAINT `product_crosssell_map_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_crosssell_map` ADD CONSTRAINT `product_crosssell_map_crosssell_id_products_id_fk` FOREIGN KEY (`crosssell_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_downloads` ADD CONSTRAINT `product_downloads_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_downloads` ADD CONSTRAINT `product_downloads_variation_id_product_variations_id_fk` FOREIGN KEY (`variation_id`) REFERENCES `product_variations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_grouped_map` ADD CONSTRAINT `product_grouped_map_group_id_products_id_fk` FOREIGN KEY (`group_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_grouped_map` ADD CONSTRAINT `product_grouped_map_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_meta` ADD CONSTRAINT `product_meta_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_meta_lookup` ADD CONSTRAINT `product_meta_lookup_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_tag_map` ADD CONSTRAINT `product_tag_map_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_tag_map` ADD CONSTRAINT `product_tag_map_tag_id_product_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `product_tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_upsell_map` ADD CONSTRAINT `product_upsell_map_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_upsell_map` ADD CONSTRAINT `product_upsell_map_upsell_id_products_id_fk` FOREIGN KEY (`upsell_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variation_attributes` ADD CONSTRAINT `product_variation_attributes_variation_id_product_variations_id_fk` FOREIGN KEY (`variation_id`) REFERENCES `product_variations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variations` ADD CONSTRAINT `product_variations_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variations` ADD CONSTRAINT `product_variations_image_id_media_id_fk` FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variations` ADD CONSTRAINT `product_variations_shipping_class_id_shipping_classes_id_fk` FOREIGN KEY (`shipping_class_id`) REFERENCES `shipping_classes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_shipping_class_id_shipping_classes_id_fk` FOREIGN KEY (`shipping_class_id`) REFERENCES `shipping_classes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_parent_id_products_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_image_id_media_id_fk` FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipping_zone_locations` ADD CONSTRAINT `shipping_zone_locations_zone_id_shipping_zones_id_fk` FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipping_zone_methods` ADD CONSTRAINT `shipping_zone_methods_zone_id_shipping_zones_id_fk` FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_rate_locations` ADD CONSTRAINT `tax_rate_locations_tax_rate_id_tax_rates_id_fk` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_rates` ADD CONSTRAINT `tax_rates_tax_class_id_tax_classes_id_fk` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_user_id_customers_id_fk` FOREIGN KEY (`user_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_sessions_customer_idx` ON `auth_sessions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `coupon_usage_coupon_idx` ON `coupon_usage` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `coupon_usage_order_idx` ON `coupon_usage` (`order_id`);--> statement-breakpoint
CREATE INDEX `coupon_usage_used_by_idx` ON `coupon_usage` (`used_by`);--> statement-breakpoint
CREATE INDEX `customer_lookup_email_idx` ON `customer_lookup` (`email`);--> statement-breakpoint
CREATE INDEX `customer_meta_owner_key_idx` ON `customer_meta` (`customer_id`,`key`);--> statement-breakpoint
CREATE INDEX `customer_meta_key_idx` ON `customer_meta` (`key`);--> statement-breakpoint
CREATE INDEX `customers_username_idx` ON `customers` (`username`);--> statement-breakpoint
CREATE INDEX `download_permissions_order_idx` ON `download_permissions` (`order_id`);--> statement-breakpoint
CREATE INDEX `download_permissions_email_order_key_idx` ON `download_permissions` (`user_email`,`order_key`);--> statement-breakpoint
CREATE INDEX `download_permissions_user_idx` ON `download_permissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `media_links_owner_idx` ON `media_links` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `order_coupon_lookup_coupon_idx` ON `order_coupon_lookup` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `order_item_meta_owner_key_idx` ON `order_item_meta` (`order_item_id`,`key`);--> statement-breakpoint
CREATE INDEX `order_item_meta_key_idx` ON `order_item_meta` (`key`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`,`type`);--> statement-breakpoint
CREATE INDEX `order_items_product_idx` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `order_meta_owner_key_idx` ON `order_meta` (`order_id`,`key`);--> statement-breakpoint
CREATE INDEX `order_meta_key_idx` ON `order_meta` (`key`);--> statement-breakpoint
CREATE INDEX `order_notes_order_idx` ON `order_notes` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_product_lookup_order_idx` ON `order_product_lookup` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_product_lookup_product_idx` ON `order_product_lookup` (`product_id`);--> statement-breakpoint
CREATE INDEX `order_product_lookup_date_idx` ON `order_product_lookup` (`date_created`);--> statement-breakpoint
CREATE INDEX `order_refunds_order_idx` ON `order_refunds` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_stats_date_idx` ON `order_stats` (`date_created`);--> statement-breakpoint
CREATE INDEX `order_stats_customer_idx` ON `order_stats` (`customer_id`);--> statement-breakpoint
CREATE INDEX `order_stats_status_idx` ON `order_stats` (`status`);--> statement-breakpoint
CREATE INDEX `order_tax_lookup_rate_idx` ON `order_tax_lookup` (`tax_rate_id`);--> statement-breakpoint
CREATE INDEX `orders_status_date_idx` ON `orders` (`status`,`date_created`);--> statement-breakpoint
CREATE INDEX `orders_customer_date_idx` ON `orders` (`customer_id`,`date_created`);--> statement-breakpoint
CREATE INDEX `orders_parent_idx` ON `orders` (`parent_id`);--> statement-breakpoint
CREATE INDEX `orders_billing_email_idx` ON `orders` (`billing_email`);--> statement-breakpoint
CREATE INDEX `payment_token_meta_owner_key_idx` ON `payment_token_meta` (`token_id`,`key`);--> statement-breakpoint
CREATE INDEX `payment_tokens_user_idx` ON `payment_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `product_attribute_terms_attr_idx` ON `product_attribute_terms` (`attribute_id`);--> statement-breakpoint
CREATE INDEX `product_attributes_lookup_product_idx` ON `product_attributes_lookup` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_attributes_lookup_term_idx` ON `product_attributes_lookup` (`attribute_id`,`term_id`);--> statement-breakpoint
CREATE INDEX `product_categories_parent_idx` ON `product_categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `product_category_map_category_idx` ON `product_category_map` (`category_id`);--> statement-breakpoint
CREATE INDEX `product_downloads_product_idx` ON `product_downloads` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_meta_owner_key_idx` ON `product_meta` (`product_id`,`key`);--> statement-breakpoint
CREATE INDEX `product_meta_key_idx` ON `product_meta` (`key`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_min_price_idx` ON `product_meta_lookup` (`min_price`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_max_price_idx` ON `product_meta_lookup` (`max_price`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_onsale_idx` ON `product_meta_lookup` (`onsale`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_stock_status_idx` ON `product_meta_lookup` (`stock_status`);--> statement-breakpoint
CREATE INDEX `product_meta_lookup_sku_idx` ON `product_meta_lookup` (`sku`);--> statement-breakpoint
CREATE INDEX `product_tag_map_tag_idx` ON `product_tag_map` (`tag_id`);--> statement-breakpoint
CREATE INDEX `pva_variation_idx` ON `product_variation_attributes` (`variation_id`);--> statement-breakpoint
CREATE INDEX `product_variations_product_idx` ON `product_variations` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`,`date_created`);--> statement-breakpoint
CREATE INDEX `products_type_idx` ON `products` (`type`);--> statement-breakpoint
CREATE INDEX `products_parent_idx` ON `products` (`parent_id`);--> statement-breakpoint
CREATE INDEX `products_shipping_class_idx` ON `products` (`shipping_class_id`);--> statement-breakpoint
CREATE INDEX `products_image_idx` ON `products` (`image_id`);--> statement-breakpoint
CREATE INDEX `queue_jobs_queue_available_idx` ON `queue_jobs` (`queue`,`available_at`);--> statement-breakpoint
CREATE INDEX `reviews_product_status_idx` ON `reviews` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`session_expiry`);--> statement-breakpoint
CREATE INDEX `shipping_zone_locations_zone_idx` ON `shipping_zone_locations` (`zone_id`);--> statement-breakpoint
CREATE INDEX `shipping_zone_locations_type_code_idx` ON `shipping_zone_locations` (`location_type`,`location_code`);--> statement-breakpoint
CREATE INDEX `shipping_zone_methods_zone_idx` ON `shipping_zone_methods` (`zone_id`);--> statement-breakpoint
CREATE INDEX `system_log_level_idx` ON `system_log` (`level`,`created_at`);--> statement-breakpoint
CREATE INDEX `tax_rate_locations_rate_idx` ON `tax_rate_locations` (`tax_rate_id`);--> statement-breakpoint
CREATE INDEX `tax_rate_locations_code_idx` ON `tax_rate_locations` (`location_code`,`location_type`);--> statement-breakpoint
CREATE INDEX `tax_rates_country_idx` ON `tax_rates` (`country`);--> statement-breakpoint
CREATE INDEX `tax_rates_class_idx` ON `tax_rates` (`tax_class_id`);--> statement-breakpoint
CREATE INDEX `tax_rates_priority_idx` ON `tax_rates` (`priority`);--> statement-breakpoint
CREATE INDEX `webhooks_status_idx` ON `webhooks` (`status`);--> statement-breakpoint
CREATE INDEX `webhooks_topic_idx` ON `webhooks` (`topic`);