# Free-Rooms API Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public `GET /api/rooms/free` endpoint that combines live DevSoc Freerooms data with cached Foursquare building enrichments (photos + addresses), so the UNSW Quest mobile-first frontend can render class-free campus rooms on a map.

**Architecture:** Five small modules in this Next.js repo — Freerooms client, Foursquare client (backfill-only), a Supabase `building_enrichments` table, an aggregation service that joins live status with the cached enrichment, and a route handler. A separate backfill script populates `building_enrichments` by matching each Freerooms building to a Foursquare place via name+proximity scoring.

**Tech Stack:** Next.js 15 App Router (existing), TypeScript strict, Supabase (existing project), Vitest (new), tsx for the standalone backfill script. No frontend changes.

**Design spec:** `docs/unsw-quest/specs/2026-05-19-free-rooms-api-design.md` — read sections 3 (architecture), 4 (endpoint contract), 5 (schema), and 6 (matching algorithm) before starting if anything below is ambiguous.

**Conventions inherited from the repo:**
- TS path alias: `@/*` → `./*`
- ESLint: `next/core-web-vitals` + `next/typescript`
- Commit style: `feat:`, `chore:`, `docs:` etc. (see `git log`)
- All API HTTPS calls use the native `fetch` (no extra HTTP client library).

---

