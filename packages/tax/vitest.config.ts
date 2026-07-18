import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tax',
    include: ['test/**/*.test.ts'],
  },
});
