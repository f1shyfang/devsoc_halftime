# UNSW Quest — Handover

**Last updated:** 2026-05-30
**Branch:** `feat/neon-migration`

---

## TL;DR

UNSW Quest is a mobile-first campus scavenger hunt game on Next.js 16. The backend has been **fully migrated off Supabase** (Postgres + Storage + Realtime + Edge Functions + RLS) onto:

- **Neon Postgres** via **Drizzle ORM** (`@neondatabase/serverless` HTTP driver).
- **Vercel Blob** for file storage (photo uploads).
- **Plain Next.js API route handlers** calling Postgres functions (no SDK data plane).
- **SWR polling** instead of Realtime for live updates.

There are two playable surfaces, both running against Neon:

- **MVP "Pitch Hunt"** — individual play, `/join` → `/play` → `/leaderboard`, identity in `localStorage`.
- **Quest team/GPS demo** — `/quest/demo/[huntSlug]`, identity from a device-id cookie.

The migration is **complete** on this branch. **65 Vitest tests pass across 13 files.** The app runs.

---

## What's done (the migration — newest first)

| Commit | Change |
|---|---|
| — | Remove Supabase, finalize Neon env + test config |
| — | `rooms/free` route + enrich script off Supabase to Drizzle |
| — | MVP play-shell off Supabase RPC/Storage |
| — | Quest play-shell off Supabase RPC/Realtime/Storage |
| — | Quest clue-progress photo-url update route |
| — | Vercel Blob upload route + client helper |
| — | MVP join + leaderboard server pages off Supabase |
| — | Quest server pages off Supabase to Drizzle |
| — | Quest play-flow types off Supabase + combined session-state poll route |
| — | MVP/Quest live updates via SWR polling (replaced Realtime) |
| — | join-form + demo home off Supabase |
| — | Full set of quest + MVP + rooms API route handlers (team create/join, profile/start/unlock/penalty, session + standings reads, MVP join/actions/leaderboard, rooms/free) |
| — | device-id reader for route handlers |

---

## Current data layer

- **DB client** — `lib/db/client.ts`. `@neondatabase/serverless` HTTP driver + Drizzle, imports the full schema. Stateless, per-request safe, never bundled to the browser.
- **Schema** — `lib/db/schema.ts`. 13 base tables + 1 view:
  - Tables: `quest_hunts`, `quest_teams`, `quest_team_members`, `quest_profiles`, `quest_hunt_sessions`, `quest_clues`, `quest_clue_progress`, `mvp_hunts`, `mvp_games`, `mvp_players`, `mvp_puzzles`, `mvp_puzzle_progress`, `building_enrichments`.
  - View: `mvp_puzzles_public` — `mvp_puzzles` with `answer`/`verification_code` stripped (safe for anon reads).
- **RPCs** — `db/functions.sql`. 19 Postgres functions (`quest_*` and `mvp_*`), canonical copies captured via `pg_get_functiondef`. Invoked from route handlers via `callRpcOne`/`callRpcRows` in `lib/db/rpc.ts` (hardcoded function names only, no user-interpolated SQL).
- **Migrations** — drizzle-kit owns table DDL; output in `db/drizzle/` (current: `0000_living_wallow.sql`, introspected from the live Neon DB on 2026-05-30). Functions are applied separately via `psql "$DATABASE_URL" -f db/functions.sql`. `db/neon-setup.sql` is a one-time script that sets the Neon role `search_path` to include `public` so unqualified table/function names resolve through the pooler.
- **Storage** — Vercel Blob. `lib/blob/upload.ts` exports `uploadPublic(pathname, body, contentType?)`. Upload route `POST /api/uploads/quest-photo` (multipart `file` field → public blob URL). Client helper `uploadViaApi()` in `lib/api/fetcher.ts`.
- **Client data layer** — `lib/api/fetcher.ts` exports `postJson` (POST returning `{data, error}`, mirroring old Supabase ergonomics), `swrFetcher` (GET for SWR), `uploadViaApi`. `lib/api/device.ts` exports `getDeviceIdFromRequest(req)` used by route handlers.
- **Live updates** — **NO realtime.** The quest play loop polls `GET /api/quest/sessions/[id]/state` every ~2.5s via SWR (one consolidated read returning `{session, progress, members}`, replacing 3 old Realtime subscriptions). The MVP refetches `/api/mvp/players/[id]/state` on demand after each action (no polling loop).

---

## Environment variables

All server-side. Now documented in `.env.example`:

- `DATABASE_URL` — Neon pooled connection string.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob.
- `FOURSQUARE_API_KEY` — enrich script only.
- Optional: `FREEROOMS_BASE_URL`, `FOURSQUARE_BASE_URL`.

