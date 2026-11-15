-- Anonymous accounts nobody has used for `days` days, oldest first. The weekly
-- cleanup job (api/cleanup.ts) deletes their screenshot files through the
-- Storage API and then the users; records and profiles cascade. Only the
-- server's service role can call it.
create function public.stale_anonymous_users(days int default 30, max_users int default 200)
returns table (user_id uuid)
language sql stable security definer set search_path = '' as $$
  select u.id
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.is_anonymous
    and coalesce(p.last_seen_at, u.last_sign_in_at, u.created_at) < now() - make_interval(days => days)
  order by coalesce(p.last_seen_at, u.last_sign_in_at, u.created_at)
  limit max_users;
$$;

revoke execute on function public.stale_anonymous_users(int, int) from public, anon, authenticated;
grant execute on function public.stale_anonymous_users(int, int) to service_role;
