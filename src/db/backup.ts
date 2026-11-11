// Backup files: everything the player has, as one JSON file, and restoring
// one in place of what's on the server now.
import { db } from './db';
import { currentUserId, sessionReady } from './supabase';
import {
  asRecords,
  fetchEventCatalog,
  fetchInstanceCatalog,
  fetchKind,
  queryClient,
  RECORD_KINDS,
  replaceAll,
  type RecordKind,
} from './store';
import type { GameEvent, Instance, StoredImage } from '../lib/types';
import {
  isUntouchedEvent,
  isUntouchedInstance,
  normalizeInstance,
  normalizeProgress,
  overridesFor,
} from '../lib/catalog';

export const BACKUP_FORMAT = 'horde-war-journal';
/**
 * 1: the browser-only app. Instances and events hold every row, and seeded
 *    rows missing from the file are restored.
 * 2: instances and events hold the list as the player sees it, so seeded rows
 *    missing from the file were removed by the player and stay hidden.
 */
export const BACKUP_VERSION = 2;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Partial<Record<RecordKind, unknown[]>>;
  images: { id: string; type: string; createdAt: string; dataUrl: string }[];
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(url: string): Blob {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error('Bad image data in backup');
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

export async function exportAll(): Promise<Backup> {
  await sessionReady;
  const uid = currentUserId() ?? null;
  const tables: Backup['tables'] = {};
  for (const k of RECORD_KINDS) tables[k] = await fetchKind(uid, k);
  const imgs = await db.images.toArray();
  const images = await Promise.all(
    imgs.map(async (i) => ({ id: i.id, type: i.type, createdAt: i.createdAt, dataUrl: await blobToDataUrl(i.blob) })),
  );
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables, images };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== 'object')
    throw new Error("That file isn't a War Journal backup.");
  if ((b.version ?? 0) > BACKUP_VERSION)
    throw new Error('That backup was made by a newer version of the War Journal.');
  return b as Backup;
}

/**
 * The records to store for full tables of rows (from a backup or the old local
 * database). Seeded instances and events the player never changed are left to
 * the catalog; with `hideMissing`, seeded rows absent from the tables are hidden.
 */
export async function recordsFromTables(tables: Backup['tables'], { hideMissing }: { hideMissing: boolean }) {
  const [instanceCatalog, eventCatalog] = await Promise.all([fetchInstanceCatalog(), fetchEventCatalog()]);
  const out: ReturnType<typeof asRecords>[number][] = [];
  for (const k of RECORD_KINDS) {
    let rows = tables[k];
    if (!Array.isArray(rows)) {
      // A table missing from the file is empty; for seeded kinds that means "nothing changed".
      if (k !== 'instances' && k !== 'events') continue;
      rows = hideMissing ? [] : k === 'instances' ? instanceCatalog : eventCatalog;
    }
    if (k === 'instances') {
      rows = overridesFor((rows as Instance[]).map((r) => normalizeInstance(r)), instanceCatalog, isUntouchedInstance, { hideMissing });
    } else if (k === 'events') {
      rows = overridesFor(rows as GameEvent[], eventCatalog, isUntouchedEvent, { hideMissing });
    } else if (k === 'progress') {
      rows = rows.map((r) => normalizeProgress(r as object));
    }
    out.push(...asRecords(k, rows));
  }
  return out;
}

/** Replaces everything on the server, and the screenshots in this browser, with the backup's contents. */
export async function importAll(backup: Backup): Promise<void> {
  const images: StoredImage[] = (backup.images ?? []).map((i) => ({
    id: i.id,
    type: i.type,
    createdAt: i.createdAt,
    blob: dataUrlToBlob(i.dataUrl),
  }));
  await replaceAll(await recordsFromTables(backup.tables, { hideMissing: (backup.version ?? 1) >= 2 }));
  await db.transaction('rw', db.images, async () => {
    await db.images.clear();
    if (images.length) await db.images.bulkAdd(images);
  });
}

/** Deletes everything the player has. The instance list and dates come back from the catalog. */
export async function resetAll(): Promise<void> {
  await sessionReady;
  if (currentUserId()) await replaceAll([]);
  await db.images.clear();
  await queryClient.invalidateQueries({ queryKey: ['kind'] });
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
