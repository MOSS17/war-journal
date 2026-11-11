// The Supabase client and the player's session. Every visitor plays as an
// anonymous user, created the first time they save something.
import { useSyncExternalStore } from 'react';
import { createClient, type User } from '@supabase/supabase-js';

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Run `vercel env pull` or `npm run db:env`.');
}

export const supabase = createClient(url, key);

// ---------- Session ----------

/** Who is playing. `email` is set once an anonymous account has been saved. */
export interface Account {
  id: string;
  anonymous: boolean;
  email: string | null;
}

/** undefined until the stored session has been read; null for a visitor with no account yet. */
let account: Account | null | undefined;
const listeners = new Set<() => void>();

function toAccount(user: User | null | undefined): Account | null {
  if (!user) return null;
  return { id: user.id, anonymous: user.is_anonymous ?? !user.email, email: user.email || null };
}

function setAccount(next: Account | null) {
  if (
    next?.id === account?.id &&
    next?.anonymous === account?.anonymous &&
    next?.email === account?.email &&
    (next === null) === (account === null)
  )
    return;
  account = next;
  for (const l of listeners) l();
}

supabase.auth.onAuthStateChange((_event, session) => setAccount(toAccount(session?.user)));

/** Resolves once the stored session (if any) has been read. */
export const sessionReady: Promise<string | null> = supabase.auth
  .getSession()
  .then(({ data }) => {
    setAccount(toAccount(data.session?.user));
    return account?.id ?? null;
  })
  .catch(() => {
    setAccount(null);
    return null;
  });

export const currentUserId = () => (account === undefined ? undefined : (account?.id ?? null));
export const currentAccount = () => account;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The current account, null for a visitor, undefined while loading. */
export function useAccount(): Account | null | undefined {
  return useSyncExternalStore(subscribe, () => account);
}

export function useUserId(): string | null | undefined {
  return useSyncExternalStore(subscribe, currentUserId);
}

let signingIn: Promise<string> | null = null;

/** The signed-in user's id, signing in anonymously first if this visitor has no account yet. */
export async function ensureUser(): Promise<string> {
  await sessionReady;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  signingIn ??= supabase.auth
    .signInAnonymously()
    .then(({ data: d, error }) => {
      if (error || !d.user) throw new SaveError('Could not start your journal. Check your connection and try again.', error);
      setAccount(toAccount(d.user));
      return d.user.id;
    })
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}

/** A save that didn't reach the server. Its message is shown to the player. */
export class SaveError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SaveError';
  }
}
