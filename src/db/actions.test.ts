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
