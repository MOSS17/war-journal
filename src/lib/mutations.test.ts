// The pure mutations, with no database: build a snapshot, run a mutation,
// check the changes it returns.
import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  addInstance,
  applyToSnapshot,
  completePlans,
  deleteCharacter,
  deleteEntry,
  deletePlan,
  removeOrphanImages,
  saveProgress,
  setInstanceProgress,
  setRetired,
  toggleObjective,
  toggleQuest,
  type Change,
  type Snapshot,
} from './mutations';
import { instanceObjectiveLinks } from './logic';
import type { Character, JournalEntry, LibraryItem, WarPlan } from './types';
import { ACCOUNT } from './types';
import { seedInstanceRows } from './catalog';

const NOW = '2026-11-10T20:00:00.000Z';
const TODAY = '2026-11-10';
const instances = seedInstanceRows(NOW);
const sm = instances.find((i) => i.id === 'scarlet-monastery')!;

function char(p: Partial<Character> & { id: string }): Character {
  return {
    firstName: 'Grukthar',
    lastName: 'Ashmaw',
    race: 'Orc',
    class: 'Warrior',
    level: 30,
    xpPct: 0,
    ruleset: 'PvP',
    faction: 'Horde',
    copper: 0,
    isMain: false,
    status: 'active',
    source: 'manual',
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

function plan(p: Partial<WarPlan> & { id: string }): WarPlan {
  return {
    title: p.id,
    type: 'custom',
    ownerId: 'a',
    status: 'active',
    tracked: true,
    target: {},
    objectives: [],
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

function snap(p: Snapshot = {}): Snapshot {
  return { characters: [], professions: [], progress: [], plans: [], instances, journal: [], library: [], ...p };
}

const puts = (changes: Change[], kind: Change['kind']) =>
  changes.filter((c) => c.kind === kind && c.op === 'put').map((c) => (c as { row: unknown }).row);
const deletes = (changes: Change[], kind: Change['kind']) =>
  changes.filter((c) => c.kind === kind && c.op === 'delete').map((c) => (c as { id: string }).id);

describe('applyToSnapshot', () => {
  it('replaces, adds and removes rows, and skips kinds it does not hold', () => {
    const s = { characters: [char({ id: 'a' }), char({ id: 'b' })] };
    const next = applyToSnapshot(s, [
      { kind: 'characters', op: 'put', row: char({ id: 'a', level: 40 }) },
      { kind: 'characters', op: 'put', row: char({ id: 'c' }) },
      { kind: 'characters', op: 'delete', id: 'b' },
      { kind: 'plans', op: 'delete', id: 'x' },
    ]);
    expect(next.characters!.map((c) => [c.id, c.level])).toEqual([
      ['a', 40],
      ['c', 30],
    ]);
    expect(next.plans).toBeUndefined();
    expect(s.characters.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('characters', () => {
  it('makes the first character main and remembers the ruleset', () => {
    const { changes, value } = addCharacter(
      snap(),
      { firstName: ' Zul ', lastName: 'Jin', race: 'Troll', class: 'Hunter', level: 1, ruleset: 'RP', isMain: false },
      'z',
      NOW,
    );
    expect(value).toBe('z');
    expect(puts(changes, 'characters')).toMatchObject([{ id: 'z', isMain: true, firstName: 'Zul' }]);
    expect(puts(changes, 'meta')).toEqual([{ key: 'lastRuleset', value: 'RP' }]);
  });

  it('moves main to a new character when asked', () => {
    const s = snap({ characters: [char({ id: 'a', isMain: true })] });
    const { changes } = addCharacter(
      s,
      { firstName: 'Zul', lastName: 'Jin', race: 'Troll', class: 'Hunter', level: 1, ruleset: 'PvP', isMain: true },
      'z',
    );
    expect(puts(changes, 'characters')).toMatchObject([
      { id: 'a', isMain: false },
      { id: 'z', isMain: true },
    ]);
  });

  it('passes main to the highest active character on retirement', () => {
    const s = snap({
      characters: [char({ id: 'a', isMain: true }), char({ id: 'b', level: 20 }), char({ id: 'c', level: 45 })],
    });
    const { changes } = setRetired(s, 'a', true, NOW);
    expect(puts(changes, 'characters')).toMatchObject([
      { id: 'a', status: 'retired', isMain: false },
      { id: 'c', isMain: true },
    ]);
  });

  it('deletes a character with its professions, progress and plans, and keeps journal entries', () => {
    const entry: JournalEntry = {
      id: 'j',
      date: TODAY,
      characterId: 'a',
      title: '',
      body: '',
      imageIds: [],
      tags: [],
      draft: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const s = snap({
      characters: [char({ id: 'a', isMain: true }), char({ id: 'b' })],
      professions: [{ id: 'p', characterId: 'a', name: 'Mining', kind: 'primary', skill: 1, source: 'manual', updatedAt: NOW }],
      progress: [{ id: 'a:sm', characterId: 'a', instanceId: 'sm', status: 'run', wingsCleared: [], bossesKilled: [], questsDone: [], timesRun: 1, source: 'manual', updatedAt: NOW }],
      plans: [plan({ id: 'mine', ownerId: 'a' }), plan({ id: 'theirs', ownerId: 'b' })],
      journal: [entry],
    });
    const { changes } = deleteCharacter(s, 'a');
    expect(deletes(changes, 'professions')).toEqual(['p']);
    expect(deletes(changes, 'progress')).toEqual(['a:sm']);
    expect(deletes(changes, 'plans')).toEqual(['mine']);
    expect(deletes(changes, 'characters')).toEqual(['a']);
    expect(puts(changes, 'journal')).toMatchObject([{ id: 'j', characterId: undefined }]);
    expect(puts(changes, 'characters')).toMatchObject([{ id: 'b', isMain: true }]);
  });
});

describe('plan completion', () => {
  it('only completes active plans whose data says they are done', () => {
    const s = snap({
      characters: [char({ id: 'a', level: 40 })],
      plans: [
        plan({ id: 'l40', type: 'level', target: { level: 40 } }),
        plan({ id: 'l50', type: 'level', target: { level: 50 } }),
        plan({ id: 'gone', type: 'level', target: { level: 40 }, status: 'abandoned' }),
      ],
    });
    const { changes, value } = completePlans(s, NOW);
    expect(value).toEqual(['l40']);
    expect(puts(changes, 'plans')).toMatchObject([{ id: 'l40', status: 'done', completedAt: NOW }]);
  });

  it('Update progress saves the character, replaces professions and completes plans', () => {
    const s = snap({
      characters: [char({ id: 'a', level: 34 })],
      professions: [{ id: 'old', characterId: 'a', name: 'Skinning', kind: 'primary', skill: 50, source: 'manual', updatedAt: NOW }],
      plans: [
        plan({ id: 'L35', type: 'level', target: { level: 35 } }),
        plan({ id: 'Fund', type: 'gold', ownerId: ACCOUNT, target: { copper: 100_0000 } }),
      ],
    });
    const { changes, value } = saveProgress(
      s,
      'a',
      { level: 35, xpPct: 10, copper: 150_0000, professions: [{ id: 'new', name: 'Mining', kind: 'primary', skill: 75 }] },
      NOW,
    );
    expect(value).toEqual(['L35', 'Fund']);
    expect(puts(changes, 'characters')).toMatchObject([{ id: 'a', level: 35, copper: 150_0000 }]);
    expect(deletes(changes, 'professions')).toEqual(['old']);
    expect(puts(changes, 'professions')).toMatchObject([{ id: 'new', characterId: 'a', skill: 75 }]);
  });

  it('clearing an instance completes its plan and dates the first clear', () => {
    const objectives = instanceObjectiveLinks(sm).map((o, i) => ({ id: `o${i}`, text: o.text, link: o.link, done: false }));
    const s = snap({
      characters: [char({ id: 'a' })],
      plans: [plan({ id: 'SM', type: 'dungeon', target: { instanceId: sm.id }, objectives })],
    });
    const { changes, value } = setInstanceProgress(
      s,
      'a',
      sm.id,
      { status: 'cleared', wingsCleared: [], bossesKilled: [], timesRun: 1 },
      NOW,
      TODAY,
    );
    expect(value).toEqual(['SM']);
    expect(puts(changes, 'progress')).toMatchObject([{ id: `a:${sm.id}`, firstClearDate: TODAY, questsDone: [] }]);
  });
});

describe('objectives', () => {
  const objectives = instanceObjectiveLinks(sm).map((o, i) => ({ id: `o${i}`, text: o.text, link: o.link, done: false }));
  const smPlan = plan({ id: 'SM', type: 'dungeon', ownerId: ACCOUNT, target: { instanceId: sm.id }, objectives });

  it('writes a wing objective through to the main character', () => {
    const s = snap({ characters: [char({ id: 'alt' }), char({ id: 'main', isMain: true })], plans: [smPlan] });
    const { changes } = toggleObjective(s, smPlan, objectives[0], true, NOW, TODAY);
    expect(puts(changes, 'progress')).toMatchObject([
      { id: `main:${sm.id}`, status: 'run', wingsCleared: [sm.wings[0]], timesRun: 1 },
    ]);
  });

  it('unticking a wing of a cleared instance drops it back to run', () => {
    const s = snap({
      characters: [char({ id: 'main', isMain: true })],
      plans: [smPlan],
      progress: [{ id: `main:${sm.id}`, characterId: 'main', instanceId: sm.id, status: 'cleared', wingsCleared: [], bossesKilled: [], questsDone: [], timesRun: 1, source: 'manual', updatedAt: NOW }],
    });
    const { changes } = toggleObjective(s, smPlan, objectives[0], false, NOW, TODAY);
    const rec = puts(changes, 'progress')[0] as { status: string; wingsCleared: string[] };
    expect(rec.status).toBe('run');
    expect(rec.wingsCleared).toEqual(sm.wings.slice(1));
  });

  it('ticks a free objective on the plan itself', () => {
    const free = { id: 'f', text: 'Get the key', done: false };
    const p = plan({ id: 'key', objectives: [free, { id: 'g', text: 'Other', done: false }] });
    const { changes, value } = toggleObjective(snap({ plans: [p] }), p, free, true, NOW, TODAY);
    expect(value).toEqual([]);
    expect(puts(changes, 'plans')).toMatchObject([{ id: 'key', objectives: [{ id: 'f', done: true, doneAt: TODAY }, { id: 'g', done: false }] }]);
  });
});

describe('other writes', () => {
  it('ticks a quest without touching run status', () => {
    const { changes } = toggleQuest(snap(), 'a', sm.id, 'q1', true, NOW);
    expect(puts(changes, 'progress')).toMatchObject([{ status: 'not-run', questsDone: ['q1'] }]);
  });

  it('gives a new instance a unique slug', () => {
    const input = { ...sm, name: 'Scarlet Monastery' };
    const { value } = addInstance(snap(), input, NOW);
    expect(value).toMatch(/^scarlet-monastery-.{6}$/);
  });

  it('unlinks library items from a deleted plan', () => {
    const item: LibraryItem = {
      id: 'l',
      kind: 'note',
      title: 'Route',
      body: '',
      category: 'Guides',
      tags: [],
      pinned: false,
      planId: 'p',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { changes } = deletePlan(snap({ plans: [plan({ id: 'p' })], library: [item] }), 'p');
    expect(puts(changes, 'library')).toMatchObject([{ id: 'l', planId: undefined }]);
    expect(deletes(changes, 'plans')).toEqual(['p']);
  });

  it('deletes a journal entry with its screenshots', () => {
    const entry: JournalEntry = {
      id: 'j',
      date: TODAY,
      title: '',
      body: '',
      imageIds: ['i1', 'i2'],
      tags: [],
      draft: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { changes } = deleteEntry(snap({ journal: [entry] }), 'j');
    expect(deletes(changes, 'images')).toEqual(['i1', 'i2']);
    expect(deletes(changes, 'journal')).toEqual(['j']);
  });

  it('removes screenshots no journal entry points at', () => {
    const entry: JournalEntry = {
      id: 'j',
      date: TODAY,
      title: '',
      body: '',
      imageIds: ['kept'],
      tags: [],
      draft: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const img = (id: string) => ({ id, type: 'image/webp', createdAt: NOW });
    const { changes, value } = removeOrphanImages(snap({ journal: [entry], images: [img('kept'), img('stray')] }));
    expect(value).toEqual(['stray']);
    expect(deletes(changes, 'images')).toEqual(['stray']);
  });
});
