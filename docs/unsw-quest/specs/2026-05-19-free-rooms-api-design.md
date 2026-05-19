# Free-Rooms API — Backend Design

**Spec for:** Feature 3 (the maps view) — backend data layer
**Date:** 2026-05-19
**Status:** Draft, pending implementation plan
**Stack target:** Next.js route handlers in this repo
**Owns:** the data layer that serves the maps UI. Does NOT own the UI itself.

---

## 1. Overview

The map view in UNSW Quest shows currently class-free rooms across the Kensington campus as potential challenge venues. This spec covers the backend service that powers that view: a single public HTTP endpoint that combines live class-free data from **DevSoc Freerooms** with cached building enrichment (photos + addresses) from **Foursquare Places**.

The endpoint is the only contract the frontend depends on. Everything else (Foursquare integration, caching, matching heuristics) is implementation detail behind it.

---

## 2. Goals & Non-Goals

### Goals

- Single endpoint the frontend hits to render the map: `GET /api/rooms/free`.
- Live "is this room free right now" data, with the standard Freerooms filters (capacity, usage, duration) passed through.
- Each room result carries enough building metadata (lat/lng, photo, address, name) for the frontend to render a rich pin or list row without further lookups.
- Resilient to partial Foursquare coverage — buildings without a Foursquare match still return, just with `photo_url: null` and `address: null`.
- Resilient to Foursquare downtime — runtime requests never block on Foursquare.
- Backfill is operator-controlled, idempotent, and supports manual overrides for the buildings Foursquare gets wrong.

### Non-goals (v1)

- Realtime push (frontend polls if it wants freshness)
- Authentication / authorization (endpoint is public for demo)
- Rate limiting
- CORS for cross-origin frontends
- Periodic automatic re-enrichment (manual re-run only)
- Admin UI for editing enrichments (use Supabase dashboard / SQL)
- Mapping rooms to challenge content (separate sub-project)
- Integration tests against live Freerooms / Foursquare

---

## 3. Architecture

Five components, all living in this Next.js repo:

| Component | Path | Responsibility |
|---|---|---|
| **Freerooms client** | `lib/freerooms/` | Typed fetch wrappers for `/api/buildings`, `/api/rooms`, `/api/rooms/status`. No business logic. |
| **Foursquare client** | `lib/foursquare/` | Place search + photo URL assembly. Reads `FOURSQUARE_API_KEY` from env. Used only by the backfill script. |
| **Building enrichment table** | Supabase `building_enrichments` | One row per Freerooms building. Stores Foursquare match data or a `no_match` marker. |
| **Aggregation service** | `lib/rooms/get-free-rooms.ts` | Joins live status (Freerooms) with cached building list, room list, and enrichment data. Pure-ish function — takes a Freerooms client and a Supabase client, returns the response shape. |
| **Public endpoint** | `app/api/rooms/free/route.ts` | Next.js route handler. Parses & validates query params, calls aggregator, returns JSON. |

Plus:

- **Backfill script** at `scripts/enrich-buildings.ts`, runnable via `npm run enrich`. Walks every Freerooms building, queries Foursquare nearby-search, picks a best match, writes to `building_enrichments`.
- **SQL migration** at `supabase/migrations/<timestamp>_building_enrichments.sql` (version-controlled). Applied to the live Supabase project via the Supabase MCP server during initial setup.

### Caching strategy

| Data | Cache | TTL / location |
|---|---|---|
| Freerooms buildings list | Next.js `unstable_cache` (or `revalidate`) | ~24h — buildings barely change |
| Freerooms rooms list | Next.js `unstable_cache` | ~24h |
| Freerooms room status | None | Live — uncached |
| Foursquare enrichments | Supabase `building_enrichments` table | Permanent — re-populated only by backfill |

### Why this shape

- **Foursquare is decoupled from request-time.** The hot path never blocks on, rate-limits against, or fails because of Foursquare.
- **Backfill is a script, not a lazy lookup.** Lets you audit and hand-fix the data before it's served. Foursquare's UNSW coverage is uneven — manual override matters.
- **Single endpoint, single source of truth.** Frontend has one URL to learn.

---

## 4. Endpoint Contract

### `GET /api/rooms/free`

Public, unauthenticated.

**Query parameters (all optional):**

| Param | Type | Default | Notes |
|---|---|---|---|
| `at` | ISO datetime | now (server) | Passed to Freerooms `datetime` |
| `capacity` | int | none | Minimum seats; passed to Freerooms |
| `usage` | enum: `AUD\|CMLB\|LAB\|LCTR\|MEET\|SDIO\|TUSM` | none | Passed to Freerooms |
| `duration` | int (minutes) | none | Minimum free duration; passed to Freerooms |
| `status` | enum: `free\|soon\|all` | `free` | Filters the response. `soon` = `free` ∪ `soon`. `all` = no filter (debugging). |
| `near_lat` | float | none | If both `near_lat` & `near_lng` are present, results sorted by ascending haversine distance from the point. |
| `near_lng` | float | none | See `near_lat`. |

**Response (200):**

