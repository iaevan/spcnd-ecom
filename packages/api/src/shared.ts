import type { SpcndCore } from '@spacendigital/core';
import { SpcndError } from '@spacendigital/core';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';

/** Shared context: every router receives the core kernel. */
export interface ApiEnv {
  Variables: {
    core: SpcndCore;
  };
}

export function createRouter(): Hono<ApiEnv> {
  return new Hono<ApiEnv>();
}

/**
 * TODO:security-blocked — see docs/SECURITY_WORK.md item S6.
 * The HTTP-Basic (consumer_key/consumer_secret) admin middleware for /api/v3
 * and the bearer-token middleware for /api/v1 admin surfaces land with S6.
 * Until then this dev-only middleware trusts every request; do NOT expose
 * admin routes publicly with it in place.
 */
export function devTrustAllAuth() {
  return async (_c: Context, next: Next) => {
    await next();
  };
}

/** Map SpcndError family onto HTTP responses; unknown errors → 500. */
export function errorHandler() {
  return (err: Error, c: Context) => {
    if (err instanceof SpcndError) {
      return c.json({ code: err.code, message: err.message }, err.status as 400);
    }
    return c.json({ code: 'internal_error', message: 'Internal server error' }, 500);
  };
}

export function intParam(c: Context, name: string): number {
  const value = Number(c.req.param(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new SpcndError(`Invalid ${name}`, 'invalid_id', 404);
  }
  return value;
}

export function pageQuery(c: Context): { page: number; perPage: number } {
  return {
    page: Math.max(1, Number(c.req.query('page') ?? 1) || 1),
    perPage: Math.min(100, Math.max(1, Number(c.req.query('per_page') ?? 10) || 10)),
  };
}

/** WC pagination headers: X-WP-Total / X-WP-TotalPages + RFC5988 Link. */
export function setListHeaders(
  c: Context,
  total: number,
  totalPages: number,
  page: number,
): void {
  c.header('X-WP-Total', String(total));
  c.header('X-WP-TotalPages', String(totalPages));
  const links: string[] = [];
  const url = new URL(c.req.url);
  if (page > 1) {
    url.searchParams.set('page', String(page - 1));
    links.push(`<${url.toString()}>; rel="prev"`);
  }
  if (page < totalPages) {
    url.searchParams.set('page', String(page + 1));
    links.push(`<${url.toString()}>; rel="next"`);
  }
  if (links.length > 0) c.header('Link', links.join(', '));
}
