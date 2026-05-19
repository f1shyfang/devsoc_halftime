-- Results card storage bucket + quest_hunt_sessions.results_card_url column.
--
-- Backs the `generate_results_card` Edge Function (PRD §6.8): a 9:16 PNG is
-- rendered server-side on hunt completion, uploaded to the public
-- `results-cards` bucket, and the public URL is persisted on the session row
-- so re-tapping "Share" is idempotent. Per PRD §7.4 the bucket is public
-- read — results cards only contain non-sensitive aggregate info (hunt name,
-- team name, time, rank, one hero photo).

-- =============================================================================
-- 1. quest_hunt_sessions.results_card_url
-- =============================================================================

alter table public.quest_hunt_sessions
  add column if not exists results_card_url text;

-- =============================================================================
-- 2. `results-cards` storage bucket
-- =============================================================================

-- Idempotent insert. storage.buckets is owned by the storage extension and
-- ships with every Supabase project, so we don't need to create the table.
insert into storage.buckets (id, name, public)
values ('results-cards', 'results-cards', true)
on conflict (id) do update
  set public = excluded.public;

-- =============================================================================
-- 3. Storage RLS policies for `results-cards`
-- =============================================================================
-- Public bucket flag covers anonymous read via the storage REST API, but RLS
-- still gates direct SELECTs against storage.objects. Allow anyone to read,
-- and restrict writes to the service-role (the Edge Function uses the
-- service-role key; service_role bypasses RLS, but we add an explicit policy
-- so the intent is documented).

drop policy if exists "results_cards_public_read" on storage.objects;
create policy "results_cards_public_read"
  on storage.objects
  for select
  using (bucket_id = 'results-cards');

drop policy if exists "results_cards_service_write" on storage.objects;
create policy "results_cards_service_write"
  on storage.objects
  for insert
  to service_role
  with check (bucket_id = 'results-cards');

drop policy if exists "results_cards_service_update" on storage.objects;
create policy "results_cards_service_update"
  on storage.objects
  for update
  to service_role
  using (bucket_id = 'results-cards');
