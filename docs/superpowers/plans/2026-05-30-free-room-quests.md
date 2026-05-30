# Dynamic Free-Room Quests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a UNSW Quest on demand from live free-rooms data — pick currently-free rooms, write them as `quest_clues` anchored to building coordinates, seat the player at the nearest one, and render all room puzzles on the map — reusing the existing quest play flow unchanged.

**Architecture:** Two pure functions (`selectRoomsForHunt`, `buildRoomHuntDraft`) feed a thin persistence helper (`createRoomHunt`, Drizzle inserts) behind a `POST /api/quest/rooms/generate` route. A client button on the demo home generates a hunt, creates a team (the existing RPC also creates the session), and routes into the existing play flow. `LeafletMap` gains an optional `rooms` prop to plot every room puzzle.

**Tech Stack:** Next.js App Router, Drizzle ORM (Neon Postgres), Vitest, Leaflet. Spec: `docs/superpowers/specs/2026-05-30-free-room-quests-design.md`.

---

## File Structure

**New:**
- `lib/rooms/select-rooms.ts` — pure room selection / corral. Test: `lib/rooms/select-rooms.test.ts`
- `lib/quest/generate-room-hunt.ts` — pure room→clue draft builder. Test: `lib/quest/generate-room-hunt.test.ts`
- `lib/quest/create-room-hunt.ts` — persist hunt + clues via Drizzle.
- `app/api/quest/rooms/generate/route.ts` — POST handler. Test: `app/api/quest/rooms/generate/route.test.ts`
- `app/quest/demo/SpawnRoomQuest.tsx` — client button: generate → create team → play.
- `scripts/clean-room-hunts.ts` — purge generated hunts.

**Modified:**
- `app/quest/demo/[huntSlug]/play/LeafletMap.tsx` — optional `rooms` multi-marker prop.
- `app/quest/demo/[huntSlug]/play/play-shell.tsx` — thread `clues` into `MapDrawer` → `LeafletMap`.
- `app/quest/quest.css` — room pin marker styles.
- `app/quest/demo/page.tsx` — render `<SpawnRoomQuest />`.
- `package.json` — `clean:room-hunts` script.

**Reference (read, do not modify):**
- `lib/rooms/types.ts` (`FreeRoomRecord`), `lib/rooms/distance.ts` (`haversineMeters`).
- `lib/db/schema.ts` (`questHunts`, `questClues` — note constraints: tier 1–3, sequence 1–9, type `riddle`/`image_clue`, verification `gps`/`qr`/`gps_plus_photo`).
- `app/api/rooms/free/route.ts` + `route.test.ts` (the pattern this route mirrors).
- `app/quest/demo/[huntSlug]/team-gate.tsx` (`quest_create_team` returns `{ team_id, invite_code, session_id }`).
- `lib/api/fetcher.ts` (`postJson<T>(url, body) => { data, error }`).

---

## Task 1: Pure room selection (`selectRoomsForHunt`)

