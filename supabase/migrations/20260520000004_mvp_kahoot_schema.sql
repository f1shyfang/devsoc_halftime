-- Kahoot-style MVP game schema (spec_sheet_v1.md §7–8).
-- Parallel to quest_* (PRD demo); powers /join, /play, /leaderboard.

create extension if not exists pgcrypto;

-- =============================================================================
-- Tables
-- =============================================================================

create table if not exists public.mvp_hunts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      text not null default 'published'
    check (status = any (array['draft'::text, 'published'::text, 'archived'::text])),
  created_at  timestamptz not null default now()
);

create table if not exists public.mvp_puzzles (
  id                 uuid primary key default gen_random_uuid(),
  hunt_id            uuid not null references public.mvp_hunts(id) on delete cascade,
  sequence           int not null check (sequence >= 0),
  type               text not null
    check (type = any (array['anagram'::text, 'riddle_to_geocache'::text, 'photo'::text])),
  prompt             text not null,
  answer             text,
  verification_code  text,
  walk_to_prompt     text,
  optional           boolean not null default false,
  unique (hunt_id, sequence)
);

create table if not exists public.mvp_games (
  id                       uuid primary key default gen_random_uuid(),
  hunt_id                  uuid not null references public.mvp_hunts(id),
  status                   text not null default 'active'
    check (status = any (array['lobby'::text, 'active'::text, 'ended'::text])),
  started_at               timestamptz not null default now(),
  hardcoded_start_location text not null default 'Head to the pitch room.'
);

create table if not exists public.mvp_players (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references public.mvp_games(id) on delete cascade,
  name                text not null,
  joined_at           timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  total_time_seconds  int,
  awaiting_walk_ack   boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists mvp_players_game_idx on public.mvp_players (game_id);

create table if not exists public.mvp_puzzle_progress (
  player_id  uuid not null references public.mvp_players(id) on delete cascade,
  puzzle_id  uuid not null references public.mvp_puzzles(id) on delete cascade,
  solved_at  timestamptz not null default now(),
  attempts   int not null default 1,
  photo_url  text,
  skipped    boolean not null default false,
  primary key (player_id, puzzle_id)
);

-- Public puzzle metadata (no answers / codes).
create or replace view public.mvp_puzzles_public as
select
  id,
  hunt_id,
  sequence,
  type,
  prompt,
  walk_to_prompt,
  optional
from public.mvp_puzzles;

-- =============================================================================
-- Realtime
-- =============================================================================

alter table public.mvp_players replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mvp_players'
  ) then
    alter publication supabase_realtime add table public.mvp_players;
  end if;
end $$;

-- =============================================================================
-- Access: anon reads leaderboard + public puzzles; writes via RPC
-- =============================================================================

alter table public.mvp_hunts disable row level security;
alter table public.mvp_puzzles disable row level security;
alter table public.mvp_games disable row level security;
alter table public.mvp_players disable row level security;
alter table public.mvp_puzzle_progress disable row level security;

grant select on public.mvp_hunts, public.mvp_games, public.mvp_players, public.mvp_puzzle_progress to anon, authenticated;
grant select on public.mvp_puzzles_public to anon, authenticated;
revoke all on public.mvp_puzzles from anon, authenticated;

-- =============================================================================
-- Helpers
-- =============================================================================

create or replace function public.mvp_normalize_text(p text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p, '')));
$$;

