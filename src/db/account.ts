// Saving an account and signing in, by email only: a magic link or the 6-digit
// code from the same email. Saving keeps the same user id, so nothing moves.
// Signing in to an existing account from a browser that has an anonymous
// journal offers to copy that journal across (the account's rows win).
import type { AuthError } from '@supabase/supabase-js';
import { db, getMeta, setMeta } from './db';
import { currentAccount, sessionReady, supabase } from './supabase';
import { fetchEventCatalog, fetchInstanceCatalog, fetchRecords, queryClient, type RecordKind, type StoredRecord } from './store';
import { BACKUP_FORMAT, BACKUP_VERSION, blobToDataUrl, type Backup } from './backup';
import { downloadImage, listImageFiles, removeImageFiles, uploadImage } from './images';
import { mergeEvents, mergeInstances, type Override } from '../lib/catalog';
import type { GameEvent, ImageRecord, Instance } from '../lib/types';

export type EmailResult =
  | { ok: true }
  | { ok: false; reason: 'exists' | 'no-account' | 'invalid' | 'rate' | 'other'; message: string };

const redirectTo = () => (typeof window === 'undefined' ? undefined : window.location.origin);

function explain(error: AuthError): EmailResult {
  const code = error.code ?? '';
  const msg = error.message ?? '';
  if (code === 'email_exists' || code === 'user_already_exists' || /already been registered/i.test(msg))
    return { ok: false, reason: 'exists', message: 'That email already has a War Journal account.' };
  if (code === 'otp_disabled' || code === 'signup_disabled' || /signups not allowed/i.test(msg))
    return { ok: false, reason: 'no-account', message: 'No War Journal account uses that email yet.' };
  if (code === 'email_address_invalid' || code === 'validation_failed')
    return { ok: false, reason: 'invalid', message: 'That doesn’t look like an email address.' };
  if (code.startsWith('over_') || error.status === 429)
    return { ok: false, reason: 'rate', message: 'Too many emails for now. Wait a minute and try again.' };
  return { ok: false, reason: 'other', message: 'Couldn’t send the email. Check your connection and try again.' };
}

// ---------- Saving an anonymous account ----------

/** Emails a link and code that attach this email to the current anonymous account. */
export async function saveAccount(email: string): Promise<EmailResult> {
  const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirectTo() });
  return error ? explain(error) : { ok: true };
}

/** Confirms the save with the code from the email. */
export async function confirmSave(email: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email_change' });
  if (error) return false;
  await supabase.auth.refreshSession();
  return true;
}

// ---------- Signing in ----------

/** Emails a sign-in link and code. Remembers this browser's anonymous journal first, to offer copying it. */
export async function requestSignIn(email: string): Promise<EmailResult> {
  await stashAnonymousJournal();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo() },
  });
  return error ? explain(error) : { ok: true };
}

/** Signs in with the code from the email. */
export async function confirmSignIn(email: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) return false;
  queryClient.clear();
  return true;
}

/** Signs a saved account out of this browser; the next visit starts as a visitor. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  queryClient.clear();
}

/** Deletes the account, its records, profile and screenshots, and signs this browser out. */
export async function deleteAccount(): Promise<void> {
  await sessionReady;
  const me = currentAccount();
  if (!me) return;
  await removeImageFiles(me.id, await listImageFiles(me.id));
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error('Couldn’t delete your account. Check your connection and try again.');
  await supabase.auth.signOut({ scope: 'local' });
  await db.images.clear();
  await setMeta(CARRY_KEY, null);
  queryClient.clear();
}

// ---------- Copying an anonymous journal into an account ----------

const CARRY_KEY = 'carryOver';

export interface CarryOver {
  fromUserId: string;
  at: string;
  records: StoredRecord[];
}

