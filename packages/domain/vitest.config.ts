import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__guards__/**',
        'src/index.ts',
        'src/**/index.ts',
        'src/money/rate.ts',
        'src/money/round.ts',
      ],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
