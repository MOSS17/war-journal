// The Supabase client and the player's session. Every visitor plays as an
// anonymous user, created the first time they save something.
import { useSyncExternalStore } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Run `vercel env pull` or `npm run db:env`.');
}

export const supabase = createClient(url, key);

// ---------- Session ----------

/** undefined until the stored session has been read; null for a visitor with no account yet. */
let userId: string | null | undefined;
const listeners = new Set<() => void>();

function setUser(id: string | null) {
  if (id === userId) return;
  userId = id;
  for (const l of listeners) l();
}

supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user.id ?? null));

/** Resolves once the stored session (if any) has been read. */
export const sessionReady: Promise<string | null> = supabase.auth
  .getSession()
  .then(({ data }) => {
    setUser(data.session?.user.id ?? null);
    return userId ?? null;
  })
  .catch(() => {
    setUser(null);
    return null;
  });

export const currentUserId = () => userId;

export function useUserId(): string | null | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => userId,
  );
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
      setUser(d.user.id);
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
