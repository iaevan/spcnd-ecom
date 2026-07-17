import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { DbConfig, SpcndDb, SpcndDrizzle } from '../types.js';
import * as schema from './schema.js';

class Mutex {
  private tail: Promise<void> = Promise.resolve();

  lock(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = this.tail.then(() => release);
    this.tail = this.tail.then(() => next);
    return acquired;
  }
}

class SqliteDb implements SpcndDb {
  readonly dialect = 'sqlite' as const;
  readonly schema = schema;
  readonly drizzle: SpcndDrizzle;
  private readonly txMutex = new Mutex();
  private inTransaction = false;

  constructor(private readonly client: Database.Database) {
    this.drizzle = drizzle(client) as unknown as SpcndDrizzle;
  }

  async transaction<T>(fn: (tx: SpcndDb) => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn(this);
    // better-sqlite3 is synchronous, so an async callback can interleave with
    // other requests on the same connection; the mutex serializes transactions
    // to keep BEGIN/COMMIT pairs atomic (see DECISIONS.md).
    const release = await this.txMutex.lock();
    this.client.exec('BEGIN IMMEDIATE');
    this.inTransaction = true;
    try {
      const result = await fn(this);
      this.client.exec('COMMIT');
      return result;
    } catch (error) {
      this.client.exec('ROLLBACK');
      throw error;
    } finally {
      this.inTransaction = false;
      release();
    }
  }

  async exec(sqlScript: string): Promise<void> {
    this.client.exec(sqlScript);
  }

  async queryRaw<T = Record<string, unknown>>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.client.prepare(sqlText);
    if (stmt.reader) return stmt.all(...params) as T[];
    stmt.run(...params);
    return [];
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

/**
 * Zero-config SQLite storage (the default). Pass a file path or `:memory:`.
 *
 * ```ts
 * createSpcndApp({ db: sqlite('./spcnd.db') })
 * ```
 */
export function sqlite(path = './spcnd.db'): DbConfig {
  return {
    dialect: 'sqlite',
    async connect() {
      const client = new Database(path);
      client.pragma('journal_mode = WAL');
      client.pragma('foreign_keys = ON');
      return new SqliteDb(client);
    },
  };
}
