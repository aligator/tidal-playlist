import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*_test.ts', 'web/src/**/*_test.ts'],
  },
});