```json
{
  "as_of": "2026-05-19T13:00:00Z",
  "rooms": [
    {
      "room_id": "K-J17-305",
      "room_name": "Brass Lab J17 305",
      "abbr": "BrassME305",
      "capacity": 30,
      "usage": "CMLB",
      "school": "COMPSC",
      "building": {
        "id": "K-J17",
        "name": "Ainsworth Building",
        "lat": -33.918,
        "lng": 151.231,
        "photo_url": "https://fastly.4sqi.net/img/general/original/...",
        "address": "Anzac Pde, Kensington NSW 2052"
      },
      "status": "free",
      "free_until": "2026-05-19T14:00:00Z"
    }
  ]
}
```

**Notes:**

- `building` is nested (not flat) so the frontend can group rooms by building when rendering building-level pins.
- `photo_url` and `address` are nullable — frontend must handle missing values gracefully.
- `as_of` is the server's timestamp at fetch time. Useful for "data is X seconds old" badges.
- `free_until` is `null` when `status === "busy"` (i.e. when `status=all` is passed and busy rooms are returned).

**Error responses:**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "invalid_param", "param": "<name>" }` | Malformed input |
| `503` | `{ "error": "rooms_service_unavailable" }` | Freerooms upstream is down or times out. We don't serve stale status — the whole point is freshness. |

**Degraded behaviour (still 200):** if Supabase enrichment is unavailable, the endpoint returns rooms with `building.photo_url: null` and `building.address: null`. Other building fields (id, name, lat, lng) come straight from Freerooms and are unaffected.

---

## 5. Data Model

### Table: `building_enrichments`

```sql
create table building_enrichments (
  building_id          text primary key,
  building_name        text not null,
  foursquare_place_id  text,
  photo_url            text,
  address              text,
  match_confidence     text not null
    check (match_confidence in ('high','medium','low','no_match')),
  match_method         text
    check (match_method in ('name_and_proximity','proximity_only','manual')),
  enriched_at          timestamptz not null default now()
);

alter table building_enrichments enable row level security;

create policy "public read"
  on building_enrichments
  for select
  using (true);