**Files:**
- Create: `lib/rooms/select-rooms.ts`
- Test: `lib/rooms/select-rooms.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/rooms/select-rooms.test.ts
import { describe, it, expect } from "vitest";
import { selectRoomsForHunt } from "./select-rooms";
import type { FreeRoomRecord } from "./types";

function room(over: Partial<FreeRoomRecord> & { id: string; buildingId: string }): FreeRoomRecord {
  return {
    room_id: over.id,
    room_name: over.room_name ?? `Room ${over.id}`,
    abbr: over.abbr ?? over.id,
    capacity: over.capacity ?? 20,
    usage: over.usage ?? "MEET",
    school: over.school ?? "",
    status: over.status ?? "free",
    free_until: over.free_until ?? null,
    building: {
      id: over.buildingId,
      name: `Building ${over.buildingId}`,
      lat: over.building?.lat ?? -33.9,
      lng: over.building?.lng ?? 151.2,
      photo_url: null,
      address: null,
    },
  };
}

describe("selectRoomsForHunt", () => {
  it("keeps only free rooms and caps at count", () => {
    const rooms = [
      room({ id: "A", buildingId: "K-A" }),
      room({ id: "B", buildingId: "K-B", status: "busy" }),
      room({ id: "C", buildingId: "K-C" }),
      room({ id: "D", buildingId: "K-D" }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 2 });
    expect(result).not.toBeNull();
    expect(result!.rooms).toHaveLength(2);
    expect(result!.rooms.every((r) => r.status === "free")).toBe(true);
    expect(result!.hub).toBe(result!.rooms[0]);
  });

  it("filters by minimum capacity and usage", () => {
    const rooms = [
      room({ id: "A", buildingId: "K-A", capacity: 10, usage: "MEET" }),
      room({ id: "B", buildingId: "K-B", capacity: 40, usage: "MEET" }),
      room({ id: "C", buildingId: "K-C", capacity: 40, usage: "LAB" }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 5, capacity: 30, usage: "MEET" });
    expect(result!.rooms.map((r) => r.room_id)).toEqual(["B"]);
  });

  it("dedupes to one room per building by default", () => {
    const rooms = [
      room({ id: "A1", buildingId: "K-A" }),
      room({ id: "A2", buildingId: "K-A" }),
      room({ id: "B1", buildingId: "K-B" }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 5 });
    expect(result!.rooms.map((r) => r.building.id)).toEqual(["K-A", "K-B"]);
  });

  it("sorts by proximity when near coords are given", () => {
    const rooms = [
      room({ id: "FAR", buildingId: "K-FAR", building: { id: "K-FAR", name: "", lat: -33.95, lng: 151.25, photo_url: null, address: null } }),
      room({ id: "NEAR", buildingId: "K-NEAR", building: { id: "K-NEAR", name: "", lat: -33.901, lng: 151.201, photo_url: null, address: null } }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 5, nearLat: -33.9, nearLng: 151.2 });
    expect(result!.hub.room_id).toBe("NEAR");
  });

  it("returns null when nothing matches", () => {
    expect(selectRoomsForHunt([], { count: 3 })).toBeNull();
    expect(
      selectRoomsForHunt([room({ id: "A", buildingId: "K-A", status: "busy" })], { count: 3 }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/rooms/select-rooms.test.ts`
Expected: FAIL — `Failed to resolve import "./select-rooms"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/rooms/select-rooms.ts
import { haversineMeters } from "./distance";
import type { FreeRoomRecord } from "./types";

export type SelectRoomsOpts = {
  count: number;
  nearLat?: number;
  nearLng?: number;
  capacity?: number;
  usage?: string;
  dedupeByBuilding?: boolean;
};

export type SelectRoomsResult = {
  hub: FreeRoomRecord;
  rooms: FreeRoomRecord[];
};

/**
 * Pick rooms for a generated quest ("corral"). Keeps only currently-free rooms,
 * applies optional capacity/usage filters, sorts by proximity when near coords
 * are given, dedupes to one room per building (markers are building-level), and
 * caps at `count`. Returns null when nothing matches. `hub` is the first
 * (nearest) room — the auto-assigned destination.
 */
export function selectRoomsForHunt(
  rooms: FreeRoomRecord[],
  opts: SelectRoomsOpts,
): SelectRoomsResult | null {
  let pool = rooms.filter((r) => r.status === "free");

  if (opts.capacity !== undefined) {
    pool = pool.filter((r) => r.capacity >= opts.capacity!);
  }
  if (opts.usage !== undefined) {
    pool = pool.filter((r) => r.usage === opts.usage);
  }

  if (opts.nearLat !== undefined && opts.nearLng !== undefined) {
    const lat = opts.nearLat;
    const lng = opts.nearLng;
    pool = [...pool].sort(
      (a, b) =>
        haversineMeters(lat, lng, a.building.lat, a.building.lng) -
        haversineMeters(lat, lng, b.building.lat, b.building.lng),
    );
  }

  if (opts.dedupeByBuilding !== false) {
    const seen = new Set<string>();
    pool = pool.filter((r) => {
      if (seen.has(r.building.id)) return false;
      seen.add(r.building.id);
      return true;
    });
  }

  const selected = pool.slice(0, Math.max(0, opts.count));
  if (selected.length === 0) return null;
  return { hub: selected[0], rooms: selected };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/rooms/select-rooms.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rooms/select-rooms.ts lib/rooms/select-rooms.test.ts
git commit -m "feat(rooms): selectRoomsForHunt pure room selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure draft builder (`buildRoomHuntDraft`)

**Files:**
- Create: `lib/quest/generate-room-hunt.ts`
- Test: `lib/quest/generate-room-hunt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/quest/generate-room-hunt.test.ts
import { describe, it, expect } from "vitest";
import { buildRoomHuntDraft } from "./generate-room-hunt";
import type { FreeRoomRecord } from "@/lib/rooms/types";

