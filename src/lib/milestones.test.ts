import { describe, expect, it } from 'vitest';
import { upcomingMilestones, zonesForLevel } from './milestones';
import type { Instance, InstanceProgress } from './types';

const inst = (id: string, levelMin: number, levelMax: number, extra: Partial<Instance> = {}): Instance => ({
  id,
  name: id,
  kind: 'dungeon',
  size: 5,
  levelMin,
  levelMax,
  zone: 'Somewhere',
  isNewInForever: false,
  wings: [],
  bosses: [],
  guideLinks: [],
  notes: '',
  territory: 'horde',
  hordeAccess: '',
  quests: [],
  source: 'manual',
  updatedAt: '2026-11-01T00:00:00Z',
  ...extra,
});

const INSTANCES = [
  inst('rfc', 13, 18),
  inst('wc', 15, 25),
  inst('sfk', 18, 25),
  inst('raid', 60, 60, { kind: 'raid' }),
  inst('locked', 20, 24, { unlockDate: '2027-01-01' }),
  inst('ally', 12, 16, { territory: 'alliance' }),
];
const TODAY = '2026-11-14';
const ids = (c: { id: string; level: number }, progress: InstanceProgress[] = [], limit = 10) =>
  upcomingMilestones(c, INSTANCES, progress, TODAY, limit).map((m) => m.id);

describe('upcomingMilestones', () => {
  it('sends you to the trainer at the next even level', () => {
    expect(ids({ id: 'c', level: 1 })[0]).toBe('trainer-2');
    expect(ids({ id: 'c', level: 2 })[0]).toBe('trainer-4');
    expect(ids({ id: 'c', level: 59 })[0]).toBe('trainer-60');
  });

  it('shows the nearest dungeon even when it is far off, then everything within 5 levels', () => {
    expect(ids({ id: 'c', level: 1 })).toContain('dungeon-rfc');
    expect(ids({ id: 'c', level: 1 })).not.toContain('dungeon-wc');
    const at12 = ids({ id: 'c', level: 12 });
    expect(at12).toEqual(expect.arrayContaining(['dungeon-rfc', 'dungeon-wc']));
    expect(at12).not.toContain('dungeon-sfk');
  });

  it('skips raids, locked dungeons, ones in range and ones already cleared', () => {
    const progress: InstanceProgress[] = [
      { id: 'c:rfc', characterId: 'c', instanceId: 'rfc', status: 'cleared', wingsCleared: [], bossesKilled: [], questsDone: [], timesRun: 1, source: 'manual', updatedAt: '' },
    ];
    const at12 = ids({ id: 'c', level: 12 }, progress);
    expect(at12).not.toContain('dungeon-rfc');
    expect(ids({ id: 'c', level: 19 })).not.toContain('dungeon-locked');
    expect(ids({ id: 'c', level: 19 }).some((i) => i.includes('raid'))).toBe(false);
    expect(ids({ id: 'c', level: 14 })).not.toContain('dungeon-rfc');
  });

  it('leaves out Alliance-side dungeons', () => {
    expect(ids({ id: 'c', level: 10 })).not.toContain('dungeon-ally');
  });

  it('shows only the next Legacy milestone', () => {
    const at1 = ids({ id: 'c', level: 1 }, [], 99);
    expect(at1.filter((i) => i.startsWith('legacy-'))).toEqual(['legacy-25']);
  });

  it('keeps things you buy at your level, drops things you reach once you are there', () => {
    const at40 = ids({ id: 'c', level: 40 });
    expect(at40).toEqual(expect.arrayContaining(['riding', 'dual-spec']));
    expect(at40).not.toContain('legacy-40');
    expect(ids({ id: 'c', level: 39 })).toContain('legacy-40');
  });

  it('at 60 has no trainer visit and still lists the fast mount', () => {
    const at60 = ids({ id: 'c', level: 60 });
    expect(at60.some((i) => i.startsWith('trainer'))).toBe(false);
    expect(at60).toContain('journeyman-riding');
  });

  it('is sorted by level and limited', () => {
    const list = upcomingMilestones({ id: 'c', level: 22 }, INSTANCES, [], TODAY, 3);
    expect(list).toHaveLength(3);
    expect(list.map((m) => m.level)).toEqual([...list.map((m) => m.level)].sort((a, b) => a - b));
  });
});

describe('zonesForLevel', () => {
  it('sends low levels to their start zone', () => {
    expect(zonesForLevel({ level: 1, race: 'Tauren' }).map((z) => z.id)).toEqual(['mulgore']);
    expect(zonesForLevel({ level: 5, race: 'Skyborne' }).map((z) => z.id)).toEqual(['zephras-isle']);
  });

  it('lists the zones that opened most recently, newest first', () => {
    const z = zonesForLevel({ level: 20, race: 'Orc' });
    expect(z[0].id).toBe('hillsbrad-foothills');
    expect(z.every((x) => x.minLevel <= 20 && x.minLevel > 10)).toBe(true);
  });

  it('never suggests a zone above your level', () => {
    for (let lvl = 1; lvl <= 60; lvl++)
      for (const z of zonesForLevel({ level: lvl, race: 'Undead' })) expect(z.minLevel).toBeLessThanOrEqual(lvl);
  });
});
