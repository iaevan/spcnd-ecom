import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'compat-wc',
    include: ['test/**/*.test.ts'],
  },
});
