// Launch pieces against the local stack: the weekly cleanup of unused
// anonymous accounts, "last seen" tracking, and deleting a browser's old
// local copy after its journal moved up.
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { db, getMeta, setMeta } from '../../src/db/db';
import { currentAccount, supabase } from '../../src/db/supabase';
import { fetchKind, queryClient } from '../../src/db/store';
import { addCharacter, addImages, saveEntry } from '../../src/db/actions';
import { listImageFiles } from '../../src/db/images';
import { confirmSave, saveAccount, signOut, touchLastSeen } from '../../src/db/account';
import { deleteLocalCopy, importLocalData, localCopy } from '../../src/db/localImport';
import { cleanupAnonymous } from '../../server/cleanup';
import { GET } from '../../api/cleanup';
import { codeFor } from './helpers';

const pgdb = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = Date.now().toString(36);
const shot = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])], 'shot.png', { type: 'image/png' });
const add = (firstName: string) =>
  addCharacter({ firstName, lastName: 'Ashmaw', race: 'Orc', class: 'Warrior', level: 20, ruleset: 'PvP', isMain: false });

async function fresh() {
  await supabase.auth.signOut();
  queryClient.clear();
  await db.delete();
  await db.open();
  try {
    localStorage.clear();
  } catch {
    // No localStorage in this environment.
  }
}

const age = (userId: string, days: number) =>
  pgdb.query(`update public.profiles set last_seen_at = now() - make_interval(days => $2) where user_id = $1`, [userId, days]);

const exists = async (userId: string) =>
  (await pgdb.query('select count(*)::int n from auth.users where id = $1', [userId])).rows[0].n === 1;

beforeAll(() => pgdb.connect());
beforeEach(fresh);

afterAll(async () => {
  await supabase.auth.signOut();
  await pgdb.query(`delete from auth.users where email like $1 or (is_anonymous and created_at > now() - interval '10 minutes')`, [`%-${run}@example.com`]);
  await pgdb.end();
});

describe('cleanup of unused anonymous accounts', () => {
  it('removes anonymous accounts idle for 30 days, with their files, and nothing else', async () => {
    // Idle anonymous player with a journal and a screenshot.
    await addImages([shot()]).then((ids) => saveEntry(undefined, { date: '2026-10-01', title: 'Old', body: '', imageIds: ids, tags: [], draft: false }));
    const idle = currentAccount()!.id;
    await age(idle, 31);
    // Active anonymous player.
    await fresh();
    await add('Active');
    const active = currentAccount()!.id;
    await age(active, 29);
    // Saved player who hasn't been back in months: never removed.
    await fresh();
    await add('Saved');
    const address = `saved-${run}@example.com`;
    await saveAccount(address);
    await confirmSave(address, await codeFor(address));
    const saved = currentAccount()!.id;
    await age(saved, 90);
    await signOut();

    const result = await cleanupAnonymous(admin);
    expect(result.users).toBeGreaterThanOrEqual(1);
    expect(result.files).toBeGreaterThanOrEqual(1);
    expect(await exists(idle)).toBe(false);
    const left = await admin.storage.from('screenshots').list(idle);
    expect(left.data ?? []).toEqual([]);
    const leftovers = await pgdb.query('select count(*)::int n from public.records where user_id = $1', [idle]);
    expect(leftovers.rows[0].n).toBe(0);
    expect(await exists(active)).toBe(true);
    expect(await exists(saved)).toBe(true);
  });

  it('runs from the cron endpoint only with the cron secret', async () => {
    const call = (auth?: string) => GET(new Request('https://example.com/api/cleanup', { headers: auth ? { authorization: auth } : {} }));
    delete process.env.CRON_SECRET;
    expect((await call('Bearer anything')).status).toBe(401);
    process.env.CRON_SECRET = `secret-${run}`;
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    const ok = await call(`Bearer secret-${run}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ users: expect.any(Number), files: expect.any(Number) });
    delete process.env.CRON_SECRET;
  });

  it('can only be listed by the server', async () => {
    const anonClient = createClient(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anonClient.rpc('stale_anonymous_users')).error).not.toBeNull();
    await add('Player');
    expect((await supabase.rpc('stale_anonymous_users')).error).not.toBeNull();
  });
});

describe('last seen', () => {
  it('is updated when a player comes back', async () => {
    await add('Back');
    const me = currentAccount()!.id;
    await age(me, 20);
    await touchLastSeen();
    const { rows } = await pgdb.query(`select last_seen_at > now() - interval '1 minute' as recent from public.profiles where user_id = $1`, [me]);
    expect(rows[0].recent).toBe(true);
  });
});

describe("a browser's old local copy", () => {
  it('can be deleted once it has moved up, uploading its screenshots first, and is never imported again', async () => {
    const now = '2026-11-01T00:00:00Z';
    await db.characters.add({
      id: 'c1', firstName: 'Zul', lastName: 'Jin', race: 'Troll', class: 'Hunter', level: 20, xpPct: 0, ruleset: 'PvP',
      faction: 'Horde', copper: 0, isMain: true, status: 'active', source: 'manual', createdAt: now, updatedAt: now,
    });
    await db.journal.add({ id: 'j1', date: '2026-11-01', title: 'Old', body: '', imageIds: ['old-1'], tags: [], draft: false, createdAt: now, updatedAt: now });
    await db.images.add({ id: 'old-1', blob: shot(), type: 'image/png', createdAt: now });
    await setMeta('seedVersion', 2);

    expect(await localCopy()).toBeNull();
    expect(await importLocalData()).toEqual({ records: 2 });
    expect(await localCopy()).toEqual({ characters: 1, journal: 1, screenshots: 1 });

    await deleteLocalCopy();
    expect(await localCopy()).toBeNull();
    expect(await db.characters.count()).toBe(0);
    expect(await db.images.count()).toBe(0);
    expect(await getMeta('cloudImport', null)).not.toBeNull();
    expect(await listImageFiles(currentAccount()!.id)).toEqual(['old-1']);
    expect((await fetchKind(currentAccount()!.id, 'characters')).map((c) => c.id)).toEqual(['c1']);
    expect(await importLocalData()).toBeNull();

    // Tidy up the uploaded file.
    await supabase.storage.from('screenshots').remove([`${currentAccount()!.id}/old-1`]);
  });

  it('is not offered when the import was skipped, so nothing unsaved is lost', async () => {
    await add('Already here');
    await db.characters.add({
      id: 'c2', firstName: 'Local', lastName: 'Only', race: 'Orc', class: 'Rogue', level: 5, xpPct: 0, ruleset: 'PvP',
      faction: 'Horde', copper: 0, isMain: true, status: 'active', source: 'manual', createdAt: 'x', updatedAt: 'x',
    });
    expect(await importLocalData()).toBeNull();
    expect(await localCopy()).toBeNull();
  });
});
