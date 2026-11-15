import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        main: './src/worker/index.ts',
        miniflare: {
          compatibilityDate: '2026-11-01',
          d1Databases: ['DB'],
          bindings: { SIGNUP_CODE: 'Ripe Tomato Garden', MAX_GARDENS: '1000', TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      name: 'worker',
      include: ['tests/worker/**/*.test.ts'],
      setupFiles: ['./tests/worker/setup.ts'],
    },
  };
});
