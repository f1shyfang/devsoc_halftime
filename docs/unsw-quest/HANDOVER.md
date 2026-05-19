# UNSW Quest — Handover

**Last updated:** 2026-05-19
**Branch:** `main` (in sync with `origin/main` at `248a265`)

---

## TL;DR

UNSW Quest is a mobile-first campus scavenger hunt game on Next.js 16 + Supabase. The backend (Free-Rooms API + 7 quest_* tables + RPCs + results-card edge function + idle-sweep job) is on `main`. The frontend's quest flow (`/quest/demo/*`) is wired up directly to Supabase via RPC + Realtime + Storage. **Auth has been removed**: identity is a device-id UUID stored in a `quest_device_id` cookie, set by `proxy.ts` (Next 16's renamed middleware).

**The app is currently broken against the live DB.** The frontend on `main` calls RPCs with a new `p_user_id` signature, but the live Supabase still has the old `auth.uid()`-based functions. **Apply migrations 00002–00006 before testing the app.**

---

## What's on `main` (since the start of this work)

| Commit | Change |
|---|---|
| `f46e81f` | Quest schema migration: 7 quest_* tables + 7 SECURITY DEFINER RPCs + RLS |
| `e4d98db` | Log Supabase enrichment fetch failures |
| `a6f6420` | API: 400 when only one of `near_lat`/`near_lng` is set |
| `32927b0` | Migrate Foursquare client to new Places API |
| `2bafeb5` | Seed v1 hunt content (2 hunts, 12 clues) |
| `424e217` | `generate_results_card` Edge Function (satori + resvg-wasm) |
| `13812e2` | `quest-photos` Storage bucket + team-scoped RLS (later relaxed) |
| `8431a39` | `quest_abandon_idle_sessions` + pg_cron schedule |
| `7048e1c` + `19f3dcc` + `dccec28` | `scripts/enrich-buildings.ts` backfill (no photos) |
| `1e389ad` | DB migration: drop auth dependency, switch RPCs to `p_user_id` |
| `0783640` | Delete auth UI + dead `lib/supabase/proxy.ts` |
| `04503e8` | Device-id cookie + `proxy.ts` (Next 16 middleware) |
| `d7699cd` | Rename `middleware.ts` → `proxy.ts` for Next 16 |
| `248a265` | Split `lib/device-id.ts` into client-safe + server-only modules |

---

## Live Supabase state (project `vpwrrlkeinfjxoiaetwf`)

| Migration | File | Applied to live? |
|---|---|---|
| `…000000` | `building_enrichments` table | ✅ Yes (Round 0) |
| `…000001` | Quest schema | ✅ Yes |
| `…000002` | Seed quest content | ❌ **Not applied** |
| `…000003` | `results-cards` bucket + column | ❌ **Not applied** |
| `…000004` | `quest-photos` bucket (now superseded) | ❌ **Not applied** |
| `…000005` | Idle-abandonment sweep | ✅ Yes (agent applied during work) |
| `…000006` | Remove auth, switch to device-id | ❌ **Not applied** |

**Minimum needed to unblock the app:** 00002, 00006, and 00004 (or the public-read piece of 00006 that supersedes 00004 — running 00006 on top of 00004 is fine, but 00004 must run first since 00006 drops policies it expects to exist).

To apply:

```bash
supabase db push   # or copy each migration into the SQL editor in order
```

---

## Outstanding work

### 1. Apply migrations 00002–00006 (BLOCKING — app is broken without this)
Run `supabase db push` against the project. Order: 00002 → 00003 → 00004 → 00006 (00005 is already live). The combined effect:
- Two hunts and 12 clues seeded.
- `results-cards` and `quest-photos` buckets created.
- All quest_* RPCs renamed to take `p_user_id uuid` first.
- RLS dropped on quest_* tables; `quest-photos` flipped to public-read.

### 2. Smoke-test the quest flow end-to-end
Was Task 13 of the original Free-Rooms plan, now applies to the quest UI too. Recipe:

```bash
npm run dev
# Open http://localhost:3000/quest/demo
# proxy.ts sets a quest_device_id cookie on first request
# Page should list 2 hunts (UNSW 101, Library Loop)
# Tap a hunt → Create Team → invite code generated
# Tap Start → first clue appears
# Walk through (or fake) GPS unlocks; verify Realtime leaderboard updates
# Finish → check results card PNG renders
```

Also smoke-test the rooms API while you're at it:

```bash
curl -s 'http://localhost:3000/api/rooms/free' | head -c 800
curl -s 'http://localhost:3000/api/rooms/free?capacity=100&usage=LCTR'
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/rooms/free?near_lat=-33.9173'
# expect 400 — unit-tested
```

### 3. Run the buildings backfill (optional — needed only if Free-Rooms API gets surfaced)
Photos were skipped per the photo-source decision. Script is ready:

```bash
npx --yes dotenv-cli -e .env -- npm run enrich
```

Spot-check via `select match_confidence, count(*) from public.building_enrichments group by 1`.

### 4. Re-design the player-name UX
`app/quest/demo/page.tsx` currently shows `Player <first-8-chars-of-uuid>` because email is gone. Probably wants a "set your display name" sheet on first load.

