import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import { Money, type PaginatedResult, type StockStatus } from '@spacendigital/types';
import { and, asc, desc, eq, gte, inArray, like, lte, ne, or, sql } from 'drizzle-orm';
import type { NewProduct, Product, ProductVariation } from '../entities.js';
import { NotFoundError, SpcndError } from '../errors.js';
import {
  filterProductIdBySku,
  filterProductIsInStock,
  filterProductIsOnSale,
  filterProductIsPurchasable,
  filterProductIsVisible,
  productBeforeDelete,
  productBeforeStockSet,
  productCreated,
  productDeleted,
  productRead,
  productSaveAfter,
  productSaveBefore,
  productStockSet,
  productStockStatusSet,
  productTrashed,
  productTypeChanged,
  productUpdated,
  productUpdatedProps,
  productVisibilitySet,
  variableProductSync,
  variationBeforeStockSet,
  variationStockSet,
  variationStockStatusSet,
} from '../events.js';
import type { SettingsService } from '../settings/service.js';
import { nowIso, slugify } from '../utils.js';

/** Relation ids accepted alongside the row fields on create/update. */
export interface ProductRelationsInput {
  categoryIds?: number[];
  tagIds?: number[];
  upsellIds?: number[];
  crosssellIds?: number[];
  /** For `grouped` products: the member product ids in display order. */
  groupedIds?: number[];
}

export type CreateProductInput = Omit<NewProduct, 'id' | 'dateCreated' | 'dateModified' | 'slug'> &
  Partial<Pick<NewProduct, 'slug'>> &
  ProductRelationsInput;

export type UpdateProductInput = Partial<Omit<NewProduct, 'id' | 'dateCreated'>> &
  ProductRelationsInput;

export interface ProductListQuery {
  page?: number;
  perPage?: number;
  status?: Product['status'] | 'any';
  type?: Product['type'];
  featured?: boolean;
  categoryId?: number;
  tagId?: number;
  onSale?: boolean;
  stockStatus?: StockStatus;
  /** Fixed-decimal strings, compared against product_meta_lookup min/max price. */
  minPrice?: string;
  maxPrice?: string;
  /** LIKE match against name and sku. Use SearchAdapter for real search. */
  search?: string;
  include?: number[];
  exclude?: number[];
  orderBy?: 'date' | 'id' | 'title' | 'menu_order' | 'price' | 'popularity' | 'rating';
  order?: 'asc' | 'desc';
}

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
  settings: SettingsService;
}

/**
 * Catalog product service. All writes go through one path (`create`/`update`/
 * stock ops) that recomputes the active price from the sale window and syncs
 * `product_meta_lookup` inside the same transaction as the product row
 * (docs/AGENTS.md §4.1 rule 10).
 */
export class ProductService {
  constructor(private readonly deps: Deps) {}

  // --- Reads ---------------------------------------------------------------

  async get(id: number): Promise<Product> {
    const { db, bus } = this.deps;
    const rows = await db.drizzle.select().from(db.schema.products).where(eq(db.schema.products.id, id));
    const product = rows[0];
    if (!product) throw new NotFoundError('Product', id);
    await bus.emit(productRead, product);
    return product;
  }

  async find(id: number): Promise<Product | undefined> {
    const { db } = this.deps;
    const rows = await db.drizzle.select().from(db.schema.products).where(eq(db.schema.products.id, id));
    return rows[0];
  }

  async getBySlug(slug: string): Promise<Product | undefined> {
    const { db } = this.deps;
    const rows = await db.drizzle
      .select()
      .from(db.schema.products)
      .where(eq(db.schema.products.slug, slug));
    return rows[0];
  }

  /** WC `wc_get_product_id_by_sku`: product id for a SKU, `0` when absent (filterable). */
  async getIdBySku(sku: string): Promise<number> {
    const { db, bus } = this.deps;
    const rows = await db.drizzle
      .select({ id: db.schema.products.id })
      .from(db.schema.products)
      .where(eq(db.schema.products.sku, sku));
    return bus.applyFilters(filterProductIdBySku, rows[0]?.id ?? 0, sku);
  }

