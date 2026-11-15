import { describe, expect, it } from 'vitest';
import seed from '../data/instances.json';
import { catalogInstance } from './catalog';
import { createPlan } from './mutations';
import { nextDungeon, savingsPlan, templatesFor, type TemplateContext } from './planTemplates';
import type { Character, Instance, Profession } from './types';

const instances: Instance[] = (seed as Parameters<typeof catalogInstance>[0][]).map((i) => catalogInstance(i));
const char = (level: number, copper = 0): Character => ({
  id: 'c1',
  firstName: 'Zuljin',
  lastName: 'Spearfang',
  race: 'Troll',
  class: 'Shaman',
  level,
  xpPct: 0,
  ruleset: 'PvP',
  faction: 'Horde',
  copper,
  isMain: true,
  status: 'active',
  source: 'manual',
  createdAt: '',
  updatedAt: '',
});
const ctx = (professions: Profession[] = []): TemplateContext => ({ instances, progress: [], professions, today: '2026-11-14' });

describe('plan templates', () => {
  it('builds valid plans for a level-1 and a level-60 character', () => {
    for (const lvl of [1, 25, 60]) {
      const c = char(lvl);
      const list = templatesFor(c, ctx());
      expect(list.length).toBeGreaterThan(0);
      const titles = list.map((x) => x.plan.title);
      expect(new Set(titles).size).toBe(titles.length);
      for (const { plan } of list) {
        expect(plan.title.trim()).not.toBe('');
        expect(plan.ownerId).toBe(c.id);
        if (plan.type === 'dungeon') expect(instances.some((i) => i.id === plan.target.instanceId)).toBe(true);
        if (plan.type === 'level') expect(plan.target.level).toBeGreaterThan(lvl);
        if (plan.type === 'gold') expect(plan.target.copper).toBeGreaterThan(0);
      }
    }
  });

  it('picks a real Horde-side dungeon and fills its wings', () => {
    const d = nextDungeon(char(1), ctx());
    expect(d?.territory).not.toBe('alliance');
    expect(d?.kind).toBe('dungeon');
    const plan = templatesFor(char(1), ctx()).find((x) => x.template.id === 'next-dungeon')!.plan;
    expect(plan.target.instanceId).toBe(d!.id);
    expect(plan.objectives.length).toBe(d!.wings.length || d!.bosses.length);
  });

  it('drops profession steps you already have, and the template once you have two', () => {
    const fa: Profession = { id: 'p1', characterId: 'c1', name: 'First Aid', kind: 'secondary', skill: 80, source: 'manual', updatedAt: '' } as Profession;
    const list = templatesFor(char(10), ctx([fa]));
    const prof = list.find((x) => x.template.id === 'professions')!.plan;
    expect(prof.objectives.map((o) => o.text)).not.toContain('Learn First Aid');
    expect(list.some((x) => x.template.id === 'first-aid')).toBe(false);
    const two = ['Mining', 'Herbalism'].map((name, i) => ({ ...fa, id: `x${i}`, name, kind: 'primary' as const }));
    expect(templatesFor(char(10), ctx(two)).some((x) => x.template.id === 'professions')).toBe(false);
  });

  it('marks templates that match an active plan', () => {
    const list = templatesFor(char(1), ctx(), ['Reach level 10']);
    expect(list.find((x) => x.plan.title === 'Reach level 10')?.exists).toBe(true);
  });

  it('saving for riding completes once the gold is there', () => {
    const plan = savingsPlan(char(38, 0), 'riding')!;
    expect(plan.target.copper).toBe(120 * 10000);
    const snap = (copper: number) => ({ characters: [char(38, copper)], professions: [], progress: [], instances, plans: [] });
    expect(plan.title).toBe('Save for riding (120g)');
    expect(createPlan(snap(120 * 10000), plan, 'rich').value.completed).toEqual([plan.title]);
    expect(createPlan(snap(20 * 10000), plan, 'poor').value.completed).toEqual([]);
    expect(savingsPlan(char(41), 'riding')).toBeNull();
  });
});
