-- Remove Supabase Auth dependency from the quest_* surface (v1 demo pivot).
--
-- Background: UNSW Quest is dropping Supabase Auth for the v1 demo. Identity
-- moves entirely client-side: the frontend generates a device-id UUID and
-- passes it explicitly to every RPC as p_user_id. There is no more auth.uid()
-- in our SECURITY DEFINER functions, no more FKs to auth.users, and no more
-- RLS on quest_* tables (anon/authenticated get direct table grants instead).
--
-- This migration is intentionally destructive: it drops every quest_* RLS
-- policy, the FKs to auth.users on quest_teams / quest_team_members /
-- quest_profiles, and the team-scoped storage policies on the quest-photos
-- bucket (which now becomes public-read for the demo). Re-running it is
-- idempotent thanks to IF EXISTS guards and CREATE OR REPLACE.

-- =============================================================================
-- 1. Drop ALL RLS policies on quest_* tables
-- =============================================================================
-- Policy names come from 20260519000001_quest_schema.sql.

drop policy if exists "quest_hunts_authed_read"             on public.quest_hunts;

drop policy if exists "quest_clues_authed_read"             on public.quest_clues;

drop policy if exists "quest_teams_invite_code_lookup"      on public.quest_teams;
drop policy if exists "quest_teams_member_read"             on public.quest_teams;
drop policy if exists "quest_teams_leader_insert"           on public.quest_teams;

drop policy if exists "quest_team_members_member_read"      on public.quest_team_members;
drop policy if exists "quest_team_members_self_insert"      on public.quest_team_members;

drop policy if exists "quest_hunt_sessions_authed_read"     on public.quest_hunt_sessions;
drop policy if exists "quest_hunt_sessions_member_insert"   on public.quest_hunt_sessions;
drop policy if exists "quest_hunt_sessions_member_update"   on public.quest_hunt_sessions;

drop policy if exists "quest_clue_progress_member_read"     on public.quest_clue_progress;
drop policy if exists "quest_clue_progress_member_insert"   on public.quest_clue_progress;
drop policy if exists "quest_clue_progress_member_update"   on public.quest_clue_progress;

drop policy if exists "quest_profiles_authed_read"          on public.quest_profiles;
drop policy if exists "quest_profiles_self_read"            on public.quest_profiles;
drop policy if exists "quest_profiles_self_update"          on public.quest_profiles;
drop policy if exists "quest_profiles_self_upsert"          on public.quest_profiles;

-- =============================================================================
-- 2. Disable RLS on every quest_* table
-- =============================================================================

alter table public.quest_hunts          disable row level security;
alter table public.quest_clues          disable row level security;
alter table public.quest_teams          disable row level security;
alter table public.quest_team_members   disable row level security;
alter table public.quest_hunt_sessions  disable row level security;
alter table public.quest_clue_progress  disable row level security;
alter table public.quest_profiles       disable row level security;

-- =============================================================================
-- 3. Grant direct table access to anon + authenticated
-- =============================================================================
-- The frontend now makes direct PostgREST queries (e.g. supabase.from(
-- "quest_clue_progress").select(...)) with no JWT, so we need to expose
-- read/write to the anon role as well as authenticated. App-level safety still
-- exists inside the SECURITY DEFINER RPCs, but those are no longer the only gate.

grant select, insert, update, delete on public.quest_hunts          to anon, authenticated;
grant select, insert, update, delete on public.quest_clues          to anon, authenticated;
grant select, insert, update, delete on public.quest_teams          to anon, authenticated;
grant select, insert, update, delete on public.quest_team_members   to anon, authenticated;
grant select, insert, update, delete on public.quest_hunt_sessions  to anon, authenticated;
grant select, insert, update, delete on public.quest_clue_progress  to anon, authenticated;
grant select, insert, update, delete on public.quest_profiles       to anon, authenticated;

-- =============================================================================
-- 4. Drop FKs to auth.users — user_id columns become free UUIDs
-- =============================================================================

alter table public.quest_teams        drop constraint if exists quest_teams_leader_user_id_fkey;
alter table public.quest_team_members drop constraint if exists quest_team_members_user_id_fkey;
alter table public.quest_profiles     drop constraint if exists quest_profiles_user_id_fkey;

-- =============================================================================
-- 5. Rewrite SECURITY DEFINER functions to take p_user_id explicitly
-- =============================================================================
-- Every function that previously called auth.uid() now accepts p_user_id as
-- its FIRST parameter. The caller (the Next.js frontend) is responsible for
-- supplying the device-id UUID it generated client-side. Any lookups against
-- auth.users are removed.
--
-- We DROP first because each function's argument list is changing — CREATE OR
-- REPLACE only matches the exact existing signature.

