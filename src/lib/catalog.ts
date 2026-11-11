// Seeded game content (instances and events) is shared by every player in the
// catalog tables. A player's edits to a seeded row are stored as an override
// record with the same id; removing a seeded row stores { id, hidden: true }.
// These pure helpers turn catalog rows plus overrides into what the app shows.
import type { GameEvent, Instance, InstanceProgress } from './types';
import seedInstances from '../data/instances.json';
import seedEvents from '../data/events.json';

/** A player's record for a seeded row: an edited copy, or a marker that hides it. */
export type Hidden = { id: string; hidden: true };
export type Override<T> = T | Hidden;

export const isHidden = (r: object): r is Hidden => (r as Partial<Hidden>).hidden === true;

/** Fields the catalog owns. They always come from the catalog, even on an edited copy. */
const INSTANCE_REFERENCE = ['territory', 'hordeAccess', 'quests'] as const;

type SeedInstance = Omit<
  Instance,
  'wings' | 'bosses' | 'guideLinks' | 'notes' | 'territory' | 'hordeAccess' | 'quests' | 'source' | 'updatedAt'
> &
  Partial<Pick<Instance, 'wings' | 'bosses' | 'notes' | 'territory' | 'hordeAccess' | 'quests'>>;

type SeedEvent = Omit<GameEvent, 'source' | 'updatedAt'>;

/** Fills fields added after v1 so older rows (and old backups) still work. */
export function normalizeInstance<T extends Partial<Instance>>(i: T): T & Pick<Instance, 'territory' | 'hordeAccess' | 'quests'> {
  return { ...i, territory: i.territory ?? 'contested', hordeAccess: i.hordeAccess ?? '', quests: i.quests ?? [] };
}

export function normalizeProgress<T extends Partial<InstanceProgress>>(p: T): T & Pick<InstanceProgress, 'questsDone'> {
  return { ...p, questsDone: p.questsDone ?? [] };
}

/** A catalog row as the app uses it. */
export function catalogInstance(s: SeedInstance, now = new Date(0).toISOString()): Instance {
  return normalizeInstance({
    wings: [],
    bosses: [],
    notes: '',
    ...s,
    size: s.size as Instance['size'],
    guideLinks: [],
    source: 'manual' as const,
    updatedAt: now,
  });
}

export function catalogEvent(s: SeedEvent, now = new Date(0).toISOString()): GameEvent {
  return { ...s, source: 'manual', updatedAt: now };
}

/** The bundled seed files as app rows. The server's catalog tables are generated from the same files. */
export function seedInstanceRows(now?: string): Instance[] {
  return (seedInstances as SeedInstance[]).map((s) => catalogInstance(s, now));
}

export function seedEventRows(now?: string): GameEvent[] {
  return (seedEvents as SeedEvent[]).map((s) => catalogEvent(s, now));
}

/** Catalog instances with the player's overrides applied, plus the instances they added. */
export function mergeInstances(catalog: Instance[], records: Override<Instance>[]): Instance[] {
  const mine = new Map(records.map((r) => [r.id, r]));
  const out: Instance[] = [];
  for (const c of catalog) {
    const o = mine.get(c.id);
    if (!o) out.push(c);
    else if (!isHidden(o)) out.push(normalizeInstance({ ...o, territory: c.territory, hordeAccess: c.hordeAccess, quests: c.quests }));
  }
  const seeded = new Set(catalog.map((c) => c.id));
  for (const r of records) if (!seeded.has(r.id) && !isHidden(r)) out.push(normalizeInstance(r));
  return out;
}

/** Catalog events with the player's edits and removals applied, plus their own events. */
export function mergeEvents(catalog: GameEvent[], records: Override<GameEvent>[]): GameEvent[] {
  const mine = new Map(records.map((r) => [r.id, r]));
  const out = catalog.flatMap((c) => {
    const o = mine.get(c.id);
    return !o ? [c] : isHidden(o) ? [] : [o];
  });
  const seeded = new Set(catalog.map((c) => c.id));
  for (const r of records) if (!seeded.has(r.id) && !isHidden(r)) out.push(r);
  return out;
}

/** Names and notes earlier seeds shipped, so text the player never touched still counts as untouched. */
const OLD_SEED_NAMES: Record<string, string[]> = {
  'alcaz-island-prison': ['Alcaz Island Prison'],
  'excavation-site': ['Excavation Site'],
};
const OLD_SEED_NOTES: Record<string, string[]> = {
  'barrow-deeps': ['Sources disagree on the entrance (Mount Hyjal vs. near Blackmaw Hold). Confirm in game.'],
};

/** A stable string of an object's fields, leaving out the ones named. */
function fingerprint(row: object, omit: readonly string[]): string {
  const o = row as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => !omit.includes(k) && o[k] !== undefined)
    .sort();
  return JSON.stringify(keys.map((k) => [k, o[k]]));
}

/**
 * True when a locally stored seeded instance is just the seed: no renames,
 * notes, bosses, wings or links of the player's own. Those don't need an override.
 */
export function isUntouchedInstance(row: Instance, seed: Instance): boolean {
  const name = row.name === seed.name || (OLD_SEED_NAMES[seed.id] ?? []).includes(row.name) ? seed.name : row.name;
  const notes = row.notes === '' || (OLD_SEED_NOTES[seed.id] ?? []).includes(row.notes) ? seed.notes : row.notes;
  const omit = [...INSTANCE_REFERENCE, 'source', 'updatedAt'];
  return fingerprint({ ...row, name, notes }, omit) === fingerprint(seed, omit);
}

export function isUntouchedEvent(row: GameEvent, seed: GameEvent): boolean {
  const omit = ['source', 'updatedAt'];
  return fingerprint(row, omit) === fingerprint(seed, omit);
}

/**
 * The records to store for a full list of instances or events (from an old
 * local database or a backup): edited seeded rows, the player's own rows, and
 * a hidden marker for each seeded row that is missing.
 */
export function overridesFor<T extends Instance | GameEvent>(
  rows: T[],
  catalog: T[],
  untouched: (row: T, seed: T) => boolean,
  { hideMissing }: { hideMissing: boolean },
): Override<T>[] {
  const seeds = new Map(catalog.map((c) => [c.id, c]));
  const present = new Set(rows.map((r) => r.id));
  const out: Override<T>[] = rows.filter((r) => {
    const seed = seeds.get(r.id);
    return !seed || !untouched(r, seed);
  });
  if (hideMissing) for (const c of catalog) if (!present.has(c.id)) out.push({ id: c.id, hidden: true });
  return out;
}
