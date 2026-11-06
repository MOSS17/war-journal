import { db, setMeta } from './db';
import type {
  Character,
  GameEvent,
  Instance,
  InstanceProgress,
  JournalEntry,
  LibraryItem,
  Objective,
  Profession,
  RunStatus,
  TonightTask,
  WarPlan,
} from '../lib/types';
import { ACCOUNT } from '../lib/types';
import { nowISO, planProgress, todayISO, uid } from '../lib/logic';

// ---------- Characters ----------

export type NewCharacter = Pick<
  Character,
  'firstName' | 'lastName' | 'race' | 'class' | 'level' | 'ruleset' | 'guild' | 'isMain'
>;

export async function addCharacter(input: NewCharacter): Promise<string> {
  const id = uid();
  const now = nowISO();
  await db.transaction('rw', db.characters, db.meta, async () => {
    const others = await db.characters.toArray();
    const isMain = input.isMain || !others.some((c) => c.isMain && c.status === 'active');
    if (isMain) {
      for (const o of others.filter((c) => c.isMain)) await db.characters.update(o.id, { isMain: false });
    }
    await db.characters.add({
      ...input,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      guild: input.guild?.trim() || undefined,
      id,
      isMain,
      xpPct: 0,
      copper: 0,
      faction: 'Horde',
      status: 'active',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    });
    await setMeta('lastRuleset', input.ruleset);
  });
  return id;
}

export async function updateCharacter(id: string, patch: Partial<Character>) {
  await db.characters.update(id, { ...patch, updatedAt: nowISO() });
  if (patch.ruleset) await setMeta('lastRuleset', patch.ruleset);
}

export async function setMain(id: string) {
  await db.transaction('rw', db.characters, async () => {
    const all = await db.characters.toArray();
    for (const c of all) {
      const isMain = c.id === id;
      if (c.isMain !== isMain) await db.characters.update(c.id, { isMain });
    }
  });
}

export async function setRetired(id: string, retired: boolean) {
  await db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(id);
    if (!c) return;
    await db.characters.update(id, {
      status: retired ? 'retired' : 'active',
      isMain: retired ? false : c.isMain,
      updatedAt: nowISO(),
    });
    if (retired && c.isMain) {
      const next = (await db.characters.toArray())
        .filter((o) => o.id !== id && o.status === 'active')
        .sort((a, b) => b.level - a.level)[0];
      if (next) await db.characters.update(next.id, { isMain: true });
    }
  });
}

/** Removes a character with its professions, dungeon progress and plans. Journal entries are kept. */
export async function deleteCharacter(id: string) {
  await db.transaction('rw', [db.characters, db.professions, db.progress, db.plans, db.journal], async () => {
    const c = await db.characters.get(id);
    await db.professions.where('characterId').equals(id).delete();
    await db.progress.where('characterId').equals(id).delete();
    await db.plans.where('ownerId').equals(id).delete();
    await db.journal.where('characterId').equals(id).modify({ characterId: undefined });
    await db.characters.delete(id);
    if (c?.isMain) {
      const next = (await db.characters.toArray())
        .filter((o) => o.status === 'active')
        .sort((a, b) => b.level - a.level)[0];
      if (next) await db.characters.update(next.id, { isMain: true });
    }
  });
}

// ---------- Progress ----------

export interface ProgressUpdate {
  level: number;
  xpPct: number;
  copper: number;
  playedMinutes?: number;
  professions: Pick<Profession, 'id' | 'name' | 'kind' | 'skill'>[];
}

/** Saves an "Update progress" form and returns titles of plans it completed. */
export async function saveProgress(characterId: string, u: ProgressUpdate): Promise<string[]> {
  const now = nowISO();
  await db.transaction('rw', db.characters, db.professions, async () => {
    await db.characters.update(characterId, {
      level: u.level,
      xpPct: u.xpPct,
      copper: u.copper,
      playedMinutes: u.playedMinutes,
      updatedAt: now,
    });
    const existing = await db.professions.where('characterId').equals(characterId).toArray();
    const keep = new Set(u.professions.map((p) => p.id));
    for (const p of existing) if (!keep.has(p.id)) await db.professions.delete(p.id);
    for (const p of u.professions) {
      await db.professions.put({ ...p, characterId, source: 'manual', updatedAt: now });
    }
  });
  return syncPlans();
}

export function progressId(characterId: string, instanceId: string) {
  return `${characterId}:${instanceId}`;
}

export type ProgressInput = Pick<
  InstanceProgress,
  'status' | 'wingsCleared' | 'bossesKilled' | 'timesRun' | 'firstClearDate'
>;

