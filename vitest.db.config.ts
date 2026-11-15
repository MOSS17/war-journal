import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// Database tests. They need the local stack: `npx supabase start`.
const status = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1], m[2]]),
);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    // The tests share the local database and mail catcher; run the files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // The app's Supabase client reads these; point it at the local stack.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_DB_URL: status.DB_URL,
      // Only the cleanup test uses this, the way the server-side cron does.
      SUPABASE_URL: status.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    },
  },
});
