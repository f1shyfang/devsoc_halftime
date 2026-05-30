# Schema dump cleanup (Supabase → Neon)

How the Neon `public` schema was produced from the live Supabase database
(Supabase PG 17.6 → Neon PG 17.10). Run once during the migration; kept for
reproducibility.

## Source

Dumped via the Supabase **session pooler** (the direct `db.<ref>.supabase.co`
host is IPv6-only and unreachable from the dev box):

```bash
pg_dump "$SUPABASE_DB_URL" \
  --schema-only --schema=public --no-owner --no-privileges \
  --no-publications --no-subscriptions \
  -f /tmp/supabase_schema.sql
```

`pg_dump` must be **v17** (matching the server); Ubuntu 24.04's default v16
refuses a v17 server. Installed `postgresql-client-17` from the PGDG repo.

## Removed before loading into Neon

Stripped with `sed` (see migration run):

- `CREATE SCHEMA public;` and `COMMENT ON SCHEMA public ...` — Neon's `neondb`
  already has a `public` schema.
- `ALTER TABLE public.building_enrichments ENABLE ROW LEVEL SECURITY;` — RLS is
  dropped (design decision; access is now server-side and trusted).
- `CREATE POLICY building_enrichments_public_read ON ...;` — the only RLS policy.

Dropped in Neon **after** load (orphan functions from an abandoned bounty/
check-in experiment that polluted the shared Supabase DB — they reference
`auth.uid()` and bounty/request tables that do not exist in this app):

```sql
DROP FUNCTION IF EXISTS public.accept_request(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.reject_request(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.check_in(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_checkin_token(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_queue_rank(text) CASCADE;
DROP FUNCTION IF EXISTS public.request_to_join(text, text, text[]) CASCADE;
```

## Not present (verified, no action needed)

- No `storage.*` references.
- No `CREATE EXTENSION` lines (defaults like `gen_random_uuid()` are core in
  PG13+; Neon provides them).
- No `GRANT`/`REVOKE` to `anon`/`authenticated`/`service_role` (suppressed by
  `--no-privileges`).

## Result

Neon `public`: 13 base tables, 1 view (`mvp_puzzles_public`), 19 functions
(all `quest_*`/`mvp_*`), zero `auth.uid()` references. Functions captured in
`db/functions.sql` via `pg_get_functiondef` (canonical copy going forward).

## Note for the unlock route

There are **two** `quest_unlock_clue` overloads in the schema — a 6-arg version
and a 7-arg version that adds `p_maps_used integer DEFAULT 0`. Confirm which the
play-shell uses and wire the API route to the matching signature.
