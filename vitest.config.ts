import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Cùng alias với tsconfig của apps/web để test import được route handlers.
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./test/load-env.ts'],
    testTimeout: 30_000,
  },
});
