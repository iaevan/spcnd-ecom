ALTER TABLE products ADD FULLTEXT INDEX products_fulltext_idx (name, sku, short_description);
