import type {
  Character,
  ISODate,
  Instance,
  InstanceProgress,
  Objective,
  Profession,
  RunStatus,
  WarPlan,
} from './types';
import { ACCOUNT } from './types';

// ---------- Difficulty ----------

export type Difficulty = 'trivial' | 'easy' | 'even' | 'hard' | 'deadly';

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  trivial: '#8A8072',
  easy: '#7FBF68',
  even: '#D9B54A',
  hard: '#E0803A',
  deadly: '#E0574A',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  trivial: 'Trivial',
  easy: 'Easy',
  even: 'Even',
  hard: 'Hard',
  deadly: 'Deadly',
};

/**
 * From the design handoff: for levels lo–hi and a character at lvl:
 * trivial if lvl > hi; easy if lvl ≥ (lo+hi)/2; even if lvl ≥ lo;
 * hard if lo − lvl ≤ 3; otherwise deadly.
 */
export function difficulty(lo: number, hi: number, lvl: number): Difficulty {
  if (lvl > hi) return 'trivial';
  if (lvl >= (lo + hi) / 2) return 'easy';
  if (lvl >= lo) return 'even';
  if (lo - lvl <= 3) return 'hard';
  return 'deadly';
}

/** "Fits my level": within two levels below the range, up to its top. */
export function fitsLevel(inst: Pick<Instance, 'levelMin' | 'levelMax'>, lvl: number): boolean {
  return lvl >= inst.levelMin - 2 && lvl <= inst.levelMax;
}

export function levelRange(inst: Pick<Instance, 'levelMin' | 'levelMax'>): string {
  return inst.levelMin === inst.levelMax
    ? String(inst.levelMin)
    : `${inst.levelMin}–${inst.levelMax}`;
}

// ---------- Money ----------

export interface Coins {
  g: number;
  s: number;
  c: number;
}

export function toCoins(copper: number): Coins {
  const v = Math.max(0, Math.round(copper));
  return { g: Math.floor(v / 10000), s: Math.floor((v % 10000) / 100), c: v % 100 };
}

export function fromCoins({ g, s, c }: Coins): number {
  return Math.max(0, Math.round(g) * 10000 + Math.round(s) * 100 + Math.round(c));
}

export function formatMoney(copper: number, opts: { short?: boolean } = {}): string {
  const { g, s, c } = toCoins(copper);
  if (opts.short) return g > 0 ? `${g}g` : s > 0 ? `${s}s` : `${c}c`;
  const parts: string[] = [];
  if (g) parts.push(`${g}g`);
  if (s || g) parts.push(`${s}s`);
  parts.push(`${c}c`);
  return parts.join(' ');
}

export function formatMoneyDelta(delta: number): string {
  const sign = delta < 0 ? '−' : '+';
  return sign + formatMoney(Math.abs(delta));
}

// ---------- Dates ----------

