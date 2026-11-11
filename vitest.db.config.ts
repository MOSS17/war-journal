import { defineConfig } from 'vitest/config';

// Database access tests. They need the local stack: `npx supabase start`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
