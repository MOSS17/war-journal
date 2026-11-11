-- Replaces all of the caller's records in one transaction: restoring a backup,
-- "Start over" (an empty list) and moving a browser's old local data up.
-- Each row is {"kind":…,"id":…,"row":{…}}. Runs as the caller, so RLS applies.
create function public.replace_records(rows jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(rows) <> 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(rows) > 20000 then
    raise exception 'Too many records in one call' using errcode = '22023';
  end if;
  delete from public.records where user_id = auth.uid();
  insert into public.records (kind, id, data)
  select r->>'kind', r->>'id', r->'row' from jsonb_array_elements(rows) as r;
end;
$$;

revoke execute on function public.replace_records(jsonb) from public, anon;
grant execute on function public.replace_records(jsonb) to authenticated;