create or replace function public.mvp_get_player_state(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_player public.mvp_players;
  v_game public.mvp_games;
  v_puzzle public.mvp_puzzles;
  v_elapsed int;
  v_prev public.mvp_puzzles;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then
    raise exception 'player not found';
  end if;

  select * into v_game from public.mvp_games where id = v_player.game_id;
  if v_game.id is null then
    raise exception 'game not found';
  end if;

  if v_player.completed_at is not null then
    return jsonb_build_object(
      'player_id', v_player.id,
      'name', v_player.name,
      'game_id', v_player.game_id,
      'phase', 'completed',
      'total_time_seconds', v_player.total_time_seconds,
      'start_location', v_game.hardcoded_start_location
    );
  end if;

  if v_player.started_at is null then
    return jsonb_build_object(
      'player_id', v_player.id,
      'name', v_player.name,
      'game_id', v_player.game_id,
      'phase', 'welcome',
      'start_location', v_game.hardcoded_start_location
    );
  end if;

  v_elapsed := floor(extract(epoch from (now() - v_player.started_at)))::int;

  if v_player.awaiting_walk_ack then
    select p.* into v_prev
    from public.mvp_puzzles p
    join public.mvp_puzzle_progress pp on pp.puzzle_id = p.id and pp.player_id = v_player.id
    where p.hunt_id = v_game.hunt_id and p.walk_to_prompt is not null
    order by p.sequence desc
    limit 1;

    return jsonb_build_object(
      'player_id', v_player.id,
      'name', v_player.name,
      'game_id', v_player.game_id,
      'phase', 'walk',
      'walk_prompt', coalesce(v_prev.walk_to_prompt, 'Keep walking.'),
      'elapsed_seconds', v_elapsed,
      'start_location', v_game.hardcoded_start_location
    );
  end if;

  select p.* into v_puzzle
  from public.mvp_puzzles p
  where p.hunt_id = v_game.hunt_id
    and not exists (
      select 1 from public.mvp_puzzle_progress pp
      where pp.player_id = v_player.id and pp.puzzle_id = p.id
    )
  order by p.sequence asc
  limit 1;

  if v_puzzle.id is null then
    perform public.mvp_complete_player(p_player_id);
    select * into v_player from public.mvp_players where id = p_player_id;
    return jsonb_build_object(
      'player_id', v_player.id,
      'name', v_player.name,
      'game_id', v_player.game_id,
      'phase', 'completed',
      'total_time_seconds', v_player.total_time_seconds,
      'start_location', v_game.hardcoded_start_location
    );
  end if;

  return jsonb_build_object(
    'player_id', v_player.id,
    'name', v_player.name,
    'game_id', v_player.game_id,
    'phase', case when v_puzzle.type = 'photo' then 'photo' else 'puzzle' end,
    'elapsed_seconds', v_elapsed,
    'start_location', v_game.hardcoded_start_location,
    'puzzle', jsonb_build_object(
      'id', v_puzzle.id,
      'type', v_puzzle.type,
      'prompt', v_puzzle.prompt,
      'optional', v_puzzle.optional
    )
  );
end;
$function$;

create or replace function public.mvp_join_game(
  p_game_id uuid,
  p_name text,
  p_existing_player_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_game public.mvp_games;
  v_player public.mvp_players;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'name is required';
  end if;

  select * into v_game from public.mvp_games where id = p_game_id;
  if v_game.id is null then
    raise exception 'game not found';
  end if;
  if v_game.status not in ('lobby', 'active') then
    raise exception 'game is not joinable';
  end if;

  if p_existing_player_id is not null then
    select * into v_player
    from public.mvp_players
    where id = p_existing_player_id and game_id = p_game_id;
    if v_player.id is not null then
      return public.mvp_get_player_state(v_player.id);
    end if;
  end if;

  insert into public.mvp_players (game_id, name)
  values (p_game_id, v_name)
  returning * into v_player;

  return public.mvp_get_player_state(v_player.id);
end;
$function$;

create or replace function public.mvp_confirm_start(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player public.mvp_players;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then
    raise exception 'player not found';
  end if;
  if v_player.started_at is not null then
    return public.mvp_get_player_state(p_player_id);
  end if;

  update public.mvp_players
  set started_at = now()
  where id = p_player_id;

  return public.mvp_get_player_state(p_player_id);
end;
$function$;

create or replace function public.mvp_ack_walk(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.mvp_players
  set awaiting_walk_ack = false
  where id = p_player_id;

  return public.mvp_get_player_state(p_player_id);
end;
$function$;

create or replace function public.mvp_submit_anagram(
  p_player_id uuid,
  p_puzzle_id uuid,
  p_input text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player public.mvp_players;
  v_game public.mvp_games;
  v_puzzle public.mvp_puzzles;
  v_attempts int := 1;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.started_at is null then raise exception 'hunt not started'; end if;
  if v_player.completed_at is not null then raise exception 'already completed'; end if;

  select * into v_game from public.mvp_games where id = v_player.game_id;
  select * into v_puzzle from public.mvp_puzzles where id = p_puzzle_id and hunt_id = v_game.hunt_id;

  if v_puzzle.id is null or v_puzzle.type <> 'anagram' then
    raise exception 'invalid puzzle';
  end if;

  if public.mvp_normalize_text(p_input) <> public.mvp_normalize_text(v_puzzle.answer) then
    return jsonb_build_object('ok', false, 'message', 'Not quite — try again.');
  end if;

  insert into public.mvp_puzzle_progress (player_id, puzzle_id, attempts)
  values (p_player_id, p_puzzle_id, 1)
  on conflict (player_id, puzzle_id) do nothing;

  if v_puzzle.walk_to_prompt is not null then
    update public.mvp_players set awaiting_walk_ack = true where id = p_player_id;
  end if;

  return public.mvp_get_player_state(p_player_id) || jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.mvp_submit_geocache_code(
  p_player_id uuid,
  p_puzzle_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player public.mvp_players;
  v_game public.mvp_games;
  v_puzzle public.mvp_puzzles;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.started_at is null then raise exception 'hunt not started'; end if;
  if v_player.completed_at is not null then raise exception 'already completed'; end if;

  select * into v_game from public.mvp_games where id = v_player.game_id;
  select * into v_puzzle from public.mvp_puzzles where id = p_puzzle_id and hunt_id = v_game.hunt_id;

  if v_puzzle.id is null or v_puzzle.type <> 'riddle_to_geocache' then
    raise exception 'invalid puzzle';
  end if;

  if public.mvp_normalize_text(p_code) <> public.mvp_normalize_text(v_puzzle.verification_code) then
    return jsonb_build_object('ok', false, 'message', 'Code does not match — try again or scan the QR.');
  end if;

  insert into public.mvp_puzzle_progress (player_id, puzzle_id, attempts)
  values (p_player_id, p_puzzle_id, 1)
  on conflict (player_id, puzzle_id) do nothing;

  return public.mvp_get_player_state(p_player_id) || jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.mvp_record_photo(
  p_player_id uuid,
  p_puzzle_id uuid,
  p_photo_url text default null,
  p_skipped boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player public.mvp_players;
  v_game public.mvp_games;
  v_puzzle public.mvp_puzzles;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;

  select * into v_game from public.mvp_games where id = v_player.game_id;
  select * into v_puzzle from public.mvp_puzzles where id = p_puzzle_id and hunt_id = v_game.hunt_id;

  if v_puzzle.id is null or v_puzzle.type <> 'photo' then
    raise exception 'invalid puzzle';
  end if;

  insert into public.mvp_puzzle_progress (player_id, puzzle_id, photo_url, skipped, attempts)
  values (p_player_id, p_puzzle_id, p_photo_url, p_skipped, 1)
  on conflict (player_id, puzzle_id) do update
    set photo_url = coalesce(excluded.photo_url, mvp_puzzle_progress.photo_url),
        skipped = excluded.skipped;

  return public.mvp_get_player_state(p_player_id);
end;
$function$;

create or replace function public.mvp_complete_player(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player public.mvp_players;
  v_total int;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.completed_at is not null then
    return public.mvp_get_player_state(p_player_id);
  end if;
  if v_player.started_at is null then
    raise exception 'hunt not started';
  end if;

  v_total := floor(extract(epoch from (now() - v_player.started_at)))::int;

  update public.mvp_players
  set completed_at = now(),
      total_time_seconds = v_total
  where id = p_player_id;

  return public.mvp_get_player_state(p_player_id);
end;
$function$;

grant execute on function public.mvp_get_player_state(uuid) to anon, authenticated;
grant execute on function public.mvp_join_game(uuid, text, uuid) to anon, authenticated;
grant execute on function public.mvp_confirm_start(uuid) to anon, authenticated;
grant execute on function public.mvp_ack_walk(uuid) to anon, authenticated;
grant execute on function public.mvp_submit_anagram(uuid, uuid, text) to anon, authenticated;
grant execute on function public.mvp_submit_geocache_code(uuid, uuid, text) to anon, authenticated;
grant execute on function public.mvp_record_photo(uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function public.mvp_complete_player(uuid) to anon, authenticated;

-- =============================================================================
-- Demo seed (fixed game id for kickoff QR)
-- =============================================================================

insert into public.mvp_hunts (id, name, description, status)
values (
  '22222222-2222-4222-8222-000000000001'::uuid,
  'Pitch Demo Hunt',
  'Two-puzzle Kahoot-style demo for the halftime pitch.',
  'published'
)
on conflict (id) do nothing;

insert into public.mvp_games (id, hunt_id, status, hardcoded_start_location)
values (
  '33333333-3333-4333-8333-000000000001'::uuid,
  '22222222-2222-4222-8222-000000000001'::uuid,
  'active',
  'Welcome! Head to the pitch room door — when you are there, tap I''m here to start your timer.'
)
on conflict (id) do nothing;

insert into public.mvp_puzzles (
  id, hunt_id, sequence, type, prompt, answer, verification_code, walk_to_prompt, optional
) values
  (
    '44444444-4444-4444-8444-000000000001'::uuid,
    '22222222-2222-4222-8222-000000000001'::uuid,
    0,
    'anagram',
    'Unscramble: ROOD',
    'door',
    null,
    'Now walk to the door.',
    false
  ),
  (
    '44444444-4444-4444-8444-000000000002'::uuid,
    '22222222-2222-4222-8222-000000000001'::uuid,
    1,
    'riddle_to_geocache',
    'I hold thousands of worlds but never leave my shelf. Find the code hidden at the door.',
    null,
    'QUEST42',
    null,
    false
  ),
  (
    '44444444-4444-4444-8444-000000000003'::uuid,
    '22222222-2222-4222-8222-000000000001'::uuid,
    2,
    'photo',
    'Take a selfie with the prize!',
    null,
    null,
    null,
    true
  )
on conflict (id) do nothing;
