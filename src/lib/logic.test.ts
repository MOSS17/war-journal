import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  difficulty,
  fitsLevel,
  formatMoney,
  fromCoins,
  levelRelation,
  planProgress,
  toCoins,
  validName,
  type PlanContext,
} from './logic';
import type { Character, WarPlan } from './types';
import { seedInstanceRows } from './catalog';

const instances = seedInstanceRows('2026-11-05T00:00:00Z');
const byId = (id: string) => instances.find((i) => i.id === id)!;

function char(p: Partial<Character> = {}): Character {
  return {
    id: 'c1', firstName: 'Grukthar', lastName: 'Ashmaw', race: 'Orc', class: 'Warrior',
    level: 34, xpPct: 62, ruleset: 'PvP', faction: 'Horde', copper: 124018, isMain: true,
    status: 'active', source: 'manual', createdAt: '', updatedAt: '', ...p,
  };
}

function plan(p: Partial<WarPlan>): WarPlan {
  return {
    id: 'p1', title: 'x', type: 'custom', ownerId: 'c1', status: 'active', tracked: true,
    target: {}, objectives: [], notes: '', createdAt: '', updatedAt: '', ...p,
  };
}

describe('difficulty', () => {
  // These match the dots on the design canvas for a level 34 character.
  it.each([
    [13, 18, 'trivial'], // Ragefire
    [29, 38, 'easy'], // Razorfen Kraul
    [30, 46, 'even'], // Scarlet Monastery
    [35, 40, 'hard'], // The Drowned City
    [40, 45, 'deadly'], // Krol'dok
  ] as const)('%i–%i at 34 is %s', (lo, hi, want) => {
    expect(difficulty(lo, hi, 34)).toBe(want);
  });

  it('treats the top of the range as easy, not trivial', () => {
    expect(difficulty(13, 18, 18)).toBe('easy');
  });
});

describe('fitsLevel', () => {
  it('includes two levels below the range up to its top', () => {
    expect(fitsLevel(byId('the-drowned-city'), 33)).toBe(true);
    expect(fitsLevel(byId('the-drowned-city'), 32)).toBe(false);
    expect(fitsLevel(byId('the-drowned-city'), 40)).toBe(true);
    expect(fitsLevel(byId('the-drowned-city'), 41)).toBe(false);
  });
});

describe('levelRelation', () => {
  it('says how far a character is from the range', () => {
    expect(levelRelation(byId('the-drowned-city'), 34).text).toBe('1 level to go');
    expect(levelRelation(byId('the-drowned-city'), 17).text).toBe('Too low');
  });
});

describe('money', () => {
  it('round-trips coins', () => {
    expect(toCoins(124018)).toEqual({ g: 12, s: 40, c: 18 });
    expect(fromCoins({ g: 12, s: 40, c: 18 })).toBe(124018);
    expect(formatMoney(124018)).toBe('12g 40s 18c');
    expect(formatMoney(5)).toBe('5c');
  });
});

describe('dates', () => {
  it('counts days to raid unlock', () => {
    expect(daysBetween('2026-11-05', '2026-12-09')).toBe(34);
  });
});

describe('validName', () => {
  it('needs 2–12 letters', () => {
    expect(validName('Grukthar')).toBe(true);
    expect(validName("Zul'ka")).toBe(true);
    expect(validName('A')).toBe(false);
    expect(validName('Abcdefghijklm')).toBe(false);
    expect(validName('Gruk1')).toBe(false);
  });
});

describe('planProgress', () => {
  const sm = byId('scarlet-monastery');
  const base: PlanContext = { characters: [char()], professions: [], progress: [], instances };

  const smPlan = plan({
    type: 'dungeon',
    target: { instanceId: sm.id },
    objectives: sm.wings.map((w) => ({ id: w, text: w, link: { wing: w }, done: false })),
  });

  it('counts wings from instance progress', () => {
    const p = planProgress(smPlan, {
      ...base,
      progress: [{ id: 'c1:scarlet-monastery', characterId: 'c1', instanceId: sm.id, status: 'run',
        wingsCleared: ['Graveyard', 'Library'], bossesKilled: [], questsDone: [], timesRun: 2, source: 'manual', updatedAt: '' }],
    });
    expect(p.label).toBe('2 / 4 wings');
    expect(p.pct).toBe(0.5);
    expect(p.done).toBe(false);
    expect(p.difficulty).toBe('even');
  });

  it('is done when the instance is cleared', () => {
    const p = planProgress(smPlan, {
      ...base,
      progress: [{ id: 'x', characterId: 'c1', instanceId: sm.id, status: 'cleared',
        wingsCleared: [], bossesKilled: [], questsDone: [], timesRun: 4, source: 'manual', updatedAt: '' }],
    });
    expect(p.done).toBe(true);
    expect(p.objectives.every((o) => o.done)).toBe(true);
  });

  it('tracks level plans from the character', () => {
    const p = planProgress(plan({ type: 'level', target: { level: 40 } }), base);
    expect(p.label).toBe('Lv 34 / 40');
    expect(p.difficulty).toBe('deadly');
    expect(p.done).toBe(false);
    expect(planProgress(plan({ type: 'level', target: { level: 34 } }), base).done).toBe(true);
  });

  it('sums gold across the warband for account plans', () => {
    const ctx = { ...base, characters: [char(), char({ id: 'c2', isMain: false, copper: 80000 })] };
    const p = planProgress(plan({ type: 'gold', ownerId: 'account', target: { copper: 1_000_000 } }), ctx);
    expect(p.label).toBe('20g / 100g');
    expect(p.pct).toBeCloseTo(0.204);
  });

  it('reads profession skill', () => {
    const p = planProgress(plan({ type: 'profession', target: { profession: 'Blacksmithing', skill: 225 } }), {
      ...base,
      professions: [{ id: 'pr', characterId: 'c1', name: 'Blacksmithing', kind: 'primary', skill: 128, source: 'manual', updatedAt: '' }],
    });
    expect(p.label).toBe('128 / 225');
  });

  it('kills a raid boss', () => {
    const ony = byId('onyxias-lair');
    const pl = plan({ type: 'raid', target: { instanceId: ony.id, boss: 'Onyxia' },
      objectives: [{ id: 'o', text: 'Kill Onyxia', link: { boss: 'Onyxia' }, done: false }] });
    expect(planProgress(pl, base).done).toBe(false);
    expect(planProgress(pl, { ...base, progress: [{ id: 'x', characterId: 'c1', instanceId: ony.id, status: 'run',
      wingsCleared: [], bossesKilled: ['Onyxia'], questsDone: [], timesRun: 1, source: 'manual', updatedAt: '' }] }).done).toBe(true);
  });
});

describe('seed data', () => {
  it('gives every instance a territory and unique quest ids', () => {
    for (const i of instances) {
      expect(['horde', 'contested', 'alliance']).toContain(i.territory);
      const ids = i.quests.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const q of i.quests) {
        expect(['horde', 'alliance', 'both']).toContain(q.faction);
        expect(q.name && q.giver && q.howTo).toBeTruthy();
      }
    }
  });
});