**Note:** `.env.local` may still contain legacy `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `DATABASE_URL_SUPA` / `SUPABASE_DB_URL`. These are **unused by runtime code** and can be removed; they were kept during the migration for reference.

---

## Architectural decisions to know

### 1. Supabase is fully removed from the runtime
Nothing imports it. The `supabase/` directory (`config.toml` + 13 historical migrations dated May 19–20) is kept **only** for historical reference / migration reproducibility. There are no remaining Supabase SDK imports in `lib`, `app`, or `scripts`. A few code comments still mention Supabase historically (e.g. the `proxy.ts` header, `app/quest/.../play/types.ts`, `app/api/quest/progress/photo/route.ts`) — harmless notes, not live dependencies. `scripts/db/clean-schema-dump.md` records exactly how the Neon `public` schema was produced from the live Supabase DB (pg_dump via session pooler, RLS/policy stripping, dropping orphan `auth.uid()` functions).

### 2. No auth, no RLS (demo trade-off)
Access is trusted server-side — route handlers read the device-id from the cookie and pass it into the functions; row access is not restricted. **Don't put sensitive data in these tables.** If the project goes past the demo, reintroducing a real auth/authorization model is the first hardening step.

### 3. Identity
- **Quest** — device-id v4 UUID in a `quest_device_id` cookie, set by `proxy.ts` (Next 16's renamed middleware; `SameSite=Lax`, not `HttpOnly`, `Secure` in prod, ~5y maxAge). `lib/device-id.ts` (client) + `lib/device-id.server.ts` (server).
- **MVP** — `player_id` (uuid from `/api/mvp/join`) stored in `localStorage` (`lib/mvp/player-storage.ts`). The MVP does **not** use the device-id cookie.

### 4. Next.js 16
- `middleware.ts` is renamed to `proxy.ts` (exported function is `proxy`). Its matcher **excludes `/api/` deliberately**, so API routes don't get the cookie auto-set — they read it from the request. If you add a quest API route that needs the cookie set on first hit, account for that.

### 5. Photos are off the table (for now)
`building_enrichments.photo_url` stays NULL — Foursquare's photo endpoint went Premium-only; photos were dropped for the demo. Candidate sources are noted in `docs/unsw-quest/plans/RESUMING-backfill-and-photos.md`.

---

## Outstanding / follow-up work

The app runs — these are nice-to-haves, not blockers.

1. **Cleanup (optional)** — delete the legacy Supabase env vars from `.env.local`, and consider removing the `supabase/` directory once the migration record is no longer needed.
2. **Player-name UX** — the quest demo still shows the raw device-id rather than a display name. Open from before the migration.
4. **UNSW-verified badge has no signal source** — email is gone. Drop it or design a new mechanism if it ever surfaces in UI.
5. **Buildings backfill** — run if/when the Free-Rooms API is surfaced in the UI: `npm run enrich`.
6. **`quest_unlock_clue` overloads** — there are two (6-arg and 7-arg with `p_maps_used`); the unlock route is wired to one. Keep them in sync if you touch the function. (Noted in `scripts/db/clean-schema-dump.md`.)

---

## Key files

```
proxy.ts                                          # Next 16 middleware — sets device-id cookie
lib/device-id.ts                                  # COOKIE_NAME + client-safe reader
lib/device-id.server.ts                           # server-only reader (next/headers)
lib/db/client.ts                                  # Neon + Drizzle client
lib/db/schema.ts                                  # 13 tables + 1 view
lib/db/rpc.ts                                     # callRpcOne / callRpcRows (Postgres function invocation)
lib/api/fetcher.ts                                # postJson, swrFetcher, uploadViaApi
lib/api/device.ts                                 # getDeviceIdFromRequest(req)
lib/blob/upload.ts                                # uploadPublic(pathname, body, contentType?)
lib/mvp/player-storage.ts                         # MVP player_id in localStorage
lib/mvp/constants.ts                              # MVP constants
lib/rooms/get-free-rooms.ts                       # Free-Rooms aggregation
lib/foursquare/client.ts                          # Foursquare Places API client
app/api/quest/**                                  # Quest route handlers
app/api/mvp/**                                    # MVP route handlers
app/api/rooms/free/route.ts                       # GET /api/rooms/free
app/api/uploads/quest-photo/route.ts              # POST multipart → public blob URL
app/quest/demo/[huntSlug]/team-gate.tsx           # Create/join team flow
app/quest/demo/[huntSlug]/play/play-shell.tsx     # Main game loop, SWR polling
app/quest/demo/[huntSlug]/standings/*             # Standings reads
app/{join,play,leaderboard}/*                     # MVP surfaces
db/functions.sql                                  # 19 Postgres functions
db/neon-setup.sql                                 # one-time role search_path setup
db/drizzle/                                        # drizzle-kit DDL (0000_living_wallow.sql)
scripts/enrich-buildings.ts                       # Buildings backfill (npm run enrich)
scripts/db/clean-schema-dump.md                   # How the Neon schema was produced
supabase/                                          # Legacy / historical only — nothing imports it
docs/unsw-quest/PRD_v1.md                          # Product spec
docs/unsw-quest/clue_content_v1.md                # Canonical clue copy
```

---

## How to run locally

```bash
npm install
vercel env pull .env.local      # or copy .env.example and fill in
                                #   DATABASE_URL, BLOB_READ_WRITE_TOKEN, FOURSQUARE_API_KEY

# one-time DB setup against your Neon DB:
#   apply schema (db/drizzle/0000_living_wallow.sql), then:
psql "$DATABASE_URL" -f db/functions.sql
psql "$DATABASE_URL" -f db/neon-setup.sql

npm run dev          # http://localhost:3000
                     #   /join?game=…   MVP
                     #   /quest/demo    team demo
                     #   /quest         storyboard
npm run test:run     # 65 tests across 13 files
npx tsc --noEmit     # type check
npm run build        # production build
```

---

## Gotchas

1. **Neon role `search_path`** — if the DB/role is recreated, re-run `db/neon-setup.sql` or unqualified table/function names won't resolve through the pooler.
2. **`proxy.ts` matcher excludes `/api/`** — by design. API routes read the cookie from the request instead of having it auto-set.
3. **Worktree vitest inflation** — `vitest.config.ts` may not exclude `.claude/worktrees/`; local worktrees with test files inflate the count. Clean up with `git worktree remove`.
4. **Turbopack workspace-root inference** — building inside a worktree while sibling worktrees exist can misinfer the workspace root. Build from the main checkout, or set `turbopack.root` in `next.config.ts`.
