// Points `npm run dev` at the local Supabase stack by writing
// .env.development.local (git-ignored), which Vite reads ahead of .env.local.
//   npx supabase start && npm run db:env
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const status = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
    .split('\n')
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!status.API_URL || !status.ANON_KEY) throw new Error('Local Supabase is not running. Start it with `npx supabase start`.');

writeFileSync(
  new URL('../.env.development.local', import.meta.url),
  `# Written by npm run db:env: the dev server uses the local Supabase stack.\n` +
    `# Delete this file to develop against the hosted project instead.\n` +
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}\n`,
);
console.log('Wrote .env.development.local (local Supabase).');