## Task 0: Bootstrap — deps, vitest config, env, proxy fix

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.env.example`
- Modify: `lib/supabase/proxy.ts` (allow `/api/*` to bypass the auth redirect)

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install -D vitest @vitest/coverage-v8 tsx
```

Expected: packages added under `devDependencies` in `package.json`. No errors.

- [ ] **Step 2: Add scripts to package.json**

Modify `package.json`, replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "test": "vitest",
  "test:run": "vitest run",
  "enrich": "tsx scripts/enrich-buildings.ts"
}
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

Run: `npm run test:run`
Expected: Vitest reports "No test files found" and exits 0 (or exits with a "no tests" notice). Either is fine. If it crashes with a config error, fix it before continuing.

- [ ] **Step 5: Update `.env.example`**

Replace the contents of `.env.example` with:

```
# Supabase (publishable / anon key — safe in browser)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key

# Service-role key — server-side only, NEVER expose to the client.
# Used by the backfill script (scripts/enrich-buildings.ts) to write to building_enrichments.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Foursquare Places API — server-side only.
# Sign up: https://foursquare.com/developers
FOURSQUARE_API_KEY=your-foursquare-key

# Optional overrides (defaults shown)
# FREEROOMS_BASE_URL=https://freerooms.devsoc.app/api
# FOURSQUARE_BASE_URL=https://api.foursquare.com/v3
```

- [ ] **Step 6: Fix the proxy so `/api/*` is not auth-gated**

Modify `lib/supabase/proxy.ts`. Find the block:

```ts
  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
```

Replace with:

```ts
  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/api")
  ) {
```

This lets the public `/api/rooms/free` endpoint be reachable without a session, while still refreshing Supabase cookies for authenticated users on other routes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example lib/supabase/proxy.ts
git commit -m "chore: add vitest, tsx; bypass auth redirect for /api/*"
```

---

## Task 1: Create `building_enrichments` table

**Files:**
- Create: `supabase/migrations/20260519000000_building_enrichments.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260519000000_building_enrichments.sql`:

```sql
-- Enrichment metadata for Freerooms buildings, sourced from Foursquare.
-- One row per Freerooms building_id. Populated by scripts/enrich-buildings.ts.

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

-- Public read: the runtime endpoint queries with the anon key.
create policy "building_enrichments_public_read"
  on public.building_enrichments
  for select
  using (true);

-- Writes happen only via the service-role key (backfill script), which bypasses RLS.
-- No write policy is needed.
```

- [ ] **Step 2: Apply the migration to the live Supabase project**

Apply via the Supabase MCP server (project ref already wired in `.mcp.json`). Use the MCP integration's "execute SQL" / "apply migration" tool with the file contents above. If that fails, fall back to: copy-paste the SQL into the Supabase dashboard SQL editor and run it.

- [ ] **Step 3: Verify the table exists**

Via the MCP server (list tables / describe table), confirm:
- Table `public.building_enrichments` exists with the columns from the migration.
- RLS is enabled.
- Policy `building_enrichments_public_read` exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260519000000_building_enrichments.sql
git commit -m "feat: add building_enrichments table for Foursquare cache"
```

---

## Task 2: Freerooms types

**Files:**
- Create: `lib/freerooms/types.ts`

- [ ] **Step 1: Write the types**

Create `lib/freerooms/types.ts`:

```ts
export type FreeroomsBuilding = {
  id: string;            // e.g. "K-J17"
  name: string;          // e.g. "Ainsworth Building"
  lat: number;
  long: number;
  aliases: string[];
};

export type FreeroomsRoom = {
  id: string;            // e.g. "K-J17-305"
  name: string;
  abbr: string;
  usage: FreeroomsUsage;
  capacity: number;
  school: string;
};

export type FreeroomsUsage =
  | "AUD"
  | "CMLB"
  | "LAB"
  | "LCTR"
  | "MEET"
  | "SDIO"
  | "TUSM"
  | string;  // allow forward-compat for unknown codes

export type RoomStatus = "free" | "soon" | "busy";

export type FreeroomsRoomStatus = {
  status: RoomStatus;
  endtime: string;       // ISO string or "" when not applicable
};

// Response shape from GET /api/rooms/status:
// { [building_id]: { [room_number]: FreeroomsRoomStatus } }
export type FreeroomsStatusResponse = Record<
  string,
  Record<string, FreeroomsRoomStatus>
>;

export type FreeroomsStatusQuery = {
  datetime?: string;
  capacity?: number;
  duration?: number;
  usage?: string;
  location?: "upper" | "lower";
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/freerooms/types.ts
git commit -m "feat(freerooms): add API response types"
```

---

## Task 3: Freerooms client

**Files:**
- Create: `lib/freerooms/client.ts`
- Create: `lib/freerooms/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/freerooms/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createFreeroomsClient,
  type FreeroomsClient,
} from "./client";

describe("FreeroomsClient", () => {
  let client: FreeroomsClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = createFreeroomsClient({ baseUrl: "https://example.test/api" });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("getBuildings hits /api/buildings and returns the building array", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          buildings: [
            { id: "K-J17", name: "Ainsworth", lat: -33.9, long: 151.2, aliases: [] },
          ],
        }),
        { status: 200 },
      ),
    );

    const buildings = await client.getBuildings();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.test/api/buildings",
      expect.objectContaining({ method: "GET" }),
    );
    expect(buildings).toHaveLength(1);
    expect(buildings[0].id).toBe("K-J17");
  });

  it("getRooms hits /api/rooms and returns rooms keyed by id", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          rooms: {
            "K-J17-305": {
              id: "K-J17-305",
              name: "Brass Lab",
              abbr: "BrassME305",
              usage: "CMLB",
              capacity: 30,
              school: "COMPSC",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const rooms = await client.getRooms();

    expect(rooms["K-J17-305"].capacity).toBe(30);
  });

  it("getRoomStatus passes query params through and parses response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "K-J17": {
            "305": { status: "free", endtime: "2026-05-19T14:00:00Z" },
          },
        }),
        { status: 200 },
      ),
    );

    const status = await client.getRoomStatus({
      datetime: "2026-05-19T13:00:00Z",
      capacity: 20,
      usage: "CMLB",
    });

    const url = (fetchSpy.mock.calls[0][0] as string);
    expect(url).toContain("/rooms/status");
    expect(url).toContain("datetime=2026-05-19T13%3A00%3A00Z");
    expect(url).toContain("capacity=20");
    expect(url).toContain("usage=CMLB");
    expect(status["K-J17"]["305"].status).toBe("free");
  });

  it("throws a typed error on non-2xx responses", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("server exploded", { status: 500 }),
    );

    await expect(client.getBuildings()).rejects.toThrow(/freerooms/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- lib/freerooms/client.test.ts`
Expected: FAIL — `createFreeroomsClient is not defined` (the module doesn't exist yet).

- [ ] **Step 3: Implement the client**

Create `lib/freerooms/client.ts`:

```ts
import type {
  FreeroomsBuilding,
  FreeroomsRoom,
  FreeroomsStatusQuery,
  FreeroomsStatusResponse,
} from "./types";

export type FreeroomsClient = {
  getBuildings: () => Promise<FreeroomsBuilding[]>;
  getRooms: () => Promise<Record<string, FreeroomsRoom>>;
  getRoomStatus: (
    query?: FreeroomsStatusQuery,
  ) => Promise<FreeroomsStatusResponse>;
};

export type FreeroomsClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = "https://freerooms.devsoc.app/api";

export class FreeroomsError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string,
  ) {
    super(`freerooms ${endpoint} failed (${status}): ${message}`);
    this.name = "FreeroomsError";
  }
}

export function createFreeroomsClient(
  options: FreeroomsClientOptions = {},
): FreeroomsClient {
  const baseUrl =
    options.baseUrl ?? process.env.FREEROOMS_BASE_URL ?? DEFAULT_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function get<T>(path: string, search?: URLSearchParams): Promise<T> {
    const url = search
      ? `${baseUrl}${path}?${search.toString()}`
      : `${baseUrl}${path}`;
    const res = await fetchImpl(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FreeroomsError(path, res.status, body.slice(0, 200));
    }
    return (await res.json()) as T;
  }

  return {
    async getBuildings() {
      const data = await get<{ buildings: FreeroomsBuilding[] }>("/buildings");
      return data.buildings;
    },

    async getRooms() {
      const data = await get<{ rooms: Record<string, FreeroomsRoom> }>(
        "/rooms",
      );
      return data.rooms;
    },

    async getRoomStatus(query: FreeroomsStatusQuery = {}) {
      const params = new URLSearchParams();
      if (query.datetime) params.set("datetime", query.datetime);
      if (query.capacity !== undefined)
        params.set("capacity", String(query.capacity));
      if (query.duration !== undefined)
        params.set("duration", String(query.duration));
      if (query.usage) params.set("usage", query.usage);
      if (query.location) params.set("location", query.location);

      return get<FreeroomsStatusResponse>(
        "/rooms/status",
        params.size ? params : undefined,
      );
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- lib/freerooms/client.test.ts`
Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add lib/freerooms/client.ts lib/freerooms/client.test.ts
git commit -m "feat(freerooms): add HTTP client with typed errors"
```

---

## Task 4: Haversine distance (strict TDD)

**Files:**
- Create: `lib/rooms/distance.ts`
- Create: `lib/rooms/distance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/rooms/distance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { haversineMeters } from "./distance";

describe("haversineMeters", () => {
  it("returns 0 for the same point", () => {
    expect(haversineMeters(-33.918, 151.231, -33.918, 151.231)).toBe(0);
  });

  it("returns ~111000m for one degree of latitude at the equator", () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("matches a known UNSW distance (Ainsworth to Library is ~250m)", () => {
    // Ainsworth ~ (-33.9178, 151.2310)
    // Main library ~ (-33.9173, 151.2336)
    const d = haversineMeters(-33.9178, 151.231, -33.9173, 151.2336);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(350);
  });

  it("is symmetric", () => {
    const a = haversineMeters(-33.9, 151.2, -33.8, 151.3);
    const b = haversineMeters(-33.8, 151.3, -33.9, 151.2);
    expect(a).toBeCloseTo(b, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- lib/rooms/distance.test.ts`
Expected: FAIL — `haversineMeters is not defined`.

- [ ] **Step 3: Implement haversine**

Create `lib/rooms/distance.ts`:

```ts
const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- lib/rooms/distance.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/rooms/distance.ts lib/rooms/distance.test.ts
git commit -m "feat(rooms): add haversine distance helper"
```

---

## Task 5: Name similarity scorer (strict TDD)

**Files:**
- Create: `lib/foursquare/match.ts`
- Create: `lib/foursquare/match.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/foursquare/match.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nameSimilarity } from "./match";

describe("nameSimilarity", () => {
  it("returns 1.0 for identical names", () => {
    expect(nameSimilarity("Ainsworth Building", "Ainsworth Building")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(nameSimilarity("AINSWORTH building", "ainsworth Building")).toBe(1);
  });

  it("strips generic suffixes (building, centre, center, block, hall)", () => {
    expect(nameSimilarity("Ainsworth Building", "Ainsworth")).toBe(1);
    expect(nameSimilarity("Mathews Theatre", "Mathews Theatre Centre")).toBe(1);
    expect(nameSimilarity("Quad Block", "Quad")).toBe(1);
  });

  it("returns a partial score for one-word overlap in multi-word names", () => {
    const s = nameSimilarity("Red Centre East", "Red Centre West");
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(1);
  });

  it("returns 0 for fully disjoint names", () => {
    expect(nameSimilarity("Ainsworth", "Goldstein")).toBe(0);
  });

  it("ignores extra whitespace and punctuation", () => {
    expect(nameSimilarity("  Ainsworth   Building  ", "Ainsworth-Building")).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- lib/foursquare/match.test.ts`
Expected: FAIL — `nameSimilarity is not defined`.

- [ ] **Step 3: Implement nameSimilarity**

Create `lib/foursquare/match.ts`:

```ts
const GENERIC_SUFFIXES = new Set([
  "building",
  "centre",
  "center",
  "block",
  "hall",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((tok) => tok.length > 0 && !GENERIC_SUFFIXES.has(tok)),
  );
}

/**
 * Jaccard similarity over name tokens (after lowercasing, stripping
 * punctuation, and removing generic building-y suffixes).
 * Returns a value in [0, 1].
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);

  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const tok of ta) if (tb.has(tok)) intersection++;
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- lib/foursquare/match.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/foursquare/match.ts lib/foursquare/match.test.ts
git commit -m "feat(foursquare): add name similarity scorer"
```

---

## Task 6: Confidence classifier (strict TDD)

**Files:**
- Modify: `lib/foursquare/match.ts`
- Modify: `lib/foursquare/match.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `lib/foursquare/match.test.ts`:

```ts
import { classifyConfidence } from "./match";

describe("classifyConfidence", () => {
  it("returns 'high' when name >= 0.85 AND distance <= 30m", () => {
    expect(classifyConfidence(0.85, 30)).toBe("high");
    expect(classifyConfidence(1.0, 15)).toBe("high");
  });

  it("returns 'medium' for borderline high (just over distance)", () => {
    expect(classifyConfidence(0.85, 31)).toBe("medium");
  });

  it("returns 'medium' when name >= 0.6 AND distance <= 50m but not high", () => {
    expect(classifyConfidence(0.6, 50)).toBe("medium");
    expect(classifyConfidence(0.7, 40)).toBe("medium");
  });

  it("returns 'low' for in-radius but below medium thresholds", () => {
    expect(classifyConfidence(0.5, 90)).toBe("low");
    expect(classifyConfidence(0.59, 49)).toBe("low");
    expect(classifyConfidence(0.0, 99)).toBe("low");
  });

  it("returns 'low' when over 50m but still within 100m even with great name", () => {
    expect(classifyConfidence(0.95, 80)).toBe("low");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- lib/foursquare/match.test.ts`
Expected: 5 NEW tests FAIL — `classifyConfidence is not defined`.

- [ ] **Step 3: Implement classifier**

Append to `lib/foursquare/match.ts`:

```ts
export type MatchConfidence = "high" | "medium" | "low" | "no_match";

/**
 * Tiered confidence for a single best-candidate match.
 * Caller is responsible for deciding `no_match` (zero candidates within 100m).
 */
