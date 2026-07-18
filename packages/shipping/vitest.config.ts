import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shipping',
    include: ['test/**/*.test.ts'],
  },
});