async function stashAnonymousJournal(): Promise<void> {
  await sessionReady;
  const me = currentAccount();
  if (!me?.anonymous) return;
  const records = await fetchRecords(me.id);
  // Signing in loses access to this account's files, so keep its screenshots in the browser until the choice is made.
  for (const r of records.filter((x) => x.kind === 'images')) {
    const img = r.data as ImageRecord;
    const blob = await downloadImage(me.id, img.id);
    if (blob) await db.images.put({ id: img.id, blob, type: img.type, createdAt: img.createdAt });
  }
  await setMeta(CARRY_KEY, records.length ? ({ fromUserId: me.id, at: new Date().toISOString(), records } satisfies CarryOver) : null);
}

/** The anonymous journal left behind by signing in, if there is one to offer. */
export async function pendingCarryOver(): Promise<CarryOver | null> {
  await sessionReady;
  const me = currentAccount();
  const stash = await getMeta<CarryOver | null>(CARRY_KEY, null);
  if (!stash || !me || me.anonymous || me.id === stash.fromUserId) return null;
  return stash;
}

export function carryOverSummary(c: CarryOver): string {
  const n = (kind: RecordKind) => c.records.filter((r) => r.kind === kind).length;
  const parts: [number, string, string][] = [
    [n('characters'), 'character', 'characters'],
    [n('plans'), 'war plan', 'war plans'],
    [n('journal'), 'journal entry', 'journal entries'],
    [n('library'), 'library item', 'library items'],
  ];
  const said = parts.filter(([k]) => k > 0).map(([k, one, many]) => `${k} ${k === 1 ? one : many}`);
  return said.length ? said.join(', ') : `${c.records.length} saved changes`;
}

/** Adds the left-behind journal to the signed-in account. Rows the account already has are kept as they are. */
export async function copyCarryOver(c: CarryOver): Promise<number> {
  const me = currentAccount();
  if (!me || me.anonymous) throw new Error('Sign in first.');
  const have = new Set((await fetchRecords(me.id)).map((r) => `${r.kind}/${r.id}`));
  const missing = c.records.filter((r) => !have.has(`${r.kind}/${r.id}`));
  // Screenshots go up under the account first, from the browser copies kept at sign-in.
  for (const r of missing.filter((x) => x.kind === 'images')) {
    const local = await db.images.get(r.id);
    if (local) r.data = await uploadImage(local.blob, r.id, local.createdAt);
  }
  for (let i = 0; i < missing.length; i += 1000) {
    const changes = missing.slice(i, i + 1000).map((r) => ({ op: 'put', kind: r.kind, id: r.id, row: r.data }));
    const { error } = await supabase.rpc('apply_changes', { changes });
    if (error) throw new Error('Couldn’t copy your journal. Check your connection and try again.');
  }
  await db.images.bulkDelete(c.records.filter((r) => r.kind === 'images').map((r) => r.id));
  await setMeta(CARRY_KEY, null);
  await queryClient.invalidateQueries({ queryKey: ['kind'] });
  return missing.length;
}

export async function dropCarryOver(): Promise<void> {
  const stash = await getMeta<CarryOver | null>(CARRY_KEY, null);
  if (stash) await db.images.bulkDelete(stash.records.filter((r) => r.kind === 'images').map((r) => r.id));
  await setMeta(CARRY_KEY, null);
}

/** The left-behind journal as a backup file, so the player can keep a copy before deciding. */
export async function carryOverBackup(c: CarryOver): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const r of c.records) if (r.kind !== 'images') (tables[r.kind] ??= []).push(r.data);
  tables.instances = mergeInstances(await fetchInstanceCatalog(), (tables.instances ?? []) as Override<Instance>[]);
  tables.events = mergeEvents(await fetchEventCatalog(), (tables.events ?? []) as Override<GameEvent>[]);
  const images: Backup['images'] = [];
  for (const r of c.records.filter((x) => x.kind === 'images')) {
    const local = await db.images.get(r.id);
    if (local) images.push({ id: r.id, type: local.type, createdAt: local.createdAt, dataUrl: await blobToDataUrl(local.blob) });
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: c.at, tables, images };
}
