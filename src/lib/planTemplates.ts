/** Ready-made war plans for new players. Each builds a plan for one character, or says it doesn't apply. */
import { MAX_LEVEL } from './gamedata';
import { LEVEL_UNLOCKS } from './guides';
import { formatMoney, instanceObjectiveLinks, isLocked, uid } from './logic';
import type { PlanInput } from './mutations';
import type { Character, ISODate, Instance, InstanceProgress, Profession } from './types';

export interface TemplateContext {
  instances: Instance[];
  progress: InstanceProgress[];
  professions: Profession[];
  today: ISODate;
}

export interface PlanTemplate {
  id: string;
  blurb: string;
  /** The plan for this character, or null when the template doesn't fit them. */
  build: (c: Character, ctx: TemplateContext) => PlanInput | null;
}

const base = (c: Character, title: string, rest: Partial<PlanInput> & Pick<PlanInput, 'type' | 'target'>): PlanInput => ({
  title,
  ownerId: c.id,
  tracked: true,
  objectives: [],
  notes: '',
  ...rest,
});

const objective = (text: string) => ({ id: uid(), text, done: false });

/** The next Horde-side dungeon this character hasn't cleared and can still use. */
export function nextDungeon(c: Character, ctx: TemplateContext): Instance | undefined {
  const cleared = new Set(ctx.progress.filter((p) => p.characterId === c.id && p.status === 'cleared').map((p) => p.instanceId));
  return ctx.instances
    .filter(
      (i) =>
        i.kind === 'dungeon' &&
        i.territory !== 'alliance' &&
        i.levelMax >= c.level &&
        !cleared.has(i.id) &&
        !isLocked(i, ctx.today),
    )
    .sort((a, b) => a.levelMin - b.levelMin || a.name.localeCompare(b.name))[0];
}

/** A gold plan for one of the LEVEL_UNLOCKS costs. Exported for the gold planner. */
export function savingsPlan(c: Character, unlockId: string): PlanInput | null {
  const u = LEVEL_UNLOCKS.find((x) => x.id === unlockId);
  if (!u?.copper || u.level < c.level) return null;
  return base(c, `Save for ${u.saveFor ?? u.title.toLowerCase()} (${formatMoney(u.copper, { short: true })})`, {
    type: 'gold',
    target: { copper: u.copper },
    level: u.level,
    notes: u.detail,
  });
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'next-ten',
    blurb: 'A level goal to aim for. Every 10 levels opens up new zones and dungeons.',
    build: (c) => {
      if (c.level >= MAX_LEVEL) return null;
      const target = Math.min(MAX_LEVEL, (Math.floor(c.level / 10) + 1) * 10);
      return base(c, `Reach level ${target}`, { type: 'level', target: { level: target }, level: target });
    },
  },
  {
    id: 'professions',
    blurb: 'Pick two main professions and learn the three secondary ones. The Field Guide explains which pairs go together.',
    build: (c, ctx) => {
      const mine = ctx.professions.filter((p) => p.characterId === c.id);
      if (mine.filter((p) => p.kind === 'primary').length >= 2) return null;
      return base(c, 'Pick my professions', {
        type: 'custom',
        target: {},
        objectives: [
          objective('Read the Field Guide’s Professions tab'),
          objective('Learn two main professions'),
          objective('Learn First Aid'),
          objective('Learn Cooking'),
          objective('Learn Fishing'),
        ].filter((o) => !mine.some((p) => o.text === `Learn ${p.name}`)),
      });
    },
  },
  {
    id: 'next-dungeon',
    blurb: 'Your next dungeon on the Horde side. Ticking its wings in Instances fills this plan in.',
    build: (c, ctx) => {
      const inst = nextDungeon(c, ctx);
      if (!inst) return null;
      return base(c, `Clear ${inst.name}`, {
        type: 'dungeon',
        target: { instanceId: inst.id },
        objectives: instanceObjectiveLinks(inst).map((l) => ({ id: uid(), text: l.text, link: l.link, done: false })),
      });
    },
  },
  {
    id: 'first-aid',
    blurb: 'Bandages heal you between fights for any class. Skill 75 is the first trainer milestone.',
    build: (c, ctx) => {
      const fa = ctx.professions.find((p) => p.characterId === c.id && p.name === 'First Aid');
      if (fa && fa.skill >= 75) return null;
      return base(c, 'First Aid 75', { type: 'profession', target: { profession: 'First Aid', skill: 75 } });
    },
  },
  ...LEVEL_UNLOCKS.filter((u) => u.copper).map(
    (u): PlanTemplate => ({
      id: `save-${u.id}`,
      blurb: u.detail,
      build: (c) => savingsPlan(c, u.id),
    }),
  ),
  {
    id: 'max-level',
    blurb: 'The long road. Track it to see how far you’ve come.',
    build: (c) => (c.level >= MAX_LEVEL ? null : base(c, `Reach level ${MAX_LEVEL}`, { type: 'level', target: { level: MAX_LEVEL }, level: MAX_LEVEL })),
  },
];

/** Templates that apply to this character, minus ones that match an active plan by title. */
export function templatesFor(c: Character, ctx: TemplateContext, activeTitles: string[] = []) {
  const seen = new Set<string>();
  return PLAN_TEMPLATES.map((t) => ({ template: t, plan: t.build(c, ctx) }))
    .filter((x): x is { template: PlanTemplate; plan: PlanInput } => !!x.plan && !seen.has(x.plan.title) && !!seen.add(x.plan.title))
    .map((x) => ({ ...x, exists: activeTitles.includes(x.plan.title) }));
}
