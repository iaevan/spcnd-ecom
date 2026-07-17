import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as sqliteSchema from './sqlite/schema.js';

export type DbDialect = 'sqlite' | 'postgres' | 'mysql';

/**
 * The canonical logical schema. All three dialects expose identical table and
 * column names with identical app-facing TS types (money as fixed 4-decimal
 * strings, timestamps as ISO-8601 UTC strings, booleans as booleans), so the
 * SQLite schema serves as the single type-level source of truth. The
 * PostgreSQL/MySQL schema modules are structurally identical at runtime and
 * are cast to this type at the factory boundary.
 */
export type Schema = typeof sqliteSchema;

export type SpcndDrizzle = BetterSQLite3Database<Record<string, unknown>>;

/** A connected spcnd-ecom database: drizzle instance + canonical schema + txn support. */
export interface SpcndDb {
  readonly dialect: DbDialect;
  readonly drizzle: SpcndDrizzle;
  readonly schema: Schema;
  /**
   * Run `fn` inside a transaction. Nested calls are flattened into the
   * outermost transaction.
   */
  transaction<T>(fn: (tx: SpcndDb) => Promise<T>): Promise<T>;
  /** Execute a raw multi-statement SQL script (migrations, FTS setup). */
  exec(sqlScript: string): Promise<void>;
  /** Run a raw parameterized query returning rows (dialect-specific SQL). */
  queryRaw<T = Record<string, unknown>>(sqlText: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/** Lazy connection descriptor returned by `sqlite()` / `postgres()` / `mysql()`. */
export interface DbConfig {
  dialect: DbDialect;
  connect(): Promise<SpcndDb>;
}
