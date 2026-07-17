DROP INDEX IF EXISTS products_attributes_gin;
--> statement-breakpoint
DROP INDEX IF EXISTS order_items_meta_gin;
--> statement-breakpoint
DROP INDEX IF EXISTS products_search_idx;
--> statement-breakpoint
ALTER TABLE products DROP COLUMN IF EXISTS search_vector;
