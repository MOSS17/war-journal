// Moves a journal kept by the browser-only version of the app up to the
// player's account, once. It runs when the browser's old database has player
// data and the account has none. The local copy is left in place, and
// screenshots stay in the browser until they move to file storage.
import { db, getMeta, SEED_VERSION, setMeta } from './db';
import { recordsFromTables } from './backup';
import { RECORD_KINDS, replaceAll, type RecordKind } from './store';
import { ensureUser, supabase } from './supabase';

const DONE_KEY = 'cloudImport';
const PLAYER_KINDS: RecordKind[] = ['characters', 'professions', 'progress', 'plans', 'journal', 'library', 'tonight'];

export interface ImportResult {
  /** Records copied up. */
  records: number;
}

/** Holds a lock so two windows of the app (say, the Glance view) never import at once. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? (locks.request('war-journal-local-import', fn) as Promise<T>) : fn();
}

/** Copies the old local journal up if there is one and the account is empty. Null when there was nothing to do. */
export function importLocalData(): Promise<ImportResult | null> {
  return exclusive(async () => {
    if (await getMeta(DONE_KEY, null)) return null;
    const counts = await Promise.all(PLAYER_KINDS.map((k) => db.table(k).count()));
    if (counts.every((n) => n === 0)) {
      await setMeta(DONE_KEY, { at: new Date().toISOString(), records: 0 });
      return null;
    }

    const uid = await ensureUser();
    const { count, error } = await supabase.from('records').select('id', { count: 'exact', head: true }).eq('user_id', uid);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      // The account already has a journal; leave it alone.
      await setMeta(DONE_KEY, { at: new Date().toISOString(), records: 0, skipped: 'account not empty' });
      return null;
    }

    const tables: Partial<Record<RecordKind, unknown[]>> = {};
    for (const k of RECORD_KINDS) {
      // Screenshots are uploaded separately (uploadLocalScreenshots), once their journal is up.
      if (k === 'images') continue;
      tables[k] = k === 'meta' ? (await db.meta.toArray()).filter((r) => r.key !== DONE_KEY && r.key !== 'seedVersion') : await db.table(k).toArray();
    }
    // An empty seeded table was never seeded, rather than cleared by the player: leave the catalog alone.
    for (const k of ['instances', 'events'] as const) if (!tables[k]?.length) delete tables[k];
    // An up-to-date local database had every seeded row, so a missing one was removed by the player.
    const seedVersion = await getMeta<number>('seedVersion', 0);
    const rows = await recordsFromTables(tables, { hideMissing: seedVersion >= SEED_VERSION });
    await replaceAll(rows);

    const check = await supabase.from('records').select('id', { count: 'exact', head: true }).eq('user_id', uid);
    if (check.error) throw check.error;
    if (check.count !== rows.length) throw new Error(`Moved ${check.count} of ${rows.length} records.`);

    await supabase.from('profiles').update({ migrated_from_local: true }).eq('user_id', uid);
    await setMeta(DONE_KEY, { at: new Date().toISOString(), records: rows.length, userId: uid });
    return { records: rows.length };
  });
}

// ---------- The old local copy ----------

export interface LocalCopy {
  characters: number;
  journal: number;
  screenshots: number;
}

/** What the browser still keeps from before its journal moved online, or null when there's nothing to offer deleting. */
export async function localCopy(): Promise<LocalCopy | null> {
  const done = await getMeta<{ records?: number } | null>(DONE_KEY, null);
  // Only once the copy has really been moved up; a skipped import keeps its data.
  if (!done?.records) return null;
  // A pending copy-or-leave offer keeps its screenshots here too; wait until it's answered.
  if (await getMeta('carryOver', null)) return null;
  const [characters, journal, screenshots, other] = await Promise.all([
    db.characters.count(),
    db.journal.count(),
    db.images.count(),
    Promise.all(PLAYER_KINDS.map((k) => db.table(k).count())).then((n) => n.reduce((a, b) => a + b, 0)),
  ]);
  return characters + journal + screenshots + other > 0 ? { characters, journal, screenshots } : null;
}

/**
 * Deletes the browser's old copy. Screenshots its journal points at are
 * uploaded first if they haven't been. Remembers that the move was done, so
 * nothing is imported again.
 */
export async function deleteLocalCopy(): Promise<void> {
  const { uploadLocalScreenshots } = await import('./actions');
  await uploadLocalScreenshots();
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) if (t.name !== 'meta') await t.clear();
    await db.meta.where('key').noneOf([DONE_KEY, 'carryOver']).delete();
  });
}
