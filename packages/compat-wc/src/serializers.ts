import type {
  Coupon,
  Customer,
  Media,
  Order,
  OrderItem,
  OrderRefund,
  Product,
  Review,
} from '@spacendigital/core';
import { type Address, Money } from '@spacendigital/types';

/**
 * WC-shaped REST v3 serializers (docs/AGENTS.md §7.2; shapes per
 * api_reference §2.2/§3/§4.1). Pure functions: rows + preloaded relations in,
 * WC JSON out. `/api/v3/*` is a thin adapter over these.
 *
 * Conventions: prices are strings at store decimals; dimensions/weight are
 * strings ('' when null); timestamps emit WC's `YYYY-MM-DDTHH:MM:SS` with
 * `_gmt` twins (store timezone is UTC, so both are equal).
 */

export interface SerializerContext {
  storeUrl: string;
  currency: string;
  /** price_num_decimals; WC default 2. */
  decimals: number;
}

export interface WcMetaData {
  id: number;
  key: string;
  value: unknown;
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export function wcDate(iso: string | null): string | null {
  if (!iso) return null;
  return iso.replace(/\.\d{3}Z$/, '').replace(/Z$/, '');
}

function price(value: string | null, decimals: number): string {
  if (value === null || value === '') return '';
  return Money.fromDb(value).toFixed(decimals);
}

function numString(value: number | null): string {
  return value === null ? '' : String(value);
}

// --- Products (§2.2) -------------------------------------------------------

export interface ProductRelations {
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  images: Media[];
  variations: number[];
  groupedProducts: number[];
  upsellIds: number[];
  crosssellIds: number[];
  relatedIds: number[];
  metaData: WcMetaData[];
  shippingClassSlug: string;
  onSale: boolean;
  purchasable: boolean;
}

export function serializeProduct(
  product: Product,
  rel: ProductRelations,
  ctx: SerializerContext,
): Record<string, unknown> {
  const ratingCount = Object.values(product.ratingCounts ?? {}).reduce(
    (sum, n) => sum + Number(n || 0),
    0,
  );
  const backordersAllowed = product.backorders === 'yes' || product.backorders === 'notify';
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    permalink: `${trimSlash(ctx.storeUrl)}/product/${product.slug}/`,
    date_created: wcDate(product.dateCreated),
    date_created_gmt: wcDate(product.dateCreated),
    date_modified: wcDate(product.dateModified),
    date_modified_gmt: wcDate(product.dateModified),
    type: product.type,
    status: product.status,
    featured: product.featured,
    catalog_visibility: product.catalogVisibility,
    description: product.description,
    short_description: product.shortDescription,
    sku: product.sku ?? '',
    global_unique_id: product.globalUniqueId ?? '',
    price: price(product.price, ctx.decimals),
    regular_price: price(product.regularPrice, ctx.decimals),
    sale_price: price(product.salePrice, ctx.decimals),
    date_on_sale_from: wcDate(product.dateOnSaleFrom),
    date_on_sale_from_gmt: wcDate(product.dateOnSaleFrom),
    date_on_sale_to: wcDate(product.dateOnSaleTo),
    date_on_sale_to_gmt: wcDate(product.dateOnSaleTo),
    price_html: '',
    on_sale: rel.onSale,
    purchasable: rel.purchasable,
    total_sales: product.totalSales,
    virtual: product.virtual,
    downloadable: product.downloadable,
    downloads: (product.downloads ?? []) as unknown[],
    download_limit: product.downloadLimit,
    download_expiry: product.downloadExpiry,
    external_url: product.externalUrl ?? '',
    button_text: product.buttonText ?? '',
    tax_status: product.taxStatus,
    tax_class: product.taxClass,
    manage_stock: product.manageStock,
    stock_quantity: product.stockQuantity,
    stock_status: product.stockStatus,
    backorders: product.backorders,
    backorders_allowed: backordersAllowed,
    backordered: product.stockStatus === 'onbackorder',
    low_stock_amount: product.lowStockAmount,
    sold_individually: product.soldIndividually,
    weight: numString(product.weight),
    dimensions: {
      length: numString(product.length),
      width: numString(product.width),
      height: numString(product.height),
    },
    shipping_required: !product.virtual,
    shipping_taxable: product.taxStatus === 'taxable' || product.taxStatus === 'shipping',
    shipping_class: rel.shippingClassSlug,
    shipping_class_id: String(product.shippingClassId ?? 0),
    reviews_allowed: product.reviewsAllowed,
    post_password: product.postPassword ?? '',
    average_rating: Number(product.averageRating).toFixed(2),
    rating_count: ratingCount,
    related_ids: rel.relatedIds,
    upsell_ids: rel.upsellIds,
    cross_sell_ids: rel.crosssellIds,
    parent_id: product.parentId ?? 0,
    purchase_note: product.purchaseNote,
    categories: rel.categories,
    tags: rel.tags,
    images: rel.images.map((m) => ({
      id: m.id,
      date_created: wcDate(m.dateCreated),
      date_created_gmt: wcDate(m.dateCreated),
      date_modified: wcDate(m.dateCreated),
      date_modified_gmt: wcDate(m.dateCreated),
      src: m.url,
      name: m.name ?? '',
      alt: m.alt ?? '',
    })),
    attributes: (product.attributes ?? []) as unknown[],
    default_attributes: (product.defaultAttributes ?? []) as unknown[],
    variations: rel.variations,
    grouped_products: rel.groupedProducts,
    menu_order: product.menuOrder,
    meta_data: rel.metaData,
  };
}

