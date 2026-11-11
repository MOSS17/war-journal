// Every read the screens make. Each hook builds on `useKind` (src/db/store.ts),
// which loads one whole kind of row from Supabase; the rest is filtering and
// sorting in memory (the data set is small).
import { useMemo } from 'react';
import { useKind, type RecordKind } from './store';
import type { Character, Profession } from '../lib/types';
import { LIBRARY_CATEGORIES } from '../lib/gamedata';
import type { PlanContext } from '../lib/logic';
import { progressId, type RowOf } from '../lib/mutations';

/** One row by id, or undefined while loading or when it doesn't exist. */
function useRow<K extends RecordKind>(kind: K, id: string | undefined): RowOf[K] | undefined {
  const all = useKind(kind);
  return useMemo(() => (id ? all?.find((r) => (r as { id: string }).id === id) : undefined), [all, id]);
}

function useSorted<T>(list: T[] | undefined, compare: (a: T, b: T) => number): T[] | undefined {
  return useMemo(() => (list ? [...list].sort(compare) : undefined), [list]);
}

// ---------- Characters ----------

export function sortCharacters(list: Character[]): Character[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    return b.level - a.level || a.firstName.localeCompare(b.firstName);
  });
}

export function useCharacters(): Character[] | undefined {
  const all = useKind('characters');
  return useMemo(() => all && sortCharacters(all), [all]);
}

export const useCharacter = (id: string | undefined) => useRow('characters', id);

/** The main character, falling back to the highest active one; null when there are none. */
export function useMain(): Character | null | undefined {
  const all = useCharacters();
  return useMemo(
    () => all && (all.find((c) => c.isMain && c.status === 'active') ?? all.find((c) => c.status === 'active') ?? null),
    [all],
  );
}

/** A character's professions, sorted by `compare`. */
export function useProfessions(
  characterId: string | undefined,
  compare?: (a: Profession, b: Profession) => number,
): Profession[] | undefined {
  const all = useKind('professions');
  return useMemo(() => {
    const mine = all?.filter((p) => p.characterId === characterId);
    return mine && compare ? mine.sort(compare) : mine;
  }, [all, characterId]);
}

export function usePlanContext(): PlanContext | undefined {
  const characters = useCharacters();
  const professions = useKind('professions');
  const progress = useKind('progress');
  const instances = useKind('instances');
  return useMemo(
    () =>
      characters && professions && progress && instances ? { characters, professions, progress, instances } : undefined,
    [characters, professions, progress, instances],
  );
}

/** One character's progress row for an instance, tagged with the character so a stale result is never used. */
export function useInstanceProgress(characterId: string | undefined, instanceId: string) {
  const all = useKind('progress');
  return useMemo(
    () =>
      all && characterId
        ? { charId: characterId, rec: all.find((p) => p.id === progressId(characterId, instanceId)) }
        : undefined,
    [all, characterId, instanceId],
  );
}

// ---------- Instances ----------

export function useInstances() {
  return useSorted(useKind('instances'), (a, b) =>
    a.kind !== b.kind
      ? a.kind === 'dungeon'
        ? -1
        : 1
      : a.levelMin - b.levelMin || a.levelMax - b.levelMax || a.name.localeCompare(b.name),
  );
}

export const useInstance = (id: string | undefined) => useRow('instances', id);

// ---------- Plans ----------

export const usePlans = () => useKind('plans');
export const usePlan = (id: string | undefined) => useRow('plans', id);

export function useActivePlans() {
  const all = useKind('plans');
  return useMemo(() => all?.filter((p) => p.status === 'active'), [all]);
}

// ---------- Journal ----------

export function useJournal() {
  return useSorted(useKind('journal'), (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export const useEntry = (id: string | undefined) => useRow('journal', id);

// ---------- Library ----------

export function useLibrary() {
  return useSorted(useKind('library'), (a, b) => a.title.localeCompare(b.title));
}

export const useLibraryItem = (id: string | undefined) => useRow('library', id);

/** The built-in categories plus any the player has made up. */
export function useLibraryCategories(): string[] | undefined {
  const all = useKind('library');
  return useMemo(() => all && [...new Set([...LIBRARY_CATEGORIES, ...all.map((l) => l.category)])], [all]);
}

// ---------- Events, tonight, settings ----------

export function useEvents() {
  return useSorted(useKind('events'), (a, b) => a.approxDate.localeCompare(b.approxDate));
}

export const useEvent = (id: string | undefined) => useRow('events', id);
export const useTonight = () => useKind('tonight');

/** A stored setting, `fallback` when unset, or undefined while loading. */
export function useMeta<T>(key: string, fallback: T): T | undefined {
  const all = useKind('meta');
  return useMemo(() => {
    if (!all) return undefined;
    const row = all.find((r) => r.key === key);
    return row ? (row.value as T) : fallback;
  }, [all, key]);
}

/** How much the player has stored, for the Backup & data screen. */
export function useCounts() {
  const characters = useKind('characters');
  const plans = useKind('plans');
  const journal = useKind('journal');
  const library = useKind('library');
  const images = useKind('images');
  return characters && plans && journal && library && images
    ? { characters: characters.length, plans: plans.length, journal: journal.length, images: images.length, library: library.length }
    : undefined;
}

// ---------- Screenshots ----------

export { useImageUrl } from './images';
