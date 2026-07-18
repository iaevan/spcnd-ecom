import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'reviews',
    include: ['test/**/*.test.ts'],
  },
});
