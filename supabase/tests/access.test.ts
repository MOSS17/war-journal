// Checks that each player only ever reaches their own data. Runs against the
// local Supabase stack:  npx supabase start && npm run test:db
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1], m[2]]),
);
const URL = env.API_URL;
const ANON_KEY = env.ANON_KEY;
const DB_URL = env.DB_URL;

const client = () =>
  createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function anonymousPlayer() {
  const c = client();
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return { c, id: data.user!.id };
}

const char = (id: string, firstName: string) => ({
  op: 'put',
  kind: 'characters',
  id,
  row: { id, firstName, lastName: 'Ashmaw', level: 30 },
});

let a: { c: SupabaseClient; id: string };
let b: { c: SupabaseClient; id: string };
let db: pg.Client;

beforeAll(async () => {
  a = await anonymousPlayer();
  b = await anonymousPlayer();
  db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  const { error } = await a.c.rpc('apply_changes', { changes: [char('gruk', 'Grukthar'), char('zul', 'Zuljin')] });
  if (error) throw error;
});

afterAll(async () => {
  await a.c.storage.from('screenshots').remove([`${a.id}/shot.png`]);
  await db.query('delete from auth.users where id = any($1)', [[a.id, b.id]]);
  await db.end();
});

describe('row-level security', () => {
  it('is enabled on every table in the public schema', async () => {
    const { rows } = await db.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
});

describe('records', () => {
  it('lets a player read their own rows', async () => {
    const { data } = await a.c.from('records').select('id, data').eq('kind', 'characters').order('id');
    expect(data).toEqual([
      { id: 'gruk', data: expect.objectContaining({ firstName: 'Grukthar' }) },
      { id: 'zul', data: expect.objectContaining({ firstName: 'Zuljin' }) },
    ]);
  });

  it("hides another player's rows", async () => {
    const all = await b.c.from('records').select('*');
    expect(all.data).toEqual([]);
    const direct = await b.c.from('records').select('*').eq('user_id', a.id);
    expect(direct.data).toEqual([]);
  });

  it('hides every row from visitors who are not signed in', async () => {
    const { data } = await client().from('records').select('*');
    expect(data).toEqual([]);
  });

  it("refuses rows written with another player's id", async () => {
    const { error } = await b.c
      .from('records')
      .insert({ user_id: a.id, kind: 'characters', id: 'evil', data: { id: 'evil' } });
    expect(error).not.toBeNull();
  });

  it("can't change or delete another player's rows", async () => {
    await b.c.from('records').update({ data: { hacked: true } }).eq('user_id', a.id);
    await b.c.from('records').delete().eq('user_id', a.id);
    await b.c.rpc('apply_changes', { changes: [{ op: 'delete', kind: 'characters', id: 'gruk' }] });
    const { rows } = await db.query(`select data from public.records where user_id = $1 and id = 'gruk'`, [a.id]);
    expect(rows).toEqual([{ data: expect.objectContaining({ firstName: 'Grukthar' }) }]);
  });

  it('keeps two players with the same record id apart', async () => {
    const { error } = await b.c.rpc('apply_changes', { changes: [char('gruk', 'Imposter')] });
    expect(error).toBeNull();
    const mine = await a.c.from('records').select('data').eq('id', 'gruk').single();
    expect(mine.data!.data.firstName).toBe('Grukthar');
  });

  it('applies a batch in one transaction', async () => {
    const { error } = await a.c.rpc('apply_changes', {
      changes: [{ op: 'delete', kind: 'characters', id: 'zul' }, { op: 'explode', kind: 'characters', id: 'x' }],
    });
    expect(error).not.toBeNull();
    const { data } = await a.c.from('records').select('id').eq('id', 'zul');
    expect(data).toHaveLength(1);
  });

  it('turns visitors who are not signed in away from writes', async () => {
    const { error } = await client().rpc('apply_changes', { changes: [char('x', 'Nobody')] });
    expect(error).not.toBeNull();
  });
});

describe('catalogs', () => {
  it('are readable by anyone', async () => {
    const { count } = await client().from('instance_catalog').select('*', { count: 'exact', head: true });
    expect(count).toBe(32);
    const events = await client().from('event_catalog').select('id');
    expect(events.data!.length).toBeGreaterThan(0);
  });

  it('are read-only for players', async () => {
    await a.c.from('instance_catalog').update({ data: {} }).eq('id', 'ragefire-chasm');
    const { error } = await a.c.from('instance_catalog').insert({ id: 'mine', data: {} });
    expect(error).not.toBeNull();
    const { rows } = await db.query(`select data->>'name' as name from public.instance_catalog where id = 'ragefire-chasm'`);
    expect(rows[0].name).toBe('Ragefire Chasm');
  });
});

describe('profiles', () => {
  it('are created for every new user and private to them', async () => {
    const mine = await a.c.from('profiles').select('user_id');
    expect(mine.data).toEqual([{ user_id: a.id }]);
    const theirs = await b.c.from('profiles').select('user_id').eq('user_id', a.id);
    expect(theirs.data).toEqual([]);
  });

  it('only let players change their own last-seen time', async () => {
    const { error } = await a.c.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', a.id);
    expect(error).toBeNull();
    const created = await a.c.from('profiles').update({ created_at: '2000-01-01' }).eq('user_id', a.id);
    expect(created.error).not.toBeNull();
  });
});

describe('screenshots', () => {
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });

  it('stay in the owner’s folder', async () => {
    const up = await a.c.storage.from('screenshots').upload(`${a.id}/shot.png`, png);
    expect(up.error).toBeNull();
    const mine = await a.c.storage.from('screenshots').download(`${a.id}/shot.png`);
    expect(mine.error).toBeNull();
    const theirs = await b.c.storage.from('screenshots').download(`${a.id}/shot.png`);
    expect(theirs.error).not.toBeNull();
    const list = await b.c.storage.from('screenshots').list(a.id);
    expect(list.data ?? []).toEqual([]);
  });

  it("can't be written into another player's folder", async () => {
    const { error } = await b.c.storage.from('screenshots').upload(`${a.id}/evil.png`, png);
    expect(error).not.toBeNull();
  });

  it('are not public', async () => {
    const { error } = await client().storage.from('screenshots').download(`${a.id}/shot.png`);
    expect(error).not.toBeNull();
  });
});
