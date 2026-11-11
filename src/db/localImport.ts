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
      tables[k] = k === 'meta' ? (await db.meta.toArray()).filter((r) => r.key !== DONE_KEY && r.key !== 'seedVersion') : await db.table(k).toArray();
    }
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