// --- Orders (§3, v2 base shape + v3 additions) -----------------------------

export interface OrderRelations {
  items: OrderItem[];
  refunds: OrderRefund[];
  metaData: WcMetaData[];
}

function itemMeta(item: OrderItem): WcMetaData[] {
  return (item.metaData ?? []).map((m, i) => ({ id: m.id ?? i + 1, key: m.key, value: m.value }));
}

function itemTaxes(item: OrderItem, decimals: number): { id: number; total: string; subtotal: string }[] {
  const total = item.taxes?.total ?? {};
  const subtotal = item.taxes?.subtotal ?? {};
  return Object.keys(total).map((rateId) => ({
    id: Number(rateId),
    total: price(total[rateId] ?? '0', decimals),
    subtotal: price(subtotal[rateId] ?? '0', decimals),
  }));
}

export function serializeOrder(
  order: Order,
  rel: OrderRelations,
  ctx: SerializerContext,
): Record<string, unknown> {
  const d = ctx.decimals;
  const byType = (type: OrderItem['type']) => rel.items.filter((i) => i.type === type);
  const metaOf = (item: OrderItem, key: string) =>
    item.metaData?.find((m) => m.key === key)?.value;

  return {
    id: order.id,
    parent_id: order.parentId ?? 0,
    number: String(order.id),
    order_key: order.orderKey,
    created_via: order.createdVia ?? '',
    status: order.status,
    currency: order.currency,
    date_created: wcDate(order.dateCreated),
    date_created_gmt: wcDate(order.dateCreated),
    date_modified: wcDate(order.dateModified),
    date_modified_gmt: wcDate(order.dateModified),
    discount_total: price(order.discountTotal, d),
    discount_tax: price(order.discountTax, d),
    shipping_total: price(order.shippingTotal, d),
    shipping_tax: price(order.shippingTax, d),
    cart_tax: price(order.cartTax, d),
    total: price(order.total, d),
    total_tax: price(order.totalTax, d),
    prices_include_tax: order.pricesIncludeTax,
    customer_id: order.customerId ?? 0,
    customer_ip_address: order.customerIpAddress ?? '',
    customer_user_agent: order.customerUserAgent ?? '',
    customer_note: order.customerNote ?? '',
    billing: {
      first_name: order.billingFirstName,
      last_name: order.billingLastName,
      company: order.billingCompany,
      address_1: order.billingAddress1,
      address_2: order.billingAddress2,
      city: order.billingCity,
      state: order.billingState,
      postcode: order.billingPostcode,
      country: order.billingCountry,
      email: order.billingEmail,
      phone: order.billingPhone,
    },
    shipping: {
      first_name: order.shippingFirstName,
      last_name: order.shippingLastName,
      company: order.shippingCompany,
      address_1: order.shippingAddress1,
      address_2: order.shippingAddress2,
      city: order.shippingCity,
      state: order.shippingState,
      postcode: order.shippingPostcode,
      country: order.shippingCountry,
      phone: order.shippingPhone,
    },
    payment_method: order.paymentMethod,
    payment_method_title: order.paymentMethodTitle,
    transaction_id: order.transactionId ?? '',
    date_paid: wcDate(order.datePaid),
    date_paid_gmt: wcDate(order.datePaid),
    date_completed: wcDate(order.dateCompleted),
    date_completed_gmt: wcDate(order.dateCompleted),
    cart_hash: order.cartHash ?? '',
    line_items: byType('line_item').map((item) => ({
      id: item.id,
      name: item.name,
      product_id: item.productId ?? 0,
      variation_id: item.variationId ?? 0,
      quantity: item.quantity ?? 0,
      tax_class: item.taxClass ?? '',
      subtotal: price(item.subtotal, d),
      subtotal_tax: price(item.subtotalTax, d),
      total: price(item.total, d),
      total_tax: price(item.totalTax, d),
      taxes: itemTaxes(item, d),
      meta_data: itemMeta(item),
      sku: '',
      price:
        item.quantity && item.total !== null
          ? Money.fromDb(item.total).div(item.quantity).toFixed(d)
          : '',
    })),
    tax_lines: byType('tax').map((item) => ({
      id: item.id,
      rate_code: String(metaOf(item, 'label') ?? item.name).toUpperCase().replace(/\s+/g, '-'),
      rate_id: Number(metaOf(item, 'rate_id') ?? 0),
      label: String(metaOf(item, 'label') ?? item.name),
      compound: Boolean(metaOf(item, 'compound') ?? false),
      rate_percent: Number(metaOf(item, 'rate_percent') ?? 0),
      // Consolidated tax lines store cart tax in `total`, shipping tax in
      // `subtotal` (order-service writeTaxLines).
      tax_total: price(item.total, d),
      shipping_tax_total: price(item.subtotal, d),
      meta_data: itemMeta(item),
    })),
    shipping_lines: byType('shipping').map((item) => ({
      id: item.id,
      method_title: item.name,
      method_id: String(metaOf(item, 'method_id') ?? ''),
      instance_id: String(metaOf(item, 'instance_id') ?? ''),
      total: price(item.total, d),
      total_tax: price(item.totalTax, d),
      taxes: itemTaxes(item, d),
      meta_data: itemMeta(item),
    })),
    fee_lines: byType('fee').map((item) => ({
      id: item.id,
      name: item.name,
      tax_class: item.taxClass ?? '',
      tax_status: item.taxStatus ?? 'taxable',
      total: price(item.total, d),
      total_tax: price(item.totalTax, d),
      taxes: itemTaxes(item, d),
      meta_data: itemMeta(item),
    })),
    coupon_lines: byType('coupon').map((item) => ({
      id: item.id,
      code: item.name,
      discount: price(item.total, d),
      discount_tax: price(item.totalTax, d),
      meta_data: itemMeta(item),
    })),
    refunds: rel.refunds.map((refund) => ({
      id: refund.id,
      reason: refund.reason ?? '',
      total: `-${price(refund.amount, d)}`,
    })),
    meta_data: rel.metaData,
  };
}

