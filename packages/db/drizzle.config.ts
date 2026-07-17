import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/sqlite/schema.ts',
  out: './migrations/sqlite',
  dbCredentials: { url: process.env.SPCND_DB_URL ?? './spcnd.db' },
});
