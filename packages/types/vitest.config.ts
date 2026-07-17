import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'types',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