### 5. UNSW-verified badge has no signal source
Previously derived from `auth.users.email LIKE '%@%unsw.edu.au'`. Email is gone. If the badge appears in any UI (it doesn't right now, but might in design), it'll need a different mechanism (manual flag, separate verification flow, or dropped feature).

### 6. Two minor follow-ups flagged by agents
- `play-shell.tsx` does a direct `supabase.from("quest_clue_progress").update({ photo_capture_url })`. Works under demo RLS (everything's permissive) but should be a `quest_set_photo` RPC for consistency.
- The Foursquare client still exports `getFirstPhoto` (`lib/foursquare/client.ts`) even though it's unused after the photo pivot. Cleanup-worthy, not urgent.

### 7. Not started (still on the original task list)
- **Quest RLS hardening** is essentially moot now (RLS is dropped). If the project goes past the demo, the FIRST thing is to put a real auth model back in (Supabase anonymous auth is the easiest path — see `memory/project_no_auth_demo.md`).

---

## Architectural decisions to know

### Auth is gone (v1-demo-only)
- Identity: v4 UUID stored in `quest_device_id` cookie (SameSite=Lax, HttpOnly=false, Secure=production, 5y maxAge).
- Cookie is set by `proxy.ts` on first matching request; readable from both server (via `next/headers`) and client (via `document.cookie`).
- Every quest RPC takes `p_user_id uuid` as its first parameter; the client passes `getDeviceId{Server,Client}()` into each `supabase.rpc(...)` call.
- RLS is dropped on quest_* tables. Anyone with the publishable key can read or write any quest_* row. **This is the demo trade-off.** Don't put sensitive info in those tables.
- The full reasoning is captured in `~/.claude/projects/-mnt-d-Documents-devsoc-halftime/memory/project_no_auth_demo.md`.

### Photos are off the table (for now)
- Foursquare's photo endpoint became Premium-only. Other sources (Google Places, Wikimedia, curated CDN) were considered; the choice was to skip photos entirely for the demo.
- `building_enrichments.photo_url` stays NULL. The Free-Rooms API soft-fails missing enrichments.
- If photos become needed, candidate sources are listed in `docs/unsw-quest/plans/RESUMING-backfill-and-photos.md`.

### Next.js 16
- `middleware.ts` is deprecated → renamed to `proxy.ts`. The exported function is `proxy`, not `middleware`. Build output lists it as `ƒ Proxy (Middleware)`.
- `proxy.ts` does not support the edge runtime. Stays on Node.

---

## Key files

```
proxy.ts                                          # Next 16 middleware — sets device-id cookie
lib/device-id.ts                                  # COOKIE_NAME + getDeviceIdClient (browser-safe)
lib/device-id.server.ts                           # getDeviceIdServer (server-only — uses next/headers)
lib/supabase/{client,server,admin}.ts             # Supabase clients (data plane)
lib/rooms/get-free-rooms.ts                       # Free-Rooms aggregation
lib/foursquare/client.ts                          # Foursquare Places API client
app/api/rooms/free/route.ts                       # GET /api/rooms/free (standalone, not yet consumed by UI)
app/quest/demo/page.tsx                           # Hunt list + profile-ensure
app/quest/demo/[huntSlug]/team-gate.tsx           # Create/join team flow
app/quest/demo/[huntSlug]/play/play-shell.tsx     # Main game loop, Realtime leaderboard
app/quest/_screens/*.tsx                          # Static design wireframes (not the live UI)
scripts/enrich-buildings.ts                       # Buildings backfill (run via dotenv-cli)
supabase/functions/generate_results_card/         # Edge Function for the finale PNG
supabase/migrations/202605190000{00..06}_*.sql    # All schema/data migrations
docs/unsw-quest/PRD_v1.md                         # Product spec
docs/unsw-quest/clue_content_v1.md                # Canonical clue copy (matches the seed data)
```

---

## How to run locally

```bash
npm install
# .env should have:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#   SUPABASE_SERVICE_ROLE_KEY     # for scripts/enrich-buildings
#   FOURSQUARE_API_KEY            # for scripts/enrich-buildings
npm run dev                      # http://localhost:3000
npm run test:run                 # 49 tests as of 248a265
npx tsc --noEmit                 # type check
npm run build                    # production build
```

---

## Gotchas

1. **Migration 00006 is destructive** — drops 21 RLS policies, disables RLS, drops 3 FKs to `auth.users`, changes 6 RPC signatures. Cannot easily be reversed. Test against a Supabase preview branch first if nervous.
2. **`proxy.ts` matcher excludes `/api/`** — that's deliberate (Free-Rooms is anonymous). If you add a quest-related API route under `/api/`, update the matcher in `proxy.ts` so it gets the cookie.
3. **`server-only` package import** — `lib/device-id.server.ts` was originally going to use `import "server-only"`. Removed because the package isn't a direct dep; rely on the filename convention as the soft guard.
4. **Worktree vitest inflation** — `vitest.config.ts` doesn't exclude `.claude/worktrees/`. If you create local worktrees with test files in them, the test count inflates. Clean up worktrees with `git worktree remove` after use.
5. **Turbopack workspace-root inference** — running `npm run build` inside a worktree while sibling worktrees exist causes Turbopack to misinfer the workspace root. Either don't build from a worktree, or set `turbopack.root` in `next.config.ts`.

---

## Memory pointers

The `MEMORY.md` index at `~/.claude/projects/-mnt-d-Documents-devsoc-halftime/memory/MEMORY.md` has the up-to-date list of saved memories — current entries:
- Project pivot from UNSW Splash → campus geocaching game
- Mobile-first design (no desktop/tablet/landscape for v1)
- Auth removed for v1 demo (device-id model)