export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function formatDate(iso: ISODate, style: 'short' | 'long' | 'weekday' = 'short'): string {
  const d = parseISODate(iso);
  if (style === 'long')
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  if (style === 'weekday')
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isLocked(inst: Pick<Instance, 'unlockDate'>, today: ISODate): boolean {
  return !!inst.unlockDate && inst.unlockDate > today;
}

export function formatPlayed(minutes?: number): string {
  if (!minutes) return '—';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

// ---------- Names ----------

const NAME_RE = /^\p{L}[\p{L}'’]{1,11}$/u;

/** Character names: 2–12 letters, as typed in game. */
export function validName(name: string): boolean {
  return NAME_RE.test(name.trim());
}

export function fullName(c: Pick<Character, 'firstName' | 'lastName'>): string {
  return `${c.firstName} ${c.lastName}`;
}

// ---------- Instance objectives ----------

/** The checklist a dungeon or raid plan gets from its instance. */
export function instanceObjectiveLinks(
  inst: Instance,
  boss?: string,
): { text: string; link: Objective['link'] }[] {
  if (inst.kind === 'raid' && boss) return [{ text: `Kill ${boss}`, link: { boss } }];
  if (inst.wings.length) return inst.wings.map((w) => ({ text: `${w} cleared`, link: { wing: w } }));
  if (inst.bosses.length) return inst.bosses.map((b) => ({ text: b, link: { boss: b } }));
  return [];
}

// ---------- Plan progress ----------

export interface PlanContext {
  characters: Character[];
  professions: Profession[];
  progress: InstanceProgress[];
  instances: Instance[];
}

export interface PlanProgress {
  /** 0–1 */
  pct: number;
  /** Short label, e.g. "2 / 4 wings" or "128 / 225". */
  label: string;
  done: boolean;
  objectives: (Objective & { derived: boolean })[];
  /** The level used to work out difficulty. */
  level?: number;
  difficulty: Difficulty;
}

function ownerChars(plan: WarPlan, ctx: PlanContext): Character[] {
  if (plan.ownerId === ACCOUNT) return ctx.characters.filter((c) => c.status === 'active');
  return ctx.characters.filter((c) => c.id === plan.ownerId);
}

function progressFor(ctx: PlanContext, characterIds: string[], instanceId: string) {
  return ctx.progress.filter(
    (p) => p.instanceId === instanceId && characterIds.includes(p.characterId),
  );
}

/** Is a wing or boss done for any of the given progress records? */
function linkDone(link: NonNullable<Objective['link']>, recs: InstanceProgress[]): boolean {
  return recs.some(
    (r) =>
      r.status === 'cleared' ||
      ('wing' in link ? r.wingsCleared.includes(link.wing) : r.bossesKilled.includes(link.boss)),
  );
}

export function planProgress(plan: WarPlan, ctx: PlanContext): PlanProgress {
  const chars = ownerChars(plan, ctx);
  const main = chars.find((c) => c.isMain) ?? chars[0];
  const topLevel = chars.reduce((m, c) => Math.max(m, c.level), 0) || undefined;
  const lvl = plan.ownerId === ACCOUNT ? (main?.level ?? topLevel) : main?.level;

  const objectives = plan.objectives.map((o) => ({ ...o, derived: false }));
  const ratio = (n: number, d: number) => (d > 0 ? Math.min(1, Math.max(0, n / d)) : 0);
  const finish = (pct: number, label: string, done: boolean, diff: Difficulty, level?: number) => ({
    pct: done ? 1 : pct,
    label,
    done: plan.status === 'done' || done,
    objectives,
    level,
    difficulty: plan.status === 'done' ? ('trivial' as Difficulty) : diff,
  });

  const plainDiff = (): Difficulty =>
    plan.level && lvl ? difficulty(plan.level, plan.level, lvl) : 'even';

  switch (plan.type) {
    case 'dungeon':
    case 'raid': {
      const inst = ctx.instances.find((i) => i.id === plan.target.instanceId);
      if (!inst) return finish(0, 'Instance missing', false, 'even');
      const recs = progressFor(
        ctx,
        chars.map((c) => c.id),
        inst.id,
      );
      for (const o of objectives) {
        if (o.link) {
          o.done = linkDone(o.link, recs);
          o.derived = true;
        }
      }
      const cleared = plan.target.boss
        ? recs.some((r) => r.status === 'cleared' || r.bossesKilled.includes(plan.target.boss!))
        : recs.some((r) => r.status === 'cleared');
      const total = objectives.length;
      const doneCount = objectives.filter((o) => o.done).length;
      const unit = inst.wings.length && !plan.target.boss ? ' wings' : '';
      const label = total ? `${cleared ? total : doneCount} / ${total}${unit}` : cleared ? 'Cleared' : 'Not cleared';
      const diff = lvl ? difficulty(inst.levelMin, inst.levelMax, lvl) : 'even';
      return finish(total ? ratio(doneCount, total) : cleared ? 1 : 0, label, cleared, diff, lvl);
    }
    case 'level': {
      const target = plan.target.level ?? 60;
      const cur = main ? main.level + main.xpPct / 100 : 0;
      const label = `Lv ${main?.level ?? '?'} / ${target}`;
      const diff = lvl ? difficulty(target, target, lvl) : 'even';
      return finish(ratio(cur, target), label, !!main && main.level >= target, diff, target);
    }
    case 'profession': {
      const target = plan.target.skill ?? 300;
      const prof = ctx.professions.find(
        (p) => chars.some((c) => c.id === p.characterId) && p.name === plan.target.profession,
      );
      const skill = prof?.skill ?? 0;
      return finish(ratio(skill, target), `${skill} / ${target}`, skill >= target, plainDiff(), plan.level ?? lvl);
    }
    case 'gold': {
      const target = plan.target.copper ?? 0;
      const have = chars.reduce((s, c) => s + c.copper, 0);
      const label = `${formatMoney(have, { short: true })} / ${formatMoney(target, { short: true })}`;
      return finish(ratio(have, target), label, target > 0 && have >= target, plainDiff(), plan.level ?? lvl);
    }
    case 'item':
    case 'custom': {
      const total = objectives.length;
      const doneCount = objectives.filter((o) => o.done).length;
      if (total) {
        return finish(ratio(doneCount, total), `${doneCount} / ${total}`, doneCount === total, plainDiff(), plan.level ?? lvl);
      }
      return finish(plan.manualDone ? 1 : 0, plan.manualDone ? 'Done' : 'Not yet', !!plan.manualDone, plainDiff(), plan.level ?? lvl);
    }
  }
}

// ---------- Instance status helpers ----------

export function runStatus(rec?: InstanceProgress): RunStatus {
  return rec?.status ?? 'not-run';
}

export const RUN_LABEL: Record<RunStatus, string> = {
  'not-run': 'Not run',
  run: 'Started',
  cleared: 'Cleared',
};

/** How a character relates to an instance's level range, for the detail panel. */
export function levelRelation(inst: Instance, lvl: number): { text: string; tone: Difficulty } {
  const d = difficulty(inst.levelMin, inst.levelMax, lvl);
  if (lvl > inst.levelMax) return { text: 'Above range', tone: 'trivial' };
  if (lvl >= inst.levelMin) return { text: 'In range', tone: d };
  const gap = inst.levelMin - lvl;
  if (gap <= 3) return { text: `${gap} level${gap === 1 ? '' : 's'} to go`, tone: 'hard' };
  return { text: 'Too low', tone: 'deadly' };
}

export function uid(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}
