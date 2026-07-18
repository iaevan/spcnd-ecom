import {
  ADDRESS_TYPES,
  API_KEY_PERMISSIONS,
  ATTRIBUTE_TYPES,
  BACKORDER_MODES,
  CATALOG_VISIBILITIES,
  CATEGORY_DISPLAY_TYPES,
  COUPON_DISCOUNT_TYPES,
  COUPON_STATUSES,
  CUSTOMER_ROLES,
  MEDIA_SOURCES,
  ORDER_ITEM_TYPES,
  ORDER_NOTE_TYPES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  REVIEW_STATUSES,
  SHIPPING_ZONE_LOCATION_TYPES,
  STOCK_STATUSES,
  TAX_RATE_LOCATION_TYPES,
  TAX_STATUSES,
  VARIATION_MANAGE_STOCK,
  WEBHOOK_STATUSES,
} from '@spacendigital/types';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean as bool,
  check,
  index,
  integer,
  jsonb as json,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { id, money, num2, stock, ts } from './columns.js';

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');
const ref = (name: string) => bigint(name, { mode: 'number' });

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    sessionKey: text('session_key').notNull(),
    sessionValue: text('session_value').notNull(),
    sessionExpiry: bigint('session_expiry', { mode: 'number' }).notNull(),
  },
  (t) => [
    uniqueIndex('sessions_session_key_uq').on(t.sessionKey),
    index('sessions_expiry_idx').on(t.sessionExpiry),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    displayName: text('display_name').notNull().default(''),
    username: text('username'),
    role: text('role', { enum: CUSTOMER_ROLES }).notNull().default('customer'),
    isPayingCustomer: bool('is_paying_customer').notNull().default(false),
    totalSpent: money('total_spent').notNull().default('0.0000'),
    orderCount: integer('order_count').notNull().default(0),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
  },
  (t) => [
    uniqueIndex('customers_email_uq').on(t.email),
    index('customers_username_idx').on(t.username),
    check('customers_role_chk', sql.raw(`"role" IN (${inList(CUSTOMER_ROLES)})`)),
  ],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    customerId: ref('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('auth_sessions_token_uq').on(t.token),
    index('auth_sessions_customer_idx').on(t.customerId),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    userId: ref('user_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    description: text('description'),
    permissions: text('permissions', { enum: API_KEY_PERMISSIONS }).notNull(),
    consumerKey: text('consumer_key').notNull(),
    consumerSecret: text('consumer_secret').notNull(),
    truncatedKey: text('truncated_key').notNull(),
    lastAccess: ts('last_access'),
  },
  (t) => [
    uniqueIndex('api_keys_consumer_key_uq').on(t.consumerKey),
    index('api_keys_user_idx').on(t.userId),
    check('api_keys_permissions_chk', sql.raw(`"permissions" IN (${inList(API_KEY_PERMISSIONS)})`)),
  ],
);

