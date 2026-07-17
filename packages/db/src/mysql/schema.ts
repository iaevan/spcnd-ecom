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
} from '@spcnd-ecom/types';
import { sql } from 'drizzle-orm';
import {
  type AnyMySqlColumn,
  bigint,
  boolean as bool,
  check,
  index,
  int as integer,
  json,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { id, money, num2, ref, stock, ts } from './columns.js';

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

export const sessions = mysqlTable(
  'sessions',
  {
    id: id(),
    sessionKey: varchar('session_key', { length: 64 }).notNull(),
    sessionValue: text('session_value').notNull(),
    sessionExpiry: bigint('session_expiry', { mode: 'number' }).notNull(),
  },
  (t) => [
    uniqueIndex('sessions_session_key_uq').on(t.sessionKey),
    index('sessions_expiry_idx').on(t.sessionExpiry),
  ],
);

export const customers = mysqlTable(
  'customers',
  {
    id: id(),
    email: varchar('email', { length: 200 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 200 }).notNull().default(''),
    lastName: varchar('last_name', { length: 200 }).notNull().default(''),
    displayName: varchar('display_name', { length: 200 }).notNull().default(''),
    username: varchar('username', { length: 60 }),
    role: varchar('role', { length: 50, enum: CUSTOMER_ROLES }).notNull().default('customer'),
    isPayingCustomer: bool('is_paying_customer').notNull().default(false),
    totalSpent: money('total_spent').notNull().default('0.0000'),
    orderCount: integer('order_count').notNull().default(0),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
  },
  (t) => [
    uniqueIndex('customers_email_uq').on(t.email),
    index('customers_username_idx').on(t.username),
    check('customers_role_chk', sql.raw(`\`role\` IN (${inList(CUSTOMER_ROLES)})`)),
  ],
);

export const authSessions = mysqlTable(
  'auth_sessions',
  {
    id: id(),
    customerId: ref('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('auth_sessions_token_uq').on(t.token),
    index('auth_sessions_customer_idx').on(t.customerId),
  ],
);

export const apiKeys = mysqlTable(
  'api_keys',
  {
    id: id(),
    userId: ref('user_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 200 }),
    permissions: varchar('permissions', { length: 10, enum: API_KEY_PERMISSIONS }).notNull(),
    consumerKey: varchar('consumer_key', { length: 64 }).notNull(),
    consumerSecret: varchar('consumer_secret', { length: 43 }).notNull(),
    truncatedKey: varchar('truncated_key', { length: 7 }).notNull(),
    lastAccess: ts('last_access'),
  },
  (t) => [
    uniqueIndex('api_keys_consumer_key_uq').on(t.consumerKey),
    index('api_keys_user_idx').on(t.userId),
    check(
      'api_keys_permissions_chk',
      sql.raw(`\`permissions\` IN (${inList(API_KEY_PERMISSIONS)})`),
    ),
  ],
);

export const media = mysqlTable(
  'media',
  {
    id: id(),
    url: text('url').notNull(),
    alt: varchar('alt', { length: 500 }),
    name: varchar('name', { length: 500 }),
    mimeType: varchar('mime_type', { length: 100 }),
    source: varchar('source', { length: 50, enum: MEDIA_SOURCES }).notNull().default('local'),
    sourceId: varchar('source_id', { length: 255 }),
    width: integer('width'),
    height: integer('height'),
    fileSize: bigint('file_size', { mode: 'number' }),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [check('media_source_chk', sql.raw(`\`source\` IN (${inList(MEDIA_SOURCES)})`))],
);

export const mediaLinks = mysqlTable(
  'media_links',
  {
    mediaId: ref('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    ownerType: varchar('owner_type', { length: 50 }).notNull(),
    ownerId: ref('owner_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.ownerType, t.ownerId] }),
    index('media_links_owner_idx').on(t.ownerType, t.ownerId),
  ],
);

export const shippingClasses = mysqlTable(
  'shipping_classes',
  {
    id: id(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    description: text('description').notNull(),
  },
  (t) => [uniqueIndex('shipping_classes_slug_uq').on(t.slug)],
);

export const products = mysqlTable(
  'products',
  {
    id: id(),
    type: varchar('type', { length: 50, enum: PRODUCT_TYPES }).notNull().default('simple'),
    name: varchar('name', { length: 500 }).notNull(),
    slug: varchar('slug', { length: 500 }).notNull(),
    description: text('description').notNull(),
    shortDescription: text('short_description').notNull(),
    sku: varchar('sku', { length: 100 }),
    globalUniqueId: varchar('global_unique_id', { length: 100 }),
    regularPrice: money('regular_price'),
    salePrice: money('sale_price'),
    price: money('price'),
    dateOnSaleFrom: ts('date_on_sale_from'),
    dateOnSaleTo: ts('date_on_sale_to'),
    status: varchar('status', { length: 20, enum: PRODUCT_STATUSES }).notNull().default('publish'),
    catalogVisibility: varchar('catalog_visibility', { length: 20, enum: CATALOG_VISIBILITIES })
      .notNull()
      .default('visible'),
    featured: bool('featured').notNull().default(false),
    virtual: bool('virtual').notNull().default(false),
    downloadable: bool('downloadable').notNull().default(false),
    taxStatus: varchar('tax_status', { length: 20, enum: TAX_STATUSES })
      .notNull()
      .default('taxable'),
    taxClass: varchar('tax_class', { length: 200 }).notNull().default(''),
    manageStock: bool('manage_stock').notNull().default(false),
    stockQuantity: stock('stock_quantity'),
    stockStatus: varchar('stock_status', { length: 20, enum: STOCK_STATUSES })
      .notNull()
      .default('instock'),
    backorders: varchar('backorders', { length: 10, enum: BACKORDER_MODES })
      .notNull()
      .default('no'),
    lowStockAmount: integer('low_stock_amount'),
    soldIndividually: bool('sold_individually').notNull().default(false),
    weight: stock('weight'),
    weightUnit: varchar('weight_unit', { length: 2 }),
    length: stock('length'),
    width: stock('width'),
    height: stock('height'),
    dimensionsUnit: varchar('dimensions_unit', { length: 2 }),
    shippingClassId: ref('shipping_class_id').references(() => shippingClasses.id, {
      onDelete: 'set null',
    }),
    purchaseNote: text('purchase_note').notNull(),
    menuOrder: integer('menu_order').notNull().default(0),
    postPassword: varchar('post_password', { length: 255 }),
    reviewsAllowed: bool('reviews_allowed').notNull().default(true),
    parentId: ref('parent_id').references((): AnyMySqlColumn => products.id, {
      onDelete: 'cascade',
    }),
    imageId: ref('image_id').references(() => media.id, { onDelete: 'set null' }),
    galleryImageIds: json('gallery_image_ids').$type<number[]>().notNull(),
    downloadLimit: integer('download_limit').notNull().default(-1),
    downloadExpiry: integer('download_expiry').notNull().default(-1),
    totalSales: bigint('total_sales', { mode: 'number' }).notNull().default(0),
    averageRating: num2('average_rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    ratingCounts: json('rating_counts').$type<Record<string, number>>().notNull(),
    defaultAttributes: json('default_attributes').$type<unknown[]>().notNull(),
    attributes: json('attributes').$type<unknown[]>().notNull(),
    downloads: json('downloads').$type<unknown[]>().notNull(),
    externalUrl: varchar('external_url', { length: 500 }),
    buttonText: varchar('button_text', { length: 200 }),
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
    check('products_type_chk', sql.raw(`\`type\` IN (${inList(PRODUCT_TYPES)})`)),
    check('products_status_chk', sql.raw(`\`status\` IN (${inList(PRODUCT_STATUSES)})`)),
    check(
      'products_catalog_visibility_chk',
      sql.raw(`\`catalog_visibility\` IN (${inList(CATALOG_VISIBILITIES)})`),
    ),
    check('products_stock_status_chk', sql.raw(`\`stock_status\` IN (${inList(STOCK_STATUSES)})`)),
    check('products_backorders_chk', sql.raw(`\`backorders\` IN (${inList(BACKORDER_MODES)})`)),
    check('products_tax_status_chk', sql.raw(`\`tax_status\` IN (${inList(TAX_STATUSES)})`)),
  ],
);

export const productVariations = mysqlTable(
  'product_variations',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 100 }),
    regularPrice: money('regular_price'),
    salePrice: money('sale_price'),
    price: money('price'),
    dateOnSaleFrom: ts('date_on_sale_from'),
    dateOnSaleTo: ts('date_on_sale_to'),
    stockQuantity: stock('stock_quantity'),
    stockStatus: varchar('stock_status', { length: 20, enum: STOCK_STATUSES })
      .notNull()
      .default('instock'),
    weight: stock('weight'),
    weightUnit: varchar('weight_unit', { length: 2 }),
    length: stock('length'),
    width: stock('width'),
    height: stock('height'),
    dimensionsUnit: varchar('dimensions_unit', { length: 2 }),
    imageId: ref('image_id').references(() => media.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: bool('enabled').notNull().default(true),
    virtual: bool('virtual').notNull().default(false),
    downloadable: bool('downloadable').notNull().default(false),
    description: text('description').notNull(),
    downloadLimit: integer('download_limit'),
    downloadExpiry: integer('download_expiry'),
    manageStock: varchar('manage_stock', { length: 10, enum: VARIATION_MANAGE_STOCK })
      .notNull()
      .default('parent'),
    backorders: varchar('backorders', { length: 10, enum: BACKORDER_MODES }),
    taxStatus: varchar('tax_status', { length: 20, enum: TAX_STATUSES })
      .notNull()
      .default('taxable'),
    taxClass: varchar('tax_class', { length: 200 }).notNull().default(''),
    shippingClassId: ref('shipping_class_id').references(() => shippingClasses.id, {
      onDelete: 'set null',
    }),
    attributes: json('attributes').$type<Record<string, string>>().notNull(),
    downloads: json('downloads').$type<unknown[]>().notNull(),
  },
  (t) => [
    uniqueIndex('product_variations_sku_uq').on(t.sku),
    index('product_variations_product_idx').on(t.productId),
    check(
      'product_variations_manage_stock_chk',
      sql.raw(`\`manage_stock\` IN (${inList(VARIATION_MANAGE_STOCK)})`),
    ),
  ],
);

export const productVariationAttributes = mysqlTable(
  'product_variation_attributes',
  {
    id: id(),
    variationId: ref('variation_id')
      .notNull()
      .references(() => productVariations.id, { onDelete: 'cascade' }),
    attributeId: ref('attribute_id'),
    termId: ref('term_id'),
    attributeName: varchar('attribute_name', { length: 200 }).notNull(),
    attributeValue: varchar('attribute_value', { length: 500 }).notNull(),
  },
  (t) => [index('pva_variation_idx').on(t.variationId)],
);

export const attributeTaxonomies = mysqlTable('attribute_taxonomies', {
  attributeId: bigint('attribute_id', { mode: 'number' }).autoincrement().primaryKey(),
  attributeName: varchar('attribute_name', { length: 200 }).notNull(),
  attributeLabel: varchar('attribute_label', { length: 200 }),
  attributeType: varchar('attribute_type', { length: 20, enum: ATTRIBUTE_TYPES })
    .notNull()
    .default('select'),
  attributeOrderby: varchar('attribute_orderby', { length: 20 }).notNull().default('menu_order'),
  attributePublic: integer('attribute_public').notNull().default(0),
});

export const productAttributes = mysqlTable(
  'product_attributes',
  {
    id: id(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    type: varchar('type', { length: 20, enum: ATTRIBUTE_TYPES }).notNull().default('select'),
    orderBy: varchar('order_by', { length: 20 }).notNull().default('menu_order'),
    hasArchives: bool('has_archives').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('product_attributes_slug_uq').on(t.slug)],
);

export const productAttributeTerms = mysqlTable(
  'product_attribute_terms',
  {
    id: id(),
    attributeId: ref('attribute_id')
      .notNull()
      .references(() => productAttributes.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    index('product_attribute_terms_attr_idx').on(t.attributeId),
    uniqueIndex('product_attribute_terms_attr_slug_uq').on(t.attributeId, t.slug),
  ],
);

export const productCategories = mysqlTable(
  'product_categories',
  {
    id: id(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    description: text('description').notNull(),
    parentId: ref('parent_id').references((): AnyMySqlColumn => productCategories.id, {
      onDelete: 'cascade',
    }),
    thumbnailId: ref('thumbnail_id').references(() => media.id, { onDelete: 'set null' }),
    displayType: varchar('display_type', { length: 20, enum: CATEGORY_DISPLAY_TYPES })
      .notNull()
      .default('default'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('product_categories_slug_uq').on(t.slug),
    index('product_categories_parent_idx').on(t.parentId),
  ],
);

export const productTags = mysqlTable(
  'product_tags',
  {
    id: id(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    description: text('description').notNull(),
  },
  (t) => [uniqueIndex('product_tags_slug_uq').on(t.slug)],
);

export const productDownloads = mysqlTable(
  'product_downloads',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variationId: ref('variation_id').references(() => productVariations.id, {
      onDelete: 'cascade',
    }),
    downloadId: varchar('download_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 500 }).notNull(),
    fileUrl: text('file_url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('product_downloads_download_id_uq').on(t.downloadId),
    index('product_downloads_product_idx').on(t.productId),
  ],
);

export const productMeta = mysqlTable(
  'product_meta',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 255 }).notNull(),
    value: text('value'),
  },
  (t) => [
    index('product_meta_owner_key_idx').on(t.productId, t.key),
    index('product_meta_key_idx').on(t.key),
  ],
);

export const productCategoryMap = mysqlTable(
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

export const productTagMap = mysqlTable(
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

export const productUpsellMap = mysqlTable(
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

export const productCrosssellMap = mysqlTable(
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

export const productGroupedMap = mysqlTable(
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

export const productMetaLookup = mysqlTable(
  'product_meta_lookup',
  {
    productId: ref('product_id')
      .primaryKey()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 100 }),
    globalUniqueId: varchar('global_unique_id', { length: 100 }),
    virtual: bool('virtual').notNull().default(false),
    downloadable: bool('downloadable').notNull().default(false),
    minPrice: money('min_price'),
    maxPrice: money('max_price'),
    onsale: bool('onsale').notNull().default(false),
    stockQuantity: stock('stock_quantity'),
    stockStatus: varchar('stock_status', { length: 100 }).notNull().default('instock'),
    ratingCount: bigint('rating_count', { mode: 'number' }).notNull().default(0),
    averageRating: num2('average_rating').notNull().default(0),
    totalSales: bigint('total_sales', { mode: 'number' }).notNull().default(0),
    taxStatus: varchar('tax_status', { length: 100 }).notNull().default('taxable'),
    taxClass: varchar('tax_class', { length: 100 }).notNull().default(''),
  },
  (t) => [
    index('product_meta_lookup_min_price_idx').on(t.minPrice),
    index('product_meta_lookup_max_price_idx').on(t.maxPrice),
    index('product_meta_lookup_onsale_idx').on(t.onsale),
    index('product_meta_lookup_stock_status_idx').on(t.stockStatus),
    index('product_meta_lookup_sku_idx').on(t.sku),
  ],
);

export const productAttributesLookup = mysqlTable(
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

export const orders = mysqlTable(
  'orders',
  {
    id: id(),
    status: varchar('status', { length: 20, enum: ORDER_STATUSES }).notNull().default('pending'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
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
    orderKey: varchar('order_key', { length: 22 }).notNull(),
    billingFirstName: varchar('billing_first_name', { length: 255 }).notNull().default(''),
    billingLastName: varchar('billing_last_name', { length: 255 }).notNull().default(''),
    billingCompany: varchar('billing_company', { length: 255 }).notNull().default(''),
    billingAddress1: varchar('billing_address_1', { length: 255 }).notNull().default(''),
    billingAddress2: varchar('billing_address_2', { length: 255 }).notNull().default(''),
    billingCity: varchar('billing_city', { length: 255 }).notNull().default(''),
    billingState: varchar('billing_state', { length: 255 }).notNull().default(''),
    billingPostcode: varchar('billing_postcode', { length: 20 }).notNull().default(''),
    billingCountry: varchar('billing_country', { length: 20 }).notNull().default(''),
    billingEmail: varchar('billing_email', { length: 320 }).notNull().default(''),
    billingPhone: varchar('billing_phone', { length: 100 }).notNull().default(''),
    shippingFirstName: varchar('shipping_first_name', { length: 255 }).notNull().default(''),
    shippingLastName: varchar('shipping_last_name', { length: 255 }).notNull().default(''),
    shippingCompany: varchar('shipping_company', { length: 255 }).notNull().default(''),
    shippingAddress1: varchar('shipping_address_1', { length: 255 }).notNull().default(''),
    shippingAddress2: varchar('shipping_address_2', { length: 255 }).notNull().default(''),
    shippingCity: varchar('shipping_city', { length: 255 }).notNull().default(''),
    shippingState: varchar('shipping_state', { length: 255 }).notNull().default(''),
    shippingPostcode: varchar('shipping_postcode', { length: 20 }).notNull().default(''),
    shippingCountry: varchar('shipping_country', { length: 20 }).notNull().default(''),
    shippingPhone: varchar('shipping_phone', { length: 100 }).notNull().default(''),
    paymentMethod: varchar('payment_method', { length: 200 }).notNull().default(''),
    paymentMethodTitle: varchar('payment_method_title', { length: 500 }).notNull().default(''),
    transactionId: varchar('transaction_id', { length: 200 }),
    customerIpAddress: varchar('customer_ip_address', { length: 45 }),
    customerUserAgent: text('customer_user_agent'),
    createdVia: varchar('created_via', { length: 200 }),
    customerNote: text('customer_note'),
    parentId: ref('parent_id').references((): AnyMySqlColumn => orders.id, {
      onDelete: 'cascade',
    }),
    cartHash: varchar('cart_hash', { length: 32 }),
  },
  (t) => [
    uniqueIndex('orders_order_key_uq').on(t.orderKey),
    index('orders_status_date_idx').on(t.status, t.dateCreated),
    index('orders_customer_date_idx').on(t.customerId, t.dateCreated),
    index('orders_parent_idx').on(t.parentId),
    index('orders_billing_email_idx').on(t.billingEmail),
    check('orders_status_chk', sql.raw(`\`status\` IN (${inList(ORDER_STATUSES)})`)),
  ],
);

export const orderItems = mysqlTable(
  'order_items',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: varchar('type', { length: 200, enum: ORDER_ITEM_TYPES }).notNull(),
    productId: ref('product_id').references(() => products.id, { onDelete: 'set null' }),
    variationId: ref('variation_id').references(() => productVariations.id, {
      onDelete: 'set null',
    }),
    quantity: integer('quantity'),
    subtotal: money('subtotal'),
    total: money('total'),
    subtotalTax: money('subtotal_tax'),
    totalTax: money('total_tax'),
    taxClass: varchar('tax_class', { length: 200 }),
    taxStatus: varchar('tax_status', { length: 20 }),
    taxes: json('taxes').$type<{
      total: Record<string, string>;
      subtotal?: Record<string, string>;
    }>(),
    metaData: json('meta_data').$type<{ id?: number; key: string; value: unknown }[]>(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId, t.type),
    index('order_items_product_idx').on(t.productId),
    check('order_items_type_chk', sql.raw(`\`type\` IN (${inList(ORDER_ITEM_TYPES)})`)),
  ],
);

export const orderItemMeta = mysqlTable(
  'order_item_meta',
  {
    id: id(),
    orderItemId: ref('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 255 }),
    value: text('value'),
  },
  (t) => [
    index('order_item_meta_owner_key_idx').on(t.orderItemId, t.key),
    index('order_item_meta_key_idx').on(t.key),
  ],
);

export const orderNotes = mysqlTable(
  'order_notes',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    type: varchar('type', { length: 20, enum: ORDER_NOTE_TYPES }).notNull().default('private'),
    createdBy: varchar('created_by', { length: 200 }),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [
    index('order_notes_order_idx').on(t.orderId),
    check('order_notes_type_chk', sql.raw(`\`type\` IN (${inList(ORDER_NOTE_TYPES)})`)),
  ],
);

export const orderRefunds = mysqlTable(
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
    lineItems: json('line_items').$type<unknown[]>().notNull(),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [index('order_refunds_order_idx').on(t.orderId)],
);

export const orderMeta = mysqlTable(
  'order_meta',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 255 }).notNull(),
    value: text('value'),
  },
  (t) => [
    index('order_meta_owner_key_idx').on(t.orderId, t.key),
    index('order_meta_key_idx').on(t.key),
  ],
);

export const orderEvents = mysqlTable(
  'order_events',
  {
    id: id(),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    payload: json('payload').$type<Record<string, unknown>>(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [uniqueIndex('order_events_order_event_uq').on(t.orderId, t.eventType)],
);

export const customerAddresses = mysqlTable(
  'customer_addresses',
  {
    id: id(),
    customerId: ref('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20, enum: ADDRESS_TYPES }).notNull(),
    firstName: varchar('first_name', { length: 255 }).notNull().default(''),
    lastName: varchar('last_name', { length: 255 }).notNull().default(''),
    company: varchar('company', { length: 255 }).notNull().default(''),
    address1: varchar('address_1', { length: 255 }).notNull().default(''),
    address2: varchar('address_2', { length: 255 }).notNull().default(''),
    city: varchar('city', { length: 255 }).notNull().default(''),
    state: varchar('state', { length: 255 }).notNull().default(''),
    postcode: varchar('postcode', { length: 20 }).notNull().default(''),
    country: varchar('country', { length: 20 }).notNull().default(''),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 100 }).notNull().default(''),
  },
  (t) => [
    uniqueIndex('customer_addresses_customer_type_uq').on(t.customerId, t.type),
    check('customer_addresses_type_chk', sql.raw(`\`type\` IN (${inList(ADDRESS_TYPES)})`)),
  ],
);

export const customerMeta = mysqlTable(
  'customer_meta',
  {
    id: id(),
    customerId: ref('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 255 }).notNull(),
    value: text('value'),
  },
  (t) => [
    index('customer_meta_owner_key_idx').on(t.customerId, t.key),
    index('customer_meta_key_idx').on(t.key),
  ],
);

export const coupons = mysqlTable(
  'coupons',
  {
    id: id(),
    code: varchar('code', { length: 200 }).notNull(),
    amount: money('amount').notNull().default('0.0000'),
    status: varchar('status', { length: 20, enum: COUPON_STATUSES }).notNull().default('publish'),
    description: text('description').notNull(),
    discountType: varchar('discount_type', { length: 30, enum: COUPON_DISCOUNT_TYPES })
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
    emailRestrictions: json('email_restrictions').$type<string[]>().notNull(),
    productIds: json('product_ids').$type<number[]>().notNull(),
    excludedProductIds: json('excluded_product_ids').$type<number[]>().notNull(),
    productCategories: json('product_categories').$type<number[]>().notNull(),
    excludedProductCategories: json('excluded_product_categories').$type<number[]>().notNull(),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
  },
  (t) => [
    uniqueIndex('coupons_code_uq').on(t.code),
    check(
      'coupons_discount_type_chk',
      sql.raw(`\`discount_type\` IN (${inList(COUPON_DISCOUNT_TYPES)})`),
    ),
  ],
);

export const couponUsage = mysqlTable(
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
    usedBy: varchar('used_by', { length: 320 }).notNull().default(''),
    amount: money('amount').notNull().default('0.0000'),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [
    index('coupon_usage_coupon_idx').on(t.couponId),
    index('coupon_usage_order_idx').on(t.orderId),
    index('coupon_usage_used_by_idx').on(t.usedBy),
  ],
);

export const reviews = mysqlTable(
  'reviews',
  {
    id: id(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: ref('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    content: text('content').notNull(),
    status: varchar('status', { length: 20, enum: REVIEW_STATUSES }).notNull().default('pending'),
    verifiedOwner: bool('verified_owner').notNull().default(false),
    authorName: varchar('author_name', { length: 200 }).notNull().default(''),
    authorEmail: varchar('author_email', { length: 320 }).notNull().default(''),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [
    index('reviews_product_status_idx').on(t.productId, t.status),
    check('reviews_rating_chk', sql.raw(`\`rating\` BETWEEN 1 AND 5`)),
    check('reviews_status_chk', sql.raw(`\`status\` IN (${inList(REVIEW_STATUSES)})`)),
  ],
);

export const shippingZones = mysqlTable('shipping_zones', {
  id: id(),
  zoneName: varchar('zone_name', { length: 200 }).notNull(),
  zoneOrder: integer('zone_order').notNull().default(0),
});

export const shippingZoneLocations = mysqlTable(
  'shipping_zone_locations',
  {
    id: id(),
    zoneId: ref('zone_id')
      .notNull()
      .references(() => shippingZones.id, { onDelete: 'cascade' }),
    locationCode: varchar('location_code', { length: 200 }).notNull(),
    locationType: varchar('location_type', {
      length: 40,
      enum: SHIPPING_ZONE_LOCATION_TYPES,
    }).notNull(),
  },
  (t) => [
    index('shipping_zone_locations_zone_idx').on(t.zoneId),
    index('shipping_zone_locations_type_code_idx').on(t.locationType, t.locationCode),
    check(
      'shipping_zone_locations_type_chk',
      sql.raw(`\`location_type\` IN (${inList(SHIPPING_ZONE_LOCATION_TYPES)})`),
    ),
  ],
);

export const shippingZoneMethods = mysqlTable(
  'shipping_zone_methods',
  {
    id: id(),
    zoneId: ref('zone_id')
      .notNull()
      .references(() => shippingZones.id, { onDelete: 'cascade' }),
    methodId: varchar('method_id', { length: 200 }).notNull(),
    methodOrder: integer('method_order').notNull().default(0),
    isEnabled: bool('is_enabled').notNull().default(true),
    settings: json('settings').$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index('shipping_zone_methods_zone_idx').on(t.zoneId)],
);

export const taxClasses = mysqlTable(
  'tax_classes',
  {
    id: id(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
  },
  (t) => [uniqueIndex('tax_classes_slug_uq').on(t.slug)],
);

export const taxRates = mysqlTable(
  'tax_rates',
  {
    id: id(),
    taxClassId: ref('tax_class_id').references(() => taxClasses.id, { onDelete: 'cascade' }),
    country: varchar('country', { length: 2 }).notNull().default(''),
    state: varchar('state', { length: 200 }).notNull().default(''),
    name: varchar('name', { length: 200 }).notNull().default('Tax'),
    rate: varchar('rate', { length: 20 }).notNull().default('0.0000'),
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

export const taxRateLocations = mysqlTable(
  'tax_rate_locations',
  {
    id: id(),
    taxRateId: ref('tax_rate_id')
      .notNull()
      .references(() => taxRates.id, { onDelete: 'cascade' }),
    locationCode: varchar('location_code', { length: 200 }).notNull(),
    locationType: varchar('location_type', {
      length: 40,
      enum: TAX_RATE_LOCATION_TYPES,
    }).notNull(),
  },
  (t) => [
    index('tax_rate_locations_rate_idx').on(t.taxRateId),
    index('tax_rate_locations_code_idx').on(t.locationCode, t.locationType),
    check(
      'tax_rate_locations_type_chk',
      sql.raw(`\`location_type\` IN (${inList(TAX_RATE_LOCATION_TYPES)})`),
    ),
  ],
);

export const paymentTokens = mysqlTable(
  'payment_tokens',
  {
    id: id(),
    userId: ref('user_id').references(() => customers.id, { onDelete: 'cascade' }),
    gateway: varchar('gateway', { length: 200 }).notNull(),
    token: text('token').notNull(),
    type: varchar('type', { length: 50 }).notNull().default('CC'),
    last4: varchar('last4', { length: 4 }),
    expiry: varchar('expiry', { length: 7 }),
    cardType: varchar('card_type', { length: 50 }),
    isDefault: bool('is_default').notNull().default(false),
    dateCreated: ts('date_created').notNull(),
  },
  (t) => [index('payment_tokens_user_idx').on(t.userId)],
);

export const paymentTokenMeta = mysqlTable(
  'payment_token_meta',
  {
    id: id(),
    tokenId: ref('token_id')
      .notNull()
      .references(() => paymentTokens.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 255 }).notNull(),
    value: text('value'),
  },
  (t) => [index('payment_token_meta_owner_key_idx').on(t.tokenId, t.key)],
);

export const downloadPermissions = mysqlTable(
  'download_permissions',
  {
    id: id(),
    downloadId: varchar('download_id', { length: 36 }).notNull(),
    productId: ref('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    orderId: ref('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    orderKey: varchar('order_key', { length: 22 }).notNull(),
    userId: ref('user_id').references(() => customers.id, { onDelete: 'set null' }),
    userEmail: varchar('user_email', { length: 320 }).notNull(),
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

export const webhooks = mysqlTable(
  'webhooks',
  {
    id: id(),
    status: varchar('status', { length: 20, enum: WEBHOOK_STATUSES }).notNull().default('active'),
    name: varchar('name', { length: 200 }).notNull(),
    userId: ref('user_id').references(() => customers.id, { onDelete: 'set null' }),
    deliveryUrl: text('delivery_url').notNull(),
    secret: varchar('secret', { length: 255 }).notNull().default(''),
    topic: varchar('topic', { length: 200 }).notNull(),
    apiVersion: integer('api_version').notNull().default(3),
    failureCount: integer('failure_count').notNull().default(0),
    pendingDelivery: bool('pending_delivery').notNull().default(false),
    dateCreated: ts('date_created').notNull(),
    dateModified: ts('date_modified').notNull(),
  },
  (t) => [
    index('webhooks_status_idx').on(t.status),
    index('webhooks_topic_idx').on(t.topic),
    check('webhooks_status_chk', sql.raw(`\`status\` IN (${inList(WEBHOOK_STATUSES)})`)),
  ],
);

export const settingsBoolean = mysqlTable('settings_boolean', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: bool('value').notNull(),
});

export const settingsInteger = mysqlTable('settings_integer', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: bigint('value', { mode: 'number' }).notNull(),
});

export const settingsString = mysqlTable('settings_string', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(),
});

export const settingsJson = mysqlTable('settings_json', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: json('value').notNull(),
});

export const settingsGeneral = mysqlTable('settings_general', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(),
});

export const adminNotes = mysqlTable('admin_notes', {
  id: id(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('info'),
  source: varchar('source', { length: 200 }).notNull().default('spcnd-ecom'),
  title: text('title').notNull(),
  content: text('content'),
  isSnoozable: bool('is_snoozable').notNull().default(false),
  isRead: bool('is_read').notNull().default(false),
  severity: varchar('severity', { length: 20 }),
  dateCreated: ts('date_created').notNull(),
});

export const systemLog = mysqlTable(
  'system_log',
  {
    id: id(),
    level: varchar('level', { length: 20 }).notNull(),
    source: varchar('source', { length: 200 }).notNull().default(''),
    message: text('message').notNull(),
    context: json('context').$type<Record<string, unknown>>(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('system_log_level_idx').on(t.level, t.createdAt)],
);

export const queueJobs = mysqlTable(
  'queue_jobs',
  {
    id: id(),
    queue: varchar('queue', { length: 100 }).notNull().default('default'),
    payload: json('payload').$type<Record<string, unknown>>().notNull(),
    attempts: integer('attempts').notNull().default(0),
    availableAt: ts('available_at').notNull(),
    reservedAt: ts('reserved_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('queue_jobs_queue_available_idx').on(t.queue, t.availableAt)],
);

export const orderStats = mysqlTable(
  'order_stats',
  {
    orderId: ref('order_id')
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    parentId: ref('parent_id'),
    status: varchar('status', { length: 20 }).notNull(),
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

export const orderProductLookup = mysqlTable(
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

export const orderTaxLookup = mysqlTable(
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

export const orderCouponLookup = mysqlTable(
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

export const customerLookup = mysqlTable(
  'customer_lookup',
  {
    customerId: ref('customer_id')
      .primaryKey()
      .references(() => customers.id, { onDelete: 'cascade' }),
    username: varchar('username', { length: 60 }).notNull().default(''),
    firstName: varchar('first_name', { length: 255 }).notNull().default(''),
    lastName: varchar('last_name', { length: 255 }).notNull().default(''),
    email: varchar('email', { length: 320 }).notNull().default(''),
    country: varchar('country', { length: 20 }).notNull().default(''),
    city: varchar('city', { length: 255 }).notNull().default(''),
    state: varchar('state', { length: 255 }).notNull().default(''),
    postcode: varchar('postcode', { length: 20 }).notNull().default(''),
    totalSpent: money('total_spent').notNull().default('0.0000'),
    orderCount: integer('order_count').notNull().default(0),
    avgOrderValue: money('avg_order_value').notNull().default('0.0000'),
    dateRegistered: ts('date_registered'),
    dateLastActive: ts('date_last_active'),
  },
  (t) => [index('customer_lookup_email_idx').on(t.email)],
);

export const categoryLookup = mysqlTable('category_lookup', {
  categoryId: ref('category_id')
    .primaryKey()
    .references(() => productCategories.id, { onDelete: 'cascade' }),
  categoryTree: text('category_tree').notNull(),
  count: integer('count').notNull().default(0),
});
