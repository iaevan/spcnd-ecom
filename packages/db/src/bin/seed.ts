import { readFileSync } from 'node:fs';
import { mysql } from '../mysql/connect.js';
import { postgres } from '../postgres/connect.js';
import { runSeed } from '../seed.js';
import { sqlite } from '../sqlite/connect.js';
import type { DbConfig } from '../types.js';

const url = process.env.SPCND_DB_URL ?? './spcnd.db';
const fileArgIdx = process.argv.indexOf('--file');
const file = fileArgIdx >= 0 ? process.argv[fileArgIdx + 1] : undefined;
if (!file) {
  console.error('Usage: db:seed --file path/to/seed.json');
  process.exit(1);
}

function configFor(dbUrl: string): DbConfig {
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) return postgres(dbUrl);
  if (dbUrl.startsWith('mysql://')) return mysql(dbUrl);
  return sqlite(dbUrl.replace(/^sqlite:/, ''));
}

const db = await configFor(url).connect();
await runSeed(db, JSON.parse(readFileSync(file, 'utf8')), { log: console.log });
console.log('Seed complete');
await db.close();
