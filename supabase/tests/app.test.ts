// The app's own data layer (actions, store, backup, moving local data up)
// against the local Supabase stack:  npx supabase start && npm run test:db
import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { db, setMeta } from '../../src/db/db';
import { supabase } from '../../src/db/supabase';
import { commit, fetchKind, loadSnapshot, queryClient } from '../../src/db/store';
import {
  addCharacter,
  createPlan,
  deleteEvent,
  deleteInstance,
  saveProgress,
  updateInstance,
} from '../../src/db/actions';
import { exportAll, importAll, resetAll } from '../../src/db/backup';
import { importLocalData } from '../../src/db/localImport';
import { seedEventRows, seedInstanceRows } from '../../src/lib/catalog';

const pgdb = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const users: string[] = [];

async function me(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function storedKinds(): Promise<Record<string, number>> {
  const { data } = await supabase.from('records').select('kind');
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.kind] = (out[r.kind] ?? 0) + 1;
  return out;
}

/** Forgets the cache, as a page reload would. */
const reload = () => queryClient.clear();

const gruk = () =>
  addCharacter({ firstName: 'Grukthar', lastName: 'Ashmaw', race: 'Orc', class: 'Warrior', level: 34, ruleset: 'PvP', isMain: false });

beforeAll(() => pgdb.connect());

beforeEach(async () => {
  await supabase.auth.signOut();
  queryClient.clear();
  await db.delete();
  await db.open();
});

afterEach(async () => {
  const id = await me();
  if (id) users.push(id);
});

afterAll(async () => {
  await supabase.auth.signOut();
  if (users.length) await pgdb.query('delete from auth.users where id = any($1)', [users]);
  await pgdb.end();
});

describe('visitors', () => {
  it('see the instance list and dates without an account', async () => {
    const s = await loadSnapshot(['instances', 'events', 'characters']);
    expect(s.instances).toHaveLength(32);
    expect(s.events!.length).toBe(seedEventRows().length);
    expect(s.characters).toEqual([]);
    expect(await me()).toBeNull();
  });

  it('get an anonymous account on their first save, and keep their data after a reload', async () => {
    const id = await gruk();
    const uid = await me();
    expect(uid).not.toBeNull();
    reload();
    const s = await loadSnapshot(['characters', 'meta']);
    expect(s.characters).toMatchObject([{ id, firstName: 'Grukthar', isMain: true }]);
    expect(s.meta).toEqual([{ key: 'lastRuleset', value: 'PvP' }]);
  });
});

describe('writes', () => {
  it('complete plans and save them in one go', async () => {
    const a = await gruk();
    await createPlan({ title: 'L35', type: 'level', ownerId: a, tracked: true, target: { level: 35 }, objectives: [], notes: '' });
    const done = await saveProgress(a, { level: 35, xpPct: 10, copper: 0, professions: [{ id: 'p1', name: 'Mining', kind: 'primary', skill: 80 }] });
    expect(done).toEqual(['L35']);
    reload();
    const s = await loadSnapshot(['plans', 'professions', 'characters']);
    expect(s.plans).toMatchObject([{ title: 'L35', status: 'done' }]);
    expect(s.professions).toMatchObject([{ id: 'p1', characterId: a, skill: 80 }]);
    expect(s.characters![0].level).toBe(35);
  });

  it("store edits to a seeded instance without freezing the catalog's reference data", async () => {
    await updateInstance('ragefire-chasm', { notes: 'Bring water', quests: [] });
    reload();
    const rfc = (await loadSnapshot(['instances'])).instances!.find((i) => i.id === 'ragefire-chasm')!;
    expect(rfc.notes).toBe('Bring water');
    expect(rfc.quests.length).toBeGreaterThan(0);
    expect(await storedKinds()).toEqual({ instances: 1 });
  });

  it('hide a removed seeded instance or event instead of deleting the catalog row', async () => {
    await deleteInstance('ragefire-chasm');
    await deleteEvent(seedEventRows()[0].id);
    reload();
    const s = await loadSnapshot(['instances', 'events']);
    expect(s.instances!.some((i) => i.id === 'ragefire-chasm')).toBe(false);
    expect(s.instances).toHaveLength(31);
    expect(s.events!.some((e) => e.id === seedEventRows()[0].id)).toBe(false);
    const { count } = await supabase.from('instance_catalog').select('*', { count: 'exact', head: true });
    expect(count).toBe(32);
  });

  it('roll back the screen when a save fails', async () => {
    await gruk();
    const before = await loadSnapshot(['characters']);
    const bad = { ...before.characters![0], id: 'x'.repeat(300) };
    await expect(commit([{ kind: 'characters', op: 'put', row: bad }])).rejects.toThrow("Couldn't save");
    expect(queryClient.getQueryData(['kind', await me(), 'characters'])).toEqual(before.characters);
  });
});

