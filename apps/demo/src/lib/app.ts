import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AnalyticsPlugin from '@spacendigital/analytics';
import { createApi } from '@spacendigital/api';
import { storefront } from '@spacendigital/astro';
import { createSpcndCore, type SpcndCore } from '@spacendigital/core';
import { migrate, runSeed, type SeedData, sqlite } from '@spacendigital/db';
import EmailPlugin from '@spacendigital/email';
import PaymentsPlugin from '@spacendigital/payments';
import ReviewsPlugin from '@spacendigital/reviews';
import ShippingPlugin from '@spacendigital/shipping';
import TaxPlugin from '@spacendigital/tax';
import type { Hono } from 'hono';
import seed from '../../seed.json';

/**
 * Demo app boot: SQLite file + migrations + idempotent seed + the full
 * plugin roster. One instance per server process (survives dev HMR via
 * globalThis).
 */

export interface DemoApp {
  core: SpcndCore;
  api: Hono<{ Variables: { core: SpcndCore } }>;
  store: ReturnType<typeof storefront>;
}

declare global {
  // eslint-disable-next-line no-var
  var __spcndDemo: Promise<DemoApp> | undefined;
}

async function boot(): Promise<DemoApp> {
  const dataDir = resolve(process.cwd(), '.data');
  mkdirSync(dataDir, { recursive: true });
  const db = await sqlite(process.env.SPCND_DB ?? resolve(dataDir, 'demo.db')).connect();
  await migrate(db);
  await runSeed(db, seed as unknown as SeedData);
  const core = await createSpcndCore({
    db,
    plugins: [TaxPlugin, ShippingPlugin, PaymentsPlugin, ReviewsPlugin, EmailPlugin, AnalyticsPlugin],
  });
  return { core, api: createApi(core), store: storefront(core) };
}

export function getApp(): Promise<DemoApp> {
  if (!globalThis.__spcndDemo) globalThis.__spcndDemo = boot();
  return globalThis.__spcndDemo;
}
