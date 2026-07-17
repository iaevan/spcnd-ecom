ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(sku, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(short_description, '')), 'C')
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_search_idx ON products USING GIN (search_vector);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS order_items_meta_gin ON order_items USING GIN (meta_data);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_attributes_gin ON products USING GIN (attributes);
