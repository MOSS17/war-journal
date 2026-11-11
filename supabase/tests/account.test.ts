// Saving an account, signing in with the emailed code, copying an anonymous
// journal across, and deleting an account, against the local stack. Emails
// land in the local mail catcher (Mailpit), where the tests read the codes.
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { db } from '../../src/db/db';
import { currentAccount, supabase } from '../../src/db/supabase';
import { loadSnapshot, queryClient } from '../../src/db/store';
import { addCharacter, updateCharacter } from '../../src/db/actions';
import {
  confirmSave,
  confirmSignIn,
  copyCarryOver,
  deleteAccount,
  pendingCarryOver,
  requestSignIn,
  saveAccount,
  signOut,
} from '../../src/db/account';

const MAIL = 'http://127.0.0.1:54324/api/v1';
const pgdb = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const run = Date.now().toString(36);
const email = (name: string) => `${name}-${run}@example.com`;

/** The 6-digit code from the newest email to `to`. */
async function codeFor(to: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const list = (await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    if (list.messages?.length) {
      const msg = (await (await fetch(`${MAIL}/message/${list.messages[0].ID}`)).json()) as { Text: string };
      await fetch(`${MAIL}/messages`, { method: 'DELETE', body: JSON.stringify({ IDs: list.messages.map((m) => m.ID) }) });
      const code = /\b(\d{6,10})\b/.exec(msg.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No email for ${to}`);
}

const add = (firstName: string) =>
  addCharacter({ firstName, lastName: 'Ashmaw', race: 'Orc', class: 'Warrior', level: 20, ruleset: 'PvP', isMain: false });

async function names(): Promise<string[]> {
  queryClient.clear();
  return (await loadSnapshot(['characters'])).characters!.map((c) => c.firstName).sort();
}

/** Creates a saved account with one character and signs out. */
async function savedAccount(address: string, character: string): Promise<string> {
  await add(character);
  expect(await saveAccount(address)).toEqual({ ok: true });
  expect(await confirmSave(address, await codeFor(address))).toBe(true);
  const id = currentAccount()!.id;
  await signOut();
  return id;
}

beforeAll(() => pgdb.connect());

beforeEach(async () => {
  await supabase.auth.signOut();
  queryClient.clear();
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await supabase.auth.signOut();
  await pgdb.query(`delete from auth.users where email like $1 or (is_anonymous and created_at > now() - interval '10 minutes')`, [`%-${run}@example.com`]);
  await pgdb.end();
});

describe('saving an anonymous account', () => {
  it('keeps the same user and journal, now with an email', async () => {
    await add('Grukthar');
    const before = currentAccount()!;
    expect(before.anonymous).toBe(true);
    const address = email('save');
    expect(await saveAccount(address)).toEqual({ ok: true });
    expect(await confirmSave(address, await codeFor(address))).toBe(true);
    expect(currentAccount()).toEqual({ id: before.id, anonymous: false, email: address });
    expect(await names()).toEqual(['Grukthar']);
  });

  it('says so when the email already has an account', async () => {
    const address = email('taken');
    await savedAccount(address, 'First');
    await add('Second');
    expect(await saveAccount(address)).toMatchObject({ ok: false, reason: 'exists' });
  });

  it('refuses a wrong code', async () => {
    await add('Grukthar');
    const address = email('wrong');
    await saveAccount(address);
    await codeFor(address);
    expect(await confirmSave(address, '000000')).toBe(false);
    expect(currentAccount()!.anonymous).toBe(true);
  });
});

describe('signing in', () => {
  it('opens the same journal on another device with the emailed code', async () => {
    const address = email('device');
    const id = await savedAccount(address, 'Zuljin');
    expect(currentAccount()).toBeNull();
    expect(await requestSignIn(address)).toEqual({ ok: true });
    expect(await confirmSignIn(address, await codeFor(address))).toBe(true);
    expect(currentAccount()).toMatchObject({ id, anonymous: false, email: address });
    expect(await names()).toEqual(['Zuljin']);
    expect(await pendingCarryOver()).toBeNull();
  });

  it('does not create accounts for unknown emails', async () => {
    expect(await requestSignIn(email('nobody'))).toMatchObject({ ok: false, reason: 'no-account' });
    expect(currentAccount()).toBeNull();
  });

  it("offers this browser's anonymous journal and copies it in without overwriting the account", async () => {
    const address = email('carry');
    await savedAccount(address, 'Saved');
    // A new anonymous journal in this browser, with a character and a remembered ruleset.
    const anonChar = await add('Anon');
    await updateCharacter(anonChar, { ruleset: 'RP' });
    expect(await requestSignIn(address)).toEqual({ ok: true });
    expect(await confirmSignIn(address, await codeFor(address))).toBe(true);

    const offer = await pendingCarryOver();
    expect(offer).not.toBeNull();
    expect(offer!.records.filter((r) => r.kind === 'characters')).toHaveLength(1);
    expect(await copyCarryOver(offer!)).toBe(1);
    expect(await names()).toEqual(['Anon', 'Saved']);
    // Both journals remembered a ruleset; the account's stays.
    const meta = (await loadSnapshot(['meta'])).meta!;
    expect(meta).toEqual([{ key: 'lastRuleset', value: 'PvP' }]);
    expect(await pendingCarryOver()).toBeNull();
  });
});

describe('signing out and deleting', () => {
  it('signing out returns the browser to a visitor', async () => {
    await savedAccount(email('out'), 'Grukthar');
    expect(currentAccount()).toBeNull();
    expect(await names()).toEqual([]);
  });

  it('deleting removes the account and everything in it, and nothing of anyone else', async () => {
    const otherId = await savedAccount(email('other'), 'Other');
    await add('Doomed');
    const me = currentAccount()!.id;
    await deleteAccount();
    expect(currentAccount()).toBeNull();
    const { rows } = await pgdb.query(
      `select (select count(*)::int from auth.users where id = $1) as mine,
              (select count(*)::int from public.records where user_id = $1) as my_records,
              (select count(*)::int from auth.users where id = $2) as theirs`,
      [me, otherId],
    );
    expect(rows[0]).toEqual({ mine: 0, my_records: 0, theirs: 1 });
  });
});