export async function setInstanceProgress(
  characterId: string,
  instanceId: string,
  input: ProgressInput,
): Promise<string[]> {
  const rec: InstanceProgress = {
    ...input,
    firstClearDate: input.status === 'cleared' ? (input.firstClearDate || todayISO()) : input.firstClearDate,
    id: progressId(characterId, instanceId),
    characterId,
    instanceId,
    source: 'manual',
    updatedAt: nowISO(),
  };
  await db.progress.put(rec);
  return syncPlans();
}

/**
 * Marks plans done when their data says so (instance cleared, level reached,
 * skill or gold target met, every objective ticked). Returns the titles of
 * plans that just completed.
 */
export async function syncPlans(): Promise<string[]> {
  return db.transaction(
    'rw',
    [db.plans, db.characters, db.professions, db.progress, db.instances],
    async () => {
      const [plans, characters, professions, progress, instances] = await Promise.all([
        db.plans.where('status').equals('active').toArray(),
        db.characters.toArray(),
        db.professions.toArray(),
        db.progress.toArray(),
        db.instances.toArray(),
      ]);
      const ctx = { characters, professions, progress, instances };
      const completed: string[] = [];
      for (const plan of plans) {
        const p = planProgress(plan, ctx);
        if (p.done) {
          const now = nowISO();
          await db.plans.update(plan.id, { status: 'done', completedAt: now, updatedAt: now });
          completed.push(plan.title);
        }
      }
      return completed;
    },
  );
}

// ---------- Plans ----------

export type PlanInput = Omit<WarPlan, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'>;

export async function createPlan(input: PlanInput): Promise<{ id: string; completed: string[] }> {
  const id = uid();
  const now = nowISO();
  await db.plans.add({ ...input, id, status: 'active', createdAt: now, updatedAt: now });
  return { id, completed: await syncPlans() };
}

export async function updatePlan(id: string, patch: Partial<WarPlan>): Promise<string[]> {
  await db.plans.update(id, { ...patch, updatedAt: nowISO() });
  return syncPlans();
}

export async function setPlanStatus(id: string, status: WarPlan['status']) {
  const now = nowISO();
  await db.plans.update(id, {
    status,
    completedAt: status === 'done' ? now : undefined,
    manualDone: status === 'done' ? true : undefined,
    updatedAt: now,
  });
}

export async function deletePlan(id: string) {
  await db.transaction('rw', db.plans, db.library, async () => {
    await db.library.where('planId').equals(id).modify({ planId: undefined });
    await db.plans.delete(id);
  });
}

/**
 * Ticks or unticks an objective. Objectives linked to a wing or boss write
 * through to the owner's InstanceProgress (the main for warband plans).
 */
export async function toggleObjective(plan: WarPlan, objective: Objective, done: boolean): Promise<string[]> {
  if (!objective.link || !plan.target.instanceId) {
    await db.plans.update(plan.id, {
      objectives: plan.objectives.map((o) =>
        o.id === objective.id ? { ...o, done, doneAt: done ? todayISO() : undefined } : o,
      ),
      updatedAt: nowISO(),
    });
    return syncPlans();
  }
  let charId = plan.ownerId;
  if (charId === ACCOUNT) {
    const main = (await db.characters.toArray()).find((c) => c.isMain && c.status === 'active');
    if (!main) return [];
    charId = main.id;
  }
  const inst = await db.instances.get(plan.target.instanceId);
  if (!inst) return [];
  const rec = await db.progress.get(progressId(charId, inst.id));
  const base: ProgressInput = rec ?? {
    status: 'not-run',
    wingsCleared: [],
    bossesKilled: [],
    timesRun: 0,
  };
  const toggle = (list: string[], v: string) =>
    done ? [...new Set([...list, v])] : list.filter((x) => x !== v);
  const link = objective.link;
  // Unticking a part of a cleared instance means it's no longer fully cleared.
  let wings = base.wingsCleared;
  let bosses = base.bossesKilled;
  if (!done && base.status === 'cleared') {
    wings = inst.wings.slice();
    bosses = inst.bosses.slice();
  }
  if ('wing' in link) wings = toggle(wings, link.wing);
  else bosses = toggle(bosses, link.boss);
  const status = resolveStatus(inst, wings, bosses, done ? base.status : base.status === 'cleared' ? 'run' : base.status);
  return setInstanceProgress(charId, inst.id, {
    ...base,
    wingsCleared: wings,
    bossesKilled: bosses,
    status,
    timesRun: Math.max(base.timesRun, status === 'not-run' ? 0 : 1),
  });
}

/** All wings (or, without wings, all bosses) done means cleared; any done means at least run. */
export function resolveStatus(
  inst: Pick<Instance, 'wings' | 'bosses'>,
  wings: string[],
  bosses: string[],
  current: RunStatus,
): RunStatus {
  const parts = inst.wings.length ? inst.wings : inst.bosses;
  const doneParts = inst.wings.length ? wings : bosses;
  if (parts.length && parts.every((p) => doneParts.includes(p))) return 'cleared';
  if (current === 'cleared') return 'cleared';
  if (wings.length || bosses.length) return 'run';
  return current;
}

