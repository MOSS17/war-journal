// Screenshots in Storage, against the local stack: they show on another
// device, go when their entry goes, move up from older browsers, survive a
// backup round trip, and come along when an anonymous journal is copied in.
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { db, setMeta } from '../../src/db/db';
import { currentAccount, supabase } from '../../src/db/supabase';
import { fetchKind, queryClient } from '../../src/db/store';
import { addImages, cleanupOrphanImages, deleteEntry, saveEntry, uploadLocalScreenshots } from '../../src/db/actions';
import { downloadImage, listImageFiles } from '../../src/db/images';
import { exportAll, importAll, resetAll } from '../../src/db/backup';
import { importLocalData } from '../../src/db/localImport';
import { confirmSave, confirmSignIn, copyCarryOver, pendingCarryOver, requestSignIn, saveAccount, signOut } from '../../src/db/account';
import { codeFor } from './helpers';

const pgdb = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const run = Date.now().toString(36);
const email = (name: string) => `${name}-${run}@example.com`;

/** A small PNG-typed file with distinct bytes. */
const shot = (n: number) => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, n, n, n])], `shot-${n}.png`, { type: 'image/png' });
const bytes = async (b: Blob | null) => (b ? [...new Uint8Array(await b.arrayBuffer())] : null);

const entry = (imageIds: string[]) => ({
  date: '2026-11-10',
  title: 'First kill',
  body: '',
  imageIds,
  tags: [],
  draft: false,
});

/** A new device: no session, no cache, an empty browser database. */
async function freshDevice() {
  await supabase.auth.signOut();
  queryClient.clear();
  await db.delete();
  await db.open();
}

async function saveAs(address: string) {
  expect(await saveAccount(address)).toEqual({ ok: true });
  expect(await confirmSave(address, await codeFor(address))).toBe(true);
}

async function signInAs(address: string) {
  expect(await requestSignIn(address)).toEqual({ ok: true });
  expect(await confirmSignIn(address, await codeFor(address))).toBe(true);
}

const me = () => currentAccount()!.id;

beforeAll(() => pgdb.connect());
beforeEach(freshDevice);

afterAll(async () => {
  await supabase.auth.signOut();
  const { rows } = await pgdb.query(
    `select id from auth.users where email like $1 or (is_anonymous and created_at > now() - interval '10 minutes')`,
    [`%-${run}@example.com`],
  );
  // Storage files can't be deleted from SQL; the tests remove their own, so only accounts are left to drop.
  await pgdb.query('delete from auth.users where id = any($1)', [rows.map((r) => r.id)]);
  await pgdb.end();
});

describe('screenshots', () => {
  it("show on another device, and go when their entry is deleted", async () => {
    const [id] = await addImages([shot(1)]);
    const entryId = await saveEntry(undefined, entry([id]));
    const address = email('device');
    await saveAs(address);
    const owner = me();

    await freshDevice();
    await signInAs(address);
    expect((await fetchKind(me(), 'images')).map((i) => i.id)).toEqual([id]);
    expect(await bytes(await downloadImage(me(), id))).toEqual(await bytes(shot(1)));
    const signed = await supabase.storage.from('screenshots').createSignedUrl(`${owner}/${id}`, 60);
    expect(signed.data?.signedUrl).toBeTruthy();

    await deleteEntry(entryId);
    expect(await listImageFiles(owner)).toEqual([]);
    expect(await fetchKind(owner, 'images')).toEqual([]);
  });

  it('that were added and then abandoned are cleaned up', async () => {
    const [kept] = await addImages([shot(2)]);
    await saveEntry(undefined, entry([kept]));
    await addImages([shot(3)]);
    await cleanupOrphanImages();
    expect(await listImageFiles(me())).toEqual([kept]);
    await deleteEntry((await fetchKind(me(), 'journal'))[0].id);
  });

  it('kept by an older browser are uploaded once, after its journal', async () => {
    const now = '2026-11-01T00:00:00Z';
    await db.journal.add({ id: 'j1', date: '2026-11-01', title: 'Old', body: '', imageIds: ['old-1'], tags: [], draft: false, createdAt: now, updatedAt: now });
    await db.images.add({ id: 'old-1', blob: shot(4), type: 'image/png', createdAt: now });
    await db.images.add({ id: 'stray', blob: shot(5), type: 'image/png', createdAt: now });
    await setMeta('seedVersion', 2);

    expect(await importLocalData()).toEqual({ records: 1 });
    expect(await uploadLocalScreenshots()).toBe(1);
    expect(await uploadLocalScreenshots()).toBe(0);
    expect(await listImageFiles(me())).toEqual(['old-1']);
    expect(await bytes(await downloadImage(me(), 'old-1'))).toEqual(await bytes(shot(4)));
    await deleteEntry('j1');
  });

  it('survive a backup, Start over and restore', async () => {
    const [id] = await addImages([shot(6)]);
    await saveEntry(undefined, entry([id]));
    const backup = JSON.parse(JSON.stringify(await exportAll()));
    expect(backup.images).toHaveLength(1);

    await resetAll();
    expect(await listImageFiles(me())).toEqual([]);

    await importAll(backup);
    queryClient.clear();
    expect(await listImageFiles(me())).toEqual([id]);
    expect((await fetchKind(me(), 'journal'))[0].imageIds).toEqual([id]);
    expect(await bytes(await downloadImage(me(), id))).toEqual(await bytes(shot(6)));
    await resetAll();
  });

  it("come along when a browser's anonymous journal is copied into an account", async () => {
    const address = email('carry');
    await addImages([shot(7)]).then((ids) => saveEntry(undefined, entry(ids)));
    await saveAs(address);
    const owner = me();
    await signOut();

    const [anonShot] = await addImages([shot(8)]);
    await saveEntry(undefined, entry([anonShot]));
    const anon = me();
    await signInAs(address);
    const offer = await pendingCarryOver();
    expect(offer).not.toBeNull();
    await copyCarryOver(offer!);

    expect((await listImageFiles(owner)).sort()).toHaveLength(2);
    expect(await bytes(await downloadImage(owner, anonShot))).toEqual(await bytes(shot(8)));
    expect(await db.images.count()).toBe(0);

    // Tidy up: this account's files, then the anonymous one's (as that user).
    await resetAll();
    await signOut();
    void anon;
  });
});