describe('backups', () => {
  it('restore exactly what was exported, removals included', async () => {
    await gruk();
    await deleteInstance('ragefire-chasm');
    await updateInstance('wailing-caverns', { notes: 'Druids everywhere' });
    const backup = await exportAll();
    expect(backup.version).toBe(2);

    await resetAll();
    expect(await storedKinds()).toEqual({});
    reload();
    expect((await loadSnapshot(['instances'])).instances).toHaveLength(32);

    await importAll(JSON.parse(JSON.stringify(backup)));
    reload();
    const s = await loadSnapshot(['characters', 'instances']);
    expect(s.characters).toMatchObject([{ firstName: 'Grukthar' }]);
    expect(s.instances!.some((i) => i.id === 'ragefire-chasm')).toBe(false);
    expect(s.instances!.find((i) => i.id === 'wailing-caverns')!.notes).toBe('Druids everywhere');
    expect(await storedKinds()).toEqual({ characters: 1, instances: 2, meta: 1 });
  });

  it('restore a browser-only (version 1) backup without copying the whole catalog', async () => {
    const instances = seedInstanceRows('2026-11-01T00:00:00Z');
    instances[0] = { ...instances[0], notes: 'Mine' };
    await importAll({
      format: 'horde-war-journal',
      version: 1,
      exportedAt: '2026-11-01T00:00:00Z',
      tables: { characters: [], instances: instances.slice(0, 20), events: seedEventRows() },
      images: [],
    });
    reload();
    const s = await loadSnapshot(['instances']);
    // Version 1 brought missing seeded rows back, so nothing is hidden.
    expect(s.instances).toHaveLength(32);
    expect(s.instances!.find((i) => i.id === instances[0].id)!.notes).toBe('Mine');
    expect(await storedKinds()).toEqual({ instances: 1 });
  });
});

describe('moving a browser-only journal up', () => {
  async function seedOldBrowser() {
    const now = '2026-11-01T00:00:00Z';
    const instances = seedInstanceRows(now).filter((i) => i.id !== 'ragefire-chasm');
    const wc = instances.find((i) => i.id === 'wailing-caverns')!;
    wc.notes = 'Druids everywhere';
    await db.instances.bulkAdd(instances);
    await db.events.bulkAdd(seedEventRows(now));
    await db.characters.add({
      id: 'c1', firstName: 'Zul', lastName: 'Jin', race: 'Troll', class: 'Hunter', level: 20, xpPct: 0, ruleset: 'PvP',
      faction: 'Horde', copper: 0, isMain: true, status: 'active', source: 'manual', createdAt: now, updatedAt: now,
    });
    await db.journal.add({ id: 'j1', date: '2026-11-01', characterId: 'c1', title: 'Ding', body: '', imageIds: [], tags: [], draft: false, createdAt: now, updatedAt: now });
    await setMeta('seedVersion', 2);
    await setMeta('lastRuleset', 'PvP');
  }

  it('copies it once, keeps the local copy, and leaves the catalog alone', async () => {
    await seedOldBrowser();
    expect(await importLocalData()).toEqual({ records: 5 });
    expect(await storedKinds()).toEqual({ characters: 1, journal: 1, instances: 2, meta: 1 });
    reload();
    const s = await loadSnapshot(['instances', 'characters']);
    expect(s.instances!.some((i) => i.id === 'ragefire-chasm')).toBe(false);
    expect(s.instances!.find((i) => i.id === 'wailing-caverns')!.notes).toBe('Druids everywhere');
    expect(s.characters).toMatchObject([{ id: 'c1' }]);
    expect(await db.characters.count()).toBe(1);

    expect(await importLocalData()).toBeNull();
    const profile = await supabase.from('profiles').select('migrated_from_local').single();
    expect(profile.data!.migrated_from_local).toBe(true);
  });

  it('does nothing for a browser with no journal, and creates no account', async () => {
    expect(await importLocalData()).toBeNull();
    expect(await me()).toBeNull();
  });

  it('leaves an account that already has a journal alone', async () => {
    await gruk();
    await seedOldBrowser();
    expect(await importLocalData()).toBeNull();
    const chars = await fetchKind(await me(), 'characters');
    expect(chars.map((c) => c.firstName)).toEqual(['Grukthar']);
  });
});
