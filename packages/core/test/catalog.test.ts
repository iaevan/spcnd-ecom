import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { productStockSet } from '../src/events.js';
import { createTestCore, seedCategory, seedProduct } from './helpers.js';

describe('ProductService', () => {
  it('creates a product and syncs product_meta_lookup in the same shape', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { sku: 'SKU-1', regularPrice: '19.9900' });
    expect(product.price).toBe('19.9900');
    const s = core.db.schema;
    const lookup = (
      await core.db.drizzle
        .select()
        .from(s.productMetaLookup)
        .where(eq(s.productMetaLookup.productId, product.id))
    )[0];
    expect(lookup).toMatchObject({
      sku: 'SKU-1',
      minPrice: '19.9900',
      maxPrice: '19.9900',
      onsale: false,
      stockStatus: 'instock',
    });
    await core.close();
  });

  it('resolves sale-window pricing', async () => {
    const core = await createTestCore();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const active = await seedProduct(core, { regularPrice: '10.0000', salePrice: '8.0000' });
    expect(active.price).toBe('8.0000');
    expect(await core.products.isOnSale(active)).toBe(true);
    const ended = await seedProduct(core, {
      name: 'Ended sale',
      regularPrice: '10.0000',
      salePrice: '8.0000',
      dateOnSaleTo: past,
    });
    expect(ended.price).toBe('10.0000');
    const scheduled = await seedProduct(core, {
      name: 'Scheduled sale',
      regularPrice: '10.0000',
      salePrice: '8.0000',
      dateOnSaleFrom: future,
    });
    expect(scheduled.price).toBe('10.0000');
    await core.close();
  });

  it('de-duplicates slugs and rejects duplicate SKUs', async () => {
    const core = await createTestCore();
    const first = await seedProduct(core, { name: 'Same Name' });
    const second = await seedProduct(core, { name: 'Same Name' });
    expect(first.slug).toBe('same-name');
    expect(second.slug).toBe('same-name-2');
    await seedProduct(core, { name: 'Keeper', sku: 'DUP' });
    await expect(seedProduct(core, { name: 'Clash', sku: 'DUP' })).rejects.toThrow(/already in use/);
    await core.close();
  });

  it('derives stock status on setStock and fires stock events', async () => {
    const core = await createTestCore();
    const product = await seedProduct(core, { manageStock: true, stockQuantity: 5 });
    const events: (number | null)[] = [];
    core.bus.on(productStockSet, ({ quantity }) => {
      events.push(quantity);
    });
    await core.products.setStock(product.id, 0);
    expect((await core.products.get(product.id)).stockStatus).toBe('outofstock');
    await core.products.restoreStock(product.id, 3);
    expect((await core.products.get(product.id)).stockQuantity).toBe(3);
    expect((await core.products.get(product.id)).stockStatus).toBe('instock');
    await core.products.reduceStock(product.id, 1);
    expect((await core.products.get(product.id)).stockQuantity).toBe(2);
    expect(events).toEqual([0, 3, 2]);
    await core.close();
  });

  it('syncs variable products from enabled variations', async () => {
    const core = await createTestCore();
    const parent = await seedProduct(core, { name: 'Variable', type: 'variable', regularPrice: null });
    await core.products.createVariation(parent.id, { regularPrice: '8.0000', attributes: { size: 'S' } });
    await core.products.createVariation(parent.id, {
      regularPrice: '12.0000',
      salePrice: '9.5000',
      attributes: { size: 'L' },
    });
    const synced = await core.products.get(parent.id);
    expect(synced.price).toBe('8.0000');
    const s = core.db.schema;
    const lookup = (
      await core.db.drizzle
        .select()
        .from(s.productMetaLookup)
        .where(eq(s.productMetaLookup.productId, parent.id))
    )[0];
    expect(lookup).toMatchObject({ minPrice: '8.0000', maxPrice: '9.5000', onsale: true });
    await core.close();
  });

  it('lists with lookup-backed filters and finds related products', async () => {
    const core = await createTestCore();
    const catId = await seedCategory(core, 'Hats', 'hats');
    const a = await seedProduct(core, { name: 'A', regularPrice: '5.0000', categoryIds: [catId] });
    const b = await seedProduct(core, { name: 'B', regularPrice: '15.0000', categoryIds: [catId] });
    await seedProduct(core, { name: 'C', regularPrice: '25.0000', salePrice: '20.0000' });

    const cheap = await core.products.list({ maxPrice: '10.0000' });
    expect(cheap.items.map((p) => p.name)).toEqual(['A']);
    const onSale = await core.products.list({ onSale: true });
    expect(onSale.items.map((p) => p.name)).toEqual(['C']);
    expect(await core.products.getRelatedIds(a.id)).toEqual([b.id]);
    await core.close();
  });

  it('looks up by sku across products and variations', async () => {
    const core = await createTestCore();
    const parent = await seedProduct(core, { name: 'V', type: 'variable', regularPrice: null });
    await core.products.createVariation(parent.id, { sku: 'VAR-SKU', regularPrice: '7.0000' });
    const hit = await core.products.findBySku('VAR-SKU');
    expect(hit?.product.id).toBe(parent.id);
    expect(hit?.variation?.sku).toBe('VAR-SKU');
    expect(await core.products.getIdBySku('missing')).toBe(0);
    await core.close();
  });
});
