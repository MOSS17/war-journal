import { db, ensureSeed } from './db';
import type { StoredImage } from '../lib/types';

export const BACKUP_FORMAT = 'horde-war-journal';
export const BACKUP_VERSION = 1;

const TABLES = [
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
] as const;

type TableName = (typeof TABLES)[number];

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
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
  const tables = {} as Backup['tables'];
  for (const t of TABLES) tables[t] = await db.table(t).toArray();
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

/** Replaces everything in the database with the backup's contents. */
export async function importAll(backup: Backup): Promise<void> {
  const images: StoredImage[] = (backup.images ?? []).map((i) => ({
    id: i.id,
    type: i.type,
    createdAt: i.createdAt,
    blob: dataUrlToBlob(i.dataUrl),
  }));
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
    for (const t of TABLES) {
      const rows = backup.tables[t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkAdd(rows);
    }
    if (images.length) await db.images.bulkAdd(images);
  });
  await ensureSeed();
}

/** Wipes everything and restores the seed instances and events. */
export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  await ensureSeed();
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
