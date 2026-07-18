import {
  loadOrderRelations,
  loadProductRelations,
  serializeCoupon,
  serializeCustomer,
  serializeOrder,
  serializeProduct,
  serializeReview,
  type SerializerContext,
} from '@spacendigital/compat-wc';
import type { SpcndCore } from '@spacendigital/core';
import type { Context } from 'hono';
import { createRouter, devTrustAllAuth, intParam, pageQuery, setListHeaders } from './shared.js';

/**
 * /api/v3 — WC-shaped REST (spec §6.1): compat-wc serializers, X-WP-Total /
 * X-WP-TotalPages / Link headers, and batch {create,update,delete} on the
 * CRUD controllers. Auth is the S6 dev-trust middleware until api-keys land.
 */

async function ctxFor(core: SpcndCore): Promise<SerializerContext> {
  return {
    storeUrl: await core.settings.getString('store_url'),
    currency: await core.settings.getString('currency'),
    decimals: await core.settings.getInt('price_num_decimals'),
  };
}

interface BatchBody {
  create?: Record<string, unknown>[];
  update?: (Record<string, unknown> & { id: number })[];
  delete?: number[];
}

/** WC batch semantics: run each op, collect results per section. */
function batchHandler(handlers: {
  create(core: SpcndCore, body: Record<string, unknown>): Promise<unknown>;
  update(core: SpcndCore, id: number, body: Record<string, unknown>): Promise<unknown>;
  delete(core: SpcndCore, id: number): Promise<unknown>;
}) {
  return async (c: Context) => {
    const core = c.get('core') as SpcndCore;
    const body = (await c.req.json()) as BatchBody;
    const result: { create: unknown[]; update: unknown[]; delete: unknown[] } = {
      create: [],
      update: [],
      delete: [],
    };
    for (const item of body.create ?? []) {
      try {
        result.create.push(await handlers.create(core, item));
      } catch (error) {
        result.create.push({ error: (error as Error).message });
      }
    }
    for (const item of body.update ?? []) {
      try {
        result.update.push(await handlers.update(core, item.id, item));
      } catch (error) {
        result.update.push({ id: item.id, error: (error as Error).message });
      }
    }
    for (const id of body.delete ?? []) {
      try {
        result.delete.push(await handlers.delete(core, id));
      } catch (error) {
        result.delete.push({ id, error: (error as Error).message });
      }
    }
    return c.json(result);
  };
}

