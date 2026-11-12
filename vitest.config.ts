import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/consumer.test.ts', 'tests/fixtures/**', 'node_modules/**'],
  },
});