function room(id: string, lat: number, lng: number): FreeRoomRecord {
  return {
    room_id: id,
    room_name: `Room ${id}`,
    abbr: `R${id}`,
    capacity: 25,
    usage: "MEET",
    school: "",
    status: "free",
    free_until: null,
    building: { id: `K-${id}`, name: `Building ${id}`, lat, lng, photo_url: null, address: null },
  };
}

describe("buildRoomHuntDraft", () => {
  it("maps each room to a gps riddle clue anchored to building coords", () => {
    const draft = buildRoomHuntDraft([room("A", -33.9, 151.2)], { slug: "rooms-abc123" });
    expect(draft.slug).toBe("rooms-abc123");
    expect(draft.clues).toHaveLength(1);
    const c = draft.clues[0];
    expect(c.type).toBe("riddle");
    expect(c.verification_type).toBe("gps");
    expect(c.location_lat).toBe(-33.9);
    expect(c.location_lng).toBe(151.2);
    expect(c.geofence_radius_m).toBe(50);
    expect(c.tier).toBe(1);
    expect(c.sequence_in_tier).toBe(1);
    expect(c.location_name).toContain("Building A");
    expect(c.location_name).toContain("Room A");
    expect(c.body_text).toContain("Room A");
    expect(c.hints.length).toBeGreaterThanOrEqual(1);
  });

  it("chunks into tiers of at most 9", () => {
    const rooms = Array.from({ length: 11 }, (_, i) => room(String(i), -33.9, 151.2 + i * 0.001));
    const draft = buildRoomHuntDraft(rooms, { slug: "rooms-x" });
    expect(draft.clues[0]).toMatchObject({ tier: 1, sequence_in_tier: 1 });
    expect(draft.clues[8]).toMatchObject({ tier: 1, sequence_in_tier: 9 });
    expect(draft.clues[9]).toMatchObject({ tier: 2, sequence_in_tier: 1 });
    expect(draft.clues[10]).toMatchObject({ tier: 2, sequence_in_tier: 2 });
  });

  it("respects an overridden geofence radius", () => {
    const draft = buildRoomHuntDraft([room("A", -33.9, 151.2)], { slug: "rooms-x", geofenceRadiusM: 80 });
    expect(draft.clues[0].geofence_radius_m).toBe(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/quest/generate-room-hunt.test.ts`
Expected: FAIL — `Failed to resolve import "./generate-room-hunt"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/quest/generate-room-hunt.ts
import type { FreeRoomRecord } from "@/lib/rooms/types";

export type ClueDraft = {
  tier: number;
  sequence_in_tier: number;
  type: "riddle";
  verification_type: "gps";
  body_text: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  geofence_radius_m: number;
  hints: string[];
};

export type HuntDraft = {
  slug: string;
  name: string;
  description: string;
  duration_minutes: number;
  hero_emoji: string;
  clues: ClueDraft[];
};

export type BuildRoomHuntOpts = {
  slug: string;
  geofenceRadiusM?: number;
  durationMinutes?: number;
  cluesPerTier?: number;
};

/**
 * Turn a list of selected free rooms into a hunt draft (no I/O). Each room
 * becomes one GPS-verified riddle clue anchored to its building coordinates
 * (Freerooms gives building-level coords only). Rooms are chunked into tiers of
 * at most 9 to satisfy quest_clues constraints (tier 1-3, sequence 1-9).
 */
export function buildRoomHuntDraft(
  selected: FreeRoomRecord[],
  opts: BuildRoomHuntOpts,
): HuntDraft {
  const geofence = opts.geofenceRadiusM ?? 50;
  const perTier = Math.min(opts.cluesPerTier ?? 9, 9);

  const clues: ClueDraft[] = selected.map((room, i) => ({
    tier: Math.floor(i / perTier) + 1,
    sequence_in_tier: (i % perTier) + 1,
    type: "riddle",
    verification_type: "gps",
    body_text: `Make your way to ${room.room_name} (${room.usage}, seats ${room.capacity}) in ${room.building.name}.`,
    location_name: `${room.building.name} — ${room.room_name}`,
    location_lat: room.building.lat,
    location_lng: room.building.lng,
    geofence_radius_m: geofence,
    hints: [`It's in ${room.building.name}.`, `Room ${room.abbr}.`],
  }));

  return {
    slug: opts.slug,
    name: "Free Room Quest",
    description: "A quest through rooms that are free on campus right now.",
    duration_minutes: opts.durationMinutes ?? 30,
    hero_emoji: "🚪",
    clues,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/quest/generate-room-hunt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/quest/generate-room-hunt.ts lib/quest/generate-room-hunt.test.ts
git commit -m "feat(quest): buildRoomHuntDraft maps free rooms to clue drafts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Persistence (`createRoomHunt`)

**Files:**
- Create: `lib/quest/create-room-hunt.ts`

No unit test (thin DB-insert wrapper; exercised by the route test in Task 4 and the manual run in Task 9 — consistent with the repo's existing patterns where DB writes are not unit-tested).

- [ ] **Step 1: Write the implementation**

```ts
// lib/quest/create-room-hunt.ts
import { db } from "@/lib/db/client";
import { questClues, questHunts } from "@/lib/db/schema";
import type { HuntDraft } from "./generate-room-hunt";

/**
 * Persist a generated hunt: one quest_hunts row (published) plus its
 * quest_clues rows. Slug is provided by the caller (rooms-<id> convention so
 * generated hunts are identifiable for cleanup). Returns the new hunt id.
 */
export async function createRoomHunt(
  draft: HuntDraft,
): Promise<{ huntId: string; slug: string }> {
  const [hunt] = await db
    .insert(questHunts)
    .values({
      slug: draft.slug,
      name: draft.name,
      description: draft.description,
      durationMinutes: draft.duration_minutes,
      heroEmoji: draft.hero_emoji,
      status: "published",
    })
    .returning({ id: questHunts.id });

  if (draft.clues.length > 0) {
    await db.insert(questClues).values(
      draft.clues.map((c) => ({
        huntId: hunt.id,
        tier: c.tier,
        sequenceInTier: c.sequence_in_tier,
        type: c.type,
        bodyText: c.body_text,
        verificationType: c.verification_type,
        locationName: c.location_name,
        locationLat: c.location_lat,
        locationLng: c.location_lng,
        geofenceRadiusM: c.geofence_radius_m,
        hints: c.hints,
      })),
    );
  }

  return { huntId: hunt.id, slug: draft.slug };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/quest/create-room-hunt.ts` (confirms column names match the Drizzle schema).

- [ ] **Step 3: Commit**

```bash
git add lib/quest/create-room-hunt.ts
git commit -m "feat(quest): createRoomHunt persists generated hunt + clues

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Generate route (`POST /api/quest/rooms/generate`)

**Files:**
- Create: `app/api/quest/rooms/generate/route.ts`
- Test: `app/api/quest/rooms/generate/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/quest/rooms/generate/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/freerooms/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/freerooms/client")>(
    "@/lib/freerooms/client",
  );
  return { ...actual, createFreeroomsClient: vi.fn() };
});
vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn(() => ({ from: vi.fn().mockResolvedValue([]) })) },
}));
vi.mock("@/lib/rooms/get-free-rooms", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rooms/get-free-rooms")>(
    "@/lib/rooms/get-free-rooms",
  );
  return { ...actual, getFreeRooms: vi.fn() };
});
vi.mock("@/lib/quest/create-room-hunt", () => ({ createRoomHunt: vi.fn() }));