  /** SKU lookup across products and variations (variations are separate rows here). */
  async findBySku(
    sku: string,
  ): Promise<{ product: Product; variation?: ProductVariation } | undefined> {
    const { db } = this.deps;
    const s = db.schema;
    const products = await db.drizzle.select().from(s.products).where(eq(s.products.sku, sku));
    if (products[0]) return { product: products[0] };
    const variations = await db.drizzle
      .select()
      .from(s.productVariations)
      .where(eq(s.productVariations.sku, sku));
    const variation = variations[0];
    if (!variation) return undefined;
    const parent = await this.find(variation.productId);
    return parent ? { product: parent, variation } : undefined;
  }

  async list(query: ProductListQuery = {}): Promise<PaginatedResult<Product>> {
    const { db } = this.deps;
    const s = db.schema;
    const d = db.drizzle;
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 10));

    const conds = [];
    if (query.status !== 'any') conds.push(eq(s.products.status, query.status ?? 'publish'));
    if (query.type) conds.push(eq(s.products.type, query.type));
    if (query.featured !== undefined) conds.push(eq(s.products.featured, query.featured));
    if (query.include?.length) conds.push(inArray(s.products.id, query.include));
    if (query.exclude?.length)
      conds.push(sql`${s.products.id} NOT IN (${sql.join(query.exclude.map((v) => sql`${v}`), sql`, `)})`);
    if (query.categoryId !== undefined) {
      conds.push(
        inArray(
          s.products.id,
          d
            .select({ id: s.productCategoryMap.productId })
            .from(s.productCategoryMap)
            .where(eq(s.productCategoryMap.categoryId, query.categoryId)),
        ),
      );
    }
    if (query.tagId !== undefined) {
      conds.push(
        inArray(
          s.products.id,
          d
            .select({ id: s.productTagMap.productId })
            .from(s.productTagMap)
            .where(eq(s.productTagMap.tagId, query.tagId)),
        ),
      );
    }
    if (query.onSale !== undefined) conds.push(eq(s.productMetaLookup.onsale, query.onSale));
    if (query.stockStatus) conds.push(eq(s.productMetaLookup.stockStatus, query.stockStatus));
    if (query.minPrice !== undefined) conds.push(gte(s.productMetaLookup.minPrice, query.minPrice));
    if (query.maxPrice !== undefined) conds.push(lte(s.productMetaLookup.maxPrice, query.maxPrice));
    if (query.search) {
      const term = `%${query.search}%`;
      conds.push(or(like(s.products.name, term), like(s.products.sku, term)));
    }
    const where = conds.length > 0 ? and(...conds) : undefined;

    const dir = query.order === 'asc' ? asc : query.order === 'desc' ? desc : undefined;
    const orderColumn = {
      date: s.products.dateCreated,
      id: s.products.id,
      title: s.products.name,
      menu_order: s.products.menuOrder,
      price: s.productMetaLookup.minPrice,
      popularity: s.productMetaLookup.totalSales,
      rating: s.productMetaLookup.averageRating,
    }[query.orderBy ?? 'date'];
    // WC defaults: menu_order/title ascending, everything else descending.
    const defaultDir = query.orderBy === 'menu_order' || query.orderBy === 'title' ? asc : desc;
    const orderBy = (dir ?? defaultDir)(orderColumn);

    const base = d
      .select({ product: s.products })
      .from(s.products)
      .leftJoin(s.productMetaLookup, eq(s.productMetaLookup.productId, s.products.id));
    const rows = await (where ? base.where(where) : base)
      .orderBy(orderBy, asc(s.products.id))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const countBase = d
      .select({ count: sql<number>`count(*)` })
      .from(s.products)
      .leftJoin(s.productMetaLookup, eq(s.productMetaLookup.productId, s.products.id));
    const total = Number((await (where ? countBase.where(where) : countBase))[0]?.count ?? 0);

    return {
      items: rows.map((r) => r.product),
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
    };
  }

  // --- Price resolution ----------------------------------------------------

  /**
   * Active price per WC's sync_price: the sale price when one is set and the
   * sale window contains `now`, otherwise the regular price.
   */
  resolveActivePrice(
    row: Pick<Product, 'regularPrice' | 'salePrice' | 'dateOnSaleFrom' | 'dateOnSaleTo'>,
    now = new Date(),
  ): { price: string | null; onSale: boolean } {
    const regular = row.regularPrice;
    const sale = row.salePrice;
    if (sale === null || sale === undefined || sale === '') {
      return { price: regular ?? null, onSale: false };
    }
    const from = row.dateOnSaleFrom ? new Date(row.dateOnSaleFrom) : null;
    const to = row.dateOnSaleTo ? new Date(row.dateOnSaleTo) : null;
    const started = !from || from.getTime() <= now.getTime();
    const ended = to !== null && to.getTime() < now.getTime();
    if (started && !ended) return { price: sale, onSale: true };
    return { price: regular ?? null, onSale: false };
  }

  /** WC `is_on_sale` (filterable): active price equals a set sale price. */
  async isOnSale(product: Product): Promise<boolean> {
    const { onSale } = this.resolveActivePrice(product);
    return this.deps.bus.applyFilters(filterProductIsOnSale, onSale, product);
  }

  // --- Conditionals --------------------------------------------------------

  async isInStock(product: Product): Promise<boolean> {
    return this.deps.bus.applyFilters(
      filterProductIsInStock,
      product.stockStatus !== 'outofstock',
      product,
    );
  }

  /** WC `is_purchasable`: exists, is publish, and has a price (filterable). */
  async isPurchasable(product: Product): Promise<boolean> {
    const purchasable =
      product.status === 'publish' &&
      product.type !== 'grouped' &&
      product.type !== 'external' &&
      product.price !== null &&
      product.price !== '';
    return this.deps.bus.applyFilters(filterProductIsPurchasable, purchasable, product);
  }

  /**
   * WC `is_visible`: shown in the catalog — published, catalog_visibility not
   * hidden/search-only, and not out of stock when the store hides those.
   */
  async isVisible(product: Product): Promise<boolean> {
    let visible =
      product.status === 'publish' &&
      (product.catalogVisibility === 'visible' || product.catalogVisibility === 'catalog');
    if (visible && product.stockStatus === 'outofstock') {
      visible = !(await this.deps.settings.getBool('hide_out_of_stock_items'));
    }
    return this.deps.bus.applyFilters(filterProductIsVisible, visible, product.id);
  }

  async setVisibility(id: number, visibility: Product['catalogVisibility']): Promise<Product> {
    const product = await this.update(id, { catalogVisibility: visibility });
    await this.deps.bus.emit(productVisibilitySet, { productId: id, visibility });
    return product;
  }

  // --- Writes (single path) ------------------------------------------------

  async create(input: CreateProductInput): Promise<Product> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const now = nowIso();
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name));
    if (input.sku) await this.assertUniqueSku(input.sku);

    const { categoryIds, tagIds, upsellIds, crosssellIds, groupedIds, ...fields } = input;
    const { price, onSale } = this.resolveActivePrice({
      regularPrice: fields.regularPrice ?? null,
      salePrice: fields.salePrice ?? null,
      dateOnSaleFrom: fields.dateOnSaleFrom ?? null,
      dateOnSaleTo: fields.dateOnSaleTo ?? null,
    });
    const row: NewProduct = {
      ...fields,
      slug,
      price,
      dateCreated: now,
      dateModified: now,
    };
    this.applyStockInvariants(row);
    await bus.emit(productSaveBefore, row as Product);

    const product = await db.transaction(async (tx) => {
      await tx.drizzle.insert(s.products).values(row);
      const inserted = (
        await tx.drizzle.select().from(s.products).where(eq(s.products.slug, slug))
      )[0];
      if (!inserted) throw new SpcndError('Product insert failed', 'product_insert_failed', 500);
      await this.writeRelations(tx, inserted.id, { categoryIds, tagIds, upsellIds, crosssellIds, groupedIds });
      await this.syncMetaLookup(tx, inserted, onSale);
      return inserted;
    });

    await bus.emit(productCreated, product);
    await bus.emit(productSaveAfter, product);
    return product;
  }

  async update(id: number, input: UpdateProductInput): Promise<Product> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const existing = await this.get(id);
    await bus.emit(productSaveBefore, existing);

    const { categoryIds, tagIds, upsellIds, crosssellIds, groupedIds, ...fields } = input;
    if (fields.sku && fields.sku !== existing.sku) await this.assertUniqueSku(fields.sku, id);
    if (fields.slug && fields.slug !== existing.slug) {
      fields.slug = await this.uniqueSlug(fields.slug, id);
    }

    const merged = { ...existing, ...fields };
    const { price, onSale } = this.resolveActivePrice(merged);
    const patch: Partial<NewProduct> = { ...fields, price, dateModified: nowIso() };
    this.applyStockInvariants(patch, merged);

    const updated = await db.transaction(async (tx) => {
      await tx.drizzle.update(s.products).set(patch).where(eq(s.products.id, id));
      const row = (await tx.drizzle.select().from(s.products).where(eq(s.products.id, id)))[0];
      if (!row) throw new NotFoundError('Product', id);
      await this.writeRelations(tx, id, { categoryIds, tagIds, upsellIds, crosssellIds, groupedIds });
      await this.syncMetaLookup(tx, row, onSale);
      return row;
    });

    const updatedProps = Object.keys(fields).filter(
      (key) => (existing as Record<string, unknown>)[key] !== (updated as Record<string, unknown>)[key],
    );
    if (existing.type !== updated.type) {
      await bus.emit(productTypeChanged, { product: updated, from: existing.type, to: updated.type });
    }
    if (existing.stockStatus !== updated.stockStatus) {
      await bus.emit(productStockStatusSet, { productId: id, status: updated.stockStatus });
    }
    await bus.emit(productUpdated, updated);
    if (updatedProps.length > 0) await bus.emit(productUpdatedProps, { product: updated, updatedProps });
    await bus.emit(productSaveAfter, updated);
    return updated;
  }

  /** Soft delete: status → trash (WC `wp_trash_post`). */
  async trash(id: number): Promise<void> {
    const { db, bus } = this.deps;
    const s = db.schema;
    await this.get(id);
    await db.drizzle
      .update(s.products)
      .set({ status: 'trash', dateModified: nowIso() })
      .where(eq(s.products.id, id));
    await bus.emit(productTrashed, { id });
  }

  /** Hard delete; cascades remove variations, meta, lookup and junction rows. */
  async delete(id: number): Promise<void> {
    const { db, bus } = this.deps;
    await this.get(id);
    await bus.emit(productBeforeDelete, { id });
    await db.drizzle.delete(db.schema.products).where(eq(db.schema.products.id, id));
    await bus.emit(productDeleted, { id });
  }

  // --- Stock ops -----------------------------------------------------------

  /** Set absolute stock on the product (or its variation) and derive stock_status. */
  async setStock(id: number, quantity: number | null, variationId?: number): Promise<void> {
    if (variationId) return this.setVariationStock(variationId, quantity);
    const { db, bus, settings } = this.deps;
    const s = db.schema;
    const product = await this.get(id);
    await bus.emit(productBeforeStockSet, { product, quantity });

    const noStockAmount = await settings.getInt('notify_no_stock_amount');
    const status = deriveStockStatus(quantity, product.backorders, noStockAmount);
    const updated = await db.transaction(async (tx) => {
      await tx.drizzle
        .update(s.products)
        .set({ stockQuantity: quantity, stockStatus: status, dateModified: nowIso() })
        .where(eq(s.products.id, id));
      const row = (await tx.drizzle.select().from(s.products).where(eq(s.products.id, id)))[0];
      if (!row) throw new NotFoundError('Product', id);
      await this.syncMetaLookup(tx, row, this.resolveActivePrice(row).onSale);
      return row;
    });

    await bus.emit(productStockSet, { product: updated, quantity });
    if (updated.stockStatus !== product.stockStatus) {
      await bus.emit(productStockStatusSet, { productId: id, status: updated.stockStatus });
    }
  }

  /** WC `wc_update_product_stock( $product, $qty, 'decrease' )`. */
  async reduceStock(id: number, quantity: number, variationId?: number): Promise<void> {
    const current = await this.managedStock(id, variationId);
    if (current === null) return;
    await this.setStock(id, current - quantity, variationId);
  }

  /** WC stock restore on cancel/refund ('increase'). */
  async restoreStock(id: number, quantity: number, variationId?: number): Promise<void> {
    const current = await this.managedStock(id, variationId);
    if (current === null) return;
    await this.setStock(id, current + quantity, variationId);
  }

  /** Stock quantity of the managing entity, honoring `manage_stock: 'parent'`. */
  private async managedStock(id: number, variationId?: number): Promise<number | null> {
    if (variationId) {
      const variation = await this.getVariation(variationId);
      if (variation.manageStock === 'yes') return variation.stockQuantity;
      if (variation.manageStock === 'no') return null;
      // 'parent' — fall through to the product row.
    }
    const product = await this.get(id);
    return product.manageStock ? product.stockQuantity : null;
  }

  // --- Variations ----------------------------------------------------------

  async getVariation(id: number): Promise<ProductVariation> {
    const { db } = this.deps;
    const rows = await db.drizzle
      .select()
      .from(db.schema.productVariations)
      .where(eq(db.schema.productVariations.id, id));
    const variation = rows[0];
    if (!variation) throw new NotFoundError('ProductVariation', id);
    return variation;
  }

  async getVariations(productId: number): Promise<ProductVariation[]> {
    const { db } = this.deps;
    const s = db.schema;
    return db.drizzle
      .select()
      .from(s.productVariations)
      .where(eq(s.productVariations.productId, productId))
      .orderBy(asc(s.productVariations.sortOrder), asc(s.productVariations.id));
  }

  async createVariation(
    productId: number,
    input: Omit<typeof this.deps.db.schema.productVariations.$inferInsert, 'id' | 'productId'>,
  ): Promise<ProductVariation> {
    const { db } = this.deps;
    const s = db.schema;
    const parent = await this.get(productId);
    if (input.sku) await this.assertUniqueSku(input.sku);
    const { price } = this.resolveActivePrice({
      regularPrice: input.regularPrice ?? null,
      salePrice: input.salePrice ?? null,
      dateOnSaleFrom: input.dateOnSaleFrom ?? null,
      dateOnSaleTo: input.dateOnSaleTo ?? null,
    });
    const variation = await db.transaction(async (tx) => {
      await tx.drizzle.insert(s.productVariations).values({ ...input, price, productId });
      const rows = await tx.drizzle
        .select()
        .from(s.productVariations)
        .where(eq(s.productVariations.productId, productId))
        .orderBy(desc(s.productVariations.id))
        .limit(1);
      const inserted = rows[0];
      if (!inserted) throw new SpcndError('Variation insert failed', 'variation_insert_failed', 500);
      await this.syncVariableProductTx(tx, parent);
      return inserted;
    });
    return variation;
  }

  async updateVariation(
    id: number,
    input: Partial<typeof this.deps.db.schema.productVariations.$inferInsert>,
  ): Promise<ProductVariation> {
    const { db } = this.deps;
    const s = db.schema;
    const existing = await this.getVariation(id);
    if (input.sku && input.sku !== existing.sku) await this.assertUniqueSku(input.sku, undefined, id);
    const merged = { ...existing, ...input };
    const { price } = this.resolveActivePrice(merged);
    const parent = await this.get(existing.productId);
    return db.transaction(async (tx) => {
      await tx.drizzle
        .update(s.productVariations)
        .set({ ...input, price })
        .where(eq(s.productVariations.id, id));
      const row = (
        await tx.drizzle.select().from(s.productVariations).where(eq(s.productVariations.id, id))
      )[0];
      if (!row) throw new NotFoundError('ProductVariation', id);
      await this.syncVariableProductTx(tx, parent);
      return row;
    });
  }

  async deleteVariation(id: number): Promise<void> {
    const { db } = this.deps;
    const s = db.schema;
    const variation = await this.getVariation(id);
    const parent = await this.get(variation.productId);
    await db.transaction(async (tx) => {
      await tx.drizzle.delete(s.productVariations).where(eq(s.productVariations.id, id));
      await this.syncVariableProductTx(tx, parent);
    });
  }

  private async setVariationStock(variationId: number, quantity: number | null): Promise<void> {
    const { db, bus, settings } = this.deps;
    const s = db.schema;
    const variation = await this.getVariation(variationId);
    await bus.emit(variationBeforeStockSet, { variation, quantity });
    const parent = await this.get(variation.productId);
    const backorders = variation.backorders ?? parent.backorders;
    const noStockAmount = await settings.getInt('notify_no_stock_amount');
    const status = deriveStockStatus(quantity, backorders, noStockAmount);
    const updated = await db.transaction(async (tx) => {
      await tx.drizzle
        .update(s.productVariations)
        .set({ stockQuantity: quantity, stockStatus: status })
        .where(eq(s.productVariations.id, variationId));
      const row = (
        await tx.drizzle
          .select()
          .from(s.productVariations)
          .where(eq(s.productVariations.id, variationId))
      )[0];
      if (!row) throw new NotFoundError('ProductVariation', variationId);
      await this.syncVariableProductTx(tx, parent);
      return row;
    });
    await bus.emit(variationStockSet, { variation: updated, quantity });
    if (updated.stockStatus !== variation.stockStatus) {
      await bus.emit(variationStockStatusSet, { variationId, status: updated.stockStatus });
    }
  }

  /**
   * WC_Product_Variable::sync — recompute the parent's price span, on-sale
   * flag and stock rollup from enabled variations, then re-sync the lookup.
   */
  async syncVariableProduct(productId: number): Promise<Product> {
    const { db, bus } = this.deps;
    const parent = await this.get(productId);
    const synced = await db.transaction(async (tx) => this.syncVariableProductTx(tx, parent));
    await bus.emit(variableProductSync, { product: synced });
    return synced;
  }

  private async syncVariableProductTx(tx: SpcndDb, parent: Product): Promise<Product> {
    const s = tx.schema;
    if (parent.type !== 'variable') {
      const row = (await tx.drizzle.select().from(s.products).where(eq(s.products.id, parent.id)))[0];
      if (!row) throw new NotFoundError('Product', parent.id);
      await this.syncMetaLookup(tx, row, this.resolveActivePrice(row).onSale);
      return row;
    }
    const variations = await tx.drizzle
      .select()
      .from(s.productVariations)
      .where(and(eq(s.productVariations.productId, parent.id), eq(s.productVariations.enabled, true)));

    let min: Money | null = null;
    let max: Money | null = null;
    let anyOnSale = false;
    let anyInStock = false;
    for (const v of variations) {
      const { price, onSale } = this.resolveActivePrice(v);
      if (price !== null) {
        const m = Money.fromDb(price);
        if (min === null || m.lt(min)) min = m;
        if (max === null || m.gt(max)) max = m;
      }
      anyOnSale ||= onSale;
      anyInStock ||= v.stockStatus !== 'outofstock';
    }
    const stockStatus: StockStatus =
      variations.length === 0 ? parent.stockStatus : anyInStock ? 'instock' : 'outofstock';

    await tx.drizzle
      .update(s.products)
      .set({
        price: min?.toDbString() ?? null,
        stockStatus,
        dateModified: nowIso(),
      })
      .where(eq(s.products.id, parent.id));
    const row = (await tx.drizzle.select().from(s.products).where(eq(s.products.id, parent.id)))[0];
    if (!row) throw new NotFoundError('Product', parent.id);
    await this.syncMetaLookup(tx, row, anyOnSale, {
      minPrice: min?.toDbString() ?? null,
      maxPrice: max?.toDbString() ?? null,
    });
    return row;
  }

  // --- Related / upsell / cross-sell ---------------------------------------

  async getUpsellIds(productId: number): Promise<number[]> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select({ id: s.productUpsellMap.upsellId })
      .from(s.productUpsellMap)
      .where(eq(s.productUpsellMap.productId, productId));
    return rows.map((r) => r.id);
  }

  async getCrosssellIds(productId: number): Promise<number[]> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select({ id: s.productCrosssellMap.crosssellId })
      .from(s.productCrosssellMap)
      .where(eq(s.productCrosssellMap.productId, productId));
    return rows.map((r) => r.id);
  }

  async getGroupedIds(groupId: number): Promise<number[]> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select({ id: s.productGroupedMap.productId })
      .from(s.productGroupedMap)
      .where(eq(s.productGroupedMap.groupId, groupId))
      .orderBy(asc(s.productGroupedMap.sortOrder));
    return rows.map((r) => r.id);
  }

  /**
   * WC `wc_get_related_products`: published products sharing a category or a
   * tag with the given product, excluding itself.
   */
  async getRelatedIds(productId: number, limit = 5): Promise<number[]> {
    const { db } = this.deps;
    const s = db.schema;
    const d = db.drizzle;
    const catIds = d
      .select({ id: s.productCategoryMap.categoryId })
      .from(s.productCategoryMap)
      .where(eq(s.productCategoryMap.productId, productId));
    const tagIds = d
      .select({ id: s.productTagMap.tagId })
      .from(s.productTagMap)
      .where(eq(s.productTagMap.productId, productId));
    const byCategory = d
      .select({ id: s.productCategoryMap.productId })
      .from(s.productCategoryMap)
      .where(inArray(s.productCategoryMap.categoryId, catIds));
    const byTag = d
      .select({ id: s.productTagMap.productId })
      .from(s.productTagMap)
      .where(inArray(s.productTagMap.tagId, tagIds));

    const rows = await d
      .select({ id: s.products.id })
      .from(s.products)
      .where(
        and(
          ne(s.products.id, productId),
          eq(s.products.status, 'publish'),
          or(inArray(s.products.id, byCategory), inArray(s.products.id, byTag)),
        ),
      )
      .limit(limit);
    return rows.map((r) => r.id);
  }

  // --- Internals -----------------------------------------------------------

  /**
   * WC `validate_props`: without stock management the quantity is cleared;
   * with it, an explicit status wins only until the next quantity change.
   */
  private applyStockInvariants(
    patch: Partial<NewProduct>,
    merged: Partial<NewProduct> = patch,
  ): void {
    if (merged.manageStock === false || merged.manageStock === undefined) {
      if ('manageStock' in patch || 'stockQuantity' in patch) patch.stockQuantity = null;
    }
  }

  private async uniqueSlug(base: string, excludeId?: number): Promise<string> {
    const { db } = this.deps;
    const s = db.schema;
    const candidate = base || 'product';
    for (let i = 0; ; i++) {
      const slug = i === 0 ? candidate : `${candidate}-${i + 1}`;
      const conds = [eq(s.products.slug, slug)];
      if (excludeId !== undefined) conds.push(ne(s.products.id, excludeId));
      const rows = await db.drizzle
        .select({ id: s.products.id })
        .from(s.products)
        .where(and(...conds));
      if (rows.length === 0) return slug;
    }
  }

  private async assertUniqueSku(
    sku: string,
    excludeProductId?: number,
    excludeVariationId?: number,
  ): Promise<void> {
    const { db } = this.deps;
    const s = db.schema;
    const productConds = [eq(s.products.sku, sku)];
    if (excludeProductId !== undefined) productConds.push(ne(s.products.id, excludeProductId));
    const inProducts = await db.drizzle
      .select({ id: s.products.id })
      .from(s.products)
      .where(and(...productConds));
    const variationConds = [eq(s.productVariations.sku, sku)];
    if (excludeVariationId !== undefined)
      variationConds.push(ne(s.productVariations.id, excludeVariationId));
    const inVariations = await db.drizzle
      .select({ id: s.productVariations.id })
      .from(s.productVariations)
      .where(and(...variationConds));
    if (inProducts.length > 0 || inVariations.length > 0) {
      throw new SpcndError(`SKU "${sku}" is already in use`, 'product_invalid_sku');
    }
  }

  private async writeRelations(
    tx: SpcndDb,
    productId: number,
    relations: ProductRelationsInput,
  ): Promise<void> {
    const s = tx.schema;
    const d = tx.drizzle;
    if (relations.categoryIds) {
      await d.delete(s.productCategoryMap).where(eq(s.productCategoryMap.productId, productId));
      for (const categoryId of relations.categoryIds) {
        await d.insert(s.productCategoryMap).values({ productId, categoryId });
      }
    }
    if (relations.tagIds) {
      await d.delete(s.productTagMap).where(eq(s.productTagMap.productId, productId));
      for (const tagId of relations.tagIds) {
        await d.insert(s.productTagMap).values({ productId, tagId });
      }
    }
    if (relations.upsellIds) {
      await d.delete(s.productUpsellMap).where(eq(s.productUpsellMap.productId, productId));
      for (const upsellId of relations.upsellIds) {
        await d.insert(s.productUpsellMap).values({ productId, upsellId });
      }
    }
    if (relations.crosssellIds) {
      await d.delete(s.productCrosssellMap).where(eq(s.productCrosssellMap.productId, productId));
      for (const crosssellId of relations.crosssellIds) {
        await d.insert(s.productCrosssellMap).values({ productId, crosssellId });
      }
    }
    if (relations.groupedIds) {
      await d.delete(s.productGroupedMap).where(eq(s.productGroupedMap.groupId, productId));
      let sortOrder = 0;
      for (const memberId of relations.groupedIds) {
        await d
          .insert(s.productGroupedMap)
          .values({ groupId: productId, productId: memberId, sortOrder: sortOrder++ });
      }
    }
  }

  /**
   * The lookup row mirrors the product row (docs/AGENTS.md §5
   * product_meta_lookup) and must be written in the caller's transaction.
   */
  private async syncMetaLookup(
    tx: SpcndDb,
    product: Product,
    onSale: boolean,
    priceSpan?: { minPrice: string | null; maxPrice: string | null },
  ): Promise<void> {
    const s = tx.schema;
    const ratingCounts = product.ratingCounts ?? {};
    const ratingCount = Object.values(ratingCounts).reduce((sum, n) => sum + Number(n || 0), 0);
    const values = {
      sku: product.sku,
      globalUniqueId: product.globalUniqueId,
      virtual: product.virtual,
      downloadable: product.downloadable,
      minPrice: priceSpan ? priceSpan.minPrice : product.price,
      maxPrice: priceSpan ? priceSpan.maxPrice : product.price,
      onsale: onSale,
      stockQuantity: product.stockQuantity,
      stockStatus: product.stockStatus,
      ratingCount,
      averageRating: product.averageRating,
      totalSales: product.totalSales,
      taxStatus: product.taxStatus,
      taxClass: product.taxClass,
    };
    const existing = await tx.drizzle
      .select({ productId: s.productMetaLookup.productId })
      .from(s.productMetaLookup)
      .where(eq(s.productMetaLookup.productId, product.id));
    if (existing.length > 0) {
      await tx.drizzle
        .update(s.productMetaLookup)
        .set(values)
        .where(eq(s.productMetaLookup.productId, product.id));
    } else {
      await tx.drizzle.insert(s.productMetaLookup).values({ productId: product.id, ...values });
    }
  }
}

/**
 * WC `validate_props` stock-status derivation: quantity above the no-stock
 * threshold → instock; backorders allowed → onbackorder; else outofstock.
 */
export function deriveStockStatus(
  quantity: number | null,
  backorders: string,
  noStockAmount: number,
): StockStatus {
  if (quantity === null) return 'instock';
  if (quantity > noStockAmount) return 'instock';
  if (backorders === 'yes' || backorders === 'notify') return 'onbackorder';
  return 'outofstock';
}
