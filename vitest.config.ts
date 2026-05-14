import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/renderer/**', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: { '@shared': resolve('src/shared') },
  },
});