// --- Customers (§4.1) ------------------------------------------------------

export function serializeCustomer(
  customer: Customer,
  billing: Address,
  shipping: Address,
  metaData: WcMetaData[] = [],
): Record<string, unknown> {
  return {
    id: customer.id,
    date_created: wcDate(customer.dateCreated),
    date_created_gmt: wcDate(customer.dateCreated),
    date_modified: wcDate(customer.dateModified),
    date_modified_gmt: wcDate(customer.dateModified),
    email: customer.email,
    first_name: customer.firstName,
    last_name: customer.lastName,
    role: customer.role,
    username: customer.username ?? '',
    billing: {
      first_name: billing.firstName,
      last_name: billing.lastName,
      company: billing.company,
      address_1: billing.address1,
      address_2: billing.address2,
      city: billing.city,
      state: billing.state,
      postcode: billing.postcode,
      country: billing.country,
      email: billing.email ?? '',
      phone: billing.phone ?? '',
    },
    shipping: {
      first_name: shipping.firstName,
      last_name: shipping.lastName,
      company: shipping.company,
      address_1: shipping.address1,
      address_2: shipping.address2,
      city: shipping.city,
      state: shipping.state,
      postcode: shipping.postcode,
      country: shipping.country,
      phone: shipping.phone ?? '',
    },
    is_paying_customer: customer.isPayingCustomer,
    avatar_url: '',
    meta_data: metaData,
  };
}

// --- Coupons ---------------------------------------------------------------

export function serializeCoupon(
  coupon: Coupon,
  ctx: SerializerContext,
  usedBy: string[] = [],
  metaData: WcMetaData[] = [],
): Record<string, unknown> {
  return {
    id: coupon.id,
    code: coupon.code,
    amount: price(coupon.amount, ctx.decimals),
    status: coupon.status,
    date_created: wcDate(coupon.dateCreated),
    date_created_gmt: wcDate(coupon.dateCreated),
    date_modified: wcDate(coupon.dateModified),
    date_modified_gmt: wcDate(coupon.dateModified),
    discount_type: coupon.discountType,
    description: coupon.description,
    date_expires: wcDate(coupon.dateExpires),
    date_expires_gmt: wcDate(coupon.dateExpires),
    usage_count: coupon.usageCount,
    individual_use: coupon.individualUse,
    product_ids: coupon.productIds ?? [],
    excluded_product_ids: coupon.excludedProductIds ?? [],
    usage_limit: coupon.usageLimit,
    usage_limit_per_user: coupon.usageLimitPerUser,
    limit_usage_to_x_items: coupon.limitUsageToXItems,
    free_shipping: coupon.freeShipping,
    product_categories: coupon.productCategories ?? [],
    excluded_product_categories: coupon.excludedProductCategories ?? [],
    exclude_sale_items: coupon.excludeSaleItems,
    minimum_amount: coupon.minimumAmount ? price(coupon.minimumAmount, ctx.decimals) : '',
    maximum_amount: coupon.maximumAmount ? price(coupon.maximumAmount, ctx.decimals) : '',
    email_restrictions: coupon.emailRestrictions ?? [],
    used_by: usedBy,
    meta_data: metaData,
  };
}

// --- Reviews ---------------------------------------------------------------

/** WC review status vocabulary: 'pending' rows surface as 'hold'. */
export function serializeReview(review: Review, productName = ''): Record<string, unknown> {
  return {
    id: review.id,
    date_created: wcDate(review.dateCreated),
    date_created_gmt: wcDate(review.dateCreated),
    product_id: review.productId,
    product_name: productName,
    status: review.status === 'pending' ? 'hold' : review.status,
    reviewer: review.authorName,
    reviewer_email: review.authorEmail,
    review: review.content,
    rating: review.rating,
    verified: review.verifiedOwner,
  };
}