export function createRestV3() {
  const app = createRouter();
  app.use('*', devTrustAllAuth());

  // --- Products -------------------------------------------------------------
  app.get('/products', async (c) => {
    const core = c.get('core');
    const { page, perPage } = pageQuery(c);
    const result = await core.products.list({
      page,
      perPage,
      search: c.req.query('search'),
      status: (c.req.query('status') as never) ?? 'publish',
    });
    setListHeaders(c, result.total, result.totalPages, result.page);
    const ctx = await ctxFor(core);
    const out = [];
    for (const product of result.items) {
      out.push(serializeProduct(product, await loadProductRelations(core, product), ctx));
    }
    return c.json(out);
  });

  app.get('/products/:id', async (c) => {
    const core = c.get('core');
    const product = await core.products.get(intParam(c, 'id'));
    return c.json(
      serializeProduct(product, await loadProductRelations(core, product), await ctxFor(core)),
    );
  });

  app.post('/products', async (c) => {
    const core = c.get('core');
    const product = await core.products.create(mapWcProductBody(await c.req.json()) as never);
    return c.json(
      serializeProduct(product, await loadProductRelations(core, product), await ctxFor(core)),
      201,
    );
  });

  app.put('/products/:id', async (c) => {
    const core = c.get('core');
    const product = await core.products.update(
      intParam(c, 'id'),
      mapWcProductBody(await c.req.json()),
    );
    return c.json(
      serializeProduct(product, await loadProductRelations(core, product), await ctxFor(core)),
    );
  });

  app.delete('/products/:id', async (c) => {
    const core = c.get('core');
    const id = intParam(c, 'id');
    const product = await core.products.get(id);
    const serialized = serializeProduct(
      product,
      await loadProductRelations(core, product),
      await ctxFor(core),
    );
    if (c.req.query('force') === 'true') await core.products.delete(id);
    else await core.products.trash(id);
    return c.json(serialized);
  });

  app.post(
    '/products/batch',
    batchHandler({
      create: async (core, body) => {
        const product = await core.products.create(mapWcProductBody(body) as never);
        return serializeProduct(product, await loadProductRelations(core, product), await ctxFor(core));
      },
      update: async (core, id, body) => {
        const product = await core.products.update(id, mapWcProductBody(body));
        return serializeProduct(product, await loadProductRelations(core, product), await ctxFor(core));
      },
      delete: async (core, id) => {
        const product = await core.products.get(id);
        await core.products.trash(id);
        return { id: product.id };
      },
    }),
  );

  // --- Orders ---------------------------------------------------------------
  app.get('/orders', async (c) => {
    const core = c.get('core');
    const { page, perPage } = pageQuery(c);
    const status = c.req.query('status');
    const result = await core.orders.list({
      page,
      perPage,
      status: status && status !== 'any' ? (status.split(',') as never) : undefined,
    });
    setListHeaders(c, result.total, result.totalPages, result.page);
    const ctx = await ctxFor(core);
    const out = [];
    for (const order of result.items) {
      out.push(serializeOrder(order, await loadOrderRelations(core, order), ctx));
    }
    return c.json(out);
  });

  app.get('/orders/:id', async (c) => {
    const core = c.get('core');
    const order = await core.orders.get(intParam(c, 'id'));
    return c.json(serializeOrder(order, await loadOrderRelations(core, order), await ctxFor(core)));
  });

  app.put('/orders/:id', async (c) => {
    const core = c.get('core');
    const id = intParam(c, 'id');
    const body = (await c.req.json()) as { status?: string; set_paid?: boolean; transaction_id?: string };
    if (body.status) await core.orders.setStatus(id, body.status as never, undefined, true);
    if (body.set_paid) await core.orders.paymentComplete(id, body.transaction_id);
    const order = await core.orders.get(id);
    return c.json(serializeOrder(order, await loadOrderRelations(core, order), await ctxFor(core)));
  });

  app.post(
    '/orders/batch',
    batchHandler({
      create: async (core) => ({ error: 'order creation via v3 batch is not supported yet' }),
      update: async (core, id, body) => {
        if (body.status) await core.orders.setStatus(id, body.status as never, undefined, true);
        const order = await core.orders.get(id);
        return serializeOrder(order, await loadOrderRelations(core, order), await ctxFor(core));
      },
      delete: async (core, id) => {
        await core.orders.trash(id);
        return { id };
      },
    }),
  );

  // --- Customers --------------------------------------------------------------
  app.get('/customers', async (c) => {
    const core = c.get('core');
    const { page, perPage } = pageQuery(c);
    const result = await core.customers.list({ page, perPage });
    setListHeaders(c, result.total, result.totalPages, result.page);
    const out = [];
    for (const customer of result.items) {
      out.push(
        serializeCustomer(
          customer,
          await core.customers.getAddress(customer.id, 'billing'),
          await core.customers.getAddress(customer.id, 'shipping'),
        ),
      );
    }
    return c.json(out);
  });

  app.get('/customers/:id', async (c) => {
    const core = c.get('core');
    const customer = await core.customers.get(intParam(c, 'id'));
    return c.json(
      serializeCustomer(
        customer,
        await core.customers.getAddress(customer.id, 'billing'),
        await core.customers.getAddress(customer.id, 'shipping'),
      ),
    );
  });

  app.post(
    '/customers/batch',
    batchHandler({
      create: async (core, body) => {
        const customer = await core.customers.create({
          email: String(body.email ?? ''),
          firstName: body.first_name as string,
          lastName: body.last_name as string,
        });
        return serializeCustomer(
          customer,
          await core.customers.getAddress(customer.id, 'billing'),
          await core.customers.getAddress(customer.id, 'shipping'),
        );
      },
      update: async (core, id, body) => {
        const customer = await core.customers.update(id, {
          firstName: body.first_name as string,
          lastName: body.last_name as string,
        });
        return serializeCustomer(
          customer,
          await core.customers.getAddress(customer.id, 'billing'),
          await core.customers.getAddress(customer.id, 'shipping'),
        );
      },
      delete: async (core, id) => {
        await core.customers.delete(id);
        return { id };
      },
    }),
  );

  // --- Coupons ----------------------------------------------------------------
  app.get('/coupons', async (c) => {
    const core = c.get('core');
    const { page, perPage } = pageQuery(c);
    const result = await core.coupons.list({ page, perPage });
    setListHeaders(c, result.total, result.totalPages, result.page);
    const ctx = await ctxFor(core);
    return c.json(result.items.map((coupon) => serializeCoupon(coupon, ctx)));
  });

  app.get('/coupons/:id', async (c) => {
    const core = c.get('core');
    return c.json(serializeCoupon(await core.coupons.get(intParam(c, 'id')), await ctxFor(core)));
  });

  // --- Reviews ----------------------------------------------------------------
  app.get('/products/reviews', async (c) => {
    const core = c.get('core');
    const rows = await core.db.drizzle.select().from(core.db.schema.reviews);
    return c.json(rows.map((r) => serializeReview(r)));
  });

  return app;
}

/** Minimal WC→canonical body mapping for v3 product writes. */
function mapWcProductBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Record<string, string> = {
    name: 'name',
    slug: 'slug',
    type: 'type',
    status: 'status',
    description: 'description',
    short_description: 'shortDescription',
    sku: 'sku',
    regular_price: 'regularPrice',
    sale_price: 'salePrice',
    manage_stock: 'manageStock',
    stock_quantity: 'stockQuantity',
    stock_status: 'stockStatus',
    catalog_visibility: 'catalogVisibility',
    featured: 'featured',
    virtual: 'virtual',
    downloadable: 'downloadable',
    tax_status: 'taxStatus',
    tax_class: 'taxClass',
    sold_individually: 'soldIndividually',
  };
  for (const [wcKey, key] of Object.entries(map)) {
    if (body[wcKey] === undefined) continue;
    // WC sends '' to clear a price; the money columns want null.
    if ((wcKey === 'regular_price' || wcKey === 'sale_price') && body[wcKey] === '') {
      out[key] = null;
      continue;
    }
    out[key] = body[wcKey];
  }
  if (Array.isArray(body.categories)) {
    out.categoryIds = (body.categories as { id: number }[]).map((c) => c.id);
  }
  if (Array.isArray(body.tags)) out.tagIds = (body.tags as { id: number }[]).map((t) => t.id);
  if (Array.isArray(body.upsell_ids)) out.upsellIds = body.upsell_ids;
  if (Array.isArray(body.cross_sell_ids)) out.crosssellIds = body.cross_sell_ids;
  return out;
}