// ---------- Instances ----------

export type InstanceInput = Omit<Instance, 'id' | 'source' | 'updatedAt'>;

export async function addInstance(input: InstanceInput): Promise<string> {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'instance';
  const id = (await db.instances.get(slug)) ? `${slug}-${uid().slice(0, 6)}` : slug;
  await db.instances.add({ ...input, id, source: 'manual', updatedAt: nowISO() });
  return id;
}

export async function updateInstance(id: string, patch: Partial<Instance>) {
  await db.instances.update(id, { ...patch, updatedAt: nowISO() });
}

export async function deleteInstance(id: string) {
  await db.transaction('rw', [db.instances, db.progress, db.library], async () => {
    await db.progress.where('instanceId').equals(id).delete();
    await db.library.where('instanceId').equals(id).modify({ instanceId: undefined });
    await db.instances.delete(id);
  });
}

// ---------- Journal ----------

export type EntryInput = Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>;

export async function saveEntry(id: string | undefined, input: EntryInput): Promise<string> {
  const now = nowISO();
  if (id && (await db.journal.get(id))) {
    await db.journal.update(id, { ...input, updatedAt: now });
    return id;
  }
  const newId = id ?? uid();
  await db.journal.add({ ...input, id: newId, createdAt: now, updatedAt: now });
  return newId;
}

export async function deleteEntry(id: string) {
  await db.transaction('rw', db.journal, db.images, async () => {
    const e = await db.journal.get(id);
    if (e) await db.images.bulkDelete(e.imageIds);
    await db.journal.delete(id);
  });
}

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

/** Deletes stored screenshots that no journal entry points at any more. */
export async function cleanupOrphanImages() {
  await db.transaction('rw', db.journal, db.images, async () => {
    const used = new Set((await db.journal.toArray()).flatMap((e) => e.imageIds));
    const all = await db.images.toCollection().primaryKeys();
    await db.images.bulkDelete(all.filter((id) => !used.has(id)));
  });
}

/** A one-line moment from the glance view, kept as a draft to finish later. */
export async function logMoment(text: string, character?: Character): Promise<string> {
  return saveEntry(undefined, {
    date: todayISO(),
    characterId: character?.id,
    level: character?.level,
    title: '',
    body: text.trim(),
    imageIds: [],
    tags: [],
    draft: true,
  });
}

// ---------- Library ----------

export type LibraryInput = Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>;

export async function saveLibraryItem(id: string | undefined, input: LibraryInput): Promise<string> {
  const now = nowISO();
  if (id) {
    await db.library.update(id, { ...input, updatedAt: now });
    return id;
  }
  const newId = uid();
  await db.library.add({ ...input, id: newId, createdAt: now, updatedAt: now });
  return newId;
}

export async function deleteLibraryItem(id: string) {
  await db.library.delete(id);
}

export async function togglePin(item: LibraryItem) {
  await db.library.update(item.id, { pinned: !item.pinned, updatedAt: nowISO() });
}

// ---------- Events ----------

export type EventInput = Pick<GameEvent, 'title' | 'date' | 'detail'> & Partial<Pick<GameEvent, 'dateLabel' | 'approxDate'>>;

export async function saveEvent(id: string | undefined, input: EventInput): Promise<string> {
  const now = nowISO();
  const approxDate = input.date ?? input.approxDate ?? todayISO();
  if (id) {
    await db.events.update(id, { ...input, approxDate, updatedAt: now });
    return id;
  }
  const newId = uid();
  await db.events.add({
    ...input,
    approxDate,
    id: newId,
    kind: 'personal',
    instanceIds: [],
    source: 'manual',
    updatedAt: now,
  });
  return newId;
}

export async function deleteEvent(id: string) {
  await db.events.delete(id);
}

// ---------- Tonight ----------

export async function addTonightTask(text: string) {
  const t = text.trim();
  if (!t) return;
  const task: TonightTask = { id: uid(), text: t, done: false, date: todayISO(), createdAt: nowISO() };
  await db.tonight.add(task);
}

export async function toggleTonightTask(task: TonightTask) {
  await db.tonight.update(task.id, {
    done: !task.done,
    doneOn: task.done ? undefined : todayISO(),
  });
}

export async function deleteTonightTask(id: string) {
  await db.tonight.delete(id);
}

/** Open tasks from any night, plus tasks ticked today. Older ticked tasks drop off. */
export function visibleTonight(tasks: TonightTask[], today = todayISO()): TonightTask[] {
  return tasks
    .filter((t) => !t.done || t.doneOn === today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
