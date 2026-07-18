import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321 },
  vite: {
    ssr: {
      // Native/CJS server deps must stay external to the ESM server bundle.
      external: ['better-sqlite3', 'nodemailer'],
    },
  },
});