drop function if exists public.quest_is_team_member(uuid);
drop function if exists public.quest_create_team(uuid, text);
drop function if exists public.quest_join_team(text);
drop function if exists public.quest_start_hunt(uuid);
drop function if exists public.quest_unlock_clue(uuid, uuid, boolean, integer, text);
drop function if exists public.quest_ensure_profile(text);

-- quest_is_team_member: now takes the user explicitly. With RLS disabled this
-- helper is no longer wired into any policy, but app code may still call it
-- as a convenience predicate, so we keep it.
create or replace function public.quest_is_team_member(p_user_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.quest_team_members
    where team_id = p_team_id and user_id = p_user_id
  );
$function$;

-- quest_generate_invite_code: no auth.uid() reference, signature unchanged.
-- Kept here as CREATE OR REPLACE for completeness / idempotency.
create or replace function public.quest_generate_invite_code()
returns text
language plpgsql
as $function$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
begin
  for i in 1..6 loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end;
$function$;

create or replace function public.quest_create_team(
  p_user_id uuid,
  p_hunt_id uuid,
  p_team_name text default null::text
)
returns table(team_id uuid, invite_code text, session_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := p_user_id;
  v_code text;
  v_team uuid;
  v_session uuid;
  v_name text;
  v_attempts int := 0;
begin
  if v_user is null then
    raise exception 'p_user_id is required';
  end if;

  -- Generate a unique code, retry on collision.
  loop
    v_code := public.quest_generate_invite_code();
    exit when not exists (select 1 from public.quest_teams t where t.invite_code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 8 then
      raise exception 'could not generate unique invite code';
    end if;
  end loop;

  v_name := coalesce(nullif(p_team_name, ''), 'Team ' || v_code);

  insert into public.quest_teams (invite_code, name, hunt_id, leader_user_id)
  values (v_code, v_name, p_hunt_id, v_user)
  returning id into v_team;

  insert into public.quest_team_members (team_id, user_id)
  values (v_team, v_user);

  insert into public.quest_hunt_sessions (team_id, hunt_id, state)
  values (v_team, p_hunt_id, 'lobby')
  returning id into v_session;

  return query select v_team, v_code, v_session;
end;
$function$;

create or replace function public.quest_join_team(
  p_user_id uuid,
  p_invite_code text
)
returns table(team_id uuid, hunt_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := p_user_id;
  v_team uuid;
  v_hunt uuid;
  v_member_count int;
begin
  if v_user is null then
    raise exception 'p_user_id is required';
  end if;

  select t.id, t.hunt_id into v_team, v_hunt
  from public.quest_teams t
  where upper(t.invite_code) = upper(p_invite_code);

  if v_team is null then
    raise exception 'invite code not found';
  end if;

  select count(*) into v_member_count from public.quest_team_members where quest_team_members.team_id = v_team;
  if v_member_count >= 6 then
    raise exception 'team is full (max 6)';
  end if;

  insert into public.quest_team_members (team_id, user_id)
  values (v_team, v_user)
  on conflict do nothing;

  return query select v_team, v_hunt;
end;
$function$;

create or replace function public.quest_start_hunt(
  p_user_id uuid,
  p_team_id uuid
)
returns public.quest_hunt_sessions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := p_user_id;
  v_session public.quest_hunt_sessions;
  v_leader uuid;
begin
  if v_user is null then
    raise exception 'p_user_id is required';
  end if;

  select leader_user_id into v_leader from public.quest_teams where id = p_team_id;
  if v_leader is null then
    raise exception 'team not found';
  end if;
  if v_leader <> v_user then
    raise exception 'only the team leader can start the hunt';
  end if;

  update public.quest_hunt_sessions
  set state = 'in_progress', started_at = coalesce(started_at, now())
  where team_id = p_team_id
  returning * into v_session;

  return v_session;
end;
$function$;

create or replace function public.quest_unlock_clue(
  p_user_id uuid,
  p_session_id uuid,
  p_clue_id uuid,
  p_manual_override boolean default false,
  p_hints_used integer default 0,
  p_photo_url text default null::text
)
returns public.quest_hunt_sessions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := p_user_id;
  v_session public.quest_hunt_sessions;
  v_clue public.quest_clues;
  v_max_seq int;
  v_max_tier int := 3;  -- 3 tiers max in v1 schema
  v_next_tier int;
  v_next_seq int;
  v_member_count int;
begin
  if v_user is null then
    raise exception 'p_user_id is required';
  end if;

  select * into v_session from public.quest_hunt_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'session not found';
  end if;

  -- Membership check
  select count(*) into v_member_count
  from public.quest_team_members
  where team_id = v_session.team_id and user_id = v_user;
  if v_member_count = 0 then
    raise exception 'not a member of this team';
  end if;

  if v_session.state <> 'in_progress' then
    raise exception 'session is not in progress';
  end if;

  select * into v_clue from public.quest_clues where id = p_clue_id;
  if v_clue.id is null then
    raise exception 'clue not found';
  end if;

  if v_clue.hunt_id <> v_session.hunt_id
    or v_clue.tier <> v_session.current_tier
    or v_clue.sequence_in_tier <> v_session.current_sequence
  then
    raise exception 'this is not the current clue';
  end if;

  -- Record progress (idempotent via unique constraint)
  insert into public.quest_clue_progress (
    hunt_session_id, clue_id, hints_used, manual_override, photo_capture_url
  )
  values (p_session_id, p_clue_id, p_hints_used, p_manual_override, p_photo_url)
  on conflict (hunt_session_id, clue_id) do update
    set hints_used = greatest(quest_clue_progress.hints_used, excluded.hints_used),
        manual_override = quest_clue_progress.manual_override or excluded.manual_override,
        photo_capture_url = coalesce(excluded.photo_capture_url, quest_clue_progress.photo_capture_url);

  -- Find the highest sequence in the current tier
  select coalesce(max(sequence_in_tier), 0) into v_max_seq
  from public.quest_clues
  where hunt_id = v_session.hunt_id and tier = v_session.current_tier;

  -- Decide next clue or completion
  if v_session.current_sequence < v_max_seq then
    v_next_tier := v_session.current_tier;
    v_next_seq := v_session.current_sequence + 1;
  else
    -- End of tier — look for a next tier with clues
    select min(tier) into v_next_tier
    from public.quest_clues
    where hunt_id = v_session.hunt_id and tier > v_session.current_tier;
    if v_next_tier is null then
      -- Hunt complete
      update public.quest_hunt_sessions
      set state = 'completed',
          completed_at = now(),
          total_time_seconds = floor(extract(epoch from (now() - started_at))) + hint_penalty_seconds
      where id = p_session_id
      returning * into v_session;
      return v_session;
    end if;
    v_next_seq := 1;
  end if;

  update public.quest_hunt_sessions
  set current_tier = v_next_tier,
      current_sequence = v_next_seq,
      hint_penalty_seconds = hint_penalty_seconds + (coalesce(p_hints_used, 0) * 60)
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$function$;

-- quest_ensure_profile: previously looked up the user's email from auth.users
-- to (a) seed a default display_name from the local-part and (b) set
-- unsw_verified based on an @unsw.edu.au suffix. With auth gone there is no
-- email source, so we drop that lookup entirely. The caller MUST supply a
-- non-empty display name; unsw_verified always seeds to false and can be
-- updated separately by an admin/seed path if needed.
create or replace function public.quest_ensure_profile(
  p_user_id uuid,
  p_display_name text
)
returns public.quest_profiles
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := p_user_id;
  v_row public.quest_profiles;
begin
  if v_user is null then
    raise exception 'p_user_id is required';
  end if;

  insert into public.quest_profiles (user_id, display_name, unsw_verified)
  values (
    v_user,
    coalesce(nullif(p_display_name, ''), 'player'),
    false
  )
  on conflict (user_id) do update
    set display_name = coalesce(nullif(excluded.display_name, ''), public.quest_profiles.display_name)
  returning * into v_row;

  return v_row;
end;
$function$;

-- Make sure anon + authenticated can execute the new RPC signatures.
grant execute on function public.quest_is_team_member(uuid, uuid)             to anon, authenticated;
grant execute on function public.quest_generate_invite_code()                 to anon, authenticated;
grant execute on function public.quest_create_team(uuid, uuid, text)          to anon, authenticated;
grant execute on function public.quest_join_team(uuid, text)                  to anon, authenticated;
grant execute on function public.quest_start_hunt(uuid, uuid)                 to anon, authenticated;
grant execute on function public.quest_unlock_clue(uuid, uuid, uuid, boolean, integer, text)
                                                                              to anon, authenticated;
grant execute on function public.quest_ensure_profile(uuid, text)             to anon, authenticated;

-- =============================================================================
-- 6. quest-photos bucket: drop team-scoped policies, make bucket public-read
-- =============================================================================
-- Policy names lifted verbatim from 20260519000004_quest_photos_bucket.sql.
-- With auth gone, "only team members can read these photos" is no longer
-- enforceable in the database. For the v1 demo we accept public-read on the
-- bucket; the path convention ({sessionId}/{clueId}-{ts}.jpg) keeps the URLs
-- effectively unguessable.

update storage.buckets set public = true where id = 'quest-photos';

drop policy if exists "quest_photos_authed_insert"     on storage.objects;
drop policy if exists "quest_photos_team_member_read"  on storage.objects;
drop policy if exists "quest_photos_owner_update"      on storage.objects;
drop policy if exists "quest_photos_owner_delete"      on storage.objects;

-- Allow anon + authenticated callers to upload directly to the bucket. The
-- public-read flag above handles SELECT for everyone via the public CDN URL.
create policy "quest_photos_public_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'quest-photos');
