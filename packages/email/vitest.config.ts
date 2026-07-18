import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'email',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
