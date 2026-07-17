import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/postgres/schema.ts',
  out: './migrations/postgres',
  dbCredentials: { url: process.env.SPCND_DB_URL ?? 'postgres://localhost:5432/spcnd' },
});
