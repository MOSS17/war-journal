// Screenshots in Supabase Storage. Each one is a file at
// screenshots/<user id>/<image id> plus an `images` record. The app shows
// them through short-lived signed URLs. Screenshots that older versions of
// the app kept in the browser are uploaded once, and shown from the browser
// until then.
import { useQuery } from '@tanstack/react-query';
import { db } from './db';
import { currentUserId, ensureUser, SaveError, sessionReady, supabase, useUserId } from './supabase';
import { fetchRecords } from './store';
import type { ImageRecord } from '../lib/types';
import { nowISO, uid } from '../lib/logic';

export const BUCKET = 'screenshots';
/** Longest side after resizing, in pixels. */
export const MAX_SIDE = 1920;
/** The bucket's per-file limit. */
export const MAX_BYTES = 5 * 1024 * 1024;
const STORED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const imagePath = (userId: string, id: string) => `${userId}/${id}`;

/**
 * Shrinks a screenshot to at most 1920 px on its long side and re-encodes it
 * as WebP (JPEG where the browser can't write WebP). Keeps the original when
 * that is already small enough and smaller. Outside a browser it returns the
 * file unchanged.
 */
export async function prepareImage(file: Blob): Promise<{ blob: Blob; width?: number; height?: number }> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return { blob: file };
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  let blob = await encode('image/webp', 0.8);
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.85);
  if (!blob) return { blob: file, width, height };
  const keepOriginal = scale === 1 && STORED_TYPES.includes(file.type) && file.size <= blob.size && file.size <= MAX_BYTES;
  return { blob: keepOriginal ? file : blob, width, height };
}

/** Resizes and uploads one screenshot. Returns its record; the caller saves it. */
export async function uploadImage(file: Blob, id = uid(), createdAt = nowISO()): Promise<ImageRecord> {
  const userId = await ensureUser();
  const { blob, width, height } = await prepareImage(file);
  if (blob.size > MAX_BYTES) throw new SaveError('That screenshot is over 5 MB even after resizing. Try a smaller one.');
  const type = blob.type || 'image/png';
  const { error } = await supabase.storage.from(BUCKET).upload(imagePath(userId, id), blob, { contentType: type, upsert: true });
  if (error) throw new SaveError('Couldn’t upload that screenshot. Check your connection and try again.', error);
  return { id, type, createdAt, width, height, bytes: blob.size };
}

/** Every file in a player's screenshot folder. */
export async function listImageFiles(userId: string): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000, offset });
    if (error) throw error;
    names.push(...data.map((f) => f.name));
    if (data.length < 1000) return names;
  }
}

/** Deletes screenshot files from Storage and any copy left in this browser. */
export async function removeImageFiles(userId: string | null | undefined, ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (userId) {
    for (let i = 0; i < ids.length; i += 1000) {
      await supabase.storage.from(BUCKET).remove(ids.slice(i, i + 1000).map((id) => imagePath(userId, id)));
    }
  }
  await db.images.bulkDelete(ids);
}

/** A screenshot's file, from Storage or, until it's uploaded, from this browser. */
export async function downloadImage(userId: string | null, id: string): Promise<Blob | null> {
  if (userId) {
    const { data } = await supabase.storage.from(BUCKET).download(imagePath(userId, id));
    if (data) return data;
  }
  return (await db.images.get(id))?.blob ?? null;
}

/** A URL to show a screenshot: a signed Storage URL, or this browser's copy until it's uploaded. */
export function useImageUrl(id: string | undefined): string | undefined {
  const userId = useUserId();
  const q = useQuery({
    queryKey: ['image-url', userId ?? null, id],
    enabled: !!id && userId !== undefined,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async () => {
      if (userId) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(imagePath(userId, id!), 60 * 60);
        if (data?.signedUrl) return data.signedUrl;
      }
      const local = await db.images.get(id!);
      return local ? URL.createObjectURL(local.blob) : null;
    },
  });
  return q.data ?? undefined;
}

/**
 * Uploads screenshots this browser kept from before they moved to Storage:
 * the ones the player's journal points at and the account doesn't have yet.
 * Returns the records to save. The browser's copies stay until replaced.
 */
export async function localScreenshotsToUpload(): Promise<ImageRecord[]> {
  await sessionReady;
  const userId = currentUserId();
  if (!userId || (await db.images.count()) === 0) return [];
  const records = await fetchRecords(userId);
  const used = new Set(records.filter((r) => r.kind === 'journal').flatMap((r) => (r.data as { imageIds?: string[] }).imageIds ?? []));
  const have = new Set(records.filter((r) => r.kind === 'images').map((r) => r.id));
  const out: ImageRecord[] = [];
  for (const img of await db.images.toArray()) {
    if (!used.has(img.id) || have.has(img.id)) continue;
    out.push(await uploadImage(img.blob, img.id, img.createdAt));
  }
  return out;
}
