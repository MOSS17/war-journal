-- War Journal schema: one owner-only table for every player record, shared
-- read-only catalogs for seeded game content, a profile per user, and the
-- private screenshot bucket. Every table has row-level security.

-- ---------- Player records ----------

create table public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (
    kind in ('characters', 'professions', 'instances', 'progress', 'plans', 'journal',
             'images', 'library', 'events', 'tonight', 'meta')
  ),
  id text not null check (length(id) between 1 and 200),
  data jsonb not null check (pg_column_size(data) <= 256 * 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

comment on table public.records is
  'Every object a player owns, stored as the app''s JSON document. kind matches the app''s data kinds.';

alter table public.records enable row level security;

create policy "Players manage their own records"
  on public.records for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger records_touch before update on public.records
  for each row execute function public.touch_updated_at();

-- Realtime keeps other tabs (the Glance window) and devices in step. It applies RLS.
alter publication supabase_realtime add table public.records;

-- ---------- Writes ----------

-- Applies a list of changes in one transaction, as the caller (RLS applies).
-- Each change is {"op":"put","kind":…,"id":…,"row":{…}} or {"op":"delete","kind":…,"id":…}.
create function public.apply_changes(changes jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  c jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) <> 'array' then
    raise exception 'changes must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(changes) > 1000 then
    raise exception 'Too many changes in one call' using errcode = '22023';
  end if;
  for c in select value from jsonb_array_elements(changes) loop
    if c->>'op' = 'put' then
      insert into public.records (kind, id, data)
      values (c->>'kind', c->>'id', c->'row')
      on conflict (user_id, kind, id) do update set data = excluded.data;
    elsif c->>'op' = 'delete' then
      delete from public.records
      where user_id = auth.uid() and kind = c->>'kind' and id = c->>'id';
    else
      raise exception 'Unknown op %', coalesce(c->>'op', 'null') using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke execute on function public.apply_changes(jsonb) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;

-- ---------- Catalogs (seeded game content, shared by everyone) ----------

create table public.instance_catalog (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.event_catalog (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.instance_catalog is 'Seeded dungeons and raids. Only migrations write here.';
comment on table public.event_catalog is 'Seeded countdown events. Only migrations write here.';

alter table public.instance_catalog enable row level security;
alter table public.event_catalog enable row level security;

create policy "Anyone can read the instance catalog"
  on public.instance_catalog for select to anon, authenticated using (true);
create policy "Anyone can read the event catalog"
  on public.event_catalog for select to anon, authenticated using (true);

-- ---------- Profiles ----------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  migrated_from_local boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per user. last_seen_at drives the cleanup of unused anonymous accounts.';

alter table public.profiles enable row level security;

create policy "Players read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Players update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Players can only change these two columns.
revoke update on public.profiles from authenticated;
grant update (last_seen_at, migrated_from_local) on public.profiles to authenticated;

-- Every new user, anonymous or not, gets a profile.
create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.create_profile() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile();

-- ---------- Screenshots ----------

-- Files live at <user_id>/<image_id>; only the owner can touch their folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 5 * 1024 * 1024,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Players read their own screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Players upload their own screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Players replace their own screenshots"
  on storage.objects for update to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Players delete their own screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
