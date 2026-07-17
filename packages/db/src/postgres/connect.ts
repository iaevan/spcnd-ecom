import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { DbConfig, Schema, SpcndDb, SpcndDrizzle } from '../types.js';
import * as pgSchema from './schema.js';

class PostgresDb implements SpcndDb {
  readonly dialect = 'postgres' as const;
  readonly schema = pgSchema as unknown as Schema;

  constructor(
    readonly drizzle: SpcndDrizzle,
    private readonly pool: pg.Pool,
    private readonly isTx = false,
  ) {}

  async transaction<T>(fn: (tx: SpcndDb) => Promise<T>): Promise<T> {
    if (this.isTx) return fn(this);
    const real = this.drizzle as unknown as ReturnType<typeof drizzle>;
    return real.transaction(async (tx) =>
      fn(new PostgresDb(tx as unknown as SpcndDrizzle, this.pool, true)),
    );
  }

  async exec(sqlScript: string): Promise<void> {
    await this.pool.query(sqlScript);
  }

  async queryRaw<T = Record<string, unknown>>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sqlText, params);
    return result.rows as T[];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * PostgreSQL storage (production recommendation).
 *
 * ```ts
 * createSpcndApp({ db: postgres(process.env.DATABASE_URL) })
 * ```
 */
export function postgres(url: string): DbConfig {
  return {
    dialect: 'postgres',
    async connect() {
      const pool = new pg.Pool({ connectionString: url });
      const db = drizzle(pool) as unknown as SpcndDrizzle;
      return new PostgresDb(db, pool);
    },
  };
}
