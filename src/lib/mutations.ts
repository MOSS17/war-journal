// Every write in the app as a pure function: it takes a snapshot of the rows it
// needs and returns the changes to make, plus anything the caller shows (a new
// id, plans that just completed). The database layer (src/db/actions.ts) loads
// the snapshot and applies the changes in one transaction, so swapping the
// storage only touches that layer.
import type {
  Character,
  GameEvent,
  Instance,
  InstanceProgress,
  JournalEntry,
  LibraryItem,
  MetaRow,
  Objective,
  Profession,
  RunStatus,
  ImageRecord,
  TonightTask,
  WarPlan,
} from './types';
import { ACCOUNT } from './types';
import { nowISO, planProgress, todayISO, uid } from './logic';

// ---------- Changes and snapshots ----------

export interface RowOf {
  characters: Character;
  professions: Profession;
  instances: Instance;
  progress: InstanceProgress;
  plans: WarPlan;
  journal: JournalEntry;
  images: ImageRecord;
  library: LibraryItem;
  events: GameEvent;
  tonight: TonightTask;
  meta: MetaRow;
}

export type Kind = keyof RowOf;

export type Change = {
  [K in Kind]: { kind: K; op: 'put'; row: RowOf[K] } | { kind: K; op: 'delete'; id: string };
}[Kind];

/** The rows a mutation reads, by kind. Only the kinds it asks for are filled. */
export type Snapshot = { [K in Kind]?: RowOf[K][] };

export interface Mutation<R = void> {
  changes: Change[];
  value: R;
}

/** The kinds plan completion reads. Mutations that complete plans need all of them. */
export const PLAN_KINDS: Kind[] = ['plans', 'characters', 'professions', 'progress', 'instances'];

export function keyOf<K extends Kind>(kind: K, row: RowOf[K]): string {
  return kind === 'meta' ? (row as MetaRow).key : (row as { id: string }).id;
}

const put = <K extends Kind>(kind: K, row: RowOf[K]) => ({ kind, op: 'put', row }) as Change;
const del = (kind: Kind, id: string) => ({ kind, op: 'delete', id }) as Change;

function rows<K extends Kind>(s: Snapshot, kind: K): RowOf[K][] {
  const list = s[kind];
  if (!list) throw new Error(`Snapshot is missing ${kind}`);
  return list as RowOf[K][];
}

function find<K extends Kind>(s: Snapshot, kind: K, id: string): RowOf[K] | undefined {
  return rows(s, kind).find((r) => keyOf(kind, r) === id);
}

/** The snapshot as it will be once the changes land. Kinds the snapshot doesn't hold are skipped. */
export function applyToSnapshot(s: Snapshot, changes: Change[]): Snapshot {
  const next: Snapshot = { ...s };
  for (const c of changes) {
    const list = next[c.kind] as RowOf[Kind][] | undefined;
    if (!list) continue;
    const id = c.op === 'put' ? keyOf(c.kind, c.row) : c.id;
    const kept = list.filter((r) => keyOf(c.kind, r) !== id);
    (next as Record<Kind, RowOf[Kind][]>)[c.kind] = c.op === 'put' ? [...kept, c.row] : kept;
  }
  return next;
}

/**
 * Marks plans done when their data says so (instance cleared, level reached,
 * skill or gold target met, every objective ticked).
 */
export function completePlans(s: Snapshot, now = nowISO()): Mutation<string[]> {
  const ctx = {
    characters: rows(s, 'characters'),
    professions: rows(s, 'professions'),
    progress: rows(s, 'progress'),
    instances: rows(s, 'instances'),
  };
  const changes: Change[] = [];
  const completed: string[] = [];
  for (const plan of rows(s, 'plans')) {
    if (plan.status !== 'active' || !planProgress(plan, ctx).done) continue;
    changes.push(put('plans', { ...plan, status: 'done', completedAt: now, updatedAt: now }));
    completed.push(plan.title);
  }
  return { changes, value: completed };
}

