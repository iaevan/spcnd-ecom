import { drizzle } from 'drizzle-orm/mysql2';
import mysql2 from 'mysql2/promise';
import type { DbConfig, Schema, SpcndDb, SpcndDrizzle } from '../types.js';
import * as mysqlSchema from './schema.js';

class MySqlDb implements SpcndDb {
  readonly dialect = 'mysql' as const;
  readonly schema = mysqlSchema as unknown as Schema;

  constructor(
    readonly drizzle: SpcndDrizzle,
    private readonly pool: mysql2.Pool,
    private readonly isTx = false,
  ) {}

  async transaction<T>(fn: (tx: SpcndDb) => Promise<T>): Promise<T> {
    if (this.isTx) return fn(this);
    const real = this.drizzle as unknown as ReturnType<typeof drizzle>;
    return real.transaction(async (tx) =>
      fn(new MySqlDb(tx as unknown as SpcndDrizzle, this.pool, true)),
    );
  }

  async exec(sqlScript: string): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.query(sqlScript);
    } finally {
      conn.release();
    }
  }

  async queryRaw<T = Record<string, unknown>>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sqlText, params);
    return rows as T[];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * MySQL storage. Connections run with UTC session timezone so DATETIME(3)
 * columns always hold UTC.
 *
 * ```ts
 * createSpcndApp({ db: mysql('mysql://user:pass@host:3306/spcnd') })
 * ```
 */
export function mysql(url: string): DbConfig {
  return {
    dialect: 'mysql',
    async connect() {
      const pool = mysql2.createPool({
        uri: url,
        timezone: 'Z',
        multipleStatements: true,
        supportBigNumbers: true,
      });
      const db = drizzle(pool) as unknown as SpcndDrizzle;
      return new MySqlDb(db, pool);
    },
  };
}
