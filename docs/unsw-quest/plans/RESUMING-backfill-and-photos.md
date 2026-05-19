# Resume Handoff — Building Enrichment Backfill + Photo Source Pivot

**Saved:** 2026-05-19 (post-merge of `feat/quest-schema-and-backfill`)
**Supersedes Task 12 + Task 13 of:** [`RESUMING-free-rooms-api.md`](./RESUMING-free-rooms-api.md)

---

## TL;DR

The `building_enrichments` table is still empty. The backfill script that was supposed to populate it (Task 12 of the prior plan) was written but **never merged** because Foursquare's `/places/{id}/photos` endpoint is now Premium-only (HTTP 429 on the free tier). We chose to switch photo sources rather than enable Foursquare billing, which makes the as-written backfill the wrong starting point for this work. The draft script is preserved on a git branch for reference but not on `main`.

---

## Why this was deferred

Mid-implementation, a live curl against `https://api.foursquare.com/v3/places/search` returned **HTTP 410 "endpoint no longer supported"**. We migrated `lib/foursquare/client.ts` to the new `places-api.foursquare.com` (Bearer auth + `X-Places-Api-Version: 2025-06-17` header) — that part is **merged**. But on the new API:

- `/places/search` — still **free**, works fine ✓
- `/places/{id}/photos` — **Premium-only**, returns `HTTP 429: "Your account has no API credits remaining... Premium calls or you have exceeded your freePro tier limit."`

A backfill run with the free key would halt on the first match's photo fetch. The decision was to **switch photo sources** rather than configure billing on Foursquare.

---

## What's on `feat/quest-schema-and-backfill` (now merged)

| Commit | Change |
|---|---|
| `f46e81f` | `feat(supabase): snapshot quest schema as migration` — captures 7 quest_* tables + 7 SECURITY DEFINER helper functions + RLS policies into `supabase/migrations/20260519000001_quest_schema.sql` |
| `e4d98db` | `fix(rooms): log Supabase enrichment fetch failures` — `console.warn` in the existing soft-fail catch in `lib/rooms/get-free-rooms.ts` |
| `a6f6420` | `fix(api): return 400 when only one of near_lat/near_lng is set` — `app/api/rooms/free/route.ts` + 2 new tests |
| `32927b0` | `refactor(foursquare): migrate client to new Places API` — base URL, auth, version header. Public interface byte-identical except for one additive `apiVersion?` option. |

Tests at branch tip: **46 passing** (44 baseline + B's 2 new geo-validation tests).

---

## What's NOT on the branch (this is what's deferred)

- No `scripts/enrich-buildings.ts` backfill script
- No `npm run enrich` runnable command
- `building_enrichments` table stays empty
- `/api/rooms/free` returns rooms with `building.photo_url = null` for every row

The Free-Rooms endpoint **works** (it soft-fails missing enrichments) — it just doesn't have photos or addresses populated.

---

## Where the draft script lives

Task 12a (a parallel subagent) wrote a complete, tested backfill script before we learned about the photos pricing. The work is preserved on:

- **Branch:** `worktree-agent-a3a6d7e776f59df89`
- **Commits:** `6368c84` (dotenv-cli dep) + `30c1aee` (script + 3 tests)
- **Worktree dir:** removed; branch only exists in `.git/refs/heads/`

To recover the work:
```bash
git checkout worktree-agent-a3a6d7e776f59df89 -- scripts/enrich-buildings.ts scripts/enrich-buildings.test.ts
```

**Note before reusing it:** the script calls `foursquare.getFirstPhoto(placeId)` for every high-confidence match. That call will 429 on the current free key. You'll need to either remove that call or replace it with a call into whatever new photo source you pick.

The script is correctly structured otherwise — exported `enrichBuildings(deps)` for testability, skips rows where `match_method = 'manual'`, upserts via `onConflict: 'building_id'`, writes `match_confidence='no_match'` rows so future runs can decide whether to re-attempt.

---

## Resume steps (in order)

### Step 1 — Pick a photo source

Candidates (none investigated):
- **Google Places API** — Place Photos endpoint, paid but volume-discounted; ~$7 per 1000 calls (verify current pricing)
- **OpenStreetMap / Wikimedia Commons** — free, image quality varies, coverage gappy for UNSW buildings specifically
- **Curated CDN** — host UNSW building photos yourself (Cloudflare R2 / Supabase Storage). Manual but predictable
- **UNSW media library** — if accessible; check with UNSW Marketing

Each has a different ergonomics + cost + coverage tradeoff. Pick before writing code.

### Step 2 — Write or adapt the photo client

If the new source has a similar shape (place lookup → photo URL), write a thin `lib/photos/<source>.ts` analogous to `lib/foursquare/client.ts:getFirstPhoto`. If the source is just a static CDN, skip the client and hard-code a URL pattern.

### Step 3 — Adapt the backfill script

`git checkout worktree-agent-a3a6d7e776f59df89 -- scripts/enrich-buildings.ts scripts/enrich-buildings.test.ts`

Replace the `foursquare.getFirstPhoto(placeId)` call with the new photo source. Update the test mocks. Run `npm run test:run`.

### Step 4 — Run the backfill

```bash
npx --yes dotenv-cli -e .env -- npm run enrich
```

Spot-check the data:
```sql
select match_confidence, count(*) from public.building_enrichments group by 1 order by 1;
select building_id, building_name, foursquare_place_id, address, photo_url
  from public.building_enrichments where match_confidence = 'low' limit 5;
```

Manually fix obvious wrongs by editing the row and setting `match_method = 'manual'`. Future runs preserve manual rows.

### Step 5 — Smoke-test the endpoint (the deferred Task 13)

```bash
npm run dev
curl -s 'http://localhost:3000/api/rooms/free' | head -c 800             # expect 200 + photos populated
curl -s 'http://localhost:3000/api/rooms/free?capacity=100&usage=LCTR'   # filter
curl -s 'http://localhost:3000/api/rooms/free?near_lat=-33.9173&near_lng=151.2336' \
  | jq '[.rooms[:5] | .[] | .building.id]'                                 # geo-sort
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/rooms/free?near_lat=-33.9173'
# expect 400 — this case is already covered by a unit test on this branch
```

### Step 6 — Clean up

Delete `worktree-agent-a3a6d7e776f59df89` branch once you've harvested what you need from it. Delete this file once Steps 1–5 are done.

---

## Other concerns surfaced during this work (NOT addressed here)

These were flagged by the quest-schema audit. Captured for visibility, not on the critical path for the backfill:

1. **`USING (true)` policies** on `quest_hunts.authed_read`, `quest_clues.authed_read`, `quest_hunt_sessions.authed_read`, `quest_teams.invite_code_lookup`, `quest_profiles.authed_read`. Any logged-in user can read every team's session state, every player profile, every team's invite-lookup row. Likely intentional for v1; worth a security pass before public launch.
2. **`quest_clue_progress_member_update`** has `USING` but no `WITH CHECK` — a team member could theoretically `UPDATE … SET hunt_session_id = <other-session>`. Not exploited via the app (which uses `quest_unlock_clue` SECURITY DEFINER) but the bare policy is loose.
3. **`quest_generate_invite_code`** is not `SECURITY DEFINER` and uses `random()` (not crypto-secure). 6 chars / 32-char alphabet ≈ 1B codes — fine for human invite codes, not for secret material.

Track these as separate v2 security work.