/** The changes, followed by completing any plans they finish. Returns the completed titles. */
function withPlanSync(s: Snapshot, changes: Change[], now: string): Mutation<string[]> {
  const sync = completePlans(applyToSnapshot(s, changes), now);
  return { changes: [...changes, ...sync.changes], value: sync.value };
}

// ---------- Characters ----------

export type NewCharacter = Pick<
  Character,
  'firstName' | 'lastName' | 'race' | 'class' | 'level' | 'ruleset' | 'guild' | 'isMain'
>;

/** Needs: characters. */
export function addCharacter(s: Snapshot, input: NewCharacter, id = uid(), now = nowISO()): Mutation<string> {
  const others = rows(s, 'characters');
  const isMain = input.isMain || !others.some((c) => c.isMain && c.status === 'active');
  const changes: Change[] = [];
  if (isMain) for (const o of others.filter((c) => c.isMain)) changes.push(put('characters', { ...o, isMain: false }));
  changes.push(
    put('characters', {
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
    }),
    put('meta', { key: 'lastRuleset', value: input.ruleset }),
  );
  return { changes, value: id };
}

/** Needs: characters. */
export function updateCharacter(s: Snapshot, id: string, patch: Partial<Character>, now = nowISO()): Mutation {
  const c = find(s, 'characters', id);
  const changes: Change[] = [];
  if (c) changes.push(put('characters', { ...c, ...patch, updatedAt: now }));
  if (patch.ruleset) changes.push(put('meta', { key: 'lastRuleset', value: patch.ruleset }));
  return { changes, value: undefined };
}

/** Needs: characters. */
export function setMain(s: Snapshot, id: string): Mutation {
  const changes = rows(s, 'characters')
    .filter((c) => c.isMain !== (c.id === id))
    .map((c) => put('characters', { ...c, isMain: c.id === id }));
  return { changes, value: undefined };
}

/** The highest-level active character other than `except`, who becomes main when the main leaves. */
function nextMain(chars: Character[], except: string): Character | undefined {
  return chars.filter((o) => o.id !== except && o.status === 'active').sort((a, b) => b.level - a.level)[0];
}

/** Needs: characters. */
export function setRetired(s: Snapshot, id: string, retired: boolean, now = nowISO()): Mutation {
  const chars = rows(s, 'characters');
  const c = chars.find((x) => x.id === id);
  if (!c) return { changes: [], value: undefined };
  const changes: Change[] = [
    put('characters', {
      ...c,
      status: retired ? 'retired' : 'active',
      isMain: retired ? false : c.isMain,
      updatedAt: now,
    }),
  ];
  if (retired && c.isMain) {
    const next = nextMain(chars, id);
    if (next) changes.push(put('characters', { ...next, isMain: true }));
  }
  return { changes, value: undefined };
}

/**
 * Removes a character with its professions, dungeon progress and plans. Journal entries are kept.
 * Needs: characters, professions, progress, plans, journal.
 */
export function deleteCharacter(s: Snapshot, id: string): Mutation {
  const c = find(s, 'characters', id);
  const changes: Change[] = [
    ...rows(s, 'professions').filter((p) => p.characterId === id).map((p) => del('professions', p.id)),
    ...rows(s, 'progress').filter((p) => p.characterId === id).map((p) => del('progress', p.id)),
    ...rows(s, 'plans').filter((p) => p.ownerId === id).map((p) => del('plans', p.id)),
    ...rows(s, 'journal')
      .filter((e) => e.characterId === id)
      .map((e) => put('journal', { ...e, characterId: undefined })),
    del('characters', id),
  ];
  if (c?.isMain) {
    const next = nextMain(rows(s, 'characters'), id);
    if (next) changes.push(put('characters', { ...next, isMain: true }));
  }
  return { changes, value: undefined };
}

// ---------- Progress ----------

export interface ProgressUpdate {
  level: number;
  xpPct: number;
  copper: number;
  playedMinutes?: number;
  professions: Pick<Profession, 'id' | 'name' | 'kind' | 'skill'>[];
}

