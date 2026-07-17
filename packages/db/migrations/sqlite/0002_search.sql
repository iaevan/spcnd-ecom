CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name, sku, short_description,
  content='products', content_rowid='id'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, sku, short_description)
  VALUES (new.id, new.name, new.sku, new.short_description);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, sku, short_description)
  VALUES ('delete', old.id, old.name, old.sku, old.short_description);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS products_fts_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, sku, short_description)
  VALUES ('delete', old.id, old.name, old.sku, old.short_description);
  INSERT INTO products_fts(rowid, name, sku, short_description)
  VALUES (new.id, new.name, new.sku, new.short_description);
END;
