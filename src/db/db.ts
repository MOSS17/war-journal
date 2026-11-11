import Dexie, { type EntityTable } from 'dexie';
import type {
  Character,
  GameEvent,
  Instance,
  InstanceProgress,
  JournalEntry,
  LibraryItem,
  MetaRow,
  Profession,
  StoredImage,
  TonightTask,
  WarPlan,
} from '../lib/types';
import seedInstances from '../data/instances.json';
import seedEvents from '../data/events.json';

export class WarJournalDB extends Dexie {
  characters!: EntityTable<Character, 'id'>;
  professions!: EntityTable<Profession, 'id'>;
  instances!: EntityTable<Instance, 'id'>;
  progress!: EntityTable<InstanceProgress, 'id'>;
  plans!: EntityTable<WarPlan, 'id'>;
  journal!: EntityTable<JournalEntry, 'id'>;
  images!: EntityTable<StoredImage, 'id'>;
  library!: EntityTable<LibraryItem, 'id'>;
  events!: EntityTable<GameEvent, 'id'>;
  tonight!: EntityTable<TonightTask, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'war-journal') {
    super(name);
    // Booleans can't be IndexedDB keys, so flags like isMain/pinned/tracked are
    // filtered in memory. The data set is small.
    this.version(1).stores({
      characters: 'id, status',
      professions: 'id, characterId',
      instances: 'id, kind, levelMin',
      progress: 'id, characterId, instanceId',
      plans: 'id, ownerId, status',
      journal: 'id, date, characterId',
      images: 'id',
      library: 'id, category, instanceId, planId',
      events: 'id, approxDate',
      tonight: 'id, date',
      meta: 'key',
    });
    // v2: instances gain territory/hordeAccess/quests, progress gains questsDone.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('instances').toCollection().modify((i: Instance) => Object.assign(i, normalizeInstance(i)));
        await tx.table('progress').toCollection().modify((p: InstanceProgress) => Object.assign(p, normalizeProgress(p)));
      });
  }
}

export const db = new WarJournalDB();

/**
 * Bump when the seed files change. New rows are added; existing seeded rows get
 * their reference data (territory, Horde access, quests) refreshed, but the
 * player's own edits (notes, bosses, wings, links, renames) are kept.
 */
export const SEED_VERSION = 2;

/** Names and notes earlier seeds shipped, so we only replace text the player never touched. */
const OLD_SEED_NAMES: Record<string, string[]> = {
  'alcaz-island-prison': ['Alcaz Island Prison'],
  'excavation-site': ['Excavation Site'],
};
const OLD_SEED_NOTES: Record<string, string[]> = {
  'barrow-deeps': ['Sources disagree on the entrance (Mount Hyjal vs. near Blackmaw Hold). Confirm in game.'],
};

type SeedInstance = Omit<
  Instance,
  'wings' | 'bosses' | 'guideLinks' | 'notes' | 'territory' | 'hordeAccess' | 'quests' | 'source' | 'updatedAt'
> &
  Partial<Pick<Instance, 'wings' | 'bosses' | 'notes' | 'territory' | 'hordeAccess' | 'quests'>>;

/** Fills fields added after v1 so older rows (and old backups) still work. */
export function normalizeInstance<T extends Partial<Instance>>(i: T): T & Pick<Instance, 'territory' | 'hordeAccess' | 'quests'> {
  return { ...i, territory: i.territory ?? 'contested', hordeAccess: i.hordeAccess ?? '', quests: i.quests ?? [] };
}

export function normalizeProgress<T extends Partial<InstanceProgress>>(p: T): T & Pick<InstanceProgress, 'questsDone'> {
  return { ...p, questsDone: p.questsDone ?? [] };
}

export function seedInstanceRows(now = new Date().toISOString()): Instance[] {
  return (seedInstances as SeedInstance[]).map((s) =>
    normalizeInstance({
      wings: [],
      bosses: [],
      notes: '',
      ...s,
      size: s.size as Instance['size'],
      guideLinks: [],
      source: 'manual' as const,
      updatedAt: now,
    }),
  );
}

/** Refreshes reference data on an existing seeded row without touching the player's edits. */
export function patchSeededInstance(existing: Instance, seed: Instance): Instance {
  const renamedBySeed = existing.name === seed.name || (OLD_SEED_NAMES[seed.id] ?? []).includes(existing.name);
  const notesUntouched = existing.notes === '' || (OLD_SEED_NOTES[seed.id] ?? []).includes(existing.notes);
  return {
    ...normalizeInstance(existing),
    name: renamedBySeed ? seed.name : existing.name,
    continent: existing.continent || seed.continent,
    notes: notesUntouched ? seed.notes : existing.notes,
    territory: seed.territory,
    hordeAccess: seed.hordeAccess,
    quests: seed.quests,
  };
}

export function seedEventRows(now = new Date().toISOString()): GameEvent[] {
  return (seedEvents as Omit<GameEvent, 'source' | 'updatedAt'>[]).map((e) => ({
    ...e,
    source: 'manual',
    updatedAt: now,
  }));
}

/** Adds seed instances and events that aren't in the database yet and refreshes seeded reference data. */
export async function ensureSeed(database: WarJournalDB = db): Promise<void> {
  const row = await database.meta.get('seedVersion');
  if (row && (row.value as number) >= SEED_VERSION) return;
  await database.transaction('rw', database.instances, database.events, database.meta, async () => {
    const have = new Map((await database.instances.toArray()).map((i) => [i.id, i]));
    const seeds = seedInstanceRows();
    await database.instances.bulkAdd(seeds.filter((i) => !have.has(i.id)));
    await database.instances.bulkPut(
      seeds.filter((i) => have.has(i.id)).map((i) => patchSeededInstance(have.get(i.id)!, i)),
    );
    const haveE = new Set(await database.events.toCollection().primaryKeys());
    await database.events.bulkAdd(seedEventRows().filter((e) => !haveE.has(e.id)));
    await database.meta.put({ key: 'seedVersion', value: SEED_VERSION });
  });
}

export async function getMeta<T>(key: string, fallback: T, database: WarJournalDB = db): Promise<T> {
  const row = await database.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown, database: WarJournalDB = db) {
  await database.meta.put({ key, value });
}
