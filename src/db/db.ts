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
  }
}

export const db = new WarJournalDB();

/** Bump when the seed files gain new rows. Existing rows are never overwritten. */
export const SEED_VERSION = 1;

type SeedInstance = Omit<Instance, 'wings' | 'bosses' | 'guideLinks' | 'notes' | 'source' | 'updatedAt'> &
  Partial<Pick<Instance, 'wings' | 'bosses' | 'notes'>>;

export function seedInstanceRows(now = new Date().toISOString()): Instance[] {
  return (seedInstances as SeedInstance[]).map((s) => ({
    wings: [],
    bosses: [],
    notes: '',
    ...s,
    size: s.size as Instance['size'],
    guideLinks: [],
    source: 'manual',
    updatedAt: now,
  }));
}

export function seedEventRows(now = new Date().toISOString()): GameEvent[] {
  return (seedEvents as Omit<GameEvent, 'source' | 'updatedAt'>[]).map((e) => ({
    ...e,
    source: 'manual',
    updatedAt: now,
  }));
}

/** Adds any seed instances and events that aren't in the database yet. */
export async function ensureSeed(database: WarJournalDB = db): Promise<void> {
  const row = await database.meta.get('seedVersion');
  if (row && (row.value as number) >= SEED_VERSION) return;
  await database.transaction('rw', database.instances, database.events, database.meta, async () => {
    const haveI = new Set(await database.instances.toCollection().primaryKeys());
    await database.instances.bulkAdd(seedInstanceRows().filter((i) => !haveI.has(i.id)));
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