export const media = pgTable(
  'media',
  {
    id: id(),
    url: text('url').notNull(),
    alt: text('alt'),
    name: text('name'),
    mimeType: text('mime_type'),
    source: text('source', { enum: MEDIA_SOURCES }).notNull().default('local'),
    sourceId: text('source_id'),
    width: integer('width'),
    height: integer('height'),
    fileSize: bigint('file_size', { mode: 'number' }),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [check('media_source_chk', sql.raw(`"source" IN (${inList(MEDIA_SOURCES)})`))],
);

export const mediaLinks = pgTable(
  'media_links',
  {
    mediaId: ref('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    ownerType: text('owner_type').notNull(),
    ownerId: ref('owner_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.ownerType, t.ownerId] }),
    index('media_links_owner_idx').on(t.ownerType, t.ownerId),
  ],
);

export const shippingClasses = pgTable(
  'shipping_classes',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
  },
  (t) => [uniqueIndex('shipping_classes_slug_uq').on(t.slug)],
);

export const products = pgTable(
  'products',
  {
    id: id(),
    type: text('type', { enum: PRODUCT_TYPES }).notNull().default('simple'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    shortDescription: text('short_description').notNull().default(''),
    sku: text('sku'),
    globalUniqueId: text('global_unique_id'),
    regularPrice: money('regular_price'),
    salePrice: money('sale_price'),
    price: money('price'),
    dateOnSaleFrom: ts('date_on_sale_from'),
    dateOnSaleTo: ts('date_on_sale_to'),
    status: text('status', { enum: PRODUCT_STATUSES }).notNull().default('publish'),
    catalogVisibility: text('catalog_visibility', { enum: CATALOG_VISIBILITIES })
      .notNull()
      .default('visible'),
    featured: bool('featured').notNull().default(false),
    virtual: bool('virtual').notNull().default(false),
    downloadable: bool('downloadable').notNull().default(false),
    taxStatus: text('tax_status', { enum: TAX_STATUSES }).notNull().default('taxable'),
    taxClass: text('tax_class').notNull().default(''),
    manageStock: bool('manage_stock').notNull().default(false),
    stockQuantity: stock('stock_quantity'),
    stockStatus: text('stock_status', { enum: STOCK_STATUSES }).notNull().default('instock'),
    backorders: text('backorders', { enum: BACKORDER_MODES }).notNull().default('no'),
    lowStockAmount: integer('low_stock_amount'),
    soldIndividually: bool('sold_individually').notNull().default(false),
    weight: stock('weight'),
    weightUnit: text('weight_unit'),
    length: stock('length'),
    width: stock('width'),
    height: stock('height'),
    dimensionsUnit: text('dimensions_unit'),
    shippingClassId: ref('shipping_class_id').references(() => shippingClasses.id, {
      onDelete: 'set null',
    }),
    purchaseNote: text('purchase_note').notNull().default(''),
    menuOrder: integer('menu_order').notNull().default(0),
    postPassword: text('post_password'),
    reviewsAllowed: bool('reviews_allowed').notNull().default(true),
    parentId: ref('parent_id').references((): AnyPgColumn => products.id, {
      onDelete: 'cascade',
    }),
    imageId: ref('image_id').references(() => media.id, { onDelete: 'set null' }),
    galleryImageIds: json('gallery_image_ids').$type<number[]>().notNull().default([]),
    downloadLimit: integer('download_limit').notNull().default(-1),
    downloadExpiry: integer('download_expiry').notNull().default(-1),
    totalSales: bigint('total_sales', { mode: 'number' }).notNull().default(0),
    averageRating: num2('average_rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    ratingCounts: json('rating_counts').$type<Record<string, number>>().notNull().default({}),
    defaultAttributes: json('default_attributes').$type<unknown[]>().notNull().default([]),
    attributes: json('attributes').$type<unknown[]>().notNull().default([]),
    downloads: json('downloads').$type<unknown[]>().notNull().default([]),
    externalUrl: text('external_url'),
    buttonText: text('button_text'),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
  },
  (t) => [
    uniqueIndex('products_slug_uq').on(t.slug),
    uniqueIndex('products_sku_uq').on(t.sku),
    index('products_status_idx').on(t.status, t.dateCreated),
    index('products_type_idx').on(t.type),
    index('products_parent_idx').on(t.parentId),
    index('products_shipping_class_idx').on(t.shippingClassId),
    index('products_image_idx').on(t.imageId),
    check('products_type_chk', sql.raw(`"type" IN (${inList(PRODUCT_TYPES)})`)),
    check('products_status_chk', sql.raw(`"status" IN (${inList(PRODUCT_STATUSES)})`)),
    check(
      'products_catalog_visibility_chk',
      sql.raw(`"catalog_visibility" IN (${inList(CATALOG_VISIBILITIES)})`),
    ),
    check('products_stock_status_chk', sql.raw(`"stock_status" IN (${inList(STOCK_STATUSES)})`)),
    check('products_backorders_chk', sql.raw(`"backorders" IN (${inList(BACKORDER_MODES)})`)),
    check('products_tax_status_chk', sql.raw(`"tax_status" IN (${inList(TAX_STATUSES)})`)),
  ],
);

export const productVariations = pgTable(
  'product_variations',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    regularPrice: money('regular_price'),
    salePrice: money('sale_price'),
    price: money('price'),
    dateOnSaleFrom: ts('date_on_sale_from'),
    dateOnSaleTo: ts('date_on_sale_to'),
    stockQuantity: stock('stock_quantity'),
    stockStatus: text('stock_status', { enum: STOCK_STATUSES }).notNull().default('instock'),
    weight: stock('weight'),
    weightUnit: text('weight_unit'),
    length: stock('length'),
    width: stock('width'),
    height: stock('height'),
    dimensionsUnit: text('dimensions_unit'),
    imageId: ref('image_id').references(() => media.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: bool('enabled').notNull().default(true),
    virtual: bool('virtual').notNull().default(false),
    downloadable: bool('downloadable').notNull().default(false),
    description: text('description').notNull().default(''),
    downloadLimit: integer('download_limit'),
    downloadExpiry: integer('download_expiry'),
    manageStock: text('manage_stock', { enum: VARIATION_MANAGE_STOCK }).notNull().default('parent'),
    backorders: text('backorders', { enum: BACKORDER_MODES }),
    taxStatus: text('tax_status', { enum: TAX_STATUSES }).notNull().default('taxable'),
    taxClass: text('tax_class').notNull().default(''),
    shippingClassId: ref('shipping_class_id').references(() => shippingClasses.id, {
      onDelete: 'set null',
    }),
    attributes: json('attributes').$type<Record<string, string>>().notNull().default({}),
    downloads: json('downloads').$type<unknown[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex('product_variations_sku_uq').on(t.sku),
    index('product_variations_product_idx').on(t.productId),
    check(
      'product_variations_manage_stock_chk',
      sql.raw(`"manage_stock" IN (${inList(VARIATION_MANAGE_STOCK)})`),
    ),
  ],
);

export const productVariationAttributes = pgTable(
  'product_variation_attributes',
  {
    id: id(),
    variationId: ref('variation_id')
      .notNull()
      .references(() => productVariations.id, { onDelete: 'cascade' }),
    attributeId: ref('attribute_id'),
    termId: ref('term_id'),
    attributeName: text('attribute_name').notNull(),
    attributeValue: text('attribute_value').notNull(),
  },
  (t) => [index('pva_variation_idx').on(t.variationId)],
);

export const attributeTaxonomies = pgTable('attribute_taxonomies', {
  attributeId: bigserial('attribute_id', { mode: 'number' }).primaryKey(),
  attributeName: text('attribute_name').notNull(),
  attributeLabel: text('attribute_label'),
  attributeType: text('attribute_type', { enum: ATTRIBUTE_TYPES }).notNull().default('select'),
  attributeOrderby: text('attribute_orderby').notNull().default('menu_order'),
  attributePublic: integer('attribute_public').notNull().default(0),
});

export const productAttributes = pgTable(
  'product_attributes',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: text('type', { enum: ATTRIBUTE_TYPES }).notNull().default('select'),
    orderBy: text('order_by').notNull().default('menu_order'),
    hasArchives: bool('has_archives').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('product_attributes_slug_uq').on(t.slug)],
);

export const productAttributeTerms = pgTable(
  'product_attribute_terms',
  {
    id: id(),
    attributeId: ref('attribute_id')
      .notNull()
      .references(() => productAttributes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    index('product_attribute_terms_attr_idx').on(t.attributeId),
    uniqueIndex('product_attribute_terms_attr_slug_uq').on(t.attributeId, t.slug),
  ],
);

export const productCategories = pgTable(
  'product_categories',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    parentId: ref('parent_id').references((): AnyPgColumn => productCategories.id, {
      onDelete: 'cascade',
    }),
    thumbnailId: ref('thumbnail_id').references(() => media.id, { onDelete: 'set null' }),
    displayType: text('display_type', { enum: CATEGORY_DISPLAY_TYPES })
      .notNull()
      .default('default'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('product_categories_slug_uq').on(t.slug),
    index('product_categories_parent_idx').on(t.parentId),
  ],
);

export const productTags = pgTable(
  'product_tags',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
  },
  (t) => [uniqueIndex('product_tags_slug_uq').on(t.slug)],
);

export const productDownloads = pgTable(
  'product_downloads',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variationId: ref('variation_id').references(() => productVariations.id, {
      onDelete: 'cascade',
    }),
    downloadId: text('download_id').notNull(),
    name: text('name').notNull(),
    fileUrl: text('file_url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('product_downloads_download_id_uq').on(t.downloadId),
    index('product_downloads_product_idx').on(t.productId),
  ],
);

export const productMeta = pgTable(
  'product_meta',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value'),
  },
  (t) => [
    index('product_meta_owner_key_idx').on(t.productId, t.key),
    index('product_meta_key_idx').on(t.key),
  ],
);

export const productCategoryMap = pgTable(
  'product_category_map',
  {
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: ref('category_id')
      .notNull()
      .references(() => productCategories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index('product_category_map_category_idx').on(t.categoryId),
  ],
);

export const productTagMap = pgTable(
  'product_tag_map',
  {
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    tagId: ref('tag_id')
      .notNull()
      .references(() => productTags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.tagId] }),
    index('product_tag_map_tag_idx').on(t.tagId),
  ],
);

export const productUpsellMap = pgTable(
  'product_upsell_map',
  {
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    upsellId: ref('upsell_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.upsellId] })],
);

export const productCrosssellMap = pgTable(
  'product_crosssell_map',
  {
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    crosssellId: ref('crosssell_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.crosssellId] })],
);

export const productGroupedMap = pgTable(
  'product_grouped_map',
  {
    groupId: ref('group_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.productId] })],
);

export const productMetaLookup = pgTable(
  'product_meta_lookup',
  {
    productId: ref('product_id')
      .primaryKey()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    globalUniqueId: text('global_unique_id'),
    virtual: bool('virtual').notNull().default(false),
    downloadable: bool('downloadable').notNull().default(false),
    minPrice: money('min_price'),
    maxPrice: money('max_price'),
    onsale: bool('onsale').notNull().default(false),
    stockQuantity: stock('stock_quantity'),
    stockStatus: text('stock_status').notNull().default('instock'),
    ratingCount: bigint('rating_count', { mode: 'number' }).notNull().default(0),
    averageRating: num2('average_rating').notNull().default(0),
    totalSales: bigint('total_sales', { mode: 'number' }).notNull().default(0),
    taxStatus: text('tax_status').notNull().default('taxable'),
    taxClass: text('tax_class').notNull().default(''),
  },
  (t) => [
    index('product_meta_lookup_min_price_idx').on(t.minPrice),
    index('product_meta_lookup_max_price_idx').on(t.maxPrice),
    index('product_meta_lookup_onsale_idx').on(t.onsale),
    index('product_meta_lookup_stock_status_idx').on(t.stockStatus),
    index('product_meta_lookup_sku_idx').on(t.sku),
  ],
);

export const productAttributesLookup = pgTable(
  'product_attributes_lookup',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: ref('attribute_id').notNull(),
    termId: ref('term_id').notNull(),
    isVariation: bool('is_variation').notNull().default(false),
  },
  (t) => [
    index('product_attributes_lookup_product_idx').on(t.productId),
    index('product_attributes_lookup_term_idx').on(t.attributeId, t.termId),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending'),
    currency: text('currency').notNull().default('USD'),
    pricesIncludeTax: bool('prices_include_tax').notNull().default(false),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
    datePaid: ts('date_paid'),
    dateCompleted: ts('date_completed'),
    discountTotal: money('discount_total').notNull().default('0.0000'),
    discountTax: money('discount_tax').notNull().default('0.0000'),
    shippingTotal: money('shipping_total').notNull().default('0.0000'),
    shippingTax: money('shipping_tax').notNull().default('0.0000'),
    cartTax: money('cart_tax').notNull().default('0.0000'),
    total: money('total').notNull().default('0.0000'),
    totalTax: money('total_tax').notNull().default('0.0000'),
    customerId: ref('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    orderKey: text('order_key').notNull(),
    billingFirstName: text('billing_first_name').notNull().default(''),
    billingLastName: text('billing_last_name').notNull().default(''),
    billingCompany: text('billing_company').notNull().default(''),
    billingAddress1: text('billing_address_1').notNull().default(''),
    billingAddress2: text('billing_address_2').notNull().default(''),
    billingCity: text('billing_city').notNull().default(''),
    billingState: text('billing_state').notNull().default(''),
    billingPostcode: text('billing_postcode').notNull().default(''),
    billingCountry: text('billing_country').notNull().default(''),
    billingEmail: text('billing_email').notNull().default(''),
    billingPhone: text('billing_phone').notNull().default(''),
    shippingFirstName: text('shipping_first_name').notNull().default(''),
    shippingLastName: text('shipping_last_name').notNull().default(''),
    shippingCompany: text('shipping_company').notNull().default(''),
    shippingAddress1: text('shipping_address_1').notNull().default(''),
    shippingAddress2: text('shipping_address_2').notNull().default(''),
    shippingCity: text('shipping_city').notNull().default(''),
    shippingState: text('shipping_state').notNull().default(''),
    shippingPostcode: text('shipping_postcode').notNull().default(''),
    shippingCountry: text('shipping_country').notNull().default(''),
    shippingPhone: text('shipping_phone').notNull().default(''),
    paymentMethod: text('payment_method').notNull().default(''),
    paymentMethodTitle: text('payment_method_title').notNull().default(''),
    transactionId: text('transaction_id'),
    customerIpAddress: text('customer_ip_address'),
    customerUserAgent: text('customer_user_agent'),
    createdVia: text('created_via'),
    customerNote: text('customer_note'),
    parentId: ref('parent_id').references((): AnyPgColumn => orders.id, { onDelete: 'cascade' }),
    cartHash: text('cart_hash'),
  },
  (t) => [
    uniqueIndex('orders_order_key_uq').on(t.orderKey),
    index('orders_status_date_idx').on(t.status, t.dateCreated),
    index('orders_customer_date_idx').on(t.customerId, t.dateCreated),
    index('orders_parent_idx').on(t.parentId),
    index('orders_billing_email_idx').on(t.billingEmail),
    check('orders_status_chk', sql.raw(`"status" IN (${inList(ORDER_STATUSES)})`)),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: ORDER_ITEM_TYPES }).notNull(),
    productId: ref('product_id').references(() => products.id, { onDelete: 'set null' }),
    variationId: ref('variation_id').references(() => productVariations.id, {
      onDelete: 'set null',
    }),
    quantity: integer('quantity'),
    subtotal: money('subtotal'),
    total: money('total'),
    subtotalTax: money('subtotal_tax'),
    totalTax: money('total_tax'),
    taxClass: text('tax_class'),
    taxStatus: text('tax_status'),
    taxes: json('taxes').$type<{
      total: Record<string, string>;
      subtotal?: Record<string, string>;
    }>(),
    metaData: json('meta_data').$type<{ id?: number; key: string; value: unknown }[]>(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId, t.type),
    index('order_items_product_idx').on(t.productId),
    check('order_items_type_chk', sql.raw(`"type" IN (${inList(ORDER_ITEM_TYPES)})`)),
  ],
);

export const orderItemMeta = pgTable(
  'order_item_meta',
  {
    id: id(),
    orderItemId: ref('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    key: text('key'),
    value: text('value'),
  },
  (t) => [
    index('order_item_meta_owner_key_idx').on(t.orderItemId, t.key),
    index('order_item_meta_key_idx').on(t.key),
  ],
);

export const orderNotes = pgTable(
  'order_notes',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    type: text('type', { enum: ORDER_NOTE_TYPES }).notNull().default('private'),
    createdBy: text('created_by'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [
    index('order_notes_order_idx').on(t.orderId),
    check('order_notes_type_chk', sql.raw(`"type" IN (${inList(ORDER_NOTE_TYPES)})`)),
  ],
);

export const orderRefunds = pgTable(
  'order_refunds',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    amount: money('amount').notNull().default('0.0000'),
    reason: text('reason'),
    refundedBy: ref('refunded_by').references(() => customers.id, { onDelete: 'set null' }),
    refundedPayment: bool('refunded_payment').notNull().default(false),
    lineItems: json('line_items').$type<unknown[]>().notNull().default([]),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [index('order_refunds_order_idx').on(t.orderId)],
);

export const orderMeta = pgTable(
  'order_meta',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value'),
  },
  (t) => [
    index('order_meta_owner_key_idx').on(t.orderId, t.key),
    index('order_meta_key_idx').on(t.key),
  ],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: json('payload').$type<Record<string, unknown>>(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [uniqueIndex('order_events_order_event_uq').on(t.orderId, t.eventType)],
);

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: id(),
    customerId: ref('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ADDRESS_TYPES }).notNull(),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    company: text('company').notNull().default(''),
    address1: text('address_1').notNull().default(''),
    address2: text('address_2').notNull().default(''),
    city: text('city').notNull().default(''),
    state: text('state').notNull().default(''),
    postcode: text('postcode').notNull().default(''),
    country: text('country').notNull().default(''),
    email: text('email'),
    phone: text('phone').notNull().default(''),
  },
  (t) => [
    uniqueIndex('customer_addresses_customer_type_uq').on(t.customerId, t.type),
    check('customer_addresses_type_chk', sql.raw(`"type" IN (${inList(ADDRESS_TYPES)})`)),
  ],
);

export const customerMeta = pgTable(
  'customer_meta',
  {
    id: id(),
    customerId: ref('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value'),
  },
  (t) => [
    index('customer_meta_owner_key_idx').on(t.customerId, t.key),
    index('customer_meta_key_idx').on(t.key),
  ],
);

export const coupons = pgTable(
  'coupons',
  {
    id: id(),
    code: text('code').notNull(),
    amount: money('amount').notNull().default('0.0000'),
    status: text('status', { enum: COUPON_STATUSES }).notNull().default('publish'),
    description: text('description').notNull().default(''),
    discountType: text('discount_type', { enum: COUPON_DISCOUNT_TYPES })
      .notNull()
      .default('fixed_cart'),
    dateExpires: ts('date_expires'),
    usageCount: integer('usage_count').notNull().default(0),
    individualUse: bool('individual_use').notNull().default(false),
    usageLimit: integer('usage_limit'),
    usageLimitPerUser: integer('usage_limit_per_user'),
    limitUsageToXItems: integer('limit_usage_to_x_items'),
    freeShipping: bool('free_shipping').notNull().default(false),
    excludeSaleItems: bool('exclude_sale_items').notNull().default(false),
    minimumAmount: money('minimum_amount'),
    maximumAmount: money('maximum_amount'),
    emailRestrictions: json('email_restrictions').$type<string[]>().notNull().default([]),
    productIds: json('product_ids').$type<number[]>().notNull().default([]),
    excludedProductIds: json('excluded_product_ids').$type<number[]>().notNull().default([]),
    productCategories: json('product_categories').$type<number[]>().notNull().default([]),
    excludedProductCategories: json('excluded_product_categories')
      .$type<number[]>()
      .notNull()
      .default([]),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
  },
  (t) => [
    uniqueIndex('coupons_code_uq').on(t.code),
    check(
      'coupons_discount_type_chk',
      sql.raw(`"discount_type" IN (${inList(COUPON_DISCOUNT_TYPES)})`),
    ),
  ],
);

export const couponUsage = pgTable(
  'coupon_usage',
  {
    id: id(),
    couponId: ref('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: ref('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    usedBy: text('used_by').notNull().default(''),
    amount: money('amount').notNull().default('0.0000'),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [
    index('coupon_usage_coupon_idx').on(t.couponId),
    index('coupon_usage_order_idx').on(t.orderId),
    index('coupon_usage_used_by_idx').on(t.usedBy),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: ref('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    content: text('content').notNull(),
    status: text('status', { enum: REVIEW_STATUSES }).notNull().default('pending'),
    verifiedOwner: bool('verified_owner').notNull().default(false),
    authorName: text('author_name').notNull().default(''),
    authorEmail: text('author_email').notNull().default(''),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [
    index('reviews_product_status_idx').on(t.productId, t.status),
    check('reviews_rating_chk', sql.raw(`"rating" BETWEEN 1 AND 5`)),
    check('reviews_status_chk', sql.raw(`"status" IN (${inList(REVIEW_STATUSES)})`)),
  ],
);

export const shippingZones = pgTable('shipping_zones', {
  id: id(),
  zoneName: text('zone_name').notNull(),
  zoneOrder: integer('zone_order').notNull().default(0),
});

export const shippingZoneLocations = pgTable(
  'shipping_zone_locations',
  {
    id: id(),
    zoneId: ref('zone_id')
      .notNull()
      .references(() => shippingZones.id, { onDelete: 'cascade' }),
    locationCode: text('location_code').notNull(),
    locationType: text('location_type', { enum: SHIPPING_ZONE_LOCATION_TYPES }).notNull(),
  },
  (t) => [
    index('shipping_zone_locations_zone_idx').on(t.zoneId),
    index('shipping_zone_locations_type_code_idx').on(t.locationType, t.locationCode),
    check(
      'shipping_zone_locations_type_chk',
      sql.raw(`"location_type" IN (${inList(SHIPPING_ZONE_LOCATION_TYPES)})`),
    ),
  ],
);

export const shippingZoneMethods = pgTable(
  'shipping_zone_methods',
  {
    id: id(),
    zoneId: ref('zone_id')
      .notNull()
      .references(() => shippingZones.id, { onDelete: 'cascade' }),
    methodId: text('method_id').notNull(),
    methodOrder: integer('method_order').notNull().default(0),
    isEnabled: bool('is_enabled').notNull().default(true),
    settings: json('settings').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('shipping_zone_methods_zone_idx').on(t.zoneId)],
);

export const taxClasses = pgTable(
  'tax_classes',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
  },
  (t) => [uniqueIndex('tax_classes_slug_uq').on(t.slug)],
);

export const taxRates = pgTable(
  'tax_rates',
  {
    id: id(),
    taxClassId: ref('tax_class_id').references(() => taxClasses.id, { onDelete: 'cascade' }),
    country: text('country').notNull().default(''),
    state: text('state').notNull().default(''),
    name: text('name').notNull().default('Tax'),
    rate: text('rate').notNull().default('0.0000'),
    priority: integer('priority').notNull().default(1),
    compound: bool('compound').notNull().default(false),
    shipping: bool('shipping').notNull().default(true),
    order: integer('order').notNull().default(0),
  },
  (t) => [
    index('tax_rates_country_idx').on(t.country),
    index('tax_rates_class_idx').on(t.taxClassId),
    index('tax_rates_priority_idx').on(t.priority),
  ],
);

export const taxRateLocations = pgTable(
  'tax_rate_locations',
  {
    id: id(),
    taxRateId: ref('tax_rate_id')
      .notNull()
      .references(() => taxRates.id, { onDelete: 'cascade' }),
    locationCode: text('location_code').notNull(),
    locationType: text('location_type', { enum: TAX_RATE_LOCATION_TYPES }).notNull(),
  },
  (t) => [
    index('tax_rate_locations_rate_idx').on(t.taxRateId),
    index('tax_rate_locations_code_idx').on(t.locationCode, t.locationType),
    check(
      'tax_rate_locations_type_chk',
      sql.raw(`"location_type" IN (${inList(TAX_RATE_LOCATION_TYPES)})`),
    ),
  ],
);

export const paymentTokens = pgTable(
  'payment_tokens',
  {
    id: id(),
    userId: ref('user_id').references(() => customers.id, { onDelete: 'cascade' }),
    gateway: text('gateway').notNull(),
    token: text('token').notNull(),
    type: text('type').notNull().default('CC'),
    last4: text('last4'),
    expiry: text('expiry'),
    cardType: text('card_type'),
    isDefault: bool('is_default').notNull().default(false),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [index('payment_tokens_user_idx').on(t.userId)],
);

export const paymentTokenMeta = pgTable(
  'payment_token_meta',
  {
    id: id(),
    tokenId: ref('token_id')
      .notNull()
      .references(() => paymentTokens.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value'),
  },
  (t) => [index('payment_token_meta_owner_key_idx').on(t.tokenId, t.key)],
);

export const downloadPermissions = pgTable(
  'download_permissions',
  {
    id: id(),
    downloadId: text('download_id').notNull(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    orderKey: text('order_key').notNull(),
    userId: ref('user_id').references(() => customers.id, { onDelete: 'set null' }),
    userEmail: text('user_email').notNull(),
    downloadsRemaining: integer('downloads_remaining'),
    accessGranted: ts('access_granted').notNull(),
    accessExpires: ts('access_expires'),
    downloadCount: integer('download_count').notNull().default(0),
  },
  (t) => [
    index('download_permissions_order_idx').on(t.orderId),
    index('download_permissions_email_order_key_idx').on(t.userEmail, t.orderKey),
    index('download_permissions_user_idx').on(t.userId),
  ],
);

export const webhooks = pgTable(
  'webhooks',
  {
    id: id(),
    status: text('status', { enum: WEBHOOK_STATUSES }).notNull().default('active'),
    name: text('name').notNull(),
    userId: ref('user_id').references(() => customers.id, { onDelete: 'set null' }),
    deliveryUrl: text('delivery_url').notNull(),
    secret: text('secret').notNull().default(''),
    topic: text('topic').notNull(),
    apiVersion: integer('api_version').notNull().default(3),
    failureCount: integer('failure_count').notNull().default(0),
    pendingDelivery: bool('pending_delivery').notNull().default(false),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
  },
  (t) => [
    index('webhooks_status_idx').on(t.status),
    index('webhooks_topic_idx').on(t.topic),
    check('webhooks_status_chk', sql.raw(`"status" IN (${inList(WEBHOOK_STATUSES)})`)),
  ],
);

export const settingsBoolean = pgTable('settings_boolean', {
  key: text('key').primaryKey(),
  value: bool('value').notNull(),
});

export const settingsInteger = pgTable('settings_integer', {
  key: text('key').primaryKey(),
  value: bigint('value', { mode: 'number' }).notNull(),
});

export const settingsString = pgTable('settings_string', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const settingsJson = pgTable('settings_json', {
  key: text('key').primaryKey(),
  value: json('value').notNull(),
});

export const settingsGeneral = pgTable('settings_general', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const adminNotes = pgTable('admin_notes', {
  id: id(),
  name: text('name').notNull(),
  type: text('type').notNull().default('info'),
  source: text('source').notNull().default('spcnd-ecom'),
  title: text('title').notNull(),
  content: text('content'),
  isSnoozable: bool('is_snoozable').notNull().default(false),
  isRead: bool('is_read').notNull().default(false),
  severity: text('severity'),
  dateCreated: ts('date_created').notNull(),
});

export const systemLog = pgTable(
  'system_log',
  {
    id: id(),
    level: text('level').notNull(),
    source: text('source').notNull().default(''),
    message: text('message').notNull(),
    context: json('context').$type<Record<string, unknown>>(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('system_log_level_idx').on(t.level, t.createdAt)],
);

export const queueJobs = pgTable(
  'queue_jobs',
  {
    id: id(),
    queue: text('queue').notNull().default('default'),
    payload: json('payload').$type<Record<string, unknown>>().notNull(),
    attempts: integer('attempts').notNull().default(0),
    availableAt: ts('available_at').notNull(),
    reservedAt: ts('reserved_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('queue_jobs_queue_available_idx').on(t.queue, t.availableAt)],
);

export const orderStats = pgTable(
  'order_stats',
  {
    orderId: ref('order_id')
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    parentId: ref('parent_id'),
    status: text('status').notNull(),
    totalSales: money('total_sales').notNull().default('0.0000'),
    taxTotal: money('tax_total').notNull().default('0.0000'),
    shippingTotal: money('shipping_total').notNull().default('0.0000'),
    netTotal: money('net_total').notNull().default('0.0000'),
    returningCustomer: bool('returning_customer').notNull().default(false),
    customerId: ref('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    numItemsSold: integer('num_items_sold').notNull().default(0),
    dateCreated: ts('date_created').notNull(),
    datePaid: ts('date_paid'),
  },
  (t) => [
    index('order_stats_date_idx').on(t.dateCreated),
    index('order_stats_customer_idx').on(t.customerId),
    index('order_stats_status_idx').on(t.status),
  ],
);

export const orderProductLookup = pgTable(
  'order_product_lookup',
  {
    orderItemId: ref('order_item_id')
      .primaryKey()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variationId: ref('variation_id'),
    customerId: ref('customer_id'),
    qty: integer('qty').notNull().default(0),
    totalSales: money('total_sales').notNull().default('0.0000'),
    taxTotal: money('tax_total').notNull().default('0.0000'),
    shippingTotal: money('shipping_total').notNull().default('0.0000'),
    couponAmount: money('coupon_amount').notNull().default('0.0000'),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [
    index('order_product_lookup_order_idx').on(t.orderId),
    index('order_product_lookup_product_idx').on(t.productId),
    index('order_product_lookup_date_idx').on(t.dateCreated),
  ],
);

export const orderTaxLookup = pgTable(
  'order_tax_lookup',
  {
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    taxRateId: ref('tax_rate_id').notNull(),
    dateCreated: ts('date_created').notNull(),
    shippingTax: money('shipping_tax').notNull().default('0.0000'),
    orderTax: money('order_tax').notNull().default('0.0000'),
    totalTax: money('total_tax').notNull().default('0.0000'),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.taxRateId] }),
    index('order_tax_lookup_rate_idx').on(t.taxRateId),
  ],
);

export const orderCouponLookup = pgTable(
  'order_coupon_lookup',
  {
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    couponId: ref('coupon_id').notNull(),
    dateCreated: ts('date_created').notNull(),
    discountAmount: money('discount_amount').notNull().default('0.0000'),
    discountAmountTax: money('discount_amount_tax').notNull().default('0.0000'),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.couponId] }),
    index('order_coupon_lookup_coupon_idx').on(t.couponId),
  ],
);

export const customerLookup = pgTable(
  'customer_lookup',
  {
    customerId: ref('customer_id')
      .primaryKey()
      .references(() => customers.id, { onDelete: 'cascade' }),
    username: text('username').notNull().default(''),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    email: text('email').notNull().default(''),
    country: text('country').notNull().default(''),
    city: text('city').notNull().default(''),
    state: text('state').notNull().default(''),
    postcode: text('postcode').notNull().default(''),
    totalSpent: money('total_spent').notNull().default('0.0000'),
    orderCount: integer('order_count').notNull().default(0),
    avgOrderValue: money('avg_order_value').notNull().default('0.0000'),
    dateRegistered: ts('date_registered'),
    dateLastActive: ts('date_last_active'),
  },
  (t) => [index('customer_lookup_email_idx').on(t.email)],
);

export const categoryLookup = pgTable('category_lookup', {
  categoryId: ref('category_id')
    .primaryKey()
    .references(() => productCategories.id, { onDelete: 'cascade' }),
  categoryTree: text('category_tree').notNull().default(''),
  count: integer('count').notNull().default(0),
});
