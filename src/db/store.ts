// Reads and writes player data in Supabase through a TanStack Query cache.
// Each kind of row is one query; writes update the cache straight away, send
// one `apply_changes` call, and roll back if it fails. Realtime refreshes the
// cache when another tab or device changes something.
import { useEffect } from 'react';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { db } from './db';
import { currentUserId, ensureUser, SaveError, sessionReady, supabase, useUserId } from './supabase';
import type { GameEvent, Instance } from '../lib/types';
import {
  catalogEvent,
  catalogInstance,
  isHidden,
  mergeEvents,
  mergeInstances,
  type Override,
} from '../lib/catalog';
import { applyToSnapshot, keyOf, type Change, type Kind, type RowOf, type Snapshot } from '../lib/mutations';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true },
  },
});

/** Kinds stored as player records. Screenshots stay in the browser for now. */
export type RecordKind = Exclude<Kind, 'images'>;
export const RECORD_KINDS: RecordKind[] = [
  'characters',
  'professions',
  'instances',
  'progress',
  'plans',
  'journal',
  'library',
  'events',
  'tonight',
  'meta',
];

const kindKey = (uid: string | null, kind: Kind) => ['kind', uid, kind] as const;

// ---------- Reads ----------

/** One record as stored. */
export interface StoredRecord {
  kind: RecordKind;
  id: string;
  data: unknown;
}

const PAGE = 1000;

/** All of the player's records of one kind (or every kind), a page at a time. */
export async function fetchRecords(uid: string, kind?: RecordKind): Promise<StoredRecord[]> {
  const out: StoredRecord[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('records').select('kind, id, data').eq('user_id', uid);
    if (kind) q = q.eq('kind', kind);
    const { data, error } = await q.order('kind').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as StoredRecord[]));
    if (data.length < PAGE) return out;
  }
}

async function fetchCatalog(table: 'instance_catalog' | 'event_catalog'): Promise<unknown[]> {
  const { data, error } = await supabase.from(table).select('data');
  if (error) throw error;
  return data.map((r) => r.data);
}

export const fetchInstanceCatalog = () =>
  queryClient.fetchQuery({
    queryKey: ['catalog', 'instances'],
    queryFn: async () => (await fetchCatalog('instance_catalog')).map((s) => catalogInstance(s as Parameters<typeof catalogInstance>[0])),
    staleTime: Infinity,
  });

export const fetchEventCatalog = () =>
  queryClient.fetchQuery({
    queryKey: ['catalog', 'events'],
    queryFn: async () => (await fetchCatalog('event_catalog')).map((s) => catalogEvent(s as Parameters<typeof catalogEvent>[0])),
    staleTime: Infinity,
  });

/** The rows the app shows for one kind: the player's records, with the catalogs merged in. */
export async function fetchKind<K extends RecordKind>(uid: string | null, kind: K): Promise<RowOf[K][]> {
  const mine = uid ? (await fetchRecords(uid, kind)).map((r) => r.data) : [];
  if (kind === 'instances') return mergeInstances(await fetchInstanceCatalog(), mine as Override<Instance>[]) as RowOf[K][];
  if (kind === 'events') return mergeEvents(await fetchEventCatalog(), mine as Override<GameEvent>[]) as RowOf[K][];
  return mine as RowOf[K][];
}

/** All rows of one kind for the current player, or undefined while loading. */
export function useKind<K extends RecordKind>(kind: K): RowOf[K][] | undefined {
  const uid = useUserId();
  const q = useQuery({
    queryKey: kindKey(uid ?? null, kind),
    queryFn: () => fetchKind(uid ?? null, kind),
    enabled: uid !== undefined,
  });
  return q.data;
}

/** The current rows of the given kinds, from the cache when it has them. */
export async function loadSnapshot(kinds: Kind[]): Promise<Snapshot> {
  await sessionReady;
  const uid = currentUserId() ?? null;
  const s: Snapshot = {};
  await Promise.all(
    kinds.map(async (k) => {
      if (k === 'images') throw new Error('Screenshots are not part of a snapshot');
      (s as Record<Kind, unknown>)[k] = await queryClient.ensureQueryData({
        queryKey: kindKey(uid, k),
        queryFn: () => fetchKind(uid, k),
      });
    }),
  );
  return s;
}

// ---------- Writes ----------

