# Design: Dynamic Free-Room Quests

**Date:** 2026-05-30
**Status:** Approved (design); pending implementation plan
**Branch context:** `feat/neon-migration`

## Summary

Generate a UNSW Quest scavenger hunt on demand from **live free-rooms data**. The
system picks rooms that are currently free, writes them as `quest_clues` anchored
to their building coordinates, seats the player/team at the nearest one ("corral
into a room"), and renders every room puzzle on the existing Leaflet map. The
entire existing quest play flow (sessions, progress, hints, leaderboard, finale)
is reused **unchanged**.

This is "Approach B — Persisted generated hunt" from brainstorming: the smallest
change that makes dynamically-generated room puzzles work across the whole
existing experience.

## Background & constraints

- **Free-rooms data works** (verified live): UNSW Freerooms upstream returns
  hundreds of free rooms. A prior integration bug — the client passed the
  upstream `{ numAvailable, roomStatuses }` shape straight through while the rest
  of the code expected a flat `{ roomNumber: status }` shape — made
  `/api/rooms/free` silently return `0` rooms. Fixed in `lib/freerooms/client.ts`
  (normalize at the client boundary) with a regression test. The live path now
  returns ~480 free rooms. This design builds on the fixed endpoint.
- **Building-level coordinates only.** Freerooms gives one lat/lng per *building*,
  not per room or floor. GPS can confirm a player is *at the building*, not which
  room/floor. Verification is therefore **GPS-to-building geofence only** (trust
  the player found the room) — chosen during brainstorming.
- **Quest mutations go through Postgres RPC functions** (`quest_create_team`,
  `quest_start_hunt`, `quest_unlock_clue`) via `lib/db/rpc.ts`; reads use Drizzle.
  Generation of content (hunt + clues) is a seed-like action done with direct
  Drizzle inserts. Seating the player reuses the existing RPCs.
- **Schema is reused with no migration.** Generated rows must respect existing
  `quest_clues` check constraints: `tier` in 1–3, `sequence_in_tier` in 1–9,
  `type` in `{riddle, image_clue}`, `verification_type` in
  `{gps, qr, gps_plus_photo}`.

## Goals

1. Query live free rooms and **auto-assign** a player/team to a currently-free
   room as their quest hub ("corral").
2. **Dynamically generate** a quest whose puzzles are anchored to free rooms,
   rendered as markers on the existing map ("puzzles inside rooms").
3. Reuse the existing quest play flow end-to-end; no parallel UI.

## Non-goals (YAGNI)

- Indoor floor-plan maps or per-room indoor coordinates.
- AI-generated puzzle text (clue text is templated for MVP).
- Room occupancy/capacity *enforcement* or load-balancing across rooms
  (capacity is used only as an optional selection filter).
- QR / photo verification for room puzzles (GPS-to-building only).
- Authentication changes (device-id cookies remain).

## Architecture

### Components (each isolated, single-purpose, unit-testable)

#### 1. `lib/rooms/select-rooms.ts` — pure selection ("corral")

```
selectRoomsForHunt(
  rooms: FreeRoomRecord[],
  opts: {
    count: number;            // max rooms to include
    nearLat?: number;
    nearLng?: number;
    capacity?: number;        // minimum capacity filter
    usage?: string;           // e.g. "MEET", "TUSM"
    dedupeByBuilding?: boolean; // default true
  },
): { hub: FreeRoomRecord; rooms: FreeRoomRecord[] }
```

- Filters to `status === "free"`, then optional `capacity` (>=) and `usage` (==).
- If `nearLat`/`nearLng` given, sorts ascending by Haversine distance
  (reuses `lib/rooms/distance.ts`); otherwise preserves input order.
- If `dedupeByBuilding` (default `true`), keeps only the first room per
  `building.id` — markers are building-level, so this prevents stacked pins.
- Takes the first `count` rooms. `hub` is the first (nearest) room — the
  auto-assigned corral destination.
- Throws / returns empty when no rooms match (caller maps to HTTP 422).

**Depends on:** `FreeRoomRecord` type, `haversineMeters`. No I/O.

#### 2. `lib/quest/generate-room-hunt.ts` — pure draft builder

```
type ClueDraft = {
  tier: number;                 // 1..3
  sequence_in_tier: number;     // 1..9
  type: "riddle";
  verification_type: "gps";
  body_text: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  geofence_radius_m: number;
  hints: string[];
};

type HuntDraft = {
  slug: string;                 // provided by caller (nanoid-based)
  name: string;                 // "Free Room Quest"
  description: string;
  duration_minutes: number;
  hero_emoji: string;           // "🚪"
  clues: ClueDraft[];
};

buildRoomHuntDraft(
  selected: FreeRoomRecord[],
  opts: { slug: string; geofenceRadiusM?: number; durationMinutes?: number },
): HuntDraft
```

- Maps each selected room → one `ClueDraft`:
  - `location_lat/lng` = `building.lat` / `building.lng`.
  - `geofence_radius_m` = `opts.geofenceRadiusM ?? 50` (building-sized).
  - `location_name` = `"{building.name} — {room_name}"`.
  - `body_text` = templated, e.g.
    `"Make your way to {room_name} ({usage}, seats {capacity}) in {building.name}."`
  - `hints` = `["It's in {building.name}.", "Room {abbr}."]`.
  - `type: "riddle"`, `verification_type: "gps"`.
- Chunks rooms into tiers of at most 9 (`sequence_in_tier` 1..9, `tier` 1..3),
  so up to 27 clues are representable. MVP generates a single tier (≤9 rooms).

**Depends on:** `FreeRoomRecord` type. No I/O.

#### 3. `lib/quest/create-room-hunt.ts` — persistence

```
createRoomHunt(draft: HuntDraft): Promise<{ huntId: string; slug: string }>
```

- Inserts one `quest_hunts` row (`status: "published"`) and its `quest_clues`
  rows (with the new `huntId`) via Drizzle `db.insert(...)`.
- Slug uses a `rooms-<nanoid>` convention so generated hunts are identifiable
  for cleanup.

**Depends on:** `db` client, `questHunts`, `questClues` schema.

#### 4. `POST /api/quest/rooms/generate` — route handler

- Body: `{ count?, nearLat?, nearLng?, capacity?, usage? }` (validated;
  `count` defaults to e.g. 6, capped at 9 for MVP single-tier).
- Pipeline:
  1. `getFreeRooms({ statusFilter: "free", capacity, usage, nearLat, nearLng }, deps)`
     using the same cached Freerooms client + Drizzle enrichments as
     `/api/rooms/free`.
  2. `selectRoomsForHunt(...)`.
  3. `buildRoomHuntDraft(...)` with a generated slug.
  4. `createRoomHunt(...)`.
- Response `200`: `{ slug, hub_room, rooms }`.
- `503` when Freerooms is unavailable; `422` when no free rooms match;
  `400` on invalid params.

**Mirrors** the structure and dependency-injection style of
`app/api/rooms/free/route.ts` and its test.

#### 5. `LeafletMap` multi-marker enhancement

- Add an optional `rooms` prop:
  `{ lat: number; lng: number; name: string; index: number; done: boolean }[]`.
- When present, plot all room puzzles as numbered markers, highlighting the
  current checkpoint and dimming completed ones.
- When absent, behavior is unchanged (single `checkpoint`) — backwards
  compatible. `PlayShell` passes the hunt's clue list through.

#### 6. Entry point on `app/quest/demo`

- A "Spawn a free-room quest" action that calls `POST /api/quest/rooms/generate`,
  then the existing `quest_create_team` + `quest_start_hunt` RPC routes, then
  routes to `/quest/demo/<slug>/play`. (Optionally the generate route geolocates
  via `nearLat/nearLng` passed from the browser.)

### Data flow

```
Live Freerooms upstream
  → /api/rooms/free internals (getFreeRooms, now fixed)
  → selectRoomsForHunt          (corral: nearest free rooms, deduped by building)
  → buildRoomHuntDraft          (room → clue, GPS verification, building geofence)
  → createRoomHunt              (insert quest_hunts + quest_clues via Drizzle)
  → quest_create_team + quest_start_hunt  (RPC: seat team at tier1/seq1 = hub)
  → /quest/demo/<slug>/play (existing) reads hunt + clues + session
  → PlayShell + LeafletMap render room markers
  → player walks → GPS geofence unlock → next room → finale
```

## Error handling

- Freerooms upstream outage → `503` (propagated from the client error, as in
  `/api/rooms/free`).
- No free rooms match the filters → `422` with an explanatory message.
- Enrichment read failure already degrades to `[]` in `getFreeRooms` (rooms still
  returned without photo/address).
- Invalid request params → `400`.

## Lifecycle / cleanup

Generated hunts accumulate in `quest_hunts` / `quest_clues`. This is the main
tradeoff of Approach B. MVP handles it without a schema change:

- Slug convention `rooms-*` identifies generated hunts.
- `scripts/clean-room-hunts.ts` purges generated hunts (and their cascading
  clues/sessions) older than a threshold.

A future `source`/`generated` column could replace the slug convention if needed
(out of scope for MVP).

## Testing (TDD)

- **`select-rooms.test.ts`** — filtering (status/capacity/usage), proximity sort,
  dedupe-by-building, `count` cap, hub selection, empty-result behavior.
- **`generate-room-hunt.test.ts`** — field mapping (coords, geofence, name/body),
  tier chunking at the 9-per-tier boundary, hint generation.
- **`generate/route.test.ts`** — param validation, `503`/`422`/`400` paths,
  happy path with mocked Freerooms client + enrichment reader + `createRoomHunt`
  (mirrors `app/api/rooms/free/route.test.ts`).
- `createRoomHunt` and the map change are exercised via the route test + manual
  run; no DB integration test for MVP (consistent with existing patterns).

## Decisions (locked during brainstorming)

- **Corral** = auto-assign to a currently-free room (nearest, deduped by
  building); the hub room is the quest's first clue.
- **Puzzles** = room-anchored GPS clues on the existing Leaflet map.
- **Verification** = GPS-to-building geofence only.
- **Integration target** = the `app/quest` flow (reused unchanged).
- **MVP scope** = a single tier, up to 9 rooms, one generated hunt per spawn.
- **Clue text** = templated, not AI-generated.

## Files touched

**New:**
- `lib/rooms/select-rooms.ts` (+ test)
- `lib/quest/generate-room-hunt.ts` (+ test)
- `lib/quest/create-room-hunt.ts`
- `app/api/quest/rooms/generate/route.ts` (+ test)
- `scripts/clean-room-hunts.ts`

**Modified:**
- `app/quest/demo/[huntSlug]/play/LeafletMap.tsx` (optional `rooms` prop)
- `app/quest/demo/[huntSlug]/play/play-shell.tsx` (pass clue locations to map)
- `app/quest/demo/page.tsx` (spawn entry point)

**Already fixed (foundation, separate from this feature):**
- `lib/freerooms/client.ts` — normalize upstream `roomStatuses` shape.
- `lib/freerooms/client.test.ts` — regression test for the upstream shape.
