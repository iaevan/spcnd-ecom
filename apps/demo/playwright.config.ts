import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * E2E per RESUME step 13: browse → add to cart → COD checkout → order
 * visible via the admin API. Runs against the built SSR server on a fresh
 * database (SPCND_DB below).
 */
const chromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4321',
    ...(existsSync(chromium) ? { launchOptions: { executablePath: chromium } } : {}),
  },
  webServer: {
    command: 'node ./dist/server/entry.mjs',
    url: 'http://localhost:4321/shop',
    timeout: 90_000,
    reuseExistingServer: !process.env.CI,
    env: { SPCND_DB: '.data/e2e.db' },
  },
});
