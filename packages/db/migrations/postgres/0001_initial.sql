CREATE TABLE "admin_notes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"source" text DEFAULT 'spcnd-ecom' NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"is_snoozable" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"severity" text,
	"date_created" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"description" text,
	"permissions" text NOT NULL,
	"consumer_key" text NOT NULL,
	"consumer_secret" text NOT NULL,
	"truncated_key" text NOT NULL,
	"last_access" timestamp with time zone,
	CONSTRAINT "api_keys_permissions_chk" CHECK ("permissions" IN ('read', 'write', 'read_write'))
);
--> statement-breakpoint
CREATE TABLE "attribute_taxonomies" (
	"attribute_id" bigserial PRIMARY KEY NOT NULL,
	"attribute_name" text NOT NULL,
	"attribute_label" text,
	"attribute_type" text DEFAULT 'select' NOT NULL,
	"attribute_orderby" text DEFAULT 'menu_order' NOT NULL,
	"attribute_public" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_lookup" (
	"category_id" bigint PRIMARY KEY NOT NULL,
	"category_tree" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"coupon_id" bigint NOT NULL,
	"order_id" bigint NOT NULL,
	"customer_id" bigint,
	"used_by" text DEFAULT '' NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"date_created" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"status" text DEFAULT 'publish' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"discount_type" text DEFAULT 'fixed_cart' NOT NULL,
	"date_expires" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"individual_use" boolean DEFAULT false NOT NULL,
	"usage_limit" integer,
	"usage_limit_per_user" integer,
	"limit_usage_to_x_items" integer,
	"free_shipping" boolean DEFAULT false NOT NULL,
	"exclude_sale_items" boolean DEFAULT false NOT NULL,
	"minimum_amount" numeric(19, 4),
	"maximum_amount" numeric(19, 4),
	"email_restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"product_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_product_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"date_modified" timestamp with time zone NOT NULL,
	CONSTRAINT "coupons_discount_type_chk" CHECK ("discount_type" IN ('fixed_cart', 'percent', 'fixed_product'))
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"type" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"address_1" text DEFAULT '' NOT NULL,
	"address_2" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"postcode" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"email" text,
	"phone" text DEFAULT '' NOT NULL,
	CONSTRAINT "customer_addresses_type_chk" CHECK ("type" IN ('billing', 'shipping'))
);
--> statement-breakpoint
CREATE TABLE "customer_lookup" (
	"customer_id" bigint PRIMARY KEY NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"postcode" text DEFAULT '' NOT NULL,
	"total_spent" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"avg_order_value" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"date_registered" timestamp with time zone,
	"date_last_active" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_meta" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"key" text NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"username" text,
	"role" text DEFAULT 'customer' NOT NULL,
	"is_paying_customer" boolean DEFAULT false NOT NULL,
	"total_spent" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"date_modified" timestamp with time zone NOT NULL,
	CONSTRAINT "customers_role_chk" CHECK ("role" IN ('customer', 'shop_manager', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "download_permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"download_id" text NOT NULL,
	"product_id" bigint NOT NULL,
	"order_id" bigint NOT NULL,
	"order_key" text NOT NULL,
	"user_id" bigint,
	"user_email" text NOT NULL,
	"downloads_remaining" integer,
	"access_granted" timestamp with time zone NOT NULL,
	"access_expires" timestamp with time zone,
	"download_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"name" text,
	"mime_type" text,
	"source" text DEFAULT 'local' NOT NULL,
	"source_id" text,
	"width" integer,
	"height" integer,
	"file_size" bigint,
	"date_created" timestamp with time zone NOT NULL,
	CONSTRAINT "media_source_chk" CHECK ("source" IN ('local', 's3', 'r2', 'external'))
);
--> statement-breakpoint
CREATE TABLE "media_links" (
	"media_id" bigint NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "media_links_media_id_owner_type_owner_id_pk" PRIMARY KEY("media_id","owner_type","owner_id")
);
--> statement-breakpoint
CREATE TABLE "order_coupon_lookup" (
	"order_id" bigint NOT NULL,
	"coupon_id" bigint NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"discount_amount" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"discount_amount_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	CONSTRAINT "order_coupon_lookup_order_id_coupon_id_pk" PRIMARY KEY("order_id","coupon_id")
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_meta" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_item_id" bigint NOT NULL,
	"key" text,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"product_id" bigint,
	"variation_id" bigint,
	"quantity" integer,
	"subtotal" numeric(19, 4),
	"total" numeric(19, 4),
	"subtotal_tax" numeric(19, 4),
	"total_tax" numeric(19, 4),
	"tax_class" text,
	"tax_status" text,
	"taxes" jsonb,
	"meta_data" jsonb,
	CONSTRAINT "order_items_type_chk" CHECK ("type" IN ('line_item', 'fee', 'shipping', 'tax', 'coupon'))
);
--> statement-breakpoint
CREATE TABLE "order_meta" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"key" text NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "order_notes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"note" text NOT NULL,
	"type" text DEFAULT 'private' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "order_notes_type_chk" CHECK ("type" IN ('private', 'customer', 'system'))
);
--> statement-breakpoint
CREATE TABLE "order_product_lookup" (
	"order_item_id" bigint PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"variation_id" bigint,
	"customer_id" bigint,
	"qty" integer DEFAULT 0 NOT NULL,
	"total_sales" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"tax_total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"shipping_total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"coupon_amount" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"date_created" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_refunds" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"reason" text,
	"refunded_by" bigint,
	"refunded_payment" boolean DEFAULT false NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"date_created" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_stats" (
	"order_id" bigint PRIMARY KEY NOT NULL,
	"parent_id" bigint,
	"status" text NOT NULL,
	"total_sales" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"tax_total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"shipping_total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"net_total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"returning_customer" boolean DEFAULT false NOT NULL,
	"customer_id" bigint,
	"num_items_sold" integer DEFAULT 0 NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"date_paid" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_tax_lookup" (
	"order_id" bigint NOT NULL,
	"tax_rate_id" bigint NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"shipping_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"order_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"total_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	CONSTRAINT "order_tax_lookup_order_id_tax_rate_id_pk" PRIMARY KEY("order_id","tax_rate_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"prices_include_tax" boolean DEFAULT false NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"date_modified" timestamp with time zone NOT NULL,
	"date_paid" timestamp with time zone,
	"date_completed" timestamp with time zone,
	"discount_total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"discount_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"shipping_total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"shipping_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"cart_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"total" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"total_tax" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"customer_id" bigint,
	"order_key" text NOT NULL,
	"billing_first_name" text DEFAULT '' NOT NULL,
	"billing_last_name" text DEFAULT '' NOT NULL,
	"billing_company" text DEFAULT '' NOT NULL,
	"billing_address_1" text DEFAULT '' NOT NULL,
	"billing_address_2" text DEFAULT '' NOT NULL,
	"billing_city" text DEFAULT '' NOT NULL,
	"billing_state" text DEFAULT '' NOT NULL,
	"billing_postcode" text DEFAULT '' NOT NULL,
	"billing_country" text DEFAULT '' NOT NULL,
	"billing_email" text DEFAULT '' NOT NULL,
	"billing_phone" text DEFAULT '' NOT NULL,
	"shipping_first_name" text DEFAULT '' NOT NULL,
	"shipping_last_name" text DEFAULT '' NOT NULL,
	"shipping_company" text DEFAULT '' NOT NULL,
	"shipping_address_1" text DEFAULT '' NOT NULL,
	"shipping_address_2" text DEFAULT '' NOT NULL,
	"shipping_city" text DEFAULT '' NOT NULL,
	"shipping_state" text DEFAULT '' NOT NULL,
	"shipping_postcode" text DEFAULT '' NOT NULL,
	"shipping_country" text DEFAULT '' NOT NULL,
	"shipping_phone" text DEFAULT '' NOT NULL,
	"payment_method" text DEFAULT '' NOT NULL,
	"payment_method_title" text DEFAULT '' NOT NULL,
	"transaction_id" text,
	"customer_ip_address" text,
	"customer_user_agent" text,
	"created_via" text,
	"customer_note" text,
	"parent_id" bigint,
	"cart_hash" text,
	CONSTRAINT "orders_status_chk" CHECK ("status" IN ('pending', 'failed', 'on-hold', 'processing', 'completed', 'cancelled', 'refunded', 'draft', 'auto-draft', 'checkout-draft', 'trash'))
);
--> statement-breakpoint
CREATE TABLE "payment_token_meta" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_id" bigint NOT NULL,
	"key" text NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "payment_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"gateway" text NOT NULL,
	"token" text NOT NULL,
	"type" text DEFAULT 'CC' NOT NULL,
	"last4" text,
	"expiry" text,
	"card_type" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"date_created" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attribute_terms" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"attribute_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text DEFAULT 'select' NOT NULL,
	"order_by" text DEFAULT 'menu_order' NOT NULL,
	"has_archives" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attributes_lookup" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"attribute_id" bigint NOT NULL,
	"term_id" bigint NOT NULL,
	"is_variation" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_id" bigint,
	"thumbnail_id" bigint,
	"display_type" text DEFAULT 'default' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_category_map" (
	"product_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	CONSTRAINT "product_category_map_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "product_crosssell_map" (
	"product_id" bigint NOT NULL,
	"crosssell_id" bigint NOT NULL,
	CONSTRAINT "product_crosssell_map_product_id_crosssell_id_pk" PRIMARY KEY("product_id","crosssell_id")
);
--> statement-breakpoint
CREATE TABLE "product_downloads" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"variation_id" bigint,
	"download_id" text NOT NULL,
	"name" text NOT NULL,
	"file_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_grouped_map" (
	"group_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_grouped_map_group_id_product_id_pk" PRIMARY KEY("group_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "product_meta" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"key" text NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "product_meta_lookup" (
	"product_id" bigint PRIMARY KEY NOT NULL,
	"sku" text,
	"global_unique_id" text,
	"virtual" boolean DEFAULT false NOT NULL,
	"downloadable" boolean DEFAULT false NOT NULL,
	"min_price" numeric(19, 4),
	"max_price" numeric(19, 4),
	"onsale" boolean DEFAULT false NOT NULL,
	"stock_quantity" numeric(12, 3),
	"stock_status" text DEFAULT 'instock' NOT NULL,
	"rating_count" bigint DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT 0 NOT NULL,
	"total_sales" bigint DEFAULT 0 NOT NULL,
	"tax_status" text DEFAULT 'taxable' NOT NULL,
	"tax_class" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tag_map" (
	"product_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	CONSTRAINT "product_tag_map_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_upsell_map" (
	"product_id" bigint NOT NULL,
	"upsell_id" bigint NOT NULL,
	CONSTRAINT "product_upsell_map_product_id_upsell_id_pk" PRIMARY KEY("product_id","upsell_id")
);
--> statement-breakpoint
CREATE TABLE "product_variation_attributes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"variation_id" bigint NOT NULL,
	"attribute_id" bigint,
	"term_id" bigint,
	"attribute_name" text NOT NULL,
	"attribute_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"sku" text,
	"regular_price" numeric(19, 4),
	"sale_price" numeric(19, 4),
	"price" numeric(19, 4),
	"date_on_sale_from" timestamp with time zone,
	"date_on_sale_to" timestamp with time zone,
	"stock_quantity" numeric(12, 3),
	"stock_status" text DEFAULT 'instock' NOT NULL,
	"weight" numeric(12, 3),
	"weight_unit" text,
	"length" numeric(12, 3),
	"width" numeric(12, 3),
	"height" numeric(12, 3),
	"dimensions_unit" text,
	"image_id" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"virtual" boolean DEFAULT false NOT NULL,
	"downloadable" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"download_limit" integer,
	"download_expiry" integer,
	"manage_stock" text DEFAULT 'parent' NOT NULL,
	"backorders" text,
	"tax_status" text DEFAULT 'taxable' NOT NULL,
	"tax_class" text DEFAULT '' NOT NULL,
	"shipping_class_id" bigint,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"downloads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "product_variations_manage_stock_chk" CHECK ("manage_stock" IN ('parent', 'yes', 'no'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'simple' NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"sku" text,
	"global_unique_id" text,
	"regular_price" numeric(19, 4),
	"sale_price" numeric(19, 4),
	"price" numeric(19, 4),
	"date_on_sale_from" timestamp with time zone,
	"date_on_sale_to" timestamp with time zone,
	"status" text DEFAULT 'publish' NOT NULL,
	"catalog_visibility" text DEFAULT 'visible' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"virtual" boolean DEFAULT false NOT NULL,
	"downloadable" boolean DEFAULT false NOT NULL,
	"tax_status" text DEFAULT 'taxable' NOT NULL,
	"tax_class" text DEFAULT '' NOT NULL,
	"manage_stock" boolean DEFAULT false NOT NULL,
	"stock_quantity" numeric(12, 3),
	"stock_status" text DEFAULT 'instock' NOT NULL,
	"backorders" text DEFAULT 'no' NOT NULL,
	"low_stock_amount" integer,
	"sold_individually" boolean DEFAULT false NOT NULL,
	"weight" numeric(12, 3),
	"weight_unit" text,
	"length" numeric(12, 3),
	"width" numeric(12, 3),
	"height" numeric(12, 3),
	"dimensions_unit" text,
	"shipping_class_id" bigint,
	"purchase_note" text DEFAULT '' NOT NULL,
	"menu_order" integer DEFAULT 0 NOT NULL,
	"post_password" text,
	"reviews_allowed" boolean DEFAULT true NOT NULL,
	"parent_id" bigint,
	"image_id" bigint,
	"gallery_image_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"download_limit" integer DEFAULT -1 NOT NULL,
	"download_expiry" integer DEFAULT -1 NOT NULL,
	"total_sales" bigint DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"rating_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"downloads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_url" text,
	"button_text" text,
	"date_created" timestamp with time zone NOT NULL,
	"date_modified" timestamp with time zone NOT NULL,
	CONSTRAINT "products_type_chk" CHECK ("type" IN ('simple', 'variable', 'grouped', 'external', 'virtual', 'downloadable')),
	CONSTRAINT "products_status_chk" CHECK ("status" IN ('publish', 'draft', 'pending', 'private', 'trash')),
	CONSTRAINT "products_catalog_visibility_chk" CHECK ("catalog_visibility" IN ('visible', 'catalog', 'search', 'hidden')),
	CONSTRAINT "products_stock_status_chk" CHECK ("stock_status" IN ('instock', 'outofstock', 'onbackorder')),
	CONSTRAINT "products_backorders_chk" CHECK ("backorders" IN ('no', 'yes', 'notify')),
	CONSTRAINT "products_tax_status_chk" CHECK ("tax_status" IN ('taxable', 'shipping', 'none'))
);
--> statement-breakpoint
CREATE TABLE "queue_jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"queue" text DEFAULT 'default' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"reserved_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"customer_id" bigint,
	"rating" integer NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_owner" boolean DEFAULT false NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"author_email" text DEFAULT '' NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	CONSTRAINT "reviews_rating_chk" CHECK ("rating" BETWEEN 1 AND 5),
	CONSTRAINT "reviews_status_chk" CHECK ("status" IN ('pending', 'approved', 'spam', 'trash'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_key" text NOT NULL,
	"session_value" text NOT NULL,
	"session_expiry" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_boolean" (
	"key" text PRIMARY KEY NOT NULL,
	"value" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_general" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_integer" (
	"key" text PRIMARY KEY NOT NULL,
	"value" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_json" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_string" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_classes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zone_locations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"zone_id" bigint NOT NULL,
	"location_code" text NOT NULL,
	"location_type" text NOT NULL,
	CONSTRAINT "shipping_zone_locations_type_chk" CHECK ("location_type" IN ('postcode', 'state', 'country', 'continent'))
);
--> statement-breakpoint
CREATE TABLE "shipping_zone_methods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"zone_id" bigint NOT NULL,
	"method_id" text NOT NULL,
	"method_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"zone_name" text NOT NULL,
	"zone_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_classes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rate_locations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tax_rate_id" bigint NOT NULL,
	"location_code" text NOT NULL,
	"location_type" text NOT NULL,
	CONSTRAINT "tax_rate_locations_type_chk" CHECK ("location_type" IN ('postcode', 'state', 'country', 'continent', 'city'))
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tax_class_id" bigint,
	"country" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"name" text DEFAULT 'Tax' NOT NULL,
	"rate" text DEFAULT '0.0000' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"compound" boolean DEFAULT false NOT NULL,
	"shipping" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"name" text NOT NULL,
	"user_id" bigint,
	"delivery_url" text NOT NULL,
	"secret" text DEFAULT '' NOT NULL,
	"topic" text NOT NULL,
	"api_version" integer DEFAULT 3 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"pending_delivery" boolean DEFAULT false NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"date_modified" timestamp with time zone NOT NULL,
	CONSTRAINT "webhooks_status_chk" CHECK ("status" IN ('active', 'paused', 'disabled'))
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_lookup" ADD CONSTRAINT "category_lookup_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_lookup" ADD CONSTRAINT "customer_lookup_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_meta" ADD CONSTRAINT "customer_meta_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_permissions" ADD CONSTRAINT "download_permissions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_permissions" ADD CONSTRAINT "download_permissions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_permissions" ADD CONSTRAINT "download_permissions_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_coupon_lookup" ADD CONSTRAINT "order_coupon_lookup_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_meta" ADD CONSTRAINT "order_item_meta_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variation_id_product_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."product_variations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_meta" ADD CONSTRAINT "order_meta_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_product_lookup" ADD CONSTRAINT "order_product_lookup_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_product_lookup" ADD CONSTRAINT "order_product_lookup_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_product_lookup" ADD CONSTRAINT "order_product_lookup_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_refunded_by_customers_id_fk" FOREIGN KEY ("refunded_by") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stats" ADD CONSTRAINT "order_stats_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stats" ADD CONSTRAINT "order_stats_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tax_lookup" ADD CONSTRAINT "order_tax_lookup_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_parent_id_orders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_token_meta" ADD CONSTRAINT "payment_token_meta_token_id_payment_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."payment_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_tokens" ADD CONSTRAINT "payment_tokens_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_terms" ADD CONSTRAINT "product_attribute_terms_attribute_id_product_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."product_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes_lookup" ADD CONSTRAINT "product_attributes_lookup_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_map" ADD CONSTRAINT "product_category_map_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_map" ADD CONSTRAINT "product_category_map_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_crosssell_map" ADD CONSTRAINT "product_crosssell_map_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_crosssell_map" ADD CONSTRAINT "product_crosssell_map_crosssell_id_products_id_fk" FOREIGN KEY ("crosssell_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_downloads" ADD CONSTRAINT "product_downloads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_downloads" ADD CONSTRAINT "product_downloads_variation_id_product_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."product_variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_grouped_map" ADD CONSTRAINT "product_grouped_map_group_id_products_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_grouped_map" ADD CONSTRAINT "product_grouped_map_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_meta" ADD CONSTRAINT "product_meta_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_meta_lookup" ADD CONSTRAINT "product_meta_lookup_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_map" ADD CONSTRAINT "product_tag_map_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_map" ADD CONSTRAINT "product_tag_map_tag_id_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_upsell_map" ADD CONSTRAINT "product_upsell_map_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_upsell_map" ADD CONSTRAINT "product_upsell_map_upsell_id_products_id_fk" FOREIGN KEY ("upsell_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variation_attributes" ADD CONSTRAINT "product_variation_attributes_variation_id_product_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."product_variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_shipping_class_id_shipping_classes_id_fk" FOREIGN KEY ("shipping_class_id") REFERENCES "public"."shipping_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shipping_class_id_shipping_classes_id_fk" FOREIGN KEY ("shipping_class_id") REFERENCES "public"."shipping_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_zone_locations" ADD CONSTRAINT "shipping_zone_locations_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_zone_methods" ADD CONSTRAINT "shipping_zone_methods_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate_locations" ADD CONSTRAINT "tax_rate_locations_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tax_class_id_tax_classes_id_fk" FOREIGN KEY ("tax_class_id") REFERENCES "public"."tax_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_consumer_key_uq" ON "api_keys" USING btree ("consumer_key");--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_uq" ON "auth_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_customer_idx" ON "auth_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "coupon_usage_coupon_idx" ON "coupon_usage" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_usage_order_idx" ON "coupon_usage" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "coupon_usage_used_by_idx" ON "coupon_usage" USING btree ("used_by");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_uq" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_customer_type_uq" ON "customer_addresses" USING btree ("customer_id","type");--> statement-breakpoint
CREATE INDEX "customer_lookup_email_idx" ON "customer_lookup" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_meta_owner_key_idx" ON "customer_meta" USING btree ("customer_id","key");--> statement-breakpoint
CREATE INDEX "customer_meta_key_idx" ON "customer_meta" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_uq" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_username_idx" ON "customers" USING btree ("username");--> statement-breakpoint
CREATE INDEX "download_permissions_order_idx" ON "download_permissions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "download_permissions_email_order_key_idx" ON "download_permissions" USING btree ("user_email","order_key");--> statement-breakpoint
CREATE INDEX "download_permissions_user_idx" ON "download_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_links_owner_idx" ON "media_links" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "order_coupon_lookup_coupon_idx" ON "order_coupon_lookup" USING btree ("coupon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_events_order_event_uq" ON "order_events" USING btree ("order_id","event_type");--> statement-breakpoint
CREATE INDEX "order_item_meta_owner_key_idx" ON "order_item_meta" USING btree ("order_item_id","key");--> statement-breakpoint
CREATE INDEX "order_item_meta_key_idx" ON "order_item_meta" USING btree ("key");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id","type");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_meta_owner_key_idx" ON "order_meta" USING btree ("order_id","key");--> statement-breakpoint
CREATE INDEX "order_meta_key_idx" ON "order_meta" USING btree ("key");--> statement-breakpoint
CREATE INDEX "order_notes_order_idx" ON "order_notes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_product_lookup_order_idx" ON "order_product_lookup" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_product_lookup_product_idx" ON "order_product_lookup" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_product_lookup_date_idx" ON "order_product_lookup" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "order_refunds_order_idx" ON "order_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_stats_date_idx" ON "order_stats" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "order_stats_customer_idx" ON "order_stats" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_stats_status_idx" ON "order_stats" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_tax_lookup_rate_idx" ON "order_tax_lookup" USING btree ("tax_rate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_key_uq" ON "orders" USING btree ("order_key");--> statement-breakpoint
CREATE INDEX "orders_status_date_idx" ON "orders" USING btree ("status","date_created");--> statement-breakpoint
CREATE INDEX "orders_customer_date_idx" ON "orders" USING btree ("customer_id","date_created");--> statement-breakpoint
CREATE INDEX "orders_parent_idx" ON "orders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "orders_billing_email_idx" ON "orders" USING btree ("billing_email");--> statement-breakpoint
CREATE INDEX "payment_token_meta_owner_key_idx" ON "payment_token_meta" USING btree ("token_id","key");--> statement-breakpoint
CREATE INDEX "payment_tokens_user_idx" ON "payment_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "product_attribute_terms_attr_idx" ON "product_attribute_terms" USING btree ("attribute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_terms_attr_slug_uq" ON "product_attribute_terms" USING btree ("attribute_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attributes_slug_uq" ON "product_attributes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_attributes_lookup_product_idx" ON "product_attributes_lookup" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_attributes_lookup_term_idx" ON "product_attributes_lookup" USING btree ("attribute_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_uq" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_categories_parent_idx" ON "product_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_category_map_category_idx" ON "product_category_map" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_downloads_download_id_uq" ON "product_downloads" USING btree ("download_id");--> statement-breakpoint
CREATE INDEX "product_downloads_product_idx" ON "product_downloads" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_meta_owner_key_idx" ON "product_meta" USING btree ("product_id","key");--> statement-breakpoint
CREATE INDEX "product_meta_key_idx" ON "product_meta" USING btree ("key");--> statement-breakpoint
CREATE INDEX "product_meta_lookup_min_price_idx" ON "product_meta_lookup" USING btree ("min_price");--> statement-breakpoint
CREATE INDEX "product_meta_lookup_max_price_idx" ON "product_meta_lookup" USING btree ("max_price");--> statement-breakpoint
CREATE INDEX "product_meta_lookup_onsale_idx" ON "product_meta_lookup" USING btree ("onsale");--> statement-breakpoint
CREATE INDEX "product_meta_lookup_stock_status_idx" ON "product_meta_lookup" USING btree ("stock_status");--> statement-breakpoint
CREATE INDEX "product_meta_lookup_sku_idx" ON "product_meta_lookup" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_tag_map_tag_idx" ON "product_tag_map" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_tags_slug_uq" ON "product_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "pva_variation_idx" ON "product_variation_attributes" USING btree ("variation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variations_sku_uq" ON "product_variations" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variations_product_idx" ON "product_variations" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uq" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_uq" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status","date_created");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("type");--> statement-breakpoint
CREATE INDEX "products_parent_idx" ON "products" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "products_shipping_class_idx" ON "products" USING btree ("shipping_class_id");--> statement-breakpoint
CREATE INDEX "products_image_idx" ON "products" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "queue_jobs_queue_available_idx" ON "queue_jobs" USING btree ("queue","available_at");--> statement-breakpoint
CREATE INDEX "reviews_product_status_idx" ON "reviews" USING btree ("product_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_session_key_uq" ON "sessions" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("session_expiry");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_classes_slug_uq" ON "shipping_classes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shipping_zone_locations_zone_idx" ON "shipping_zone_locations" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "shipping_zone_locations_type_code_idx" ON "shipping_zone_locations" USING btree ("location_type","location_code");--> statement-breakpoint
CREATE INDEX "shipping_zone_methods_zone_idx" ON "shipping_zone_methods" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "system_log_level_idx" ON "system_log" USING btree ("level","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_classes_slug_uq" ON "tax_classes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tax_rate_locations_rate_idx" ON "tax_rate_locations" USING btree ("tax_rate_id");--> statement-breakpoint
CREATE INDEX "tax_rate_locations_code_idx" ON "tax_rate_locations" USING btree ("location_code","location_type");--> statement-breakpoint
CREATE INDEX "tax_rates_country_idx" ON "tax_rates" USING btree ("country");--> statement-breakpoint
CREATE INDEX "tax_rates_class_idx" ON "tax_rates" USING btree ("tax_class_id");--> statement-breakpoint
CREATE INDEX "tax_rates_priority_idx" ON "tax_rates" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "webhooks_status_idx" ON "webhooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhooks_topic_idx" ON "webhooks" USING btree ("topic");