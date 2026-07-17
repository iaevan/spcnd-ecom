import { mysql } from '../mysql/connect.js';
import { postgres } from '../postgres/connect.js';
import { migrate } from '../migrate.js';
import { sqlite } from '../sqlite/connect.js';
import type { DbConfig } from '../types.js';

const url = process.env.SPCND_DB_URL ?? './spcnd.db';

function configFor(dbUrl: string): DbConfig {
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) return postgres(dbUrl);
  if (dbUrl.startsWith('mysql://')) return mysql(dbUrl);
  return sqlite(dbUrl.replace(/^sqlite:/, ''));
}

const db = await configFor(url).connect();
const applied = await migrate(db);
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Already up to date');
await db.close();