-- Writes happen only via the service-role key (backfill script).
-- No RLS write policy needed — service role bypasses RLS.
```

- `building_id` matches the Freerooms building ID (e.g. `K-J17`). Acts as the join key at runtime.
- `building_name` is snapshotted at enrichment time. Used for debugging mismatches — the live name comes from Freerooms.
- `match_confidence = 'no_match'` rows still exist (with null Foursquare fields). This lets the backfill skip already-attempted buildings on subsequent runs unless the operator clears them.
- `match_method = 'manual'` flags rows that have been hand-edited. The backfill script must not overwrite these.

---

## 6. Foursquare Matching Algorithm

Run once per building during backfill.

### Steps

1. **Search.** Call Foursquare `GET /v3/places/search`:
   - `ll=<building.lat>,<building.long>`
   - `radius=100` (metres)
   - `limit=20`
   - `fields=fsq_place_id,name,location,distance`
2. **Score candidates.** For each candidate:
   - **Name similarity** (`0.0`–`1.0`): token-overlap on lowercased names. Strip generic suffixes from both sides: `"building"`, `"centre"`, `"center"`, `"block"`, `"hall"`. (Implementation: split on whitespace, remove stopwords, compute Jaccard or token-set ratio.)
   - **Distance** in metres (returned by Foursquare).
3. **Pick the best candidate** by `name_similarity` descending, then `distance` ascending.
4. **Classify confidence:**

| Tier | Condition |
|---|---|
| `high` | name ≥ 0.85 **and** distance ≤ 30m |
| `medium` | name ≥ 0.6 **and** distance ≤ 50m |
| `low` | at least one candidate ≤ 100m but doesn't meet medium |
| `no_match` | zero candidates within 100m |

5. **For matched buildings (any tier ≠ `no_match`):** fetch the first photo from `GET /v3/places/{fsq_place_id}/photos?limit=1`. Assemble the final URL using Foursquare's `{prefix}original{suffix}` template. Store the assembled URL.
6. **Upsert** into `building_enrichments`. Set `match_method = 'name_and_proximity'` (not `'manual'`).

### Special cases

- **Already manual:** if the existing row has `match_method = 'manual'`, **skip** the entire building. Don't overwrite operator edits.
- **No photo:** if the matched place has zero photos, store the match (place_id, address) with `photo_url = null`.
- **Foursquare 429 / rate-limit:** back off with jittered retry (max 3 attempts). If still failing, log + skip that building. The script keeps going.
- **Foursquare 5xx:** same retry strategy. Skip on persistent failure.

---

## 7. Backfill Script

`scripts/enrich-buildings.ts`, runnable via `npm run enrich`.

### Behaviour

1. Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env. Fail loudly if missing.
2. Read `FOURSQUARE_API_KEY` from env. Fail loudly if missing.
3. Fetch the full list of buildings from Freerooms (`GET /api/buildings`).
4. For each building (sequential, with a small delay to be polite):
   - Skip if `building_enrichments.match_method = 'manual'` for that building_id.
   - Run the matching algorithm.
   - Upsert the row.
   - Print one line: `[<building_id>] <building_name> → <confidence> (<method>, <photo_url or 'no photo'>)`.
5. At the end, print a summary: `high: X / medium: Y / low: Z / no_match: W / skipped (manual): K`.
6. Exit 0 on completion (even with `no_match` rows). Exit non-zero only on catastrophic failure (env missing, Supabase unreachable, Freerooms unreachable).

### Idempotency

Re-running the script:
- Skips rows with `match_method = 'manual'`.
- Re-runs the algorithm for everything else and upserts. Rows with previously-matched data get overwritten with fresh data (in case Foursquare improved their coverage).

---

## 8. Environment & Setup

### New env vars (in `.env.local`)

```
FOURSQUARE_API_KEY=<from foursquare.com/developers>
SUPABASE_SERVICE_ROLE_KEY=<Supabase dashboard → Settings → API>
```

- `FOURSQUARE_API_KEY` — server-only. Used by both the backfill script and `lib/foursquare/`.
- `SUPABASE_SERVICE_ROLE_KEY` — **only** by the backfill script. Bypasses RLS. **Must never** be `NEXT_PUBLIC_*` or used in client code.

### Existing env vars (already configured)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The runtime endpoint uses the publishable (anon) key + RLS public-read policy.

### `package.json` additions

```json
{
  "scripts": {
    "enrich": "tsx scripts/enrich-buildings.ts",
    "test": "vitest"
  },
  "devDependencies": {
    "tsx": "^4.x",
    "vitest": "^2.x",
    "@vitest/coverage-v8": "^2.x"
  }
}
```

**Note:** the existing repo has no test runner configured. The implementation plan will add Vitest (chosen for its Next.js compatibility, native ESM, and minimal config). Tests are colocated next to the modules they exercise.

### Migration delivery

Two-track per user decision:
1. Save the SQL at `supabase/migrations/<timestamp>_building_enrichments.sql` (version-controlled).
2. Apply it to the live Supabase project via the Supabase MCP server during initial setup. Both paths end at the same schema.

---

## 9. Testing Strategy

Lightweight, demo-scoped, TDD on the algorithmic pieces.

### Unit tests (required)

- **Name similarity scorer** — `lib/foursquare/match.ts`. Pure function. Cover: exact match, suffix-stripping, partial overlap, no overlap, case insensitivity.
- **Confidence classifier** — pure function over `(name_score, distance)`. Cover all four tiers including boundary conditions.
- **Aggregation join** — `lib/rooms/get-free-rooms.ts` with mocked Freerooms client + mocked Supabase. Cover: Freerooms returns rooms with matched buildings, Freerooms returns rooms with unmatched buildings (`photo_url: null`), `status=soon` filter, distance sort with `near_lat`/`near_lng`, Supabase fetch fails (degraded 200 path).
- **Endpoint param validation** — `app/api/rooms/free/route.ts` test-helpers. Cover: bad `usage` value → 400, bad `at` → 400, missing optional params → defaults applied.

### Skipped in v1

- Integration tests against live Freerooms (flaky, rate-limited)
- Integration tests against live Foursquare (rate-limited, costs API quota)
- E2E tests of the backfill script (manual verification by inspecting the Supabase dashboard after a run)

---

## 10. File / Module Plan

```
lib/
  freerooms/
    client.ts          # fetch wrappers: getBuildings, getRooms, getRoomStatus
    types.ts           # Building, Room, RoomStatus
  foursquare/
    client.ts          # searchNearby, getPhotos, buildPhotoUrl
    types.ts           # Place, Photo
    match.ts           # nameSimilarity(), classifyConfidence(), pickBestCandidate()
    match.test.ts
  rooms/
    get-free-rooms.ts  # the aggregation service
    get-free-rooms.test.ts
    types.ts           # FreeRoomsResponse, FreeRoomRecord
    distance.ts        # haversine() helper (if not pulled from a lib)
  supabase/            # existing
app/
  api/
    rooms/
      free/
        route.ts       # the endpoint
        route.test.ts  # param validation tests
scripts/
  enrich-buildings.ts  # backfill
supabase/
  migrations/
    <timestamp>_building_enrichments.sql
```

---

## 11. Open Questions / Future Work

| Item | When to revisit |
|---|---|
| Auth on the endpoint | If we see abuse, or before public launch |
| Rate limiting | Same trigger |
| CORS | If frontend deploys to a different origin |
| Auto re-enrichment cron | After Freerooms adds new buildings between manual re-runs |
| Caching the response itself (CDN / edge) | If `/api/rooms/free` shows up as hot in production |
| Surfacing buildings (not rooms) as the primary unit | If frontend ends up rendering one pin per building rather than per room. Spec already supports this via the nested `building` field. |
| Mapping rooms → challenges | Separate sub-project. Out of scope here. |

---

## 12. What's required from the operator before implementation

1. Sign up at [foursquare.com/developers](https://foursquare.com/developers), create a project, paste `FOURSQUARE_API_KEY` into `.env.local`.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` from the Supabase dashboard.
3. (No code action required from operator — the implementation plan handles the rest.)

---

*End of design spec.*
