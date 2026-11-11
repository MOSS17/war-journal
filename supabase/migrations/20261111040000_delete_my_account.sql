-- Lets a player delete their own account. Their records and profile go with
-- it (on delete cascade). The app removes their screenshots through the
-- storage API first, since storage files can't be deleted from SQL.
-- Security definer because players can't touch auth.users themselves; it only
-- ever deletes the caller.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
