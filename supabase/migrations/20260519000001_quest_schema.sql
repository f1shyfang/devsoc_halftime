-- Quest schema snapshot — captures the live quest_* tables in project vpwrrlkeinfjxoiaetwf
-- so that `supabase db reset` and fresh environments reproduce the current state.
--
-- Scope: quest_hunts, quest_clues, quest_teams, quest_team_members,
-- quest_hunt_sessions, quest_clue_progress, quest_profiles
-- plus helper SQL/PL/pgSQL functions (quest_is_team_member, quest_create_team,
-- quest_join_team, quest_start_hunt, quest_unlock_clue, quest_ensure_profile,
-- quest_generate_invite_code) and the RLS policies that depend on them.

-- =============================================================================
-- Extensions
-- =============================================================================

create extension if not exists pgcrypto;  -- for gen_random_uuid()

-- =============================================================================
-- Tables (in FK-dependency order: parents before children)
-- =============================================================================

-- quest_hunts: top-level hunt definition. Parent of quest_clues, quest_teams,
-- quest_hunt_sessions.
create table if not exists public.quest_hunts (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  name                   text not null,
  description            text,
  duration_minutes       integer,
  recommended_team_size  text default '2-6'::text,
  hero_emoji             text default '🗺️'::text,
  status                 text not null default 'published'::text
    check (status = any (array['draft'::text, 'published'::text, 'archived'::text])),
  created_at             timestamptz not null default now()
);

-- quest_clues: individual clue/checkpoint within a hunt. (hunt_id, tier, sequence_in_tier)
-- is unique, so each hunt has at most 3 tiers x 9 clues = 27 ordered checkpoints.
create table if not exists public.quest_clues (
  id                      uuid primary key default gen_random_uuid(),
  hunt_id                 uuid not null references public.quest_hunts(id) on delete cascade,
  tier                    integer not null check (tier >= 1 and tier <= 3),
  sequence_in_tier        integer not null check (sequence_in_tier >= 1 and sequence_in_tier <= 9),
  type                    text not null default 'riddle'::text
    check (type = any (array['riddle'::text, 'image_clue'::text])),
  body_text               text not null,
  image_url               text,
  verification_type       text not null default 'gps'::text
    check (verification_type = any (array['gps'::text, 'qr'::text, 'gps_plus_photo'::text])),
  location_name           text,
  location_lat            numeric,
  location_lng            numeric,
  geofence_radius_m       integer not null default 25,
  qr_code_payload         text,
  photo_challenge_prompt  text,
  hints                   jsonb not null default '[]'::jsonb,
  unique (hunt_id, tier, sequence_in_tier)
);

-- quest_teams: a team playing a particular hunt. Joined via invite_code.
create table if not exists public.quest_teams (
  id              uuid primary key default gen_random_uuid(),
  invite_code     text not null unique,
  name            text not null,
  hunt_id         uuid not null references public.quest_hunts(id),
  leader_user_id  uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);

-- quest_team_members: which auth.users belong to which quest_team. Composite PK.
create table if not exists public.quest_team_members (
  team_id    uuid not null references public.quest_teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- quest_hunt_sessions: an active or completed playthrough for a team. One per
-- team (team_id is unique), seeded in 'lobby' state by quest_create_team.
create table if not exists public.quest_hunt_sessions (
  id                    uuid primary key default gen_random_uuid(),
  team_id               uuid not null unique references public.quest_teams(id) on delete cascade,
  hunt_id               uuid not null references public.quest_hunts(id),
  state                 text not null default 'lobby'::text
    check (state = any (array['lobby'::text, 'in_progress'::text, 'completed'::text, 'abandoned'::text])),
  started_at            timestamptz,
  completed_at          timestamptz,
  current_tier          integer not null default 1,
  current_sequence      integer not null default 1,
  hint_penalty_seconds  integer not null default 0,
  total_time_seconds    integer,
  created_at            timestamptz not null default now()
);

-- quest_clue_progress: one row per clue per session as the team unlocks it.
-- (hunt_session_id, clue_id) is unique so quest_unlock_clue is idempotent.
create table if not exists public.quest_clue_progress (
  id                 uuid primary key default gen_random_uuid(),
  hunt_session_id    uuid not null references public.quest_hunt_sessions(id) on delete cascade,
  clue_id            uuid not null references public.quest_clues(id),
  unlocked_at        timestamptz not null default now(),
  hints_used         integer not null default 0 check (hints_used >= 0 and hints_used <= 2),
  manual_override    boolean not null default false,
  photo_capture_url  text,
  unique (hunt_session_id, clue_id)
);

-- quest_profiles: per-user display data; one row per auth.users entry.
create table if not exists public.quest_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null,
  avatar_color   text not null default '#ef5b3a'::text,
  unsw_verified  boolean not null default false,
  created_at     timestamptz not null default now()
);

