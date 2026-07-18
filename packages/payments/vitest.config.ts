import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'payments',
    include: ['test/**/*.test.ts'],
  },
});
