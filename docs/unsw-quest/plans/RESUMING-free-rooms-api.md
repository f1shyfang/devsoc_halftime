# Free-Rooms API Backend — Resume Handoff

**Saved:** 2026-05-19
**Branch:** `feat/free-rooms-api-backend`
**Plan:** [`docs/unsw-quest/plans/2026-05-19-free-rooms-api-backend.md`](./2026-05-19-free-rooms-api-backend.md)
**Spec:** [`docs/unsw-quest/specs/2026-05-19-free-rooms-api-design.md`](../specs/2026-05-19-free-rooms-api-design.md)

> This file exists because the previous Claude Code session was restarted to make the Supabase MCP server tools available. Use it to pick up exactly where we stopped.

---

## TL;DR

We're executing the Free-Rooms API backend implementation plan with subagent-driven-development. **Task 0 is committed.** **Task 1 stopped at the operator gate** (applying the SQL migration to Supabase). Once the migration is applied, the previous session's plan was to dispatch one subagent per remaining task (2 → 13), with spec-compliance + code-quality reviews between each.

---

## Commits on this branch so far

```
0418585  docs(unsw-quest): add free-rooms-api design spec and implementation plan
af74ee9  chore: add vitest, tsx; bypass auth redirect for /api/*           [Task 0]
<HEAD>   docs(unsw-quest): add free-rooms-api resume handoff                [this commit]
```

Run `git log --oneline` to confirm.

---

## What's uncommitted and waiting for you

`supabase/migrations/20260519000000_building_enrichments.sql` — the SQL is written, but the migration **has not been applied** to the live Supabase project yet. That's the operator gate for Task 1.

---

## Resume steps (do these in order)

### Step A — Apply the migration

Supabase project ref: **`vpwrrlkeinfjxoiaetwf`** (already wired in `.mcp.json`).

After Claude Code restarts, the Supabase MCP server should expose tools (typically `mcp__supabase__execute_sql` or similar). Use it to run:

```sql
create table public.building_enrichments (
  building_id          text primary key,
  building_name        text not null,
  foursquare_place_id  text,
  photo_url            text,
  address              text,
  match_confidence     text not null
    check (match_confidence in ('high', 'medium', 'low', 'no_match')),
  match_method         text
    check (match_method in ('name_and_proximity', 'proximity_only', 'manual')),
  enriched_at          timestamptz not null default now()
);

alter table public.building_enrichments enable row level security;

create policy "building_enrichments_public_read"
  on public.building_enrichments
  for select
  using (true);
```

(Same content as `supabase/migrations/20260519000000_building_enrichments.sql`.)

**Manual fallback:** paste the SQL into [the Supabase SQL editor](https://supabase.com/dashboard/project/vpwrrlkeinfjxoiaetwf/sql/new) and run it there.

### Step B — Verify

Confirm the table exists, RLS is enabled, and the policy is in place. Either via MCP or:

```sql
select tablename, rowsecurity
  from pg_tables
  where schemaname = 'public' and tablename = 'building_enrichments';

select policyname, cmd, qual
  from pg_policies
  where tablename = 'building_enrichments';
```

Expected: one table row with `rowsecurity = true`; one policy named `building_enrichments_public_read` with `cmd = SELECT`.

### Step C — Commit the migration file

```bash
git add supabase/migrations/20260519000000_building_enrichments.sql
git commit -m "$(cat <<'EOF'
feat: add building_enrichments table for Foursquare cache

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

This closes Task 1.

### Step D — Continue executing the plan

Re-invoke the subagent-driven-development skill on the plan:

> Execute the implementation plan at `docs/unsw-quest/plans/2026-05-19-free-rooms-api-backend.md`. We are on branch `feat/free-rooms-api-backend`. Tasks 0 and 1 are already committed (`af74ee9` and the migration commit). Dispatch one subagent per remaining task starting at Task 2 (Freerooms types). Two-stage review between tasks: spec compliance first, then code quality. Stop and ask the user before Task 12 (needs FOURSQUARE_API_KEY and SUPABASE_SERVICE_ROLE_KEY in `.env.local`) and Task 13 (operator-driven smoke test).

The session-local TaskCreate state from the previous run is gone — the new controller should re-create tracking entries for Tasks 2–13 if it wants progress visibility.

---

## Operator gates still ahead

| Task | Gate |
|---|---|
| **Task 12 — Backfill script** | Needs `FOURSQUARE_API_KEY` (sign up at [foursquare.com/developers](https://foursquare.com/developers)) and `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Settings → API) in `.env.local` before the script can run. Also needs `dotenv-cli` (the plan installs it if missing) since `tsx` doesn't auto-load `.env.local`. |
| **Task 13 — End-to-end smoke test** | Requires the dev server running and the backfill data populated. Verify with `curl` + `jq`. |

---

## Design decisions already locked (do not re-litigate)

- **Public endpoint, no auth** for the v1 demo (Freerooms is public anyway, photo URLs are CDN-public).
- **Foursquare's role:** photos + addresses for buildings (Freerooms already supplies lat/lng).
- **Mobile-first** UI is mandated per PRD §7.0 — applies to frontend teammates, not this backend slice.
- **Backend lives in this Next.js repo** as route handlers (not Edge Functions, not a separate service).
- **24h cache** on Freerooms buildings/rooms via Next's `unstable_cache`; live status uncached.
- **Backfill is an on-demand `npm run enrich` script**, not a cron.
- **Strict TDD** on the algorithmic pieces called out in spec §9 (name similarity, confidence classifier, best-candidate picker, aggregation join, route param validation).
- **`building_enrichments` table** owns the cache; RLS read-public, writes via service-role from the backfill script.

---

## Reading order for the resuming session

1. **This file** (you are here)
2. **The plan:** [`2026-05-19-free-rooms-api-backend.md`](./2026-05-19-free-rooms-api-backend.md) — 13 tasks, full checkboxed steps, all code shown inline
3. **The spec** (only if any decision feels ambiguous): [`2026-05-19-free-rooms-api-design.md`](../specs/2026-05-19-free-rooms-api-design.md)
4. **The PRD** (only for big-picture context): [`PRD_v1.md`](../PRD_v1.md)

---

## Other context worth knowing

- `gstack` has been removed from this repo — there's no `CLAUDE.md`, no PreToolUse hook checking for gstack, no `.gitmodules`. Past commit `3fe462d` (`remove gstack stuff`) handled that. Do not re-install gstack.
- The mobile-first directive is also saved as user memory at `~/.claude/projects/-mnt-d-Documents-devsoc-halftime/memory/feedback_mobile_first.md`.
- Pre-existing baseline lint failure in `tailwind.config.ts:62` (`require()` style import) — unrelated to this branch, not introduced by Task 0. Don't try to fix it here unless asked.
- The repo has no test runner state from before this branch; Vitest was added in Task 0.

---

*Delete this file once the resume is complete and the migration commit is on the branch.*