interface WireChange {
  op: 'put' | 'delete';
  kind: RecordKind;
  id: string;
  row?: unknown;
}

/** Drops undefined fields, as the stored JSON would. */
const plain = (row: unknown) => JSON.parse(JSON.stringify(row)) as unknown;

/** Deleting a seeded instance or event stores a marker that hides it; anything else maps straight across. */
async function toWire(c: Change & { kind: RecordKind }): Promise<WireChange> {
  if (c.op === 'put') return { op: 'put', kind: c.kind, id: keyOf(c.kind, c.row), row: plain(c.row) };
  if (c.kind === 'instances' || c.kind === 'events') {
    const catalog = c.kind === 'instances' ? await fetchInstanceCatalog() : await fetchEventCatalog();
    if (catalog.some((r) => r.id === c.id)) return { op: 'put', kind: c.kind, id: c.id, row: { id: c.id, hidden: true } };
  }
  return { op: 'delete', kind: c.kind, id: c.id };
}

/** Saves changes: screenshots to the browser, everything else to Supabase in one transaction. */
export async function commit(changes: Change[]): Promise<void> {
  const images = changes.filter((c) => c.kind === 'images');
  const records = changes.filter((c): c is Change & { kind: RecordKind } => c.kind !== 'images');

  if (records.length) {
    await sessionReady;
    const visitorUid = currentUserId() ?? null;
    const uid = await ensureUser();
    // A visitor's first save: carry the catalog rows they were looking at over to their new account.
    if (visitorUid === null) {
      for (const k of ['instances', 'events'] as const) {
        const before = queryClient.getQueryData(kindKey(null, k));
        if (before && !queryClient.getQueryData(kindKey(uid, k))) queryClient.setQueryData(kindKey(uid, k), before);
      }
    }
    const touched = [...new Set(records.map((c) => c.kind))];
    await Promise.all(touched.map((k) => queryClient.cancelQueries({ queryKey: kindKey(uid, k) })));
    const previous = new Map(touched.map((k) => [k, queryClient.getQueryData(kindKey(uid, k))]));
    for (const k of touched) {
      const cached = previous.get(k) as RowOf[typeof k][] | undefined;
      const next = applyToSnapshot({ [k]: cached ?? [] }, records)[k];
      queryClient.setQueryData(kindKey(uid, k), next);
    }

    const wire = await Promise.all(records.map(toWire));
    const { error } = await supabase.rpc('apply_changes', { changes: wire });
    if (error) {
      for (const [k, v] of previous) queryClient.setQueryData(kindKey(uid, k), v);
      throw new SaveError("Couldn't save. Check your connection and try again.", error);
    }
    for (const k of touched) void queryClient.invalidateQueries({ queryKey: kindKey(uid, k) });
  }

  const gone = images.filter((c) => c.op === 'delete').map((c) => (c as { id: string }).id);
  if (gone.length) await db.images.bulkDelete(gone);
}

/** Replaces all of the player's records in one transaction (restore, start over, moving local data up). */
export async function replaceAll(rows: { kind: RecordKind; id: string; row: unknown }[]): Promise<void> {
  const uid = await ensureUser();
  const { error } = await supabase.rpc('replace_records', {
    rows: rows.map((r) => ({ kind: r.kind, id: r.id, row: plain(r.row) })),
  });
  if (error) throw new SaveError("Couldn't save. Check your connection and try again.", error);
  await queryClient.invalidateQueries({ queryKey: ['kind', uid] });
}

/** Records for a whole kind, keyed for storage. Seeded markers ({ id, hidden }) are kept. */
export function asRecords<K extends RecordKind>(kind: K, rows: unknown[]) {
  return rows.map((row) => ({
    kind,
    id: isHidden(row as object) ? (row as { id: string }).id : keyOf(kind, row as RowOf[K]),
    row,
  }));
}

// ---------- Live updates ----------

/** Refreshes a kind when its records change in another tab or on another device. */
export function useLiveUpdates() {
  const uid = useUserId();
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`records:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${uid}` },
        (payload) => {
          const kind = ((payload.new as { kind?: string })?.kind ?? (payload.old as { kind?: string })?.kind) as Kind | undefined;
          void queryClient.invalidateQueries({ queryKey: kind ? kindKey(uid, kind) : ['kind', uid] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid]);
}
