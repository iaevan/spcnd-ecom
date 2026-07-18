import type { Product, SpcndCore } from '@spacendigital/core';
import { Money } from '@spacendigital/types';

/**
 * Astro integration surface (docs/AGENTS.md §10):
 * - `createApiRoute(app)` — mount the Hono app under an Astro catch-all
 *   (`src/pages/api/[...path].ts` exporting `export const ALL = createApiRoute(app)`).
 * - `storefront(core)` — SSR helpers .astro frontmatter calls directly (no
 *   HTTP loopback for reads).
 * - `./components/*` — drop-in .astro components (ProductCard, Price,
 *   AddToCartButton) compiled by the consuming Astro app.
 */

interface FetchApp {
  fetch(request: Request): Response | Promise<Response>;
}

/** Astro APIRoute forwarding the raw Request into the Hono app. */
export function createApiRoute(app: FetchApp) {
  return async (context: { request: Request }): Promise<Response> => {
    return app.fetch(context.request);
  };
}

/** Server-side read helpers for .astro frontmatter. */
export function storefront(core: SpcndCore) {
  return {
    async listProducts(query: Parameters<SpcndCore['products']['list']>[0] = {}) {
      return core.products.list({ status: 'publish', ...query });
    },
    async productBySlug(slug: string): Promise<Product | undefined> {
      const product = await core.products.getBySlug(slug);
      return product?.status === 'publish' ? product : undefined;
    },
    async categories() {
      return core.db.drizzle.select().from(core.db.schema.productCategories);
    },
    async categoryBySlug(slug: string) {
      const rows = await core.db.drizzle.select().from(core.db.schema.productCategories);
      return rows.find((row) => row.slug === slug);
    },
    async tags() {
      return core.db.drizzle.select().from(core.db.schema.productTags);
    },
    async tagBySlug(slug: string) {
      const rows = await core.db.drizzle.select().from(core.db.schema.productTags);
      return rows.find((row) => row.slug === slug);
    },
    /**
     * SSR cart/checkout reads: forward the browser's request (cookie intact)
     * into the mounted API so the session resolves identically.
     */
    async fetchWithSession<T>(app: FetchApp, request: Request, path: string): Promise<T> {
      const url = new URL(path, new URL(request.url).origin);
      const response = await app.fetch(
        new Request(url, { headers: { Cookie: request.headers.get('Cookie') ?? '' } }),
      );
      return (await response.json()) as T;
    },
  };
}

/** Storefront money formatting for stored fixed-decimal strings. */
export function formatPrice(value: string | null, symbol = '$'): string {
  if (value === null || value === '') return '';
  return `${symbol}${Money.fromDb(value).toFixed(2)}`;
}

/** Storefront money formatting for integer minor units. */
export function formatMinor(minor: number, symbol = '$'): string {
  const sign = minor < 0 ? '-' : '';
  return `${sign}${symbol}${(Math.abs(minor) / 10000).toFixed(2)}`;
}
