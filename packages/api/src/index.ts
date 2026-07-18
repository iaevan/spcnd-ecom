import type { SpcndCore } from '@spacendigital/core';
import { Hono } from 'hono';
import { type ApiEnv, createRouter, devTrustAllAuth, errorHandler } from './shared.js';
import { storefrontRoutes } from './storefront.js';
import { catalogRoutes } from './v1/catalog.js';
import { orderRoutes } from './v1/orders.js';
import { storeAdminRoutes } from './v1/store-admin.js';
import { createRestV3 } from './v3.js';

export { createRestV3 } from './v3.js';
export { storefrontRoutes } from './storefront.js';
export { devTrustAllAuth, errorHandler } from './shared.js';

/**
 * /api/v1 — the clean JSON surface (spec §6.1). Admin-facing routes sit
 * behind the S6 dev-trust middleware until api-keys land.
 */
export function createRestV1() {
  const app = createRouter();
  app.use('*', devTrustAllAuth());
  app.route('/', catalogRoutes());
  app.route('/', orderRoutes());
  app.route('/', storeAdminRoutes());
  return app;
}

/**
 * Inbound webhook receiver mount.
 * TODO:security-blocked — see docs/SECURITY_WORK.md item S3: outbound
 * delivery, the X-WC-Webhook-Signature header and ping handling are the S3
 * webhook service; until then this only acknowledges.
 */
export function createWebhookRouter() {
  const app = createRouter();
  app.post('/delivery', (c) => c.json({ received: true }, 202));
  return app;
}

/**
 * The composed HTTP app: v1 + v3 + storefront + webhooks, with the core
 * kernel injected per request. `app.fetch` is a WinterCG fetch handler —
 * mount it in Node servers, Astro catch-alls, or (v2) Workers.
 */
export function createApi(core: SpcndCore): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    c.set('core', core);
    await next();
  });
  app.onError(errorHandler());
  app.route('/api/v1', createRestV1());
  app.route('/api/v3', createRestV3());
  app.route('/api/store', storefrontRoutes());
  app.route('/api/webhooks', createWebhookRouter());
  app.get('/api/health', (c) => c.json({ ok: true }));
  return app;
}
