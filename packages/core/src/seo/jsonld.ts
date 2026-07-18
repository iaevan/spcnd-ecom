import { Money } from '@spacendigital/types';
import type { Product, ProductVariation, Review } from '../entities.js';

/**
 * JSON-LD builders (docs/AGENTS.md §11): pure functions the Astro adapter
 * embeds as `<script type="application/ld+json">`.
 */

export interface JsonLdContext {
  storeUrl: string;
  storeName: string;
  currency: string;
}

type JsonLd = Record<string, unknown>;

export function productJsonLd(
  product: Product,
  ctx: JsonLdContext,
  opts: { variations?: ProductVariation[]; reviews?: Review[]; imageUrls?: string[] } = {},
): JsonLd {
  const url = `${trimSlash(ctx.storeUrl)}/product/${product.slug}/`;
  const base: JsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    url,
    description: product.shortDescription || product.description,
  };
  if (product.sku) base.sku = product.sku;
  if (product.globalUniqueId) base.gtin = product.globalUniqueId;
  if (opts.imageUrls?.length) base.image = opts.imageUrls;

  const variations = opts.variations ?? [];
  if (product.type === 'variable' && variations.length > 0) {
    const prices = variations
      .filter((v) => v.enabled && v.price !== null)
      .map((v) => Money.fromDb(v.price));
    if (prices.length > 0) {
      const low = prices.reduce((a, b) => (a.lte(b) ? a : b));
      const high = prices.reduce((a, b) => (a.gte(b) ? a : b));
      base.offers = [
        {
          '@type': 'AggregateOffer',
          priceCurrency: ctx.currency,
          lowPrice: low.toFixed(2),
          highPrice: high.toFixed(2),
          offerCount: prices.length,
          availability: availability(product.stockStatus),
          url,
        },
      ];
    }
  } else if (product.price !== null) {
    base.offers = [
      {
        '@type': 'Offer',
        price: Money.fromDb(product.price).toFixed(2),
        priceCurrency: ctx.currency,
        availability: availability(product.stockStatus),
        url,
        ...(product.dateOnSaleTo ? { priceValidUntil: product.dateOnSaleTo } : {}),
      },
    ];
  }

  if (product.reviewCount > 0) {
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(product.averageRating),
      reviewCount: product.reviewCount,
    };
  }
  if (opts.reviews?.length) {
    base.review = opts.reviews.map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: String(r.rating), bestRating: '5' },
      author: { '@type': 'Person', name: r.authorName },
      reviewBody: r.content,
      datePublished: r.dateCreated,
    }));
  }
  return base;
}

export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export function websiteJsonLd(ctx: JsonLdContext): JsonLd {
  const url = trimSlash(ctx.storeUrl);
  return {
    '@context': 'https://schema.org/',
    '@type': 'WebSite',
    name: ctx.storeName,
    url: `${url}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${url}/shop/?s={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Order confirmation JSON-LD for transactional emails (§11 "Order (in email)"). */
export function orderJsonLd(
  order: {
    id: number;
    total: string;
    currency: string;
    dateCreated: string;
    billingFirstName: string;
    billingLastName: string;
    status: string;
  },
  ctx: JsonLdContext,
): JsonLd {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Order',
    merchant: { '@type': 'Organization', name: ctx.storeName },
    orderNumber: String(order.id),
    priceCurrency: order.currency,
    price: Money.fromDb(order.total).toFixed(2),
    orderDate: order.dateCreated,
    orderStatus: `https://schema.org/OrderProcessing`,
    customer: {
      '@type': 'Person',
      name: `${order.billingFirstName} ${order.billingLastName}`.trim(),
    },
    url: trimSlash(ctx.storeUrl),
  };
}

function availability(stockStatus: string): string {
  switch (stockStatus) {
    case 'outofstock':
      return 'https://schema.org/OutOfStock';
    case 'onbackorder':
      return 'https://schema.org/BackOrder';
    default:
      return 'https://schema.org/InStock';
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
