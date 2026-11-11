// The app's writes. Each one loads the rows its pure mutation needs
// (src/lib/mutations.ts), runs it, and applies the resulting changes in a
// single transaction. This file is the only place that writes to storage.
import { db } from './db';
import type { Character, LibraryItem, Objective, TonightTask, WarPlan } from '../lib/types';
import { nowISO, uid } from '../lib/logic';
import * as m from '../lib/mutations';
import { PLAN_KINDS, type Change, type Kind, type Mutation, type Snapshot } from '../lib/mutations';

export {
  progressId,
  resolveStatus,
  visibleTonight,
  type EntryInput,
  type EventInput,
  type InstanceInput,
  type LibraryInput,
  type NewCharacter,
  type PlanInput,
  type ProgressInput,
  type ProgressUpdate,
} from '../lib/mutations';

async function loadSnapshot(kinds: Kind[]): Promise<Snapshot> {
  const s: Snapshot = {};
  await Promise.all(
    kinds.map(async (k) => {
      (s as Record<Kind, unknown[]>)[k] = await db.table(k).toArray();
    }),
  );
  return s;
}

/** Writes a list of changes in order. */
export async function applyChanges(changes: Change[]): Promise<void> {
  if (!changes.length) return;
  await db.transaction('rw', db.tables, async () => {
    for (const c of changes) {
      if (c.op === 'put') await db.table(c.kind).put(c.row);
      else await db.table(c.kind).delete(c.id);
    }
  });
}

/** Loads a snapshot of `kinds`, runs the mutation and applies its changes, all in one transaction. */
async function run<R>(kinds: Kind[], fn: (s: Snapshot) => Mutation<R>): Promise<R> {
  return db.transaction('rw', db.tables, async () => {
    const result = fn(await loadSnapshot(kinds));
    await applyChanges(result.changes);
    return result.value;
  });
}

// ---------- Characters ----------

export const addCharacter = (input: m.NewCharacter) => run(['characters'], (s) => m.addCharacter(s, input));
export const updateCharacter = (id: string, patch: Partial<Character>) =>
  run(['characters'], (s) => m.updateCharacter(s, id, patch));
export const setMain = (id: string) => run(['characters'], (s) => m.setMain(s, id));
export const setRetired = (id: string, retired: boolean) => run(['characters'], (s) => m.setRetired(s, id, retired));
/** Removes a character with its professions, dungeon progress and plans. Journal entries are kept. */
export const deleteCharacter = (id: string) =>
  run(['characters', 'professions', 'progress', 'plans', 'journal'], (s) => m.deleteCharacter(s, id));

// ---------- Progress ----------

/** Saves an "Update progress" form and returns titles of plans it completed. */
export const saveProgress = (characterId: string, u: m.ProgressUpdate) =>
  run(PLAN_KINDS, (s) => m.saveProgress(s, characterId, u));
export const setInstanceProgress = (characterId: string, instanceId: string, input: m.ProgressInput) =>
  run(PLAN_KINDS, (s) => m.setInstanceProgress(s, characterId, instanceId, input));
/** Completes any plans whose data says they're done. Returns their titles. */
export const syncPlans = () => run(PLAN_KINDS, (s) => m.completePlans(s));
export const toggleQuest = (characterId: string, instanceId: string, questId: string, done: boolean) =>
  run(['progress'], (s) => m.toggleQuest(s, characterId, instanceId, questId, done));

// ---------- Plans ----------

export const createPlan = (input: m.PlanInput) => run(PLAN_KINDS, (s) => m.createPlan(s, input));
export const updatePlan = (id: string, patch: Partial<WarPlan>) => run(PLAN_KINDS, (s) => m.updatePlan(s, id, patch));
export const setPlanStatus = (id: string, status: WarPlan['status']) =>
  run(['plans'], (s) => m.setPlanStatus(s, id, status));
export const deletePlan = (id: string) => run(['plans', 'library'], (s) => m.deletePlan(s, id));
/** Ticks or unticks an objective; wing and boss objectives write through to instance progress. */
export const toggleObjective = (plan: WarPlan, objective: Objective, done: boolean) =>
  run(PLAN_KINDS, (s) => m.toggleObjective(s, plan, objective, done));

// ---------- Instances ----------

export const addInstance = (input: m.InstanceInput) => run(['instances'], (s) => m.addInstance(s, input));
export const updateInstance = (id: string, patch: Parameters<typeof m.updateInstance>[2]) =>
  run(['instances'], (s) => m.updateInstance(s, id, patch));
export const deleteInstance = (id: string) =>
  run(['instances', 'progress', 'library'], (s) => m.deleteInstance(s, id));

// ---------- Journal ----------

export const saveEntry = (id: string | undefined, input: m.EntryInput) =>
  run(['journal'], (s) => m.saveEntry(s, id, input));
export const deleteEntry = (id: string) => run(['journal'], (s) => m.deleteEntry(s, id));
/** A one-line moment from the glance view, kept as a draft to finish later. */
export const logMoment = (text: string, character?: Character) =>
  run(['journal'], (s) => m.logMoment(s, text, character));

// Screenshots stay browser-only until they move to file storage (phase 5).

export async function addImages(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const id = uid();
    await db.images.add({ id, blob: f, type: f.type, createdAt: nowISO() });
    ids.push(id);
  }
  return ids;
}

export async function deleteImages(ids: string[]) {
  await db.images.bulkDelete(ids);
}

export async function getImage(id: string) {
  return db.images.get(id);
}

/** Deletes stored screenshots that no journal entry points at any more. */
export async function cleanupOrphanImages() {
  await db.transaction('rw', db.journal, db.images, async () => {
    const used = new Set((await db.journal.toArray()).flatMap((e) => e.imageIds));
    const all = await db.images.toCollection().primaryKeys();
    await db.images.bulkDelete(all.filter((id) => !used.has(id)));
  });
}

// ---------- Library ----------

export const saveLibraryItem = (id: string | undefined, input: m.LibraryInput) =>
  run(['library'], (s) => m.saveLibraryItem(s, id, input));
export const deleteLibraryItem = (id: string) => run([], () => m.remove('library', id));
export const togglePin = (item: LibraryItem) => run(['library'], (s) => m.togglePin(s, item));

// ---------- Events ----------

export const saveEvent = (id: string | undefined, input: m.EventInput) =>
  run(['events'], (s) => m.saveEvent(s, id, input));
export const deleteEvent = (id: string) => run([], () => m.remove('events', id));

// ---------- Tonight ----------

export const addTonightTask = (text: string) => run([], () => m.addTonightTask(text));
export const toggleTonightTask = (task: TonightTask) => run(['tonight'], (s) => m.toggleTonightTask(s, task));
export const deleteTonightTask = (id: string) => run([], () => m.remove('tonight', id));
