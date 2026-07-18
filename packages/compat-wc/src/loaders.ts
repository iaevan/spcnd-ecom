import type { Order, Product, ProductService, OrderService } from '@spacendigital/core';
import type { SpcndDb } from '@spacendigital/db';
import { asc, eq, inArray } from 'drizzle-orm';
import type { OrderRelations, ProductRelations, WcMetaData } from './serializers.js';

/**
 * Relation loaders feeding the pure serializers. The api package calls
 * `loadProductRelations` + `serializeProduct` per row for `/api/v3/products`.
 */

export interface LoaderDeps {
  db: SpcndDb;
  products: ProductService;
  orders: OrderService;
}

async function productMetaData(db: SpcndDb, productId: number): Promise<WcMetaData[]> {
  const s = db.schema;
  const rows = await db.drizzle
    .select()
    .from(s.productMeta)
    .where(eq(s.productMeta.productId, productId))
    .orderBy(asc(s.productMeta.id));
  return rows.map((r) => ({ id: r.id, key: r.key, value: r.value ?? '' }));
}

export async function loadProductRelations(
  deps: LoaderDeps,
  product: Product,
): Promise<ProductRelations> {
  const { db, products } = deps;
  const s = db.schema;

  const categories = await db.drizzle
    .select({ id: s.productCategories.id, name: s.productCategories.name, slug: s.productCategories.slug })
    .from(s.productCategoryMap)
    .innerJoin(s.productCategories, eq(s.productCategories.id, s.productCategoryMap.categoryId))
    .where(eq(s.productCategoryMap.productId, product.id));
  const tags = await db.drizzle
    .select({ id: s.productTags.id, name: s.productTags.name, slug: s.productTags.slug })
    .from(s.productTagMap)
    .innerJoin(s.productTags, eq(s.productTags.id, s.productTagMap.tagId))
    .where(eq(s.productTagMap.productId, product.id));

  const imageIds = [product.imageId, ...(product.galleryImageIds ?? [])].filter(
    (id): id is number => typeof id === 'number',
  );
  const imageRows =
    imageIds.length > 0
      ? await db.drizzle.select().from(s.media).where(inArray(s.media.id, imageIds))
      : [];
  // Preserve featured-then-gallery order.
  const images = imageIds
    .map((id) => imageRows.find((m) => m.id === id))
    .filter((m): m is (typeof imageRows)[number] => m !== undefined);

  const variationRows =
    product.type === 'variable' ? await products.getVariations(product.id) : [];

  const shippingClassSlug = product.shippingClassId
    ? ((
        await db.drizzle
          .select({ slug: s.shippingClasses.slug })
          .from(s.shippingClasses)
          .where(eq(s.shippingClasses.id, product.shippingClassId))
      )[0]?.slug ?? '')
    : '';

  return {
    categories,
    tags,
    images,
    variations: variationRows.map((v) => v.id),
    groupedProducts: await products.getGroupedIds(product.id),
    upsellIds: await products.getUpsellIds(product.id),
    crosssellIds: await products.getCrosssellIds(product.id),
    relatedIds: await products.getRelatedIds(product.id),
    metaData: await productMetaData(db, product.id),
    shippingClassSlug,
    onSale: await products.isOnSale(product),
    purchasable: await products.isPurchasable(product),
  };
}

export async function loadOrderRelations(deps: LoaderDeps, order: Order): Promise<OrderRelations> {
  const { db, orders } = deps;
  const s = db.schema;
  const metaRows = await db.drizzle
    .select()
    .from(s.orderMeta)
    .where(eq(s.orderMeta.orderId, order.id))
    .orderBy(asc(s.orderMeta.id));
  return {
    items: await orders.getItems(order.id),
    refunds: await orders.getRefunds(order.id),
    metaData: metaRows.map((r) => ({ id: r.id, key: r.key, value: r.value ?? '' })),
  };
}

/** used_by list for coupon serialization (customer id as string, else email). */
export async function loadCouponUsedBy(db: SpcndDb, couponId: number): Promise<string[]> {
  const s = db.schema;
  const rows = await db.drizzle
    .select()
    .from(s.couponUsage)
    .where(eq(s.couponUsage.couponId, couponId))
    .orderBy(asc(s.couponUsage.id));
  return rows.map((r) => (r.customerId !== null ? String(r.customerId) : r.usedBy));
}
