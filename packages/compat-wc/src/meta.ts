import type { SpcndDb } from '@spacendigital/db';
import { and, asc, eq } from 'drizzle-orm';

/**
 * WP-style meta shims over the EAV tables (docs/AGENTS.md §7.2). Signatures
 * mirror get_post_meta / update_post_meta / add_post_meta / delete_post_meta:
 * values are stored as strings (JSON-encoded when not already a string),
 * `single` returns the first value, and update replaces every existing row
 * for the key.
 */

interface MetaTableConfig {
  table:
    | 'productMeta'
    | 'orderMeta'
    | 'customerMeta'
    | 'orderItemMeta';
  ownerColumn: 'productId' | 'orderId' | 'customerId' | 'orderItemId';
}

function serialize(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Parse stored strings back into structures when they are JSON. */
function deserialize(value: string | null): unknown {
  if (value === null) return '';
  const trimmed = value.trim();
  if (/^[[{"]|^-?\d+(\.\d+)?$|^(true|false|null)$/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function shimFor(db: SpcndDb, config: MetaTableConfig) {
  // The four EAV tables share the same shape; typing goes through one of them.
  const table = db.schema[config.table] as unknown as typeof db.schema.productMeta;
  const ownerCol =
    config.table === 'productMeta'
      ? db.schema.productMeta.productId
      : config.table === 'orderMeta'
        ? db.schema.orderMeta.orderId
        : config.table === 'customerMeta'
          ? db.schema.customerMeta.customerId
          : db.schema.orderItemMeta.orderItemId;

  return {
    /** get_post_meta($id, $key, true) — first value, '' when absent. */
    async get(ownerId: number, key: string): Promise<unknown> {
      const rows = await db.drizzle
        .select()
        .from(table)
        .where(and(eq(ownerCol, ownerId), eq(table.key, key)))
        .orderBy(asc(table.id))
        .limit(1);
      return rows[0] ? deserialize(rows[0].value) : '';
    },

    /** get_post_meta($id, $key, false) — every value for the key. */
    async getAll(ownerId: number, key?: string): Promise<Record<string, unknown[]>> {
      const where = key ? and(eq(ownerCol, ownerId), eq(table.key, key)) : eq(ownerCol, ownerId);
      const rows = await db.drizzle.select().from(table).where(where).orderBy(asc(table.id));
      const out: Record<string, unknown[]> = {};
      for (const row of rows) {
        if (row.key === null) continue;
        (out[row.key] ??= []).push(deserialize(row.value));
      }
      return out;
    },

    /** update_post_meta — replaces all rows for the key (creates when absent). */
    async update(ownerId: number, key: string, value: unknown): Promise<void> {
      const existing = await db.drizzle
        .select({ id: table.id })
        .from(table)
        .where(and(eq(ownerCol, ownerId), eq(table.key, key)))
        .orderBy(asc(table.id));
      const first = existing[0];
      if (first) {
        await db.drizzle
          .update(table)
          .set({ value: serialize(value) })
          .where(eq(table.id, first.id));
        for (const row of existing.slice(1)) {
          await db.drizzle.delete(table).where(eq(table.id, row.id));
        }
      } else {
        await this.add(ownerId, key, value);
      }
    },

    /** add_post_meta — appends another row for the key. */
    async add(ownerId: number, key: string, value: unknown): Promise<void> {
      await db.drizzle
        .insert(table)
        .values({ [config.ownerColumn]: ownerId, key, value: serialize(value) } as never);
    },

    /** delete_post_meta — every row for the key (optionally value-matched). */
    async delete(ownerId: number, key: string, value?: unknown): Promise<void> {
      if (value === undefined) {
        await db.drizzle.delete(table).where(and(eq(ownerCol, ownerId), eq(table.key, key)));
        return;
      }
      await db.drizzle
        .delete(table)
        .where(and(eq(ownerCol, ownerId), eq(table.key, key), eq(table.value, serialize(value))));
    },
  };
}

export type MetaShim = ReturnType<typeof shimFor>;

/** The four WC meta surfaces: product, order, customer, order-item. */
export function createMetaShims(db: SpcndDb): {
  product: MetaShim;
  order: MetaShim;
  customer: MetaShim;
  orderItem: MetaShim;
} {
  return {
    product: shimFor(db, { table: 'productMeta', ownerColumn: 'productId' }),
    order: shimFor(db, { table: 'orderMeta', ownerColumn: 'orderId' }),
    customer: shimFor(db, { table: 'customerMeta', ownerColumn: 'customerId' }),
    orderItem: shimFor(db, { table: 'orderItemMeta', ownerColumn: 'orderItemId' }),
  };
}
