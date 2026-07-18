import type { ProductListQuery } from '@spacendigital/core';
import { createRouter, intParam, pageQuery, setListHeaders } from '../shared.js';

/** /api/v1 products + variations + categories + tags (clean JSON shapes). */
export function catalogRoutes() {
  const app = createRouter();

  app.get('/products', async (c) => {
    const core = c.get('core');
    const { page, perPage } = pageQuery(c);
    const q = c.req.query();
    const query: ProductListQuery = {
      page,
      perPage,
      status: (q.status as ProductListQuery['status']) ?? 'publish',
      type: q.type as ProductListQuery['type'],
      search: q.search,
      categoryId: q.category ? Number(q.category) : undefined,
      tagId: q.tag ? Number(q.tag) : undefined,
      featured: q.featured === undefined ? undefined : q.featured === 'true',
      onSale: q.on_sale === undefined ? undefined : q.on_sale === 'true',
      stockStatus: q.stock_status as ProductListQuery['stockStatus'],
      minPrice: q.min_price,
      maxPrice: q.max_price,
      orderBy: q.orderby as ProductListQuery['orderBy'],
      order: q.order as ProductListQuery['order'],
    };
    const result = await core.products.list(query);
    setListHeaders(c, result.total, result.totalPages, result.page);
    return c.json(result.items);
  });

  app.post('/products', async (c) => {
    const core = c.get('core');
    const body = await c.req.json();
    return c.json(await core.products.create(body), 201);
  });

  app.get('/products/:id', async (c) => {
    return c.json(await c.get('core').products.get(intParam(c, 'id')));
  });

  app.put('/products/:id', async (c) => {
    const body = await c.req.json();
    return c.json(await c.get('core').products.update(intParam(c, 'id'), body));
  });

  app.delete('/products/:id', async (c) => {
    const core = c.get('core');
    const id = intParam(c, 'id');
    const force = c.req.query('force') === 'true';
    const product = await core.products.get(id);
    if (force) await core.products.delete(id);
    else await core.products.trash(id);
    return c.json(product);
  });

  app.get('/products/:id/variations', async (c) => {
    return c.json(await c.get('core').products.getVariations(intParam(c, 'id')));
  });

  app.post('/products/:id/variations', async (c) => {
    const body = await c.req.json();
    return c.json(await c.get('core').products.createVariation(intParam(c, 'id'), body), 201);
  });

  app.put('/products/:id/variations/:variationId', async (c) => {
    const body = await c.req.json();
    return c.json(await c.get('core').products.updateVariation(intParam(c, 'variationId'), body));
  });

  app.delete('/products/:id/variations/:variationId', async (c) => {
    const core = c.get('core');
    const variation = await core.products.getVariation(intParam(c, 'variationId'));
    await core.products.deleteVariation(variation.id);
    return c.json(variation);
  });

  app.get('/products/:id/related', async (c) => {
    return c.json(await c.get('core').products.getRelatedIds(intParam(c, 'id')));
  });

  // --- Categories & tags (flat CRUD over the taxonomy tables) --------------
  app.get('/products-categories', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    return c.json(await core.db.drizzle.select().from(s.productCategories));
  });

  app.post('/products-categories', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const body = (await c.req.json()) as { name: string; slug?: string; parentId?: number | null; description?: string };
    const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await core.db.drizzle.insert(s.productCategories).values({
      name: body.name,
      slug,
      description: body.description ?? '',
      parentId: body.parentId ?? null,
      displayType: 'default',
      sortOrder: 0,
    });
    const rows = await core.db.drizzle.select().from(s.productCategories);
    return c.json(rows.find((r) => r.slug === slug), 201);
  });

  app.get('/products-tags', async (c) => {
    const core = c.get('core');
    return c.json(await core.db.drizzle.select().from(core.db.schema.productTags));
  });

  app.post('/products-tags', async (c) => {
    const core = c.get('core');
    const s = core.db.schema;
    const body = (await c.req.json()) as { name: string; slug?: string };
    const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await core.db.drizzle.insert(s.productTags).values({ name: body.name, slug, description: '' });
    const rows = await core.db.drizzle.select().from(s.productTags);
    return c.json(rows.find((r) => r.slug === slug), 201);
  });

  app.get('/products-reviews', async (c) => {
    const core = c.get('core');
    return c.json(await core.db.drizzle.select().from(core.db.schema.reviews));
  });

  return app;
}
