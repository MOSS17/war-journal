// The browser database. Player data now lives in Supabase; this keeps
// screenshots (until they move to file storage) and is read once to move a
// browser's older journal up to the cloud (src/db/localImport.ts).
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
import { normalizeInstance, normalizeProgress } from '../lib/catalog';

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

/** The seed version the old local database was last brought up to. */
export const SEED_VERSION = 2;

export async function getMeta<T>(key: string, fallback: T, database: WarJournalDB = db): Promise<T> {
  const row = await database.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown, database: WarJournalDB = db) {
  await database.meta.put({ key, value });
}
