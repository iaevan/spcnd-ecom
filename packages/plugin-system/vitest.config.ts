import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-system',
    include: ['test/**/*.test.ts'],
  },
});