/** Saves an "Update progress" form and returns titles of plans it completed. Needs: PLAN_KINDS. */
export function saveProgress(s: Snapshot, characterId: string, u: ProgressUpdate, now = nowISO()): Mutation<string[]> {
  const c = find(s, 'characters', characterId);
  const changes: Change[] = [];
  if (c) {
    changes.push(
      put('characters', {
        ...c,
        level: u.level,
        xpPct: u.xpPct,
        copper: u.copper,
        playedMinutes: u.playedMinutes,
        updatedAt: now,
      }),
    );
  }
  const keep = new Set(u.professions.map((p) => p.id));
  for (const p of rows(s, 'professions')) {
    if (p.characterId === characterId && !keep.has(p.id)) changes.push(del('professions', p.id));
  }
  for (const p of u.professions) changes.push(put('professions', { ...p, characterId, source: 'manual', updatedAt: now }));
  return withPlanSync(s, changes, now);
}

export function progressId(characterId: string, instanceId: string) {
  return `${characterId}:${instanceId}`;
}

export type ProgressInput = Pick<
  InstanceProgress,
  'status' | 'wingsCleared' | 'bossesKilled' | 'timesRun' | 'firstClearDate'
>;

/** Needs: PLAN_KINDS. */
export function setInstanceProgress(
  s: Snapshot,
  characterId: string,
  instanceId: string,
  input: ProgressInput,
  now = nowISO(),
  today = todayISO(),
): Mutation<string[]> {
  const id = progressId(characterId, instanceId);
  const prev = find(s, 'progress', id);
  const rec: InstanceProgress = {
    questsDone: prev?.questsDone ?? [],
    ...input,
    firstClearDate: input.status === 'cleared' ? input.firstClearDate || today : input.firstClearDate,
    id,
    characterId,
    instanceId,
    source: 'manual',
    updatedAt: now,
  };
  return withPlanSync(s, [put('progress', rec)], now);
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

/** Ticks or unticks a dungeon quest for one character. Run status is left alone. Needs: progress. */
export function toggleQuest(
  s: Snapshot,
  characterId: string,
  instanceId: string,
  questId: string,
  done: boolean,
  now = nowISO(),
): Mutation {
  const id = progressId(characterId, instanceId);
  const rec = find(s, 'progress', id);
  const list = rec?.questsDone ?? [];
  const questsDone = done ? [...new Set([...list, questId])] : list.filter((q) => q !== questId);
  const row: InstanceProgress = {
    status: 'not-run',
    wingsCleared: [],
    bossesKilled: [],
    timesRun: 0,
    ...rec,
    id,
    characterId,
    instanceId,
    questsDone,
    source: 'manual',
    updatedAt: now,
  };
  return { changes: [put('progress', row)], value: undefined };
}

// ---------- Plans ----------

export type PlanInput = Omit<WarPlan, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'>;

/** Needs: PLAN_KINDS. */
export function createPlan(
  s: Snapshot,
  input: PlanInput,
  id = uid(),
  now = nowISO(),
): Mutation<{ id: string; completed: string[] }> {
  const m = withPlanSync(s, [put('plans', { ...input, id, status: 'active', createdAt: now, updatedAt: now })], now);
  return { changes: m.changes, value: { id, completed: m.value } };
}

/** Needs: PLAN_KINDS. */
export function updatePlan(s: Snapshot, id: string, patch: Partial<WarPlan>, now = nowISO()): Mutation<string[]> {
  const p = find(s, 'plans', id);
  return withPlanSync(s, p ? [put('plans', { ...p, ...patch, updatedAt: now })] : [], now);
}

/** Needs: plans. */
export function setPlanStatus(s: Snapshot, id: string, status: WarPlan['status'], now = nowISO()): Mutation {
  const p = find(s, 'plans', id);
  if (!p) return { changes: [], value: undefined };
  const row: WarPlan = {
    ...p,
    status,
    completedAt: status === 'done' ? now : undefined,
    manualDone: status === 'done' ? true : undefined,
    updatedAt: now,
  };
  return { changes: [put('plans', row)], value: undefined };
}

/** Needs: plans, library. */
export function deletePlan(s: Snapshot, id: string): Mutation {
  const changes: Change[] = [
    ...rows(s, 'library')
      .filter((l) => l.planId === id)
      .map((l) => put('library', { ...l, planId: undefined })),
    del('plans', id),
  ];
  return { changes, value: undefined };
}

/**
 * Ticks or unticks an objective. Objectives linked to a wing or boss write
 * through to the owner's InstanceProgress (the main for warband plans).
 * Needs: PLAN_KINDS.
 */
export function toggleObjective(
  s: Snapshot,
  plan: WarPlan,
  objective: Objective,
  done: boolean,
  now = nowISO(),
  today = todayISO(),
): Mutation<string[]> {
  if (!objective.link || !plan.target.instanceId) {
    const current = find(s, 'plans', plan.id);
    if (!current) return withPlanSync(s, [], now);
    const objectives = plan.objectives.map((o) =>
      o.id === objective.id ? { ...o, done, doneAt: done ? today : undefined } : o,
    );
    return withPlanSync(s, [put('plans', { ...current, objectives, updatedAt: now })], now);
  }
  let charId = plan.ownerId;
  if (charId === ACCOUNT) {
    const main = rows(s, 'characters').find((c) => c.isMain && c.status === 'active');
    if (!main) return { changes: [], value: [] };
    charId = main.id;
  }
  const inst = find(s, 'instances', plan.target.instanceId);
  if (!inst) return { changes: [], value: [] };
  const rec = find(s, 'progress', progressId(charId, inst.id));
  const base: ProgressInput = rec ?? { status: 'not-run', wingsCleared: [], bossesKilled: [], timesRun: 0 };
  const toggle = (list: string[], v: string) => (done ? [...new Set([...list, v])] : list.filter((x) => x !== v));
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
  return setInstanceProgress(
    s,
    charId,
    inst.id,
    {
      ...base,
      wingsCleared: wings,
      bossesKilled: bosses,
      status,
      timesRun: Math.max(base.timesRun, status === 'not-run' ? 0 : 1),
    },
    now,
    today,
  );
}

// ---------- Instances ----------

export type InstanceInput = Omit<Instance, 'id' | 'source' | 'updatedAt'>;

/** Needs: instances. */
export function addInstance(s: Snapshot, input: InstanceInput, now = nowISO()): Mutation<string> {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'instance';
  const id = find(s, 'instances', slug) ? `${slug}-${uid().slice(0, 6)}` : slug;
  return { changes: [put('instances', { ...input, id, source: 'manual', updatedAt: now })], value: id };
}

/** Needs: instances. */
export function updateInstance(s: Snapshot, id: string, patch: Partial<Instance>, now = nowISO()): Mutation {
  const i = find(s, 'instances', id);
  return { changes: i ? [put('instances', { ...i, ...patch, updatedAt: now })] : [], value: undefined };
}

/** Needs: instances, progress, library. */
export function deleteInstance(s: Snapshot, id: string): Mutation {
  const changes: Change[] = [
    ...rows(s, 'progress').filter((p) => p.instanceId === id).map((p) => del('progress', p.id)),
    ...rows(s, 'library')
      .filter((l) => l.instanceId === id)
      .map((l) => put('library', { ...l, instanceId: undefined })),
    del('instances', id),
  ];
  return { changes, value: undefined };
}

// ---------- Journal ----------

export type EntryInput = Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>;

/** Needs: journal. */
export function saveEntry(s: Snapshot, id: string | undefined, input: EntryInput, now = nowISO()): Mutation<string> {
  const existing = id ? find(s, 'journal', id) : undefined;
  if (existing) return { changes: [put('journal', { ...existing, ...input, updatedAt: now })], value: existing.id };
  const newId = id ?? uid();
  return { changes: [put('journal', { ...input, id: newId, createdAt: now, updatedAt: now })], value: newId };
}

/** Deletes an entry and its screenshots. Needs: journal. */
export function deleteEntry(s: Snapshot, id: string): Mutation {
  const e = find(s, 'journal', id);
  return { changes: [...(e?.imageIds ?? []).map((i) => del('images', i)), del('journal', id)], value: undefined };
}

/** Screenshot records for files that were just uploaded. */
export function addImages(images: ImageRecord[]): Mutation<string[]> {
  return { changes: images.map((i) => put('images', i)), value: images.map((i) => i.id) };
}

/** Deletes screenshots that no journal entry points at any more. Needs: journal, images. */
export function removeOrphanImages(s: Snapshot): Mutation<string[]> {
  const used = new Set(rows(s, 'journal').flatMap((e) => e.imageIds));
  const orphans = rows(s, 'images')
    .map((i) => i.id)
    .filter((id) => !used.has(id));
  return { changes: orphans.map((id) => del('images', id)), value: orphans };
}

/** A one-line moment from the glance view, kept as a draft to finish later. Needs: journal. */
export function logMoment(s: Snapshot, text: string, character?: Character, today = todayISO()): Mutation<string> {
  return saveEntry(s, undefined, {
    date: today,
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

/** Needs: library. */
export function saveLibraryItem(s: Snapshot, id: string | undefined, input: LibraryInput, now = nowISO()): Mutation<string> {
  if (id) {
    const l = find(s, 'library', id);
    return { changes: l ? [put('library', { ...l, ...input, updatedAt: now })] : [], value: id };
  }
  const newId = uid();
  return { changes: [put('library', { ...input, id: newId, createdAt: now, updatedAt: now })], value: newId };
}

/** Needs: library. */
export function togglePin(s: Snapshot, item: LibraryItem, now = nowISO()): Mutation {
  const l = find(s, 'library', item.id);
  return { changes: l ? [put('library', { ...l, pinned: !item.pinned, updatedAt: now })] : [], value: undefined };
}

// ---------- Events ----------

export type EventInput = Pick<GameEvent, 'title' | 'date' | 'detail'> &
  Partial<Pick<GameEvent, 'dateLabel' | 'approxDate'>>;

/** Needs: events. */
export function saveEvent(
  s: Snapshot,
  id: string | undefined,
  input: EventInput,
  now = nowISO(),
  today = todayISO(),
): Mutation<string> {
  const approxDate = input.date ?? input.approxDate ?? today;
  if (id) {
    const e = find(s, 'events', id);
    return { changes: e ? [put('events', { ...e, ...input, approxDate, updatedAt: now })] : [], value: id };
  }
  const newId = uid();
  const row: GameEvent = {
    ...input,
    approxDate,
    id: newId,
    kind: 'personal',
    instanceIds: [],
    source: 'manual',
    updatedAt: now,
  };
  return { changes: [put('events', row)], value: newId };
}

// ---------- Tonight ----------

export function addTonightTask(text: string, now = nowISO(), today = todayISO()): Mutation {
  const t = text.trim();
  if (!t) return { changes: [], value: undefined };
  return {
    changes: [put('tonight', { id: uid(), text: t, done: false, date: today, createdAt: now })],
    value: undefined,
  };
}

/** Needs: tonight. */
export function toggleTonightTask(s: Snapshot, task: TonightTask, today = todayISO()): Mutation {
  const t = find(s, 'tonight', task.id);
  if (!t) return { changes: [], value: undefined };
  return {
    changes: [put('tonight', { ...t, done: !task.done, doneOn: task.done ? undefined : today })],
    value: undefined,
  };
}

/** Open tasks from any night, plus tasks ticked today. Older ticked tasks drop off. */
export function visibleTonight(tasks: TonightTask[], today = todayISO()): TonightTask[] {
  return tasks
    .filter((t) => !t.done || t.doneOn === today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- Simple deletes ----------

export const remove = (kind: Kind, id: string): Mutation => ({ changes: [del(kind, id)], value: undefined });