import { POST } from "./route";
import { getFreeRooms } from "@/lib/rooms/get-free-rooms";
import { createRoomHunt } from "@/lib/quest/create-room-hunt";
import type { FreeRoomRecord } from "@/lib/rooms/types";

const mockedGetFreeRooms = vi.mocked(getFreeRooms);
const mockedCreate = vi.mocked(createRoomHunt);

function freeRoom(id: string): FreeRoomRecord {
  return {
    room_id: id,
    room_name: `Room ${id}`,
    abbr: id,
    capacity: 25,
    usage: "MEET",
    school: "",
    status: "free",
    free_until: null,
    building: { id: `K-${id}`, name: `Building ${id}`, lat: -33.9, lng: 151.2, photo_url: null, address: null },
  };
}

function makeReq(body: unknown) {
  return new Request("http://localhost/api/quest/rooms/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/quest/rooms/generate", () => {
  beforeEach(() => {
    mockedGetFreeRooms.mockResolvedValue({ as_of: "t", rooms: [freeRoom("A"), freeRoom("B")] });
    mockedCreate.mockResolvedValue({ huntId: "hunt-1", slug: "rooms-test" });
  });
  afterEach(() => vi.clearAllMocks());

  it("generates a hunt and returns slug + huntId + hub", async () => {
    const res = await POST(makeReq({ count: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toMatch(/^rooms-/);
    expect(body.huntId).toBe("hunt-1");
    expect(body.hub_room.room_id).toBe("A");
    expect(mockedCreate).toHaveBeenCalledOnce();
  });

  it("returns 422 when no free rooms match", async () => {
    mockedGetFreeRooms.mockResolvedValueOnce({ as_of: "t", rooms: [] });
    const res = await POST(makeReq({ count: 2 }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_free_rooms");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid usage", async () => {
    const res = await POST(makeReq({ usage: "NOPE" }));
    expect(res.status).toBe(400);
    expect((await res.json()).param).toBe("usage");
  });

  it("returns 503 when Freerooms is unavailable", async () => {
    const { FreeroomsError } = await import("@/lib/freerooms/client");
    mockedGetFreeRooms.mockRejectedValueOnce(new FreeroomsError("/rooms/status", 500, "boom"));
    const res = await POST(makeReq({ count: 2 }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("rooms_service_unavailable");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/quest/rooms/generate/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/quest/rooms/generate/route.ts
import { unstable_cache } from "next/cache";
import {
  createFreeroomsClient,
  FreeroomsError,
  type FreeroomsClient,
} from "@/lib/freerooms/client";
import { getFreeRooms } from "@/lib/rooms/get-free-rooms";
import { selectRoomsForHunt } from "@/lib/rooms/select-rooms";
import { buildRoomHuntDraft } from "@/lib/quest/generate-room-hunt";
import { createRoomHunt } from "@/lib/quest/create-room-hunt";
import { db } from "@/lib/db/client";
import { buildingEnrichments } from "@/lib/db/schema";

const ONE_DAY_SECONDS = 60 * 60 * 24;

function createCachedFreeroomsClient(): FreeroomsClient {
  const base = createFreeroomsClient();
  return {
    ...base,
    getBuildings: unstable_cache(() => base.getBuildings(), ["freerooms-buildings"], {
      revalidate: ONE_DAY_SECONDS,
      tags: ["freerooms-static"],
    }),
    getRooms: unstable_cache(() => base.getRooms(), ["freerooms-rooms"], {
      revalidate: ONE_DAY_SECONDS,
      tags: ["freerooms-static"],
    }),
  };
}

const VALID_USAGES = new Set(["AUD", "CMLB", "LAB", "LCTR", "MEET", "SDIO", "TUSM"]);
const MAX_COUNT = 27; // 3 tiers * 9 clues
const DEFAULT_COUNT = 6;

type Body = {
  count?: number;
  capacity?: number;
  usage?: string;
  nearLat?: number;
  nearLng?: number;
};

type Parsed =
  | { ok: true; value: Required<Pick<Body, "count">> & Body }
  | { ok: false; param: string };

function parseBody(raw: Body): Parsed {
  const value: Body & { count: number } = { count: DEFAULT_COUNT };

  if (raw.count !== undefined) {
    if (!Number.isInteger(raw.count) || raw.count < 1 || raw.count > MAX_COUNT) {
      return { ok: false, param: "count" };
    }
    value.count = raw.count;
  }
  if (raw.capacity !== undefined) {
    if (!Number.isInteger(raw.capacity) || raw.capacity < 0) {
      return { ok: false, param: "capacity" };
    }
    value.capacity = raw.capacity;
  }
  if (raw.usage !== undefined) {
    if (!VALID_USAGES.has(raw.usage)) return { ok: false, param: "usage" };
    value.usage = raw.usage;
  }
  const hasLat = raw.nearLat !== undefined;
  const hasLng = raw.nearLng !== undefined;
  if (hasLat !== hasLng) return { ok: false, param: "near_lat_lng" };
  if (hasLat) {
    if (!Number.isFinite(raw.nearLat)) return { ok: false, param: "nearLat" };
    if (!Number.isFinite(raw.nearLng)) return { ok: false, param: "nearLng" };
    value.nearLat = raw.nearLat;
    value.nearLng = raw.nearLng;
  }
  return { ok: true, value };
}

export async function POST(req: Request): Promise<Response> {
  let raw: Body;
  try {
    raw = (await req.json()) as Body;
  } catch {
    raw = {};
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return Response.json({ error: "invalid_param", param: parsed.param }, { status: 400 });
  }
  const { count, capacity, usage, nearLat, nearLng } = parsed.value;

  try {
    const readEnrichments = async () =>
      db
        .select({
          building_id: buildingEnrichments.buildingId,
          photo_url: buildingEnrichments.photoUrl,
          address: buildingEnrichments.address,
        })
        .from(buildingEnrichments);

    const free = await getFreeRooms(
      { statusFilter: "free", capacity, usage, nearLat, nearLng },
      { freerooms: createCachedFreeroomsClient(), readEnrichments },
    );

    const selected = selectRoomsForHunt(free.rooms, {
      count,
      capacity,
      usage,
      nearLat,
      nearLng,
    });
    if (!selected) {
      return Response.json({ error: "no_free_rooms" }, { status: 422 });
    }

    const slug = `rooms-${crypto.randomUUID().slice(0, 8)}`;
    const draft = buildRoomHuntDraft(selected.rooms, { slug });
    const created = await createRoomHunt(draft);

    return Response.json(
      { slug: created.slug, huntId: created.huntId, hub_room: selected.hub, rooms: selected.rooms },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof FreeroomsError) {
      return Response.json({ error: "rooms_service_unavailable" }, { status: 503 });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/quest/rooms/generate/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/quest/rooms/generate/route.ts app/api/quest/rooms/generate/route.test.ts
git commit -m "feat(api): POST /api/quest/rooms/generate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: LeafletMap multi-marker prop

**Files:**
- Modify: `app/quest/demo/[huntSlug]/play/LeafletMap.tsx`
- Modify: `app/quest/quest.css`

No unit test — the repo has no Leaflet test harness; this is verified manually in Task 9. Behavior is backwards-compatible (the prop is optional).

- [ ] **Step 1: Add the `rooms` prop type and ref**

In `LeafletMap.tsx`, replace the `type Props = {...}` block (lines ~10-16) with:

```ts
type LatLng = { lat: number; lng: number };

export type RoomMarker = {
  lat: number;
  lng: number;
  name: string;
  index: number;
  done: boolean;
  current: boolean;
};

type Props = {
  checkpoint: LatLng;
  player: LatLng | null;
  geofenceRadiusM: number;
  accuracyM?: number | null;
  locationName?: string | null;
  rooms?: RoomMarker[];
};
```

Add `rooms` to the destructured params:

```ts
export function LeafletMap({
  checkpoint,
  player,
  geofenceRadiusM,
  accuracyM,
  locationName,
  rooms,
}: Props) {
```

Add a ref alongside the other refs (after `accuracyRef`):

```ts
  const roomMarkersRef = useRef<Marker[]>([]);
```

- [ ] **Step 2: Reset the ref in the init-effect cleanup**

In the init `useEffect` cleanup (the `return () => { ... }` near line 90-98), add the room markers reset after `accuracyRef.current = null;`:

```ts
      roomMarkersRef.current.forEach((m) => m.remove());
      roomMarkersRef.current = [];
```

- [ ] **Step 3: Add an effect that renders room markers**

Add this effect immediately after the "Keep the geofence + label in sync" effect (after the block ending at line ~109):

```ts
  // Plot all room puzzles as numbered pins (current highlighted, done dimmed).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      roomMarkersRef.current.forEach((m) => m.remove());
      roomMarkersRef.current = [];

      for (const r of rooms ?? []) {
        const variant = r.current
          ? " quest-room-pin--current"
          : r.done
            ? " quest-room-pin--done"
            : "";
        const icon = L.divIcon({
          className: `quest-room-pin${variant}`,
          html: `<span class="quest-room-pin__inner">${r.index}</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([r.lat, r.lng], {
          icon,
          interactive: false,
          keyboard: false,
        }).addTo(map);
        roomMarkersRef.current.push(marker);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rooms]);
```

- [ ] **Step 4: Add marker styles to `quest.css`**

Append to `app/quest/quest.css`:

```css
/* Room puzzle pins on the play map (generated free-room quests) */
.quest-room-pin__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--ink, #1a1a22);
  color: #fff;
  border: 2px solid #fff;
  font-family: var(--mono, monospace);
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.quest-room-pin--current .quest-room-pin__inner {
  background: var(--accent, #ef5b3a);
}
.quest-room-pin--done .quest-room-pin__inner {
  opacity: 0.45;
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "app/quest/demo/[huntSlug]/play/LeafletMap.tsx" app/quest/quest.css
git commit -m "feat(quest): LeafletMap optional room markers prop

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Thread clues into MapDrawer → LeafletMap

**Files:**
- Modify: `app/quest/demo/[huntSlug]/play/play-shell.tsx`

- [ ] **Step 1: Pass `clues` to MapDrawer**

At the `MapDrawer` invocation (around line 858), add the `clues` prop:

```tsx
        <MapDrawer
          clue={clue}
          clues={clues}
          distanceM={distanceM}
          accuracy={coords?.accuracy ?? null}
          playerCoords={coords ? { lat: coords.lat, lng: coords.lng } : null}
          onClose={() => setMapOpen(false)}
        />
```

- [ ] **Step 2: Accept `clues` in the MapDrawer signature**

In the `function MapDrawer({...})` definition (around line 970), add `clues` to both the destructure and the prop type:

```tsx
function MapDrawer({
  clue,
  clues,
  distanceM,
  accuracy,
  playerCoords,
  onClose,
}: {
  clue: Clue;
  clues: Clue[];
  distanceM: number | null;
  accuracy: number | null;
  playerCoords: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
```

- [ ] **Step 3: Build the room markers and pass to LeafletMap**

Inside `MapDrawer`, after the `checkpoint` const (around line 985-986), add:

```tsx
  const roomMarkers = clues
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.location_lat != null && c.location_lng != null)
    .map(({ c, i }) => ({
      lat: Number(c.location_lat),
      lng: Number(c.location_lng),
      name: c.location_name ?? "",
      index: i + 1,
      current: c.id === clue.id,
      done:
        c.tier < clue.tier ||
        (c.tier === clue.tier && c.sequence_in_tier < clue.sequence_in_tier),
    }));
```

Then add `rooms={roomMarkers}` to the `<LeafletMap ... />` element (around line 1016-1022):

```tsx
            <LeafletMap
              checkpoint={checkpoint}
              player={playerCoords}
              geofenceRadiusM={clue.geofence_radius_m ?? 25}
              accuracyM={accuracy}
              locationName={clue.location_name}
              rooms={roomMarkers}
            />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "app/quest/demo/[huntSlug]/play/play-shell.tsx"
git commit -m "feat(quest): show all room puzzles on the play map

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Spawn button + demo home wiring

**Files:**
- Create: `app/quest/demo/SpawnRoomQuest.tsx`
- Modify: `app/quest/demo/page.tsx`

No unit test (client component with browser geolocation + navigation; verified in Task 9).

- [ ] **Step 1: Write the client component**

```tsx
// app/quest/demo/SpawnRoomQuest.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api/fetcher";

type GenerateResponse = { slug: string; huntId: string };
type CreateTeamResponse = { team_id: string; invite_code: string; session_id: string };

// Best-effort geolocation; resolves to null if denied/unavailable/slow.
function getCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

export function SpawnRoomQuest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = async () => {
    setBusy(true);
    setError(null);

    const coords = await getCoords();

    const gen = await postJson<GenerateResponse>("/api/quest/rooms/generate", {
      count: 6,
      ...(coords ? { nearLat: coords.lat, nearLng: coords.lng } : {}),
    });
    if (gen.error || !gen.data) {
      setBusy(false);
      setError(gen.error?.message ?? "Could not find free rooms right now.");
      return;
    }

    const team = await postJson<CreateTeamResponse>("/api/quest/teams/create", {
      huntId: gen.data.huntId,
    });
    if (team.error || !team.data) {
      setBusy(false);
      setError(team.error?.message ?? "Could not create a team.");
      return;
    }

    router.push(`/quest/demo/${gen.data.slug}/play`);
  };

  return (
    <div className="card" style={{ padding: 18, borderColor: "var(--accent)" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="hand row gap-2" style={{ fontSize: 24, lineHeight: 1, alignItems: "center" }}>
          🚪 Free Room Quest
        </div>
        <div className="pill lime">live</div>
      </div>
      <div className="p muted" style={{ marginTop: 8 }}>
        Generates a quest from rooms that are free on campus right now and drops you at the nearest one.
      </div>
      <button
        className="btn primary grow"
        style={{ marginTop: 14, width: "100%" }}
        onClick={spawn}
        disabled={busy}
      >
        {busy ? "Finding free rooms…" : "Spawn a free-room quest →"}
      </button>
      {error ? (
        <div className="p" style={{ color: "var(--bad)", marginTop: 10 }}>{error}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Render it on the demo home**

In `app/quest/demo/page.tsx`, add the import near the other imports:

```tsx
import { SpawnRoomQuest } from "./SpawnRoomQuest";
```

Then render it at the top of the hunt list `div` — immediately after the opening of the column container (the `div` with `flexDirection: "column", gap: 16`), before `{(hunts ?? []).map(...)}`:

```tsx
        <SpawnRoomQuest />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/quest/demo/SpawnRoomQuest.tsx app/quest/demo/page.tsx
git commit -m "feat(quest): spawn a free-room quest from the demo home

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Cleanup script

**Files:**
- Create: `scripts/clean-room-hunts.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the cleanup script**

```ts
// scripts/clean-room-hunts.ts
// Purge generated free-room quests (slug like 'rooms-%'). Deleting the hunt
// cascades to quest_clues (FK onDelete cascade). Quest teams reference the hunt
// without cascade, so we delete teams for those hunts first (which cascades to
// team members and, via team_id, sessions).
import { db } from "@/lib/db/client";
import { questHunts, questTeams } from "@/lib/db/schema";
import { inArray, like } from "drizzle-orm";

async function main() {
  const generated = await db
    .select({ id: questHunts.id, slug: questHunts.slug })
    .from(questHunts)
    .where(like(questHunts.slug, "rooms-%"));

  if (generated.length === 0) {
    console.log("No generated room hunts to clean.");
    return;
  }

  const huntIds = generated.map((h) => h.id);
  await db.delete(questTeams).where(inArray(questTeams.huntId, huntIds));
  await db.delete(questHunts).where(inArray(questHunts.id, huntIds));

  console.log(`Deleted ${generated.length} generated room hunt(s):`);
  for (const h of generated) console.log(`  - ${h.slug}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` (after the `"enrich"` line):

```json
    "clean:room-hunts": "dotenv -e .env.local -- tsx scripts/clean-room-hunts.ts"
```

(Add a trailing comma to the preceding `"enrich"` line if needed so the JSON stays valid.)

- [ ] **Step 3: Verify the script loads (no rows is fine)**

Run: `npm run clean:room-hunts`
Expected: prints either "No generated room hunts to clean." or a list — exits 0 with no stack trace.

- [ ] **Step 4: Commit**

```bash
git add scripts/clean-room-hunts.ts package.json
git commit -m "chore(quest): script to purge generated room hunts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Full-suite + end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all tests pass (the prior 26 plus the new selection/draft/route tests).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end against live data**

Run: `npm run dev`, then in Firefox (mobile viewport) open `http://localhost:3000/quest/demo`.
- Click **"Spawn a free-room quest"**. (Allow or deny location — both must work.)
- Expected: it routes to `/quest/demo/rooms-XXXXXXXX/play` and the first clue names a real free room (e.g. "Make your way to … in …").
- Open the map. Expected: numbered pins for each room, the current one highlighted in accent, plus the building geofence circle.
- Confirm the existing hint/leaderboard/finale UI still renders (no regressions).

- [ ] **Step 4: Confirm rows were written, then clean up**

Quick check (optional): the new hunt appears on `/quest/demo` as a "Free Room Quest" card.
Run: `npm run clean:room-hunts`
Expected: deletes the generated `rooms-*` hunt(s); exits 0.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(quest): verify free-room quest end-to-end

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** select (corral) → T1; generate draft (room-anchored GPS puzzles) → T2; persist → T3; route + 503/422/400 → T4; map markers ("improve the map") → T5–T6; auto-assign/seat entry point → T7; cleanup lifecycle → T8; testing → T1/T2/T4 + T9. All spec sections map to a task.
- **Type consistency:** `HuntDraft`/`ClueDraft` defined in T2 are consumed unchanged in T3 and T4; `RoomMarker` defined in T5 is constructed in T6 with matching fields (`lat/lng/name/index/done/current`); `createRoomHunt` returns `{huntId, slug}` (T3) consumed by the route (T4) and surfaced to the spawn component (T7).
- **No new schema/migration:** all inserts respect existing `quest_clues` checks (tier 1–3 via 9-per-tier chunking + `count ≤ 27` cap; type `riddle`; verification `gps`).
