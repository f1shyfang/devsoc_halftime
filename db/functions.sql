-- Postgres functions migrated from Supabase to Neon.
-- Generated from the live Neon DB via pg_get_functiondef.
-- Drizzle owns table DDL; this file owns functions/RPCs. Apply with psql.

CREATE OR REPLACE FUNCTION public.mvp_ack_walk(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.mvp_players set awaiting_walk_ack = false where id = p_player_id;
  return public.mvp_get_player_state(p_player_id);
end; $function$
;

CREATE OR REPLACE FUNCTION public.mvp_complete_player(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_player public.mvp_players; v_total int;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.completed_at is not null then return public.mvp_get_player_state(p_player_id); end if;
  if v_player.started_at is null then raise exception 'hunt not started'; end if;
  v_total := floor(extract(epoch from (now() - v_player.started_at)))::int;
  update public.mvp_players set completed_at = now(), total_time_seconds = v_total where id = p_player_id;
  return public.mvp_get_player_state(p_player_id);
end; $function$
;

CREATE OR REPLACE FUNCTION public.mvp_confirm_start(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_player public.mvp_players;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.started_at is not null then return public.mvp_get_player_state(p_player_id); end if;
  update public.mvp_players set started_at = now() where id = p_player_id;
  return public.mvp_get_player_state(p_player_id);
end; $function$
;

CREATE OR REPLACE FUNCTION public.mvp_get_player_state(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.mvp_players;
  v_game public.mvp_games;
  v_puzzle public.mvp_puzzles;
  v_elapsed int;
  v_prev public.mvp_puzzles;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  select * into v_game from public.mvp_games where id = v_player.game_id;
  if v_game.id is null then raise exception 'game not found'; end if;
  if v_player.completed_at is not null then
    return jsonb_build_object('player_id', v_player.id, 'name', v_player.name, 'game_id', v_player.game_id, 'phase', 'completed', 'total_time_seconds', v_player.total_time_seconds, 'start_location', v_game.hardcoded_start_location);
  end if;
  if v_player.started_at is null then
    return jsonb_build_object('player_id', v_player.id, 'name', v_player.name, 'game_id', v_player.game_id, 'phase', 'welcome', 'start_location', v_game.hardcoded_start_location);
  end if;
  v_elapsed := floor(extract(epoch from (now() - v_player.started_at)))::int;
  if v_player.awaiting_walk_ack then
    select p.* into v_prev from public.mvp_puzzles p
    join public.mvp_puzzle_progress pp on pp.puzzle_id = p.id and pp.player_id = v_player.id
    where p.hunt_id = v_game.hunt_id and p.walk_to_prompt is not null
    order by p.sequence desc limit 1;
    return jsonb_build_object('player_id', v_player.id, 'name', v_player.name, 'game_id', v_player.game_id, 'phase', 'walk', 'walk_prompt', coalesce(v_prev.walk_to_prompt, 'Keep walking.'), 'elapsed_seconds', v_elapsed, 'start_location', v_game.hardcoded_start_location);
  end if;
  select p.* into v_puzzle from public.mvp_puzzles p
  where p.hunt_id = v_game.hunt_id and not exists (select 1 from public.mvp_puzzle_progress pp where pp.player_id = v_player.id and pp.puzzle_id = p.id)
  order by p.sequence asc limit 1;
  if v_puzzle.id is null then
    perform public.mvp_complete_player(p_player_id);
    select * into v_player from public.mvp_players where id = p_player_id;
    return jsonb_build_object('player_id', v_player.id, 'name', v_player.name, 'game_id', v_player.game_id, 'phase', 'completed', 'total_time_seconds', v_player.total_time_seconds, 'start_location', v_game.hardcoded_start_location);
  end if;
  return jsonb_build_object('player_id', v_player.id, 'name', v_player.name, 'game_id', v_player.game_id, 'phase', case when v_puzzle.type = 'photo' then 'photo' else 'puzzle' end, 'elapsed_seconds', v_elapsed, 'start_location', v_game.hardcoded_start_location, 'puzzle', jsonb_build_object('id', v_puzzle.id, 'type', v_puzzle.type, 'prompt', v_puzzle.prompt, 'optional', v_puzzle.optional));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mvp_join_game(p_game_id uuid, p_name text, p_existing_player_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_game public.mvp_games; v_player public.mvp_players; v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' then raise exception 'name is required'; end if;
  select * into v_game from public.mvp_games where id = p_game_id;
  if v_game.id is null then raise exception 'game not found'; end if;
  if v_game.status not in ('lobby', 'active') then raise exception 'game is not joinable'; end if;
  if p_existing_player_id is not null then
    select * into v_player from public.mvp_players where id = p_existing_player_id and game_id = p_game_id;
    if v_player.id is not null then return public.mvp_get_player_state(v_player.id); end if;
  end if;
  insert into public.mvp_players (game_id, name) values (p_game_id, v_name) returning * into v_player;
  return public.mvp_get_player_state(v_player.id);
end; $function$
;

CREATE OR REPLACE FUNCTION public.mvp_normalize_text(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select lower(trim(coalesce(p, '')));
$function$
;

CREATE OR REPLACE FUNCTION public.mvp_record_photo(p_player_id uuid, p_puzzle_id uuid, p_photo_url text DEFAULT NULL::text, p_skipped boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_player public.mvp_players; v_game public.mvp_games; v_puzzle public.mvp_puzzles;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  select * into v_game from public.mvp_games where id = v_player.game_id;
  select * into v_puzzle from public.mvp_puzzles where id = p_puzzle_id and hunt_id = v_game.hunt_id;
  if v_puzzle.id is null or v_puzzle.type <> 'photo' then raise exception 'invalid puzzle'; end if;
  insert into public.mvp_puzzle_progress (player_id, puzzle_id, photo_url, skipped, attempts)
  values (p_player_id, p_puzzle_id, p_photo_url, p_skipped, 1)
  on conflict (player_id, puzzle_id) do update set photo_url = coalesce(excluded.photo_url, mvp_puzzle_progress.photo_url), skipped = excluded.skipped;
  return public.mvp_get_player_state(p_player_id);
end; $function$
;

CREATE OR REPLACE FUNCTION public.mvp_submit_anagram(p_player_id uuid, p_puzzle_id uuid, p_input text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_player public.mvp_players; v_game public.mvp_games; v_puzzle public.mvp_puzzles;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.started_at is null then raise exception 'hunt not started'; end if;
  if v_player.completed_at is not null then raise exception 'already completed'; end if;
  select * into v_game from public.mvp_games where id = v_player.game_id;
  select * into v_puzzle from public.mvp_puzzles where id = p_puzzle_id and hunt_id = v_game.hunt_id;
  if v_puzzle.id is null or v_puzzle.type <> 'anagram' then raise exception 'invalid puzzle'; end if;
  if public.mvp_normalize_text(p_input) <> public.mvp_normalize_text(v_puzzle.answer) then
    return jsonb_build_object('ok', false, 'message', 'Not quite - try again.');
  end if;
  insert into public.mvp_puzzle_progress (player_id, puzzle_id, attempts) values (p_player_id, p_puzzle_id, 1) on conflict do nothing;
  if v_puzzle.walk_to_prompt is not null then update public.mvp_players set awaiting_walk_ack = true where id = p_player_id; end if;
  return public.mvp_get_player_state(p_player_id) || jsonb_build_object('ok', true);
end; $function$
;

CREATE OR REPLACE FUNCTION public.mvp_submit_geocache_code(p_player_id uuid, p_puzzle_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_player public.mvp_players; v_game public.mvp_games; v_puzzle public.mvp_puzzles;
begin
  select * into v_player from public.mvp_players where id = p_player_id;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.started_at is null then raise exception 'hunt not started'; end if;
  if v_player.completed_at is not null then raise exception 'already completed'; end if;
  select * into v_game from public.mvp_games where id = v_player.game_id;
  select * into v_puzzle from public.mvp_puzzles where id = p_puzzle_id and hunt_id = v_game.hunt_id;
  if v_puzzle.id is null or v_puzzle.type <> 'riddle_to_geocache' then raise exception 'invalid puzzle'; end if;
  if public.mvp_normalize_text(p_code) <> public.mvp_normalize_text(v_puzzle.verification_code) then
    return jsonb_build_object('ok', false, 'message', 'Code does not match - try again or scan the QR.');
  end if;
  insert into public.mvp_puzzle_progress (player_id, puzzle_id, attempts) values (p_player_id, p_puzzle_id, 1) on conflict do nothing;
  return public.mvp_get_player_state(p_player_id) || jsonb_build_object('ok', true);
end; $function$
;

CREATE OR REPLACE FUNCTION public.quest_abandon_idle_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_threshold constant interval := interval '30 minutes';
  v_count integer;
begin
  with last_activity as (
    select
      s.id as session_id,
      coalesce(
        (select max(p.unlocked_at)
           from public.quest_clue_progress p
          where p.hunt_session_id = s.id),
        s.started_at
      ) as last_active_at
    from public.quest_hunt_sessions s
    where s.state = 'in_progress'
  ),
  to_abandon as (
    select session_id
    from last_activity
    where last_active_at is not null
      and last_active_at < (now() - v_threshold)
  ),
  updated as (
    update public.quest_hunt_sessions s
       set state = 'abandoned',
           abandoned_at = now()
      from to_abandon a
     where s.id = a.session_id
       and s.state = 'in_progress'
    returning s.id
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.quest_apply_penalty(p_user_id uuid, p_session_id uuid, p_seconds integer)
 RETURNS public.quest_hunt_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := p_user_id;
  v_session public.quest_hunt_sessions;
  v_member_count int;
begin
  if v_user is null then
    raise exception 'p_user_id is required';
  end if;
  if p_seconds is null or p_seconds <= 0 then
    raise exception 'p_seconds must be positive';
  end if;

  select * into v_session from public.quest_hunt_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'session not found';
  end if;

  select count(*) into v_member_count
  from public.quest_team_members
  where team_id = v_session.team_id and user_id = v_user;
  if v_member_count = 0 then
    raise exception 'not a member of this team';
  end if;

  if v_session.state <> 'in_progress' then
    raise exception 'session is not in progress';
  end if;

  update public.quest_hunt_sessions
  set hint_penalty_seconds = hint_penalty_seconds + p_seconds
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.quest_create_team(p_user_id uuid, p_hunt_id uuid, p_team_name text DEFAULT NULL::text)
 RETURNS TABLE(team_id uuid, invite_code text, session_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.quest_ensure_profile(p_user_id uuid, p_display_name text)
 RETURNS public.quest_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    set display_name = coalesce(nullif(p_display_name, ''), public.quest_profiles.display_name)
  returning * into v_row;

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.quest_generate_invite_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.quest_is_team_member(p_user_id uuid, p_team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.quest_team_members
    where team_id = p_team_id and user_id = p_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.quest_join_team(p_user_id uuid, p_invite_code text)
 RETURNS TABLE(team_id uuid, hunt_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.quest_start_hunt(p_user_id uuid, p_team_id uuid)
 RETURNS public.quest_hunt_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.quest_unlock_clue(p_user_id uuid, p_session_id uuid, p_clue_id uuid, p_manual_override boolean DEFAULT false, p_hints_used integer DEFAULT 0, p_photo_url text DEFAULT NULL::text)
 RETURNS public.quest_hunt_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.quest_unlock_clue(p_user_id uuid, p_session_id uuid, p_clue_id uuid, p_manual_override boolean DEFAULT false, p_hints_used integer DEFAULT 0, p_photo_url text DEFAULT NULL::text, p_maps_used integer DEFAULT 0)
 RETURNS public.quest_hunt_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := p_user_id;
  v_session public.quest_hunt_sessions;
  v_clue public.quest_clues;
  v_max_seq int;
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

  insert into public.quest_clue_progress (
    hunt_session_id, clue_id, hints_used, maps_used, manual_override, photo_capture_url
  )
  values (p_session_id, p_clue_id, p_hints_used, p_maps_used, p_manual_override, p_photo_url)
  on conflict (hunt_session_id, clue_id) do update
    set hints_used = greatest(quest_clue_progress.hints_used, excluded.hints_used),
        maps_used = greatest(quest_clue_progress.maps_used, excluded.maps_used),
        manual_override = quest_clue_progress.manual_override or excluded.manual_override,
        photo_capture_url = coalesce(excluded.photo_capture_url, quest_clue_progress.photo_capture_url);

  select coalesce(max(sequence_in_tier), 0) into v_max_seq
  from public.quest_clues
  where hunt_id = v_session.hunt_id and tier = v_session.current_tier;

  if v_session.current_sequence < v_max_seq then
    v_next_tier := v_session.current_tier;
    v_next_seq := v_session.current_sequence + 1;
  else
    select min(tier) into v_next_tier
    from public.quest_clues
    where hunt_id = v_session.hunt_id and tier > v_session.current_tier;
    if v_next_tier is null then
      update public.quest_hunt_sessions
      set state = 'completed',
          completed_at = now(),
          total_time_seconds = floor(extract(epoch from (now() - started_at)))
            + hint_penalty_seconds
            + (coalesce(p_hints_used, 0) * 60)
            + (coalesce(p_maps_used, 0) * 60),
          hint_penalty_seconds = hint_penalty_seconds
            + (coalesce(p_hints_used, 0) * 60)
            + (coalesce(p_maps_used, 0) * 60)
      where id = p_session_id
      returning * into v_session;
      return v_session;
    end if;
    v_next_seq := 1;
  end if;

  update public.quest_hunt_sessions
  set current_tier = v_next_tier,
      current_sequence = v_next_seq,
      hint_penalty_seconds = hint_penalty_seconds
        + (coalesce(p_hints_used, 0) * 60)
        + (coalesce(p_maps_used, 0) * 60)
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$function$
;

