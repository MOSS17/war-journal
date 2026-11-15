// Deletes anonymous accounts nobody has used for a while: their screenshot
// files first (Storage can't be cleared from SQL), then the users. Their
// records and profiles go with them (on delete cascade).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CleanupResult {
  users: number;
  files: number;
}

/** `admin` must use the service role key. */
export async function cleanupAnonymous(
  admin: SupabaseClient,
  { days = 30, maxUsers = 200 }: { days?: number; maxUsers?: number } = {},
): Promise<CleanupResult> {
  const { data, error } = await admin.rpc('stale_anonymous_users', { days, max_users: maxUsers });
  if (error) throw error;
  const result: CleanupResult = { users: 0, files: 0 };
  for (const { user_id } of data as { user_id: string }[]) {
    for (;;) {
      const { data: files, error: listError } = await admin.storage.from('screenshots').list(user_id, { limit: 1000 });
      if (listError) throw listError;
      if (!files.length) break;
      const { error: removeError } = await admin.storage.from('screenshots').remove(files.map((f) => `${user_id}/${f.name}`));
      if (removeError) throw removeError;
      result.files += files.length;
      if (files.length < 1000) break;
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;
    result.users += 1;
  }
  return result;
}
