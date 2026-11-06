import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Character } from '../lib/types';
import type { PlanContext } from '../lib/logic';

export function sortCharacters(list: Character[]): Character[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    return b.level - a.level || a.firstName.localeCompare(b.firstName);
  });
}

export function useCharacters(): Character[] | undefined {
  return useLiveQuery(async () => sortCharacters(await db.characters.toArray()), []);
}

export function useMain(): Character | null | undefined {
  return useLiveQuery(async () => {
    const all = await db.characters.toArray();
    return all.find((c) => c.isMain && c.status === 'active') ?? sortCharacters(all).find((c) => c.status === 'active') ?? null;
  }, []);
}

export function usePlanContext(): PlanContext | undefined {
  return useLiveQuery(async () => {
    const [characters, professions, progress, instances] = await Promise.all([
      db.characters.toArray(),
      db.professions.toArray(),
      db.progress.toArray(),
      db.instances.toArray(),
    ]);
    return { characters: sortCharacters(characters), professions, progress, instances };
  }, []);
}

export function useInstances() {
  return useLiveQuery(async () => {
    const all = await db.instances.toArray();
    return all.sort((a, b) =>
      a.kind !== b.kind ? (a.kind === 'dungeon' ? -1 : 1) : a.levelMin - b.levelMin || a.levelMax - b.levelMax || a.name.localeCompare(b.name),
    );
  }, []);
}

export function usePlans() {
  return useLiveQuery(() => db.plans.toArray(), []);
}

export function useJournal() {
  return useLiveQuery(async () => {
    const all = await db.journal.toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, []);
}

export function useLibrary() {
  return useLiveQuery(async () => (await db.library.toArray()).sort((a, b) => a.title.localeCompare(b.title)), []);
}

export function useEvents() {
  return useLiveQuery(async () => (await db.events.toArray()).sort((a, b) => a.approxDate.localeCompare(b.approxDate)), []);
}

export function useTonight() {
  return useLiveQuery(() => db.tonight.toArray(), []);
}