-- =============================================================================
-- Indexes (non-unique; unique indexes are created implicitly by UNIQUE / PK)
-- =============================================================================

create index if not exists quest_clues_hunt_idx
  on public.quest_clues using btree (hunt_id, tier, sequence_in_tier);

create index if not exists quest_teams_hunt_idx
  on public.quest_teams using btree (hunt_id);

create index if not exists quest_team_members_user_idx
  on public.quest_team_members using btree (user_id);

create index if not exists quest_hunt_sessions_hunt_idx
  on public.quest_hunt_sessions using btree (hunt_id);

create index if not exists quest_clue_progress_session_idx
  on public.quest_clue_progress using btree (hunt_session_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.quest_hunts          enable row level security;
alter table public.quest_clues          enable row level security;
alter table public.quest_teams          enable row level security;
alter table public.quest_team_members   enable row level security;
alter table public.quest_hunt_sessions  enable row level security;
alter table public.quest_clue_progress  enable row level security;
alter table public.quest_profiles       enable row level security;

-- =============================================================================
-- Helper functions
-- =============================================================================

-- Used by every team-scoped RLS policy below. SECURITY DEFINER so it can read
-- quest_team_members without recursing through that table's own RLS.
create or replace function public.quest_is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.quest_team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$function$;

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

create or replace function public.quest_create_team(p_hunt_id uuid, p_team_name text default null::text)
returns table(team_id uuid, invite_code text, session_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_team uuid;
  v_session uuid;
  v_name text;
  v_attempts int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated';
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

create or replace function public.quest_join_team(p_invite_code text)
returns table(team_id uuid, hunt_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_hunt uuid;
  v_member_count int;
begin
  if v_user is null then
    raise exception 'not authenticated';
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

create or replace function public.quest_start_hunt(p_team_id uuid)
returns public.quest_hunt_sessions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_session public.quest_hunt_sessions;
  v_leader uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
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
  v_user uuid := auth.uid();
  v_session public.quest_hunt_sessions;
  v_clue public.quest_clues;
  v_max_seq int;
  v_max_tier int := 3;  -- 3 tiers max in v1 schema
  v_next_tier int;
  v_next_seq int;
  v_member_count int;
begin
  if v_user is null then
    raise exception 'not authenticated';
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

create or replace function public.quest_ensure_profile(p_display_name text)
returns public.quest_profiles
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_row public.quest_profiles;
  v_email text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user;

  insert into public.quest_profiles (user_id, display_name, unsw_verified)
  values (
    v_user,
    coalesce(nullif(p_display_name, ''), split_part(coalesce(v_email, 'player'), '@', 1)),
    coalesce(v_email, '') like '%@%unsw.edu.au'
  )
  on conflict (user_id) do update
    set display_name = coalesce(nullif(excluded.display_name, ''), public.quest_profiles.display_name)
  returning * into v_row;

  return v_row;
end;
$function$;

-- =============================================================================
-- RLS policies (drop-and-recreate so this is rerunnable)
-- =============================================================================

-- quest_hunts: any authenticated user can read; no write policies (admin/seed
-- happens via service_role, which bypasses RLS).
drop policy if exists "quest_hunts_authed_read" on public.quest_hunts;
create policy "quest_hunts_authed_read"
  on public.quest_hunts
  for select
  to authenticated
  using (true);

-- quest_clues: any authenticated user can read all clues (the app handles
-- gating client-side; tiers / sequence aren't secret).
drop policy if exists "quest_clues_authed_read" on public.quest_clues;
create policy "quest_clues_authed_read"
  on public.quest_clues
  for select
  to authenticated
  using (true);

-- quest_teams: team rows are public-readable to authenticated users (for
-- invite-code lookups). Team leaders insert; members can also read via the
-- team-member check.
drop policy if exists "quest_teams_invite_code_lookup" on public.quest_teams;
create policy "quest_teams_invite_code_lookup"
  on public.quest_teams
  for select
  to authenticated
  using (true);

drop policy if exists "quest_teams_member_read" on public.quest_teams;
create policy "quest_teams_member_read"
  on public.quest_teams
  for select
  to authenticated
  using (public.quest_is_team_member(id));

drop policy if exists "quest_teams_leader_insert" on public.quest_teams;
create policy "quest_teams_leader_insert"
  on public.quest_teams
  for insert
  to authenticated
  with check (auth.uid() = leader_user_id);

-- quest_team_members
drop policy if exists "quest_team_members_member_read" on public.quest_team_members;
create policy "quest_team_members_member_read"
  on public.quest_team_members
  for select
  to authenticated
  using ((user_id = auth.uid()) or public.quest_is_team_member(team_id));

drop policy if exists "quest_team_members_self_insert" on public.quest_team_members;
create policy "quest_team_members_self_insert"
  on public.quest_team_members
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- quest_hunt_sessions
drop policy if exists "quest_hunt_sessions_authed_read" on public.quest_hunt_sessions;
create policy "quest_hunt_sessions_authed_read"
  on public.quest_hunt_sessions
  for select
  to authenticated
  using (true);

drop policy if exists "quest_hunt_sessions_member_insert" on public.quest_hunt_sessions;
create policy "quest_hunt_sessions_member_insert"
  on public.quest_hunt_sessions
  for insert
  to authenticated
  with check (public.quest_is_team_member(team_id));

drop policy if exists "quest_hunt_sessions_member_update" on public.quest_hunt_sessions;
create policy "quest_hunt_sessions_member_update"
  on public.quest_hunt_sessions
  for update
  to authenticated
  using (public.quest_is_team_member(team_id));

-- quest_clue_progress
drop policy if exists "quest_clue_progress_member_read" on public.quest_clue_progress;
create policy "quest_clue_progress_member_read"
  on public.quest_clue_progress
  for select
  to authenticated
  using (
    exists (
      select 1 from public.quest_hunt_sessions s
      where s.id = quest_clue_progress.hunt_session_id
        and public.quest_is_team_member(s.team_id)
    )
  );

drop policy if exists "quest_clue_progress_member_insert" on public.quest_clue_progress;
create policy "quest_clue_progress_member_insert"
  on public.quest_clue_progress
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.quest_hunt_sessions s
      where s.id = quest_clue_progress.hunt_session_id
        and public.quest_is_team_member(s.team_id)
    )
  );

drop policy if exists "quest_clue_progress_member_update" on public.quest_clue_progress;
create policy "quest_clue_progress_member_update"
  on public.quest_clue_progress
  for update
  to authenticated
  using (
    exists (
      select 1 from public.quest_hunt_sessions s
      where s.id = quest_clue_progress.hunt_session_id
        and public.quest_is_team_member(s.team_id)
    )
  );

-- quest_profiles
-- Note: live DB has quest_profiles_authed_read (roles: authenticated) plus
-- quest_profiles_self_read / _self_update / _self_upsert (roles: public).
-- The public-role policies still effectively scope to authenticated callers
-- because auth.uid() returns null for anon, so auth.uid() = user_id is false.
drop policy if exists "quest_profiles_authed_read" on public.quest_profiles;
create policy "quest_profiles_authed_read"
  on public.quest_profiles
  for select
  to authenticated
  using (true);

drop policy if exists "quest_profiles_self_read" on public.quest_profiles;
create policy "quest_profiles_self_read"
  on public.quest_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "quest_profiles_self_update" on public.quest_profiles;
create policy "quest_profiles_self_update"
  on public.quest_profiles
  for update
  using (auth.uid() = user_id);

drop policy if exists "quest_profiles_self_upsert" on public.quest_profiles;
create policy "quest_profiles_self_upsert"
  on public.quest_profiles
  for insert
  with check (auth.uid() = user_id);
