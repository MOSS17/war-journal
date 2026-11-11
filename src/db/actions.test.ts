import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeed } from './db';
import {
  addCharacter,
  createPlan,
  deleteCharacter,
  saveProgress,
  setInstanceProgress,
  setRetired,
  toggleObjective,
  toggleQuest,
  visibleTonight,
} from './actions';
import { exportAll, importAll } from './backup';
import { instanceObjectiveLinks, uid } from '../lib/logic';
import type { TonightTask } from '../lib/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeed();
});

const gruk = () =>
  addCharacter({ firstName: 'Grukthar', lastName: 'Ashmaw', race: 'Orc', class: 'Warrior', level: 34, ruleset: 'PvP', isMain: false });

describe('seed', () => {
  it('loads 29 dungeons, 3 raids and 4 events once', async () => {
    await ensureSeed();
    expect(await db.instances.where('kind').equals('dungeon').count()).toBe(29);
    expect(await db.instances.where('kind').equals('raid').count()).toBe(3);
    expect(await db.events.count()).toBe(4);
  });
});

describe('seed v2 patch', () => {
  it('refreshes reference data on old rows and keeps player edits', async () => {
    const old = (await db.instances.get('alcaz-island-prison'))!;
    const { territory: _t, hordeAccess: _h, quests: _q, ...v1 } = old;
    await db.instances.put({ ...v1, name: 'Alcaz Island Prison', notes: 'Bring water breathing', bosses: ['Warden'] } as typeof old);
    await db.instances.update('excavation-site', { name: 'My Dig' });
    await db.meta.put({ key: 'seedVersion', value: 1 });
    await ensureSeed();
    const alcaz = (await db.instances.get('alcaz-island-prison'))!;
    expect(alcaz.name).toBe('Alcaz Prison');
    expect(alcaz.territory).toBe('contested');
    expect(alcaz.hordeAccess).not.toBe('');
    expect(Array.isArray(alcaz.quests)).toBe(true);
    expect(alcaz.notes).toBe('Bring water breathing');
    expect(alcaz.bosses).toEqual(['Warden']);
    expect((await db.instances.get('excavation-site'))!.name).toBe('My Dig');
    expect((await db.instances.get('kroldok-stronghold'))!.continent).toBe('Eastern Kingdoms');
  });

  it('marks Alliance-territory dungeons', async () => {
    const ally = (await db.instances.toArray()).filter((i) => i.territory === 'alliance').map((i) => i.id).sort();
    expect(ally).toEqual(['deadmines', 'gnomeregan', 'hall-of-thanes', 'the-stockade']);
  });
});

describe('quests', () => {
  it('ticks and unticks a quest without changing run status', async () => {
    const a = await gruk();
    await toggleQuest(a, 'scarlet-monastery', 'q1', true);
    let rec = (await db.progress.get(`${a}:scarlet-monastery`))!;
    expect(rec.questsDone).toEqual(['q1']);
    expect(rec.status).toBe('not-run');
    await setInstanceProgress(a, 'scarlet-monastery', { status: 'run', wingsCleared: ['Library'], bossesKilled: [], timesRun: 1 });
    rec = (await db.progress.get(`${a}:scarlet-monastery`))!;
    expect(rec.questsDone).toEqual(['q1']);
    await toggleQuest(a, 'scarlet-monastery', 'q1', false);
    rec = (await db.progress.get(`${a}:scarlet-monastery`))!;
    expect(rec.questsDone).toEqual([]);
    expect(rec.status).toBe('run');
  });
});

describe('characters', () => {
  it('makes the first character the main and moves main on retire', async () => {
    const a = await gruk();
    const b = await addCharacter({ firstName: 'Zulka', lastName: 'Vexhollow', race: 'Troll', class: 'Shaman', level: 17, ruleset: 'PvP', isMain: false });
    expect((await db.characters.get(a))!.isMain).toBe(true);
    expect((await db.characters.get(b))!.isMain).toBe(false);
    await setRetired(a, true);
    expect((await db.characters.get(b))!.isMain).toBe(true);
  });

  it('deletes a character with its plans but keeps journal entries', async () => {
    const a = await gruk();
    await createPlan({ title: 'L40', type: 'level', ownerId: a, tracked: true, target: { level: 40 }, objectives: [], notes: '' });
    await db.journal.add({ id: 'j', date: '2026-11-05', characterId: a, title: 't', body: '', imageIds: [], tags: [], draft: false, createdAt: '', updatedAt: '' });
    await deleteCharacter(a);
    expect(await db.plans.count()).toBe(0);
    expect((await db.journal.get('j'))!.characterId).toBeUndefined();
  });
});

