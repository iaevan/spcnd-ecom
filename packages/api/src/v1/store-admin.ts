import {
  COUNTRIES,
  CURRENCIES,
  PAYMENT_SERVICE,
  SETTING_DEFINITIONS,
} from '@spacendigital/core';
import {
  couponsReport,
  customersReport,
  downloadsReport,
  leaderboards,
  ordersReport,
  productsReport,
  categoriesReport,
  revenueReport,
  stockReport,
  taxesReport,
  variationsReport,
} from '@spacendigital/analytics';
import { asc, eq } from 'drizzle-orm';
import { createRouter, intParam, pageQuery, setListHeaders } from '../shared.js';

/**
 * /api/v1 admin surfaces: customers, coupons, tax rates/classes, shipping
 * zones/methods, webhooks (rows only — delivery is S3), gateway config
 * (list-only; charge endpoints are S5), settings, system status, reports,
 * and the data endpoints (countries/currencies).
 */
export function storeAdminRoutes() {
  const app = createRouter();

  // --- Customers ------------------------------------------------------------
  app.get('/customers', async (c) => {
    const { page, perPage } = pageQuery(c);
    const result = await c.get('core').customers.list({ page, perPage, search: c.req.query('search') });
    setListHeaders(c, result.total, result.totalPages, result.page);
    return c.json(result.items.map(({ passwordHash: _ph, ...rest }) => rest));
  });

  app.post('/customers', async (c) => {
    const { passwordHash: _ph, ...customer } = await c.get('core').customers.create(await c.req.json());
    return c.json(customer, 201);
  });

  app.get('/customers/:id', async (c) => {
    const core = c.get('core');
    const id = intParam(c, 'id');
    const { passwordHash: _ph, ...customer } = await core.customers.get(id);
    return c.json({
      ...customer,
      billing: await core.customers.getAddress(id, 'billing'),
      shipping: await core.customers.getAddress(id, 'shipping'),
    });
  });

  app.put('/customers/:id', async (c) => {
    const { passwordHash: _ph, ...customer } = await c
      .get('core')
      .customers.update(intParam(c, 'id'), await c.req.json());
    return c.json(customer);
  });

  app.delete('/customers/:id', async (c) => {
    await c.get('core').customers.delete(intParam(c, 'id'));
    return c.json({ deleted: true });
  });

  // --- Coupons --------------------------------------------------------------
  app.get('/coupons', async (c) => {
    const { page, perPage } = pageQuery(c);
    const result = await c.get('core').coupons.list({ page, perPage, search: c.req.query('search') });
    setListHeaders(c, result.total, result.totalPages, result.page);
    return c.json(result.items);
  });

  app.post('/coupons', async (c) => {
    return c.json(await c.get('core').coupons.create(await c.req.json()), 201);
  });

  app.get('/coupons/:id', async (c) => c.json(await c.get('core').coupons.get(intParam(c, 'id'))));

  app.put('/coupons/:id', async (c) => {
    return c.json(await c.get('core').coupons.update(intParam(c, 'id'), await c.req.json()));
  });

  app.delete('/coupons/:id', async (c) => {
    await c.get('core').coupons.delete(intParam(c, 'id'));
    return c.json({ deleted: true });
  });

  // --- Tax rates & classes ---------------------------------------------------
  app.get('/taxes/classes', async (c) => {
    const core = c.get('core');
    return c.json(await core.db.drizzle.select().from(core.db.schema.taxClasses));
  });

  app.get('/taxes', async (c) => {
    const core = c.get('core');
    return c.json(await core.db.drizzle.select().from(core.db.schema.taxRates));
  });

  app.post('/taxes', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const body = await c.req.json();
    await core.db.drizzle.insert(s.taxRates).values(body);
    const rows = await core.db.drizzle.select().from(s.taxRates).orderBy(asc(s.taxRates.id));
    return c.json(rows.at(-1), 201);
  });

  app.delete('/taxes/:id', async (c) => {
    const core = c.get('core');
    await core.db.drizzle
      .delete(core.db.schema.taxRates)
      .where(eq(core.db.schema.taxRates.id, intParam(c, 'id')));
    return c.json({ deleted: true });
  });

  // --- Shipping zones & methods ----------------------------------------------
  app.get('/shipping/zones', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const zones = await core.db.drizzle.select().from(s.shippingZones).orderBy(asc(s.shippingZones.zoneOrder));
    const locations = await core.db.drizzle.select().from(s.shippingZoneLocations);
    const methods = await core.db.drizzle.select().from(s.shippingZoneMethods);
    return c.json(
      zones.map((zone) => ({
        ...zone,
        locations: locations.filter((l) => l.zoneId === zone.id),
        methods: methods.filter((m) => m.zoneId === zone.id),
      })),
    );
  });

  app.post('/shipping/zones', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const body = (await c.req.json()) as { zoneName: string; zoneOrder?: number };
    await core.db.drizzle
      .insert(s.shippingZones)
      .values({ zoneName: body.zoneName, zoneOrder: body.zoneOrder ?? 0 });
    const rows = await core.db.drizzle.select().from(s.shippingZones).orderBy(asc(s.shippingZones.id));
    return c.json(rows.at(-1), 201);
  });

  app.post('/shipping/zones/:id/methods', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const body = await c.req.json();
    await core.db.drizzle
      .insert(s.shippingZoneMethods)
      .values({ ...body, zoneId: intParam(c, 'id') });
    const rows = await core.db.drizzle.select().from(s.shippingZoneMethods).orderBy(asc(s.shippingZoneMethods.id));
    return c.json(rows.at(-1), 201);
  });

  app.post('/shipping/zones/:id/locations', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const body = await c.req.json();
    await core.db.drizzle
      .insert(s.shippingZoneLocations)
      .values({ ...body, zoneId: intParam(c, 'id') });
    return c.json({ ok: true }, 201);
  });

  // --- Webhook rows (delivery engine is SECURITY_WORK S3) --------------------
  app.get('/webhooks', async (c) => {
    const core = c.get('core');
    return c.json(await core.db.drizzle.select().from(core.db.schema.webhooks));
  });

  app.post('/webhooks', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const body = await c.req.json();
    const now = new Date().toISOString();
    await core.db.drizzle
      .insert(s.webhooks)
      .values({ ...body, dateCreated: now, dateModified: now });
    const rows = await core.db.drizzle.select().from(s.webhooks).orderBy(asc(s.webhooks.id));
    return c.json(rows.at(-1), 201);
  });

  // --- Payment gateway config (list-only; charges are S5) --------------------
  app.get('/payment-gateways', async (c) => {
    const payments = c.get('core').container.tryResolve(PAYMENT_SERVICE);
    return c.json(payments ? await payments.availableGateways() : []);
  });

  // --- Settings ---------------------------------------------------------------
  app.get('/settings', async (c) => {
    const core = c.get('core');
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(SETTING_DEFINITIONS)) out[key] = await core.settings.get(key);
    return c.json(out);
  });

  app.put('/settings', async (c) => {
    const core = c.get('core');
    const body = (await c.req.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) await core.settings.set(key, value);
    return c.json({ updated: Object.keys(body).length });
  });

  // --- System status ----------------------------------------------------------
  app.get('/system_status', async (c) => {
    const core = c.get('core');
    return c.json({
      environment: { dialect: core.db.dialect, node: typeof process !== 'undefined' ? process.version : 'edge' },
      database: { migrated: true },
      security: {
        // Grep-able deferral surface: what is stubbed until SECURITY_WORK lands.
        pending: ['S1 order-key tags', 'S2 sessions', 'S3 webhooks', 'S4 auth', 'S5 gateways', 'S6 api-keys', 'S7 admin login', 'S8 i18n data'],
      },
    });
  });

  // --- Reports ----------------------------------------------------------------
  app.get('/reports/revenue', async (c) => c.json(await revenueReport(c.get('core').db, rangeQuery(c))));
  app.get('/reports/orders', async (c) => c.json(await ordersReport(c.get('core').db, rangeQuery(c))));
  app.get('/reports/products', async (c) => c.json(await productsReport(c.get('core').db, rangeQuery(c))));
  app.get('/reports/categories', async (c) => c.json(await categoriesReport(c.get('core').db, rangeQuery(c))));
  app.get('/reports/coupons', async (c) => c.json(await couponsReport(c.get('core').db, rangeQuery(c))));
  app.get('/reports/taxes', async (c) => c.json(await taxesReport(c.get('core').db, rangeQuery(c))));
  app.get('/reports/customers', async (c) => c.json(await customersReport(c.get('core').db)));
  app.get('/reports/stock', async (c) => c.json(await stockReport(c.get('core').db)));
  app.get('/reports/downloads', async (c) => c.json(await downloadsReport(c.get('core').db)));
  app.get('/reports/variations', async (c) => c.json(await variationsReport(c.get('core').db, rangeQuery(c))));
  app.get('/reports/leaderboards', async (c) => c.json(await leaderboards(c.get('core').db, rangeQuery(c))));

  // --- Data -------------------------------------------------------------------
  app.get('/data/countries', (c) => c.json(COUNTRIES));
  app.get('/data/currencies', (c) => c.json(CURRENCIES));

  return app;
}

function rangeQuery(c: Parameters<Parameters<ReturnType<typeof createRouter>['get']>[1]>[0]) {
  return {
    after: c.req.query('after'),
    before: c.req.query('before'),
  };
}
