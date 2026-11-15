// Weekly Vercel Cron (vercel.json): removes anonymous accounts unused for 30
// days, with their screenshots. Vercel sends `Authorization: Bearer
// $CRON_SECRET`; anything else is turned away.
import { createClient } from '@supabase/supabase-js';
import { cleanupAnonymous } from '../server/cleanup.js';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response('Supabase is not configured', { status: 500 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await cleanupAnonymous(admin);
  console.log('Removed unused anonymous accounts', result);
  return Response.json(result);
}
