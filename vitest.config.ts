import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/load-env.ts'],
    testTimeout: 30_000,
  },
});