export function classifyConfidence(
  nameScore: number,
  distanceMeters: number,
): Exclude<MatchConfidence, "no_match"> {
  if (nameScore >= 0.85 && distanceMeters <= 30) return "high";
  if (nameScore >= 0.6 && distanceMeters <= 50) return "medium";
  return "low";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- lib/foursquare/match.test.ts`
Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/foursquare/match.ts lib/foursquare/match.test.ts
git commit -m "feat(foursquare): add confidence classifier"
```

---

## Task 7: Best-candidate picker (strict TDD)

**Files:**
- Modify: `lib/foursquare/match.ts`
- Modify: `lib/foursquare/match.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `lib/foursquare/match.test.ts`:

```ts
import { pickBestCandidate, type ScoredCandidate } from "./match";

describe("pickBestCandidate", () => {
  const c = (
    id: string,
    name: string,
    nameScore: number,
    distance: number,
  ): ScoredCandidate => ({ id, name, nameScore, distanceMeters: distance });

  it("returns null when given no candidates", () => {
    expect(pickBestCandidate([])).toBeNull();
  });

  it("picks the higher nameScore even if it is farther", () => {
    const best = pickBestCandidate([
      c("a", "Foo", 0.5, 10),
      c("b", "Foo", 0.9, 80),
    ]);
    expect(best?.id).toBe("b");
  });

  it("breaks ties on nameScore by picking the closer candidate", () => {
    const best = pickBestCandidate([
      c("a", "Foo", 0.8, 60),
      c("b", "Foo", 0.8, 20),
    ]);
    expect(best?.id).toBe("b");
  });

  it("returns the single candidate when there is only one", () => {
    const only = c("only", "Foo", 0.4, 200);
    expect(pickBestCandidate([only])).toEqual(only);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- lib/foursquare/match.test.ts`
Expected: 4 NEW tests FAIL — `pickBestCandidate is not defined`.

- [ ] **Step 3: Implement picker**

Append to `lib/foursquare/match.ts`:

```ts
export type ScoredCandidate = {
  id: string;
  name: string;
  nameScore: number;
  distanceMeters: number;
};

/**
 * Picks the candidate with the highest name score, breaking ties by proximity.
 * Returns null when given an empty list.
 */
export function pickBestCandidate(
  candidates: ScoredCandidate[],
): ScoredCandidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
    return a.distanceMeters - b.distanceMeters;
  })[0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- lib/foursquare/match.test.ts`
Expected: all 15 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/foursquare/match.ts lib/foursquare/match.test.ts
git commit -m "feat(foursquare): add best-candidate picker"
```

---

## Task 8: Foursquare client

**Files:**
- Create: `lib/foursquare/types.ts`
- Create: `lib/foursquare/client.ts`
- Create: `lib/foursquare/client.test.ts`

- [ ] **Step 1: Write types**

Create `lib/foursquare/types.ts`:

```ts
export type FoursquarePlace = {
  fsq_place_id: string;
  name: string;
  location: {
    address?: string;
    formatted_address?: string;
  };
  distance: number;  // metres from the search ll
};

export type FoursquarePhoto = {
  prefix: string;
  suffix: string;
};
```

- [ ] **Step 2: Write failing client tests**

Create `lib/foursquare/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFoursquareClient, buildPhotoUrl } from "./client";

describe("buildPhotoUrl", () => {
  it("assembles a Foursquare photo URL from prefix/suffix", () => {
    const url = buildPhotoUrl({
      prefix: "https://fastly.4sqi.net/img/general/",
      suffix: "/12345_abcdef.jpg",
    });
    expect(url).toBe(
      "https://fastly.4sqi.net/img/general/original/12345_abcdef.jpg",
    );
  });
});

describe("FoursquareClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("searchNearby sends ll, radius, limit, fields and the api key", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });

    await client.searchNearby({ lat: -33.9, lng: 151.2, radiusMeters: 100 });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("/places/search");
    expect(url).toContain("ll=-33.9%2C151.2");
    expect(url).toContain("radius=100");
    expect(url).toContain("limit=20");
    expect(url).toContain("fields=fsq_place_id%2Cname%2Clocation%2Cdistance");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "test-key",
      Accept: "application/json",
    });
  });

  it("searchNearby returns the parsed results array", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              fsq_place_id: "abc",
              name: "Foo",
              location: { formatted_address: "1 Foo St" },
              distance: 12,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });
    const results = await client.searchNearby({
      lat: 0,
      lng: 0,
      radiusMeters: 50,
    });
    expect(results).toHaveLength(1);
    expect(results[0].fsq_place_id).toBe("abc");
  });

  it("getFirstPhoto returns null when the place has zero photos", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });
    const photo = await client.getFirstPhoto("abc");
    expect(photo).toBeNull();
  });

  it("getFirstPhoto returns the first photo when present", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { prefix: "https://x/", suffix: "/y.jpg" },
          { prefix: "https://x/", suffix: "/z.jpg" },
        ]),
        { status: 200 },
      ),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });
    const photo = await client.getFirstPhoto("abc");
    expect(photo).toEqual({ prefix: "https://x/", suffix: "/y.jpg" });
  });

  it("throws on non-2xx", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const client = createFoursquareClient({ apiKey: "test-key" });
    await expect(
      client.searchNearby({ lat: 0, lng: 0, radiusMeters: 50 }),
    ).rejects.toThrow(/foursquare/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- lib/foursquare/client.test.ts`
Expected: all 6 tests FAIL — module doesn't exist.

- [ ] **Step 4: Implement client**

Create `lib/foursquare/client.ts`:

```ts
import type { FoursquarePhoto, FoursquarePlace } from "./types";

const DEFAULT_BASE_URL = "https://api.foursquare.com/v3";

export type FoursquareClient = {
  searchNearby: (args: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
  }) => Promise<FoursquarePlace[]>;
  getFirstPhoto: (placeId: string) => Promise<FoursquarePhoto | null>;
};

export type FoursquareClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class FoursquareError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string,
  ) {
    super(`foursquare ${endpoint} failed (${status}): ${message}`);
    this.name = "FoursquareError";
  }
}

export function createFoursquareClient(
  options: FoursquareClientOptions,
): FoursquareClient {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = {
    Authorization: options.apiKey,
    Accept: "application/json",
  } as const;

  async function get<T>(path: string, search?: URLSearchParams): Promise<T> {
    const url = search
      ? `${baseUrl}${path}?${search.toString()}`
      : `${baseUrl}${path}`;
    const res = await fetchImpl(url, { method: "GET", headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FoursquareError(path, res.status, body.slice(0, 200));
    }
    return (await res.json()) as T;
  }

  return {
    async searchNearby({ lat, lng, radiusMeters, limit = 20 }) {
      const params = new URLSearchParams({
        ll: `${lat},${lng}`,
        radius: String(radiusMeters),
        limit: String(limit),
        fields: "fsq_place_id,name,location,distance",
      });
      const data = await get<{ results: FoursquarePlace[] }>(
        "/places/search",
        params,
      );
      return data.results;
    },

    async getFirstPhoto(placeId: string) {
      const params = new URLSearchParams({ limit: "1" });
      const data = await get<FoursquarePhoto[]>(
        `/places/${encodeURIComponent(placeId)}/photos`,
        params,
      );
      return data.length === 0 ? null : data[0];
    },
  };
}

export function buildPhotoUrl(photo: FoursquarePhoto): string {
  return `${photo.prefix}original${photo.suffix}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- lib/foursquare/client.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/foursquare/types.ts lib/foursquare/client.ts lib/foursquare/client.test.ts
git commit -m "feat(foursquare): add HTTP client and photo URL builder"
```

---

## Task 9: Supabase admin (service-role) client

**Files:**
- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: Write the admin client**

Create `lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER-SIDE ONLY.
 *
 * Bypasses RLS. Used by the backfill script (scripts/enrich-buildings.ts)
 * to write to building_enrichments. Never import this from any file that
 * could be bundled into the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/admin.ts
git commit -m "feat(supabase): add service-role admin client"
```

---

## Task 10: Aggregation service (strict TDD)

**Files:**
- Create: `lib/rooms/types.ts`
- Create: `lib/rooms/get-free-rooms.ts`
- Create: `lib/rooms/get-free-rooms.test.ts`

- [ ] **Step 1: Write the response types**

Create `lib/rooms/types.ts`:

```ts
import type { RoomStatus } from "@/lib/freerooms/types";

export type FreeRoomBuilding = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  photo_url: string | null;
  address: string | null;
};

export type FreeRoomRecord = {
  room_id: string;
  room_name: string;
  abbr: string;
  capacity: number;
  usage: string;
  school: string;
  building: FreeRoomBuilding;
  status: RoomStatus;
  free_until: string | null;
};

export type FreeRoomsResponse = {
  as_of: string;            // ISO timestamp
  rooms: FreeRoomRecord[];
};

export type GetFreeRoomsParams = {
  at?: string;
  capacity?: number;
  usage?: string;
  duration?: number;
  statusFilter?: "free" | "soon" | "all";
  nearLat?: number;
  nearLng?: number;
};
```

- [ ] **Step 2: Write failing aggregator tests**

Create `lib/rooms/get-free-rooms.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { getFreeRooms } from "./get-free-rooms";
import type { FreeroomsClient } from "@/lib/freerooms/client";

// Helpers ---------------------------------------------------------

function makeFreeroomsClient(overrides: Partial<FreeroomsClient> = {}): FreeroomsClient {
  return {
    getBuildings: vi.fn().mockResolvedValue([
      { id: "K-J17", name: "Ainsworth", lat: -33.91, long: 151.23, aliases: [] },
      { id: "K-E15", name: "Library", lat: -33.917, long: 151.234, aliases: [] },
    ]),
    getRooms: vi.fn().mockResolvedValue({
      "K-J17-305": {
        id: "K-J17-305",
        name: "Ainsworth 305",
        abbr: "Ains305",
        usage: "CMLB",
        capacity: 30,
        school: "COMPSC",
      },
      "K-E15-200": {
        id: "K-E15-200",
        name: "Library 200",
        abbr: "Lib200",
        usage: "LCTR",
        capacity: 150,
        school: "LIB",
      },
    }),
    getRoomStatus: vi.fn().mockResolvedValue({
      "K-J17": { "305": { status: "free", endtime: "2026-05-19T14:00:00Z" } },
      "K-E15": { "200": { status: "soon", endtime: "2026-05-19T13:10:00Z" } },
    }),
    ...overrides,
  };
}

type EnrichmentRow = {
  building_id: string;
  photo_url: string | null;
  address: string | null;
};

function makeEnrichmentReader(rows: EnrichmentRow[]) {
  return vi.fn().mockResolvedValue(rows);
}

// Tests -----------------------------------------------------------

describe("getFreeRooms", () => {
  it("returns free rooms with enriched building data", async () => {
    const fr = makeFreeroomsClient();
    const reader = makeEnrichmentReader([
      {
        building_id: "K-J17",
        photo_url: "https://photo/ainsworth.jpg",
        address: "Anzac Pde",
      },
    ]);

    const res = await getFreeRooms(
      { statusFilter: "free" },
      { freerooms: fr, readEnrichments: reader },
    );

    expect(res.rooms).toHaveLength(1);
    const r = res.rooms[0];
    expect(r.room_id).toBe("K-J17-305");
    expect(r.status).toBe("free");
    expect(r.free_until).toBe("2026-05-19T14:00:00Z");
    expect(r.building.id).toBe("K-J17");
    expect(r.building.photo_url).toBe("https://photo/ainsworth.jpg");
    expect(r.building.address).toBe("Anzac Pde");
  });

  it("includes 'soon' rooms when statusFilter is 'soon'", async () => {
    const fr = makeFreeroomsClient();
    const res = await getFreeRooms(
      { statusFilter: "soon" },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    const statuses = res.rooms.map((r) => r.status).sort();
    expect(statuses).toEqual(["free", "soon"]);
  });

  it("includes all rooms when statusFilter is 'all'", async () => {
    const fr = makeFreeroomsClient({
      getRoomStatus: vi.fn().mockResolvedValue({
        "K-J17": { "305": { status: "busy", endtime: "" } },
      }),
    });
    const res = await getFreeRooms(
      { statusFilter: "all" },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.rooms).toHaveLength(1);
    expect(res.rooms[0].status).toBe("busy");
    expect(res.rooms[0].free_until).toBeNull();
  });

  it("falls back to null photo/address when enrichment row is missing", async () => {
    const fr = makeFreeroomsClient();
    const res = await getFreeRooms(
      { statusFilter: "free" },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.rooms[0].building.photo_url).toBeNull();
    expect(res.rooms[0].building.address).toBeNull();
  });

  it("falls back to null photo/address when readEnrichments throws", async () => {
    const fr = makeFreeroomsClient();
    const reader = vi.fn().mockRejectedValue(new Error("supabase down"));

    const res = await getFreeRooms(
      { statusFilter: "free" },
      { freerooms: fr, readEnrichments: reader },
    );
    expect(res.rooms[0].building.photo_url).toBeNull();
    expect(res.rooms[0].building.address).toBeNull();
  });

  it("sorts by distance ascending when nearLat/nearLng are given", async () => {
    const fr = makeFreeroomsClient({
      getRoomStatus: vi.fn().mockResolvedValue({
        "K-J17": { "305": { status: "free", endtime: "2026-05-19T14:00:00Z" } },
        "K-E15": { "200": { status: "free", endtime: "2026-05-19T14:00:00Z" } },
      }),
    });
    // K-E15 is at (-33.917, 151.234). nearLat/nearLng matches it.
    const res = await getFreeRooms(
      { statusFilter: "free", nearLat: -33.917, nearLng: 151.234 },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.rooms[0].building.id).toBe("K-E15");
    expect(res.rooms[1].building.id).toBe("K-J17");
  });

  it("passes the freerooms query params through (at, capacity, usage, duration)", async () => {
    const getRoomStatus = vi.fn().mockResolvedValue({});
    const fr = makeFreeroomsClient({ getRoomStatus });

    await getFreeRooms(
      {
        at: "2026-05-19T13:00:00Z",
        capacity: 20,
        usage: "CMLB",
        duration: 30,
      },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );

    expect(getRoomStatus).toHaveBeenCalledWith({
      datetime: "2026-05-19T13:00:00Z",
      capacity: 20,
      usage: "CMLB",
      duration: 30,
    });
  });

  it("populates as_of with an ISO timestamp", async () => {
    const fr = makeFreeroomsClient();
    const res = await getFreeRooms(
      {},
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.as_of).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- lib/rooms/get-free-rooms.test.ts`
Expected: all 8 tests FAIL — module doesn't exist.

- [ ] **Step 4: Implement the aggregator**

Create `lib/rooms/get-free-rooms.ts`:

```ts
import type { FreeroomsClient } from "@/lib/freerooms/client";
import type { RoomStatus } from "@/lib/freerooms/types";
import { haversineMeters } from "./distance";
import type {
  FreeRoomRecord,
  FreeRoomsResponse,
  GetFreeRoomsParams,
} from "./types";

export type EnrichmentRow = {
  building_id: string;
  photo_url: string | null;
  address: string | null;
};

export type ReadEnrichments = () => Promise<EnrichmentRow[]>;

export type GetFreeRoomsDeps = {
  freerooms: FreeroomsClient;
  readEnrichments: ReadEnrichments;
};

const STATUS_FREE: RoomStatus[] = ["free"];
const STATUS_SOON: RoomStatus[] = ["free", "soon"];
const STATUS_ALL: RoomStatus[] = ["free", "soon", "busy"];

function statusesFor(filter: GetFreeRoomsParams["statusFilter"]): RoomStatus[] {
  switch (filter) {
    case "all":
      return STATUS_ALL;
    case "soon":
      return STATUS_SOON;
    case "free":
    default:
      return STATUS_FREE;
  }
}

export async function getFreeRooms(
  params: GetFreeRoomsParams,
  deps: GetFreeRoomsDeps,
): Promise<FreeRoomsResponse> {
  const allowedStatuses = statusesFor(params.statusFilter);

  // Fetch live + reference data concurrently.
  const [buildings, rooms, status, enrichmentList] = await Promise.all([
    deps.freerooms.getBuildings(),
    deps.freerooms.getRooms(),
    deps.freerooms.getRoomStatus({
      datetime: params.at,
      capacity: params.capacity,
      usage: params.usage,
      duration: params.duration,
    }),
    deps.readEnrichments().catch(() => [] as EnrichmentRow[]),
  ]);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const enrichmentById = new Map(
    enrichmentList.map((e) => [e.building_id, e]),
  );

  const records: FreeRoomRecord[] = [];

  for (const [buildingId, roomMap] of Object.entries(status)) {
    const building = buildingById.get(buildingId);
    if (!building) continue;
    const enrichment = enrichmentById.get(buildingId);

    for (const [roomNumber, roomStatus] of Object.entries(roomMap)) {
      if (!allowedStatuses.includes(roomStatus.status)) continue;
      const roomId = `${buildingId}-${roomNumber}`;
      const room = rooms[roomId];
      if (!room) continue;

      records.push({
        room_id: room.id,
        room_name: room.name,
        abbr: room.abbr,
        capacity: room.capacity,
        usage: room.usage,
        school: room.school,
        building: {
          id: building.id,
          name: building.name,
          lat: building.lat,
          lng: building.long,
          photo_url: enrichment?.photo_url ?? null,
          address: enrichment?.address ?? null,
        },
        status: roomStatus.status,
        free_until:
          roomStatus.status === "busy" || !roomStatus.endtime
            ? null
            : roomStatus.endtime,
      });
    }
  }

  if (params.nearLat !== undefined && params.nearLng !== undefined) {
    const lat = params.nearLat;
    const lng = params.nearLng;
    records.sort(
      (a, b) =>
        haversineMeters(lat, lng, a.building.lat, a.building.lng) -
        haversineMeters(lat, lng, b.building.lat, b.building.lng),
    );
  }

  return {
    as_of: new Date().toISOString(),
    rooms: records,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- lib/rooms/get-free-rooms.test.ts`
Expected: all 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/rooms/types.ts lib/rooms/get-free-rooms.ts lib/rooms/get-free-rooms.test.ts
git commit -m "feat(rooms): add aggregation service joining freerooms + enrichments"
```

---

## Task 11: Public route handler

**Files:**
- Create: `app/api/rooms/free/route.ts`
- Create: `app/api/rooms/free/route.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `app/api/rooms/free/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the dependencies the route uses, before importing the route.
// We preserve the real FreeroomsError class so we can throw and catch it.
vi.mock("@/lib/freerooms/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/freerooms/client")
  >("@/lib/freerooms/client");
  return { ...actual, createFreeroomsClient: vi.fn() };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));
vi.mock("@/lib/rooms/get-free-rooms", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rooms/get-free-rooms")>(
    "@/lib/rooms/get-free-rooms",
  );
  return { ...actual, getFreeRooms: vi.fn() };
});

import { GET } from "./route";
import { getFreeRooms } from "@/lib/rooms/get-free-rooms";

const mockedGetFreeRooms = vi.mocked(getFreeRooms);

function makeReq(query = "") {
  return new Request(`http://localhost/api/rooms/free${query}`);
}

describe("GET /api/rooms/free", () => {
  beforeEach(() => {
    mockedGetFreeRooms.mockResolvedValue({
      as_of: "2026-05-19T13:00:00Z",
      rooms: [],
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the aggregator response on a valid request", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ as_of: "2026-05-19T13:00:00Z", rooms: [] });
  });

  it("returns 400 for an invalid usage param", async () => {
    const res = await GET(makeReq("?usage=NOTREAL"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_param", param: "usage" });
  });

  it("returns 400 for an invalid status param", async () => {
    const res = await GET(makeReq("?status=banana"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.param).toBe("status");
  });

  it("returns 400 for a non-numeric capacity", async () => {
    const res = await GET(makeReq("?capacity=abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.param).toBe("capacity");
  });

  it("returns 400 for a non-ISO datetime", async () => {
    const res = await GET(makeReq("?at=not-a-date"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.param).toBe("at");
  });

  it("returns 503 when the aggregator throws a FreeroomsError", async () => {
    const { FreeroomsError } = await import("@/lib/freerooms/client");
    mockedGetFreeRooms.mockRejectedValueOnce(
      new FreeroomsError("/rooms/status", 500, "boom"),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "rooms_service_unavailable" });
  });

  it("passes parsed params through to getFreeRooms", async () => {
    await GET(
      makeReq(
        "?at=2026-05-19T13:00:00Z&capacity=20&usage=CMLB&duration=45&status=soon&near_lat=-33.9&near_lng=151.2",
      ),
    );
    expect(mockedGetFreeRooms).toHaveBeenCalledWith(
      {
        at: "2026-05-19T13:00:00Z",
        capacity: 20,
        usage: "CMLB",
        duration: 45,
        statusFilter: "soon",
        nearLat: -33.9,
        nearLng: 151.2,
      },
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- app/api/rooms/free/route.test.ts`
Expected: all 7 tests FAIL — `route.ts` doesn't exist.

- [ ] **Step 3: Implement the route**

Create `app/api/rooms/free/route.ts`:

```ts
import { unstable_cache } from "next/cache";
import {
  createFreeroomsClient,
  FreeroomsError,
  type FreeroomsClient,
} from "@/lib/freerooms/client";
import { getFreeRooms } from "@/lib/rooms/get-free-rooms";
import type { GetFreeRoomsParams } from "@/lib/rooms/types";
import { createClient } from "@/lib/supabase/server";

// Wrap the underlying Freerooms client so building/room lists are cached
// at the Next layer for ~24h (per design spec §3). Live status is NOT cached.
const ONE_DAY_SECONDS = 60 * 60 * 24;

function createCachedFreeroomsClient(): FreeroomsClient {
  const base = createFreeroomsClient();
  return {
    ...base,
    getBuildings: unstable_cache(
      () => base.getBuildings(),
      ["freerooms-buildings"],
      { revalidate: ONE_DAY_SECONDS, tags: ["freerooms-static"] },
    ),
    getRooms: unstable_cache(
      () => base.getRooms(),
      ["freerooms-rooms"],
      { revalidate: ONE_DAY_SECONDS, tags: ["freerooms-static"] },
    ),
  };
}

const VALID_USAGES = new Set([
  "AUD",
  "CMLB",
  "LAB",
  "LCTR",
  "MEET",
  "SDIO",
  "TUSM",
]);
const VALID_STATUSES = new Set(["free", "soon", "all"]);

type ParsedParams =
  | { ok: true; value: GetFreeRoomsParams }
  | { ok: false; param: string };

function parseParams(url: URL): ParsedParams {
  const params: GetFreeRoomsParams = {};
  const q = url.searchParams;

  const at = q.get("at");
  if (at !== null) {
    if (Number.isNaN(Date.parse(at))) return { ok: false, param: "at" };
    params.at = at;
  }

  const capacity = q.get("capacity");
  if (capacity !== null) {
    const n = Number(capacity);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0)
      return { ok: false, param: "capacity" };
    params.capacity = n;
  }

  const duration = q.get("duration");
  if (duration !== null) {
    const n = Number(duration);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0)
      return { ok: false, param: "duration" };
    params.duration = n;
  }

  const usage = q.get("usage");
  if (usage !== null) {
    if (!VALID_USAGES.has(usage)) return { ok: false, param: "usage" };
    params.usage = usage;
  }

  const statusFilter = q.get("status");
  if (statusFilter !== null) {
    if (!VALID_STATUSES.has(statusFilter))
      return { ok: false, param: "status" };
    params.statusFilter = statusFilter as GetFreeRoomsParams["statusFilter"];
  }

  const nearLat = q.get("near_lat");
  const nearLng = q.get("near_lng");
  if (nearLat !== null) {
    const n = Number(nearLat);
    if (!Number.isFinite(n)) return { ok: false, param: "near_lat" };
    params.nearLat = n;
  }
  if (nearLng !== null) {
    const n = Number(nearLng);
    if (!Number.isFinite(n)) return { ok: false, param: "near_lng" };
    params.nearLng = n;
  }

  return { ok: true, value: params };
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = parseParams(url);
  if (!parsed.ok) {
    return Response.json(
      { error: "invalid_param", param: parsed.param },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const readEnrichments = async () => {
      const { data, error } = await supabase
        .from("building_enrichments")
        .select("building_id, photo_url, address");
      if (error) throw error;
      return data ?? [];
    };

    const result = await getFreeRooms(parsed.value, {
      freerooms: createCachedFreeroomsClient(),
      readEnrichments,
    });
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof FreeroomsError) {
      return Response.json(
        { error: "rooms_service_unavailable" },
        { status: 503 },
      );
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- app/api/rooms/free/route.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test:run`
Expected: all tests across all files pass. No failures.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: clean (no warnings or errors).

- [ ] **Step 7: Commit**

```bash
git add app/api/rooms/free/route.ts app/api/rooms/free/route.test.ts
git commit -m "feat(api): add public GET /api/rooms/free endpoint"
```

---

## Task 12: Backfill script

**Files:**
- Create: `scripts/enrich-buildings.ts`

This task is glue code, not algorithmic. We're not writing a test for the script itself — its building blocks (matching, clients) are already tested. Manual verification after running it is enough.

- [ ] **Step 1: Write the script**

Create `scripts/enrich-buildings.ts`:

```ts
#!/usr/bin/env tsx
/* eslint-disable no-console */
import { createFreeroomsClient } from "../lib/freerooms/client";
import { createFoursquareClient, buildPhotoUrl } from "../lib/foursquare/client";
import { createAdminClient } from "../lib/supabase/admin";
import {
  classifyConfidence,
  nameSimilarity,
  pickBestCandidate,
  type MatchConfidence,
  type ScoredCandidate,
} from "../lib/foursquare/match";

const SEARCH_RADIUS_M = 100;
const POLITE_DELAY_MS = 200;

type EnrichmentInsert = {
  building_id: string;
  building_name: string;
  foursquare_place_id: string | null;
  photo_url: string | null;
  address: string | null;
  match_confidence: MatchConfidence;
  match_method: "name_and_proximity" | null;
};

async function main() {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) throw new Error("FOURSQUARE_API_KEY is not set");

  const freerooms = createFreeroomsClient();
  const foursquare = createFoursquareClient({ apiKey });
  const supabase = createAdminClient();

  // Load existing rows so we know what's marked manual.
  const { data: existing, error: existingErr } = await supabase
    .from("building_enrichments")
    .select("building_id, match_method");
  if (existingErr) throw existingErr;
  const manualIds = new Set(
    (existing ?? [])
      .filter((row) => row.match_method === "manual")
      .map((row) => row.building_id),
  );

  const buildings = await freerooms.getBuildings();
  console.log(`Enriching ${buildings.length} buildings (skipping ${manualIds.size} manual)`);

  const summary: Record<MatchConfidence | "skipped_manual", number> = {
    high: 0,
    medium: 0,
    low: 0,
    no_match: 0,
    skipped_manual: 0,
  };

  for (const b of buildings) {
    if (manualIds.has(b.id)) {
      summary.skipped_manual++;
      console.log(`[${b.id}] ${b.name} → skipped (manual)`);
      continue;
    }

    let row: EnrichmentInsert;

    try {
      const candidates = await foursquare.searchNearby({
        lat: b.lat,
        lng: b.long,
        radiusMeters: SEARCH_RADIUS_M,
      });

      const scored: ScoredCandidate[] = candidates.map((c) => ({
        id: c.fsq_place_id,
        name: c.name,
        nameScore: nameSimilarity(b.name, c.name),
        distanceMeters: c.distance,
      }));

      const best = pickBestCandidate(scored);

      if (!best) {
        row = {
          building_id: b.id,
          building_name: b.name,
          foursquare_place_id: null,
          photo_url: null,
          address: null,
          match_confidence: "no_match",
          match_method: null,
        };
      } else {
        const confidence = classifyConfidence(
          best.nameScore,
          best.distanceMeters,
        );
        const photo = await foursquare.getFirstPhoto(best.id);
        const fullCandidate = candidates.find((c) => c.fsq_place_id === best.id);

        row = {
          building_id: b.id,
          building_name: b.name,
          foursquare_place_id: best.id,
          photo_url: photo ? buildPhotoUrl(photo) : null,
          address:
            fullCandidate?.location.formatted_address ??
            fullCandidate?.location.address ??
            null,
          match_confidence: confidence,
          match_method: "name_and_proximity",
        };
      }

      summary[row.match_confidence]++;
      console.log(
        `[${b.id}] ${b.name} → ${row.match_confidence} (${row.foursquare_place_id ?? "no_match"}, ${row.photo_url ? "photo" : "no photo"})`,
      );
    } catch (err) {
      console.error(`[${b.id}] ${b.name} → ERROR`, err);
      continue;
    }

    const { error: upsertErr } = await supabase
      .from("building_enrichments")
      .upsert(row, { onConflict: "building_id" });
    if (upsertErr) {
      console.error(`[${b.id}] upsert failed`, upsertErr);
    }

    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  console.log("\nSummary:");
  console.log(`  high:           ${summary.high}`);
  console.log(`  medium:         ${summary.medium}`);
  console.log(`  low:            ${summary.low}`);
  console.log(`  no_match:       ${summary.no_match}`);
  console.log(`  skipped manual: ${summary.skipped_manual}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Ensure env is set up**

Confirm that `.env.local` contains:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOURSQUARE_API_KEY`

If `SUPABASE_SERVICE_ROLE_KEY` is missing, grab it from Supabase dashboard → Settings → API → service_role secret. If `FOURSQUARE_API_KEY` is missing, sign up at [foursquare.com/developers](https://foursquare.com/developers).

- [ ] **Step 3: Load env into the script run**

tsx does not auto-load `.env.local`. Run with env explicitly via `dotenv`:

```bash
npx --yes dotenv-cli -e .env.local -- npm run enrich
```

If `dotenv-cli` is not available locally, install it: `npm install -D dotenv-cli` and re-run. (Optional: add a wrapper to the `enrich` script in `package.json`.)

- [ ] **Step 4: Verify the run**

Run the command above. Expected:
- One log line per building, in the form `[K-J17] Ainsworth → high (fsq_…, photo)`.
- A summary at the end like `high: 64 / medium: 18 / low: 7 / no_match: 3 / skipped manual: 0`.
- Exit code 0.

If you see errors per building (rate limits, etc.) that's tolerable — those buildings get retried on next run. A catastrophic exit (env missing, Supabase unreachable) means stop and fix.

- [ ] **Step 5: Inspect the table**

Via the Supabase dashboard (or MCP), query:
```sql
select match_confidence, count(*) from public.building_enrichments group by 1 order by 1;
```

Numbers should match the script summary. Spot-check a `low` row and verify it makes sense:
```sql
select building_id, building_name, foursquare_place_id, address, photo_url
  from public.building_enrichments
  where match_confidence = 'low' limit 5;
```

If any are obvious wrongs, fix manually (set `match_method = 'manual'` after editing). Future re-runs won't clobber them.

- [ ] **Step 6: Commit**

```bash
git add scripts/enrich-buildings.ts
git commit -m "feat(scripts): add Foursquare building enrichment backfill"
```

If `dotenv-cli` was added: also commit the updated `package.json` / `package-lock.json` in this commit.

---

## Task 13: End-to-end smoke test

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Next.js listens on `http://localhost:3000` with no startup errors.

- [ ] **Step 2: Call the endpoint with no filters**

In a second terminal:
```bash
curl -s 'http://localhost:3000/api/rooms/free' | head -c 800
```

Expected: JSON body starting with `{"as_of":"...","rooms":[{"room_id":...`. At least one `building.photo_url` should be a Foursquare URL (assuming the backfill ran). Some may be `null` — that's expected for `no_match` buildings.

- [ ] **Step 3: Try a filter**

```bash
curl -s 'http://localhost:3000/api/rooms/free?capacity=100&usage=LCTR&status=soon' | head -c 400
```

Expected: 200 with rooms filtered to large lecture theatres that are free or about to be.

- [ ] **Step 4: Try a near sort**

```bash
# Roughly the Library lawn
curl -s 'http://localhost:3000/api/rooms/free?near_lat=-33.9173&near_lng=151.2336' \
  | jq '[.rooms[:5] | .[] | .building.id]'
```

(If `jq` isn't installed, `sudo apt-get install -y jq` on WSL.)

Expected: the first few results are buildings close to the lawn.

- [ ] **Step 5: Try an invalid param**

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/rooms/free?usage=NOPE'
```

Expected: `400`.

- [ ] **Step 6: Document and finish**

If anything doesn't behave as expected, file the issue, debug, fix, and re-run. Otherwise we're done — the backend slice is ready for frontend teammates to consume.

```bash
git log --oneline -15
```

Confirm the commit trail tells a clean story of feature growth.

---

## Done criteria

- [ ] `npm run test:run` passes with no failures.
- [ ] `npm run lint` is clean.
- [ ] `GET /api/rooms/free` returns 200 with at least one enriched room when called against a live Supabase + Freerooms.
- [ ] `GET /api/rooms/free?usage=NOPE` returns 400.
- [ ] The `building_enrichments` table has rows for every Freerooms building, with `high`/`medium` covering the majority of UNSW's named buildings.
- [ ] The repo has no `TODO`s, no `any`-leaks in the new modules, and no committed secrets.
