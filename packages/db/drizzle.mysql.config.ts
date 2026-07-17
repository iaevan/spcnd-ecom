import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'mysql',
  schema: './src/mysql/schema.ts',
  out: './migrations/mysql',
  dbCredentials: { url: process.env.SPCND_DB_URL ?? 'mysql://localhost:3306/spcnd' },
});
