import { getTableConfig as mysqlConfig } from 'drizzle-orm/mysql-core';
import { getTableConfig as pgConfig } from 'drizzle-orm/pg-core';
import { getTableConfig as sqliteConfig } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { migrate, rollback } from '../src/migrate.js';
import * as mysqlSchema from '../src/mysql/schema.js';
import * as pgSchema from '../src/postgres/schema.js';
import { runSeed } from '../src/seed.js';
import { sqlite } from '../src/sqlite/connect.js';
import * as sqliteSchema from '../src/sqlite/schema.js';

async function freshDb() {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return db;
}

describe('sqlite migrations', () => {
  it('applies 0001_initial + 0002_search and is idempotent', async () => {
    const db = await freshDb();
    const again = await migrate(db);
    expect(again).toEqual([]);
    const tables = await db.queryRaw<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('products');
    expect(names).toContain('orders');
    expect(names).toContain('order_events');
    expect(names).toContain('settings_json');
    expect(names).toContain('products_fts');
    await db.close();
  });

  it('rolls back to 0 with down migrations', async () => {
    const db = await freshDb();
    const rolled = await rollback(db, 0);
    expect(rolled).toEqual(['0002_search', '0001_initial']);
    const tables = await db.queryRaw<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = 'products'",
    );
    expect(tables).toHaveLength(0);
    await db.close();
  });

  it('exposes money as fixed 4-decimal strings and timestamps as ISO strings', async () => {
    const db = await freshDb();
    const s = db.schema;
    const iso = new Date().toISOString();
    await db.drizzle.insert(s.products).values({
      name: 'Test',
      slug: 'test',
      regularPrice: '12.34',
      price: '12.34',
      galleryImageIds: [],
      ratingCounts: {},
      defaultAttributes: [],
      attributes: [],
      downloads: [],
      dateCreated: iso,
      dateModified: iso,
    });
    const row = (await db.drizzle.select().from(s.products).where(eq(s.products.slug, 'test')))[0]!;
    expect(row.regularPrice).toBe('12.3400');
    expect(row.dateCreated).toBe(iso);
    expect(row.featured).toBe(false);
    expect(row.galleryImageIds).toEqual([]);
    await db.close();
  });

  it('enforces CHECK constraints and FKs', async () => {
    const db = await freshDb();
    await expect(
      db.exec(`INSERT INTO orders (status, currency, prices_include_tax, date_created, date_modified, order_key)
               VALUES ('bogus', 'USD', 0, '2026-01-01', '2026-01-01', 'wc_order_x')`),
    ).rejects.toThrow();
    await expect(
      db.exec(`INSERT INTO order_items (order_id, name, type) VALUES (99999, 'x', 'line_item')`),
    ).rejects.toThrow();
    await db.close();
  });

  it('order_events UNIQUE(order_id, event_type) prevents double-fire', async () => {
    const db = await freshDb();
    const s = db.schema;
    const iso = new Date().toISOString();
    await db.drizzle.insert(s.orders).values({
      status: 'pending',
      currency: 'USD',
      pricesIncludeTax: false,
      dateCreated: iso,
      dateModified: iso,
      orderKey: 'wc_order_test1',
    });
    const order = (await db.drizzle.select().from(s.orders))[0]!;
    await db.drizzle
      .insert(s.orderEvents)
      .values({ orderId: order.id, eventType: 'stock_reduced', createdAt: iso });
    await expect(
      db.drizzle
        .insert(s.orderEvents)
        .values({ orderId: order.id, eventType: 'stock_reduced', createdAt: iso }),
    ).rejects.toThrow();
    await db.close();
  });
});

describe('dialect parity', () => {
  it('all three schemas expose identical tables and columns', () => {
    const tableNames = Object.keys(sqliteSchema).sort();
    expect(Object.keys(pgSchema).sort()).toEqual(tableNames);
    expect(Object.keys(mysqlSchema).sort()).toEqual(tableNames);

    for (const key of tableNames) {
      const sq = sqliteConfig((sqliteSchema as Record<string, any>)[key]);
      const pgc = pgConfig((pgSchema as Record<string, any>)[key]);
      const myc = mysqlConfig((mysqlSchema as Record<string, any>)[key]);
      const cols = (c: { columns: { name: string; notNull: boolean }[] }) =>
        c.columns.map((col) => `${col.name}:${col.notNull ? 'nn' : 'null'}`).sort();
      expect(pgc.name).toBe(sq.name);
      expect(myc.name).toBe(sq.name);
      expect(cols(pgc)).toEqual(cols(sq));
      expect(cols(myc)).toEqual(cols(sq));
    }
  });
});

describe('seed runner', () => {
  it('seeds idempotently', async () => {
    const db = await freshDb();
    const seed = {
      settings: { string: { store_name: 'Test Store' } },
      users: [{ email: 'admin@example.com', passwordHash: 'x', role: 'admin' }],
      categories: [{ name: 'Hoodies', slug: 'hoodies' }],
      products: [
        {
          name: 'Logo Hoodie',
          slug: 'logo-hoodie',
          regularPrice: '45.0000',
          sku: 'HOOD-1',
          categories: ['hoodies'],
        },
      ],
      coupons: [{ code: 'save10', discountType: 'percent', amount: '10' }],
      taxRates: [{ country: 'US', state: 'CA', name: 'CA Tax', rate: '7.2500' }],
      shippingZones: [
        {
          name: 'Domestic',
          locations: [{ type: 'country', code: 'US' }],
          methods: [{ methodId: 'flat_rate', settings: { cost: '5.00' } }],
        },
      ],
    };
    await runSeed(db, seed);
    await runSeed(db, seed);
    const products = await db.drizzle.select().from(db.schema.products);
    expect(products).toHaveLength(1);
    const zones = await db.drizzle.select().from(db.schema.shippingZones);
    expect(zones).toHaveLength(1);
    const rates = await db.drizzle.select().from(db.schema.taxRates);
    expect(rates).toHaveLength(1);
    await db.close();
  });
});