describe('plan sync', () => {
  it('completes a dungeon plan when the instance is cleared', async () => {
    const a = await gruk();
    const sm = (await db.instances.get('scarlet-monastery'))!;
    const objectives = instanceObjectiveLinks(sm).map((o) => ({ id: uid(), text: o.text, link: o.link, done: false }));
    const { id } = await createPlan({ title: 'SM', type: 'dungeon', ownerId: a, tracked: true, target: { instanceId: sm.id }, objectives, notes: '' });
    let done = await setInstanceProgress(a, sm.id, { status: 'run', wingsCleared: ['Graveyard'], bossesKilled: [], timesRun: 1 });
    expect(done).toEqual([]);
    done = await setInstanceProgress(a, sm.id, { status: 'cleared', wingsCleared: [], bossesKilled: [], timesRun: 2 });
    expect(done).toEqual(['SM']);
    const p = (await db.plans.get(id))!;
    expect(p.status).toBe('done');
    expect((await db.progress.get(`${a}:${sm.id}`))!.firstClearDate).toBeTruthy();
  });

  it('ticking every wing objective clears the instance', async () => {
    const a = await gruk();
    const sm = (await db.instances.get('scarlet-monastery'))!;
    const objectives = instanceObjectiveLinks(sm).map((o) => ({ id: uid(), text: o.text, link: o.link, done: false }));
    const { id } = await createPlan({ title: 'SM', type: 'dungeon', ownerId: a, tracked: true, target: { instanceId: sm.id }, objectives, notes: '' });
    for (const o of objectives) {
      await toggleObjective((await db.plans.get(id))!, o, true);
    }
    expect((await db.progress.get(`${a}:${sm.id}`))!.status).toBe('cleared');
    expect((await db.plans.get(id))!.status).toBe('done');
  });

  it('completes level and gold plans from Update progress', async () => {
    const a = await gruk();
    await createPlan({ title: 'L35', type: 'level', ownerId: a, tracked: true, target: { level: 35 }, objectives: [], notes: '' });
    await createPlan({ title: 'Fund', type: 'gold', ownerId: 'account', tracked: true, target: { copper: 100_0000 }, objectives: [], notes: '' });
    const done = await saveProgress(a, { level: 35, xpPct: 18, copper: 150_0000, professions: [] });
    expect(done.sort()).toEqual(['Fund', 'L35']);
  });
});

describe('tonight', () => {
  it('drops tasks ticked on earlier nights', () => {
    const t = (p: Partial<TonightTask>): TonightTask => ({ id: uid(), text: 'x', done: false, date: '2026-11-04', createdAt: '', ...p });
    const list = visibleTonight([t({}), t({ done: true, doneOn: '2026-11-04' }), t({ done: true, doneOn: '2026-11-05' })], '2026-11-05');
    expect(list).toHaveLength(2);
  });
});

describe('backup', () => {
  it('round-trips data including images', async () => {
    const a = await gruk();
    await db.images.add({ id: 'img', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), type: 'image/png', createdAt: '' });
    const backup = JSON.parse(JSON.stringify(await exportAll()));
    await db.characters.clear();
    await db.images.clear();
    await importAll(backup);
    expect((await db.characters.get(a))!.firstName).toBe('Grukthar');
    const img = (await db.images.get('img'))!;
    expect(new Uint8Array(await img.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await db.instances.count()).toBe(32);
  });
});

describe('backup v1 compatibility', () => {
  it('imports a backup made before quests and territory', async () => {
    const a = await gruk();
    await setInstanceProgress(a, 'deadmines', { status: 'run', wingsCleared: [], bossesKilled: [], timesRun: 1 });
    const backup = await exportAll();
    backup.tables.instances = (backup.tables.instances as Record<string, unknown>[]).map(
      ({ territory: _t, hordeAccess: _h, quests: _q, ...rest }) => rest,
    );
    backup.tables.progress = (backup.tables.progress as Record<string, unknown>[]).map(({ questsDone: _q, ...rest }) => rest);
    backup.tables.meta = [{ key: 'seedVersion', value: 1 }];
    await importAll(backup);
    expect((await db.progress.get(`${a}:deadmines`))!.questsDone).toEqual([]);
    const dm = (await db.instances.get('deadmines'))!;
    expect(dm.territory).toBe('alliance');
    expect(Array.isArray(dm.quests)).toBe(true);
  });
});
