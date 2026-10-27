-- =====================================================================================================
-- Klaps Planer – schemat chmury (Supabase). Uruchom RAZ w Supabase → SQL Editor → New query → Run.
-- Można uruchomić ponownie (aktualizacja schematu): polecenia są idempotentne.
--
-- Zasady bezpieczeństwa:
--  * treść projektów (tytuł, zmiany, migawki, mapki) jest szyfrowana end-to-end po stronie aplikacji – serwer widzi
--    tylko szyfrogramy, identyfikatory, role i czasy;
--  * tabele są tylko do odczytu dla zalogowanych (RLS); wszystkie zapisy idą przez funkcje poniżej, które sprawdzają rolę;
--  * kod zaproszenia nie jest przechowywany – tylko jego skrót (SHA-256).
-- =====================================================================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.klaps_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  position text not null default '',
  avatar text not null default '',            -- małe zdjęcie jako data URL (ok. 128×128 px)
  color text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.klaps_projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id),
  title_enc text not null,                    -- tytuł zaszyfrowany kluczem projektu
  head_seq bigint not null default 0,         -- numer ostatniej operacji (bez luk)
  snap_seq bigint not null default 0,         -- numer operacji, na której oparta jest migawka
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.klaps_members (
  project_id uuid not null references public.klaps_projects(id) on delete cascade,
  user_id uuid not null references public.klaps_profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists klaps_members_user on public.klaps_members(user_id);
create table if not exists public.klaps_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.klaps_projects(id) on delete cascade,
  code_hash text not null unique,
  secret_enc text not null,                   -- sekret zaszyfrowany kluczem projektu (właściciel może ponownie skopiować kod)
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses int,
  uses int not null default 0,
  revoked boolean not null default false
);
create table if not exists public.klaps_ops (
  project_id uuid not null references public.klaps_projects(id) on delete cascade,
  seq bigint not null,
  author uuid not null references auth.users(id),
  client_id text not null,
  local_seq bigint not null,
  payload text not null,                      -- zaszyfrowana paczka zmian
  created_at timestamptz not null default now(),
  primary key (project_id, seq),
  unique (project_id, client_id, local_seq)
);
create table if not exists public.klaps_snapshots (
  project_id uuid primary key references public.klaps_projects(id) on delete cascade,
  seq bigint not null,
  payload text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.klaps_blobs (
  project_id uuid not null references public.klaps_projects(id) on delete cascade,
  id text not null,
  payload text not null,
  primary key (project_id, id)
);
create table if not exists public.klaps_activity (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.klaps_projects(id) on delete cascade,
  author uuid not null references auth.users(id),
  at timestamptz not null default now(),
  payload text not null                       -- zaszyfrowany wpis dziennika zmian („kto, co”)
);
create index if not exists klaps_activity_project on public.klaps_activity(project_id, id desc);

-- ---------- pomocnicze (omijają RLS, aby reguły nie wywoływały się w pętli) ----------
create or replace function public.klaps_role(p_project uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.klaps_members where project_id = p_project and user_id = auth.uid()
$$;
create or replace function public.klaps_is_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.klaps_members where project_id = p_project and user_id = auth.uid())
$$;
create or replace function public.klaps_shares_project(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or exists (
    select 1 from public.klaps_members a join public.klaps_members b on a.project_id = b.project_id
    where a.user_id = auth.uid() and b.user_id = p_user)
$$;
create or replace function public.klaps_version() returns int language sql immutable as $$ select 1 $$;

-- ---------- dostęp do odczytu (RLS) ----------
alter table public.klaps_profiles enable row level security;
alter table public.klaps_projects enable row level security;
alter table public.klaps_members enable row level security;
alter table public.klaps_invites enable row level security;
alter table public.klaps_ops enable row level security;
alter table public.klaps_snapshots enable row level security;
alter table public.klaps_blobs enable row level security;
alter table public.klaps_activity enable row level security;

drop policy if exists klaps_profiles_read on public.klaps_profiles;
create policy klaps_profiles_read on public.klaps_profiles for select to authenticated using (public.klaps_shares_project(id));
drop policy if exists klaps_projects_read on public.klaps_projects;
create policy klaps_projects_read on public.klaps_projects for select to authenticated using (public.klaps_is_member(id));
drop policy if exists klaps_members_read on public.klaps_members;
create policy klaps_members_read on public.klaps_members for select to authenticated using (public.klaps_is_member(project_id));
drop policy if exists klaps_invites_read on public.klaps_invites;
create policy klaps_invites_read on public.klaps_invites for select to authenticated using (public.klaps_role(project_id) = 'owner');
drop policy if exists klaps_ops_read on public.klaps_ops;
create policy klaps_ops_read on public.klaps_ops for select to authenticated using (public.klaps_is_member(project_id));
drop policy if exists klaps_snapshots_read on public.klaps_snapshots;
create policy klaps_snapshots_read on public.klaps_snapshots for select to authenticated using (public.klaps_is_member(project_id));
drop policy if exists klaps_blobs_read on public.klaps_blobs;
create policy klaps_blobs_read on public.klaps_blobs for select to authenticated using (public.klaps_is_member(project_id));
drop policy if exists klaps_activity_read on public.klaps_activity;
create policy klaps_activity_read on public.klaps_activity for select to authenticated using (public.klaps_is_member(project_id));

revoke all on public.klaps_profiles, public.klaps_projects, public.klaps_members, public.klaps_invites, public.klaps_ops, public.klaps_snapshots, public.klaps_blobs, public.klaps_activity from anon, authenticated;
grant select on public.klaps_profiles, public.klaps_projects, public.klaps_members, public.klaps_invites, public.klaps_ops, public.klaps_snapshots, public.klaps_blobs, public.klaps_activity to authenticated;

-- ---------- funkcje (jedyna droga zapisu) ----------
create or replace function public.klaps_upsert_profile(p_name text, p_position text, p_avatar text, p_color text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'klaps:not_signed_in'; end if;
  if length(coalesce(p_avatar, '')) > 90000 then raise exception 'klaps:avatar_too_large'; end if;
  insert into public.klaps_profiles(id, name, position, avatar, color, updated_at)
  values (auth.uid(), left(coalesce(p_name, ''), 80), left(coalesce(p_position, ''), 80), coalesce(p_avatar, ''), left(coalesce(p_color, ''), 20), now())
  on conflict (id) do update set name = excluded.name, position = excluded.position, avatar = excluded.avatar, color = excluded.color, updated_at = now();
end $$;

create or replace function public.klaps_create_project(p_title_enc text, p_snapshot text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'klaps:not_signed_in'; end if;
  insert into public.klaps_profiles(id) values (auth.uid()) on conflict do nothing;
  insert into public.klaps_projects(owner, title_enc) values (auth.uid(), p_title_enc) returning id into pid;
  insert into public.klaps_members(project_id, user_id, role) values (pid, auth.uid(), 'owner');
  insert into public.klaps_snapshots(project_id, seq, payload, created_by) values (pid, 0, p_snapshot, auth.uid());
  return pid;
end $$;

create or replace function public.klaps_push_ops(p_project uuid, p_client text, p_local bigint, p_payload text) returns bigint
language plpgsql security definer set search_path = public as $$
declare r text; s bigint;
begin
  r := public.klaps_role(p_project);
  if r is null then raise exception 'klaps:not_member'; end if;
  if r not in ('owner', 'editor') then raise exception 'klaps:forbidden'; end if;
  -- ponowne wysłanie tej samej paczki (np. po zerwaniu połączenia) zwraca ten sam numer
  select seq into s from public.klaps_ops where project_id = p_project and client_id = p_client and local_seq = p_local;
  if s is not null then return s; end if;
  -- blokada wiersza projektu = jedna kolejka na projekt: numery bez luk i w kolejności zatwierdzania
  update public.klaps_projects set head_seq = head_seq + 1, updated_at = now() where id = p_project returning head_seq into s;
  insert into public.klaps_ops(project_id, seq, author, client_id, local_seq, payload) values (p_project, s, auth.uid(), p_client, p_local, p_payload);
  return s;
end $$;

create or replace function public.klaps_put_snapshot(p_project uuid, p_seq bigint, p_payload text) returns void
language plpgsql security definer set search_path = public as $$
declare r text; h bigint; sn bigint;
begin
  r := public.klaps_role(p_project);
  if r is null then raise exception 'klaps:not_member'; end if;
  if r not in ('owner', 'editor') then raise exception 'klaps:forbidden'; end if;
  select head_seq, snap_seq into h, sn from public.klaps_projects where id = p_project for update;
  if p_seq > h or p_seq <= sn then return; end if;       -- nieaktualna migawka: ignorujemy
  insert into public.klaps_snapshots(project_id, seq, payload, created_by) values (p_project, p_seq, p_payload, auth.uid())
  on conflict (project_id) do update set seq = excluded.seq, payload = excluded.payload, created_by = excluded.created_by, created_at = now();
  update public.klaps_projects set snap_seq = p_seq where id = p_project;
  delete from public.klaps_ops where project_id = p_project and seq < p_seq - 100;   -- zostaje ogon dla klientów, które są tuż za
end $$;

create or replace function public.klaps_put_blob(p_project uuid, p_id text, p_payload text) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := public.klaps_role(p_project);
  if r is null then raise exception 'klaps:not_member'; end if;
  if r not in ('owner', 'editor') then raise exception 'klaps:forbidden'; end if;
  insert into public.klaps_blobs(project_id, id, payload) values (p_project, p_id, p_payload) on conflict do nothing;
end $$;

create or replace function public.klaps_log_activity(p_project uuid, p_payload text) returns void
language plpgsql security definer set search_path = public as $$
declare r text; cutoff bigint;
begin
  r := public.klaps_role(p_project);
  if r is null then raise exception 'klaps:not_member'; end if;
  if r not in ('owner', 'editor') then raise exception 'klaps:forbidden'; end if;
  if length(p_payload) > 20000 then raise exception 'klaps:too_big'; end if;
  insert into public.klaps_activity(project_id, author, payload) values (p_project, auth.uid(), p_payload);
  -- dziennik trzyma ostatnie 1000 wpisów projektu
  select id into cutoff from public.klaps_activity where project_id = p_project order by id desc offset 1000 limit 1;
  if cutoff is not null then delete from public.klaps_activity where project_id = p_project and id <= cutoff; end if;
end $$;

create or replace function public.klaps_set_title(p_project uuid, p_title_enc text) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := public.klaps_role(p_project);
  if r is null then raise exception 'klaps:not_member'; end if;
  if r not in ('owner', 'editor') then raise exception 'klaps:forbidden'; end if;
  update public.klaps_projects set title_enc = p_title_enc, updated_at = now() where id = p_project;
end $$;

create or replace function public.klaps_create_invite(p_project uuid, p_role text, p_secret text, p_secret_enc text, p_hours int, p_max_uses int) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare iid uuid;
begin
  if public.klaps_role(p_project) is distinct from 'owner' then raise exception 'klaps:forbidden'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'klaps:bad_role'; end if;
  if length(coalesce(p_secret, '')) < 20 then raise exception 'klaps:weak_secret'; end if;
  insert into public.klaps_invites(project_id, code_hash, secret_enc, role, created_by, expires_at, max_uses)
  values (p_project, encode(digest(p_secret, 'sha256'), 'hex'), p_secret_enc, p_role, auth.uid(),
          case when p_hours is null or p_hours <= 0 then null else now() + make_interval(hours => p_hours) end,
          nullif(p_max_uses, 0))
  returning id into iid;
  return iid;
end $$;

create or replace function public.klaps_revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select project_id into pid from public.klaps_invites where id = p_invite;
  if pid is null or public.klaps_role(pid) is distinct from 'owner' then raise exception 'klaps:forbidden'; end if;
  update public.klaps_invites set revoked = true where id = p_invite;
end $$;

create or replace function public.klaps_redeem_invite(p_secret text) returns table (project_id uuid, role text)
language plpgsql security definer set search_path = public, extensions as $$
declare inv public.klaps_invites; cur text;
begin
  if auth.uid() is null then raise exception 'klaps:not_signed_in'; end if;
  select * into inv from public.klaps_invites i where i.code_hash = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') for update;
  if not found or inv.revoked or (inv.expires_at is not null and inv.expires_at < now()) or (inv.max_uses is not null and inv.uses >= inv.max_uses) then
    raise exception 'klaps:invalid_invite';
  end if;
  insert into public.klaps_profiles(id) values (auth.uid()) on conflict do nothing;
  select m.role into cur from public.klaps_members m where m.project_id = inv.project_id and m.user_id = auth.uid();
  if cur is null then
    insert into public.klaps_members(project_id, user_id, role) values (inv.project_id, auth.uid(), inv.role);
    update public.klaps_invites set uses = uses + 1 where id = inv.id;
    cur := inv.role;
  elsif cur = 'viewer' and inv.role = 'editor' then
    update public.klaps_members m set role = 'editor' where m.project_id = inv.project_id and m.user_id = auth.uid();
    update public.klaps_invites set uses = uses + 1 where id = inv.id;
    cur := 'editor';
  end if;
  return query select inv.project_id, cur;
end $$;

create or replace function public.klaps_set_role(p_project uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.klaps_role(p_project) is distinct from 'owner' then raise exception 'klaps:forbidden'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'klaps:bad_role'; end if;
  update public.klaps_members set role = p_role where project_id = p_project and user_id = p_user and role <> 'owner';
end $$;

create or replace function public.klaps_remove_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := public.klaps_role(p_project);
  if r is null then raise exception 'klaps:not_member'; end if;
  if p_user <> auth.uid() and r <> 'owner' then raise exception 'klaps:forbidden'; end if;
  if exists (select 1 from public.klaps_members where project_id = p_project and user_id = p_user and role = 'owner') then
    raise exception 'klaps:owner_cannot_leave';
  end if;
  delete from public.klaps_members where project_id = p_project and user_id = p_user;
end $$;

create or replace function public.klaps_transfer_owner(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.klaps_role(p_project) is distinct from 'owner' then raise exception 'klaps:forbidden'; end if;
  if not exists (select 1 from public.klaps_members where project_id = p_project and user_id = p_user) then raise exception 'klaps:not_member'; end if;
  update public.klaps_members set role = 'editor' where project_id = p_project and user_id = auth.uid();
  update public.klaps_members set role = 'owner' where project_id = p_project and user_id = p_user;
  update public.klaps_projects set owner = p_user where id = p_project;
end $$;

create or replace function public.klaps_delete_project(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.klaps_role(p_project) is distinct from 'owner' then raise exception 'klaps:forbidden'; end if;
  delete from public.klaps_projects where id = p_project;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.klaps_version() to anon, authenticated;
-- funkcje pomocnicze używane przez reguły RLS wykonują się z uprawnieniami zalogowanego
grant execute on function public.klaps_role(uuid), public.klaps_is_member(uuid), public.klaps_shares_project(uuid) to authenticated;
grant execute on function public.klaps_upsert_profile(text, text, text, text), public.klaps_create_project(text, text), public.klaps_push_ops(uuid, text, bigint, text),
  public.klaps_put_snapshot(uuid, bigint, text), public.klaps_put_blob(uuid, text, text), public.klaps_log_activity(uuid, text), public.klaps_set_title(uuid, text),
  public.klaps_create_invite(uuid, text, text, text, int, int), public.klaps_revoke_invite(uuid), public.klaps_redeem_invite(text),
  public.klaps_set_role(uuid, uuid, text), public.klaps_remove_member(uuid, uuid), public.klaps_transfer_owner(uuid, uuid),
  public.klaps_delete_project(uuid) to authenticated;

-- ---------- zmiany na żywo (Realtime) ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'klaps_ops') then
    alter publication supabase_realtime add table public.klaps_ops;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'klaps_members') then
    alter publication supabase_realtime add table public.klaps_members;
  end if;
end $$;
