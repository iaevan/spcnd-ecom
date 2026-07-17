import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpcndDb } from './types.js';

const CREATE_MIGRATIONS_TABLE: Record<string, string> = {
  sqlite: `CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  )`,
  postgres: `CREATE TABLE IF NOT EXISTS _migrations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL
  )`,
  mysql: `CREATE TABLE IF NOT EXISTS _migrations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at DATETIME(3) NOT NULL
  )`,
};

/** Default migrations directory shipped inside the @spcnd-ecom/db package. */
export function defaultMigrationsDir(dialect: string): string {
  return fileURLToPath(new URL(`../migrations/${dialect}`, import.meta.url));
}

/** drizzle-kit emits `--> statement-breakpoint` markers; MySQL can't parse them as comments. */
function splitStatements(script: string): string[] {
  return script
    .split(/^\s*-->\s*statement-breakpoint\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function listMigrationFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
}

async function appliedNames(db: SpcndDb): Promise<Set<string>> {
  const rows = await db.queryRaw<{ name: string }>('SELECT name FROM _migrations');
  return new Set(rows.map((r) => r.name));
}

function nowValue(db: SpcndDb): string {
  return db.dialect === 'mysql'
    ? new Date().toISOString().replace('T', ' ').replace('Z', '')
    : new Date().toISOString();
}

/** Apply all pending migrations. Returns the applied migration names. */
export async function migrate(db: SpcndDb, opts: { dir?: string } = {}): Promise<string[]> {
  const dir = opts.dir ?? defaultMigrationsDir(db.dialect);
  await db.exec(CREATE_MIGRATIONS_TABLE[db.dialect] as string);
  const done = await appliedNames(db);
  const applied: string[] = [];
  for (const file of listMigrationFiles(dir)) {
    const name = file.replace(/\.sql$/, '');
    if (done.has(name)) continue;
    const sqlScript = readFileSync(join(dir, file), 'utf8');
    for (const statement of splitStatements(sqlScript)) {
      await db.exec(statement);
    }
    const placeholder = db.dialect === 'postgres' ? '($1, $2)' : '(?, ?)';
    await db.queryRaw(`INSERT INTO _migrations (name, applied_at) VALUES ${placeholder}`, [
      name,
      nowValue(db),
    ]);
    applied.push(name);
  }
  return applied;
}

/**
 * Roll back applied migrations down to (and keeping) migration number `to`.
 * Requires matching `NNNN_name.down.sql` files.
 */
export async function rollback(db: SpcndDb, to: number, opts: { dir?: string } = {}): Promise<string[]> {
  const dir = opts.dir ?? defaultMigrationsDir(db.dialect);
  await db.exec(CREATE_MIGRATIONS_TABLE[db.dialect] as string);
  const done = [...(await appliedNames(db))].sort().reverse();
  const rolledBack: string[] = [];
  for (const name of done) {
    const num = Number.parseInt(name.slice(0, 4), 10);
    if (Number.isNaN(num) || num <= to) continue;
    const downFile = join(dir, `${name}.down.sql`);
    const sqlScript = readFileSync(downFile, 'utf8');
    for (const statement of splitStatements(sqlScript)) {
      await db.exec(statement);
    }
    const placeholder = db.dialect === 'postgres' ? '$1' : '?';
    await db.queryRaw(`DELETE FROM _migrations WHERE name = ${placeholder}`, [name]);
    rolledBack.push(name);
  }
  return rolledBack;
}
