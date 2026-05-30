# UNSW Quest

A location-based scavenger hunt game for the UNSW Kensington campus. Players scan a QR, enter a name, race through riddles and anagrams tied to real places, scan or type geocache codes at each stop, and finish on a live leaderboard.

**Built on** Next.js 16 (App Router) + Neon Postgres (via Drizzle ORM) + Vercel Blob + SWR polling. Mobile-first, designed for iPhone 14–16 viewports; pitched in Firefox's responsive mobile visualiser.

> **Status:** Hackathon MVP. The Supabase→Neon migration is complete; both the MVP "Pitch Hunt" flow and the Quest team demo run against Neon. See [`docs/unsw-quest/HANDOVER.md`](docs/unsw-quest/HANDOVER.md) for the current state.

---

## App surfaces

The repo ships **two** play surfaces:

- **MVP / "Pitch Hunt"** — the demo build target. Individual play (no teams), Kahoot-style QR join + name entry. Puzzle types: anagram (typed), `riddle_to_geocache` (QR scan or typed code), photo (optional selfie). Identity = `player_id` (uuid) returned on join, stored in browser `localStorage`. Routes: `/join`, `/play`, `/leaderboard`.
- **Quest (team/GPS demo + storyboard)** — the richer original concept. Team-based, GPS/QR-gated clues, live standings. Routes: `/quest` (design storyboard of 8 stages × 3 variants), `/quest/demo/[huntSlug]` (playable team demo). Identity = device-id UUID in a `quest_device_id` cookie set by `proxy.ts`.

---

## Docs

Start here, in order:

| Doc | Purpose |
|---|---|
| [`docs/unsw-quest/spec_sheet_v1.md`](docs/unsw-quest/spec_sheet_v1.md) | Engineering spec sheet — **current build target**. Demo user flow, MVP feature set, data model, stretch goals. |
| [`docs/unsw-quest/HANDOVER.md`](docs/unsw-quest/HANDOVER.md) | Current state-of-the-repo doc — what's on the branch today and how the two surfaces fit together. |
| [`docs/unsw-quest/PRD_v1.md`](docs/unsw-quest/PRD_v1.md) | Original (historical) product requirements. Strategy, personas, and roadmap; auth + verification + team model are **superseded by the spec sheet**. |
| [`docs/unsw-quest/clue_content_v1.md`](docs/unsw-quest/clue_content_v1.md) | Seed content: hero hunt + mini hunt riddles. |
| [`docs/unsw-quest/campus_tips_v1.md`](docs/unsw-quest/campus_tips_v1.md) | UNSW Kensington campus tips & fun facts feeding clue content. |
| [`design/unsw-quest/wireframes.html`](design/unsw-quest/wireframes.html) | Wireframes (single HTML, open in a browser). |

---

## Quick start

### Prerequisites

- Node.js 20+
- A Neon Postgres database (env vars below)
- Vercel CLI for pulling env (optional)
- Foursquare API key (only for the enrich script)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` → `.env.local` and fill in, or pull from Vercel:

```bash
vercel env pull .env.local
```

```env
DATABASE_URL=...              # Neon pooled connection string (server-side only)
BLOB_READ_WRITE_TOKEN=...     # Vercel Blob write token
FOURSQUARE_API_KEY=...        # for the enrich script
# Optional overrides:
# FREEROOMS_BASE_URL=https://freerooms.devsoc.app/api
# FOURSQUARE_BASE_URL=https://api.foursquare.com/v3
```

On Vercel, `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are auto-set by the Neon/Blob integrations.

### 3. Set up the database (one-time, against your Neon DB)

1. Apply the Drizzle-generated schema: [`db/drizzle/0000_living_wallow.sql`](db/drizzle/0000_living_wallow.sql).
2. Apply the Postgres functions:

   ```bash
   psql "$DATABASE_URL" -f db/functions.sql
   ```

3. Run [`db/neon-setup.sql`](db/neon-setup.sql) once to set the role `search_path` so unqualified table/function names resolve through the Neon pooler.

For schema changes going forward, edit [`lib/db/schema.ts`](lib/db/schema.ts) and run `drizzle-kit generate`.

### 4. Run

```bash
npm run dev
```

Then open <http://localhost:3000>:

- MVP demo → `/join?game=<gameId>`
- Team/GPS demo → `/quest/demo`
- Design storyboard → `/quest`

Use **Firefox** with the responsive mobile visualiser set to **iPhone 14 / 15 / 16** (390–430px wide, portrait).

---

## Repo structure

```
app/
  page.tsx                 # Landing — links to MVP join, quest demo, storyboard
  join/, play/, leaderboard/   # MVP "Pitch Hunt" player flow (individual, localStorage identity)
  quest/                   # Quest design storyboard + playable team demo
    page.tsx, _registry.ts, _screens/, _components/   # Storyboard (8 stages × 3 variants)
    demo/[huntSlug]/       # Playable team demo (team-gate, play-shell w/ SWR polling, finale, standings)
  api/
    quest/                 # team create/join, profile, sessions (start/read/state/unlock/penalty), progress/photo, standings
    mvp/                   # join, players/[id]/* actions (state, confirm-start, anagram, geocache, photo, complete, ack-walk), games/[id]/leaderboard
    rooms/free/            # Free-Rooms API (campus building data)
    uploads/quest-photo/   # Vercel Blob upload endpoint
components/                # Shared UI (shadcn/ui)
lib/
  db/                      # Drizzle client, schema, rpc helpers
  api/                     # Client fetch helpers (postJson, swrFetcher, uploadViaApi) + device-id reader
  blob/                    # Vercel Blob upload helper
  device-id.{ts,server.ts} # Device identity (cookie-based)
  mvp/                     # MVP localStorage identity + constants
  foursquare/, freerooms/, rooms/   # Campus data clients + free-room aggregation
proxy.ts                   # Next 16 middleware — sets quest_device_id cookie
db/
  schema (via lib/db/schema.ts), drizzle/   # drizzle-kit migration output
  functions.sql            # 19 Postgres functions (quest_* / mvp_*)
  neon-setup.sql           # one-time role search_path setup
scripts/
  enrich-buildings.ts      # Foursquare backfill for building_enrichments
  db/clean-schema-dump.md  # how the Neon schema was produced from Supabase (migration record)
supabase/                  # LEGACY — old migrations + config kept for historical reference only; not used at runtime
docs/unsw-quest/           # PRD, spec sheet, content, handover
design/unsw-quest/         # Wireframes
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind, shadcn/ui, SWR (client-side polling) |
| Database | Neon Postgres via the `@neondatabase/serverless` HTTP driver + Drizzle ORM — client at `lib/db/client.ts`, schema at `lib/db/schema.ts` (13 tables + 1 view) |
| Server logic | 19 Postgres functions ("RPCs") in `db/functions.sql`, invoked from route handlers via `callRpcOne` / `callRpcRows` in `lib/db/rpc.ts`; reads that don't need a function go through Drizzle directly |
| Storage | Vercel Blob (`@vercel/blob`) — helper `lib/blob/upload.ts` (`uploadPublic`), endpoint `POST /api/uploads/quest-photo`, client helper `uploadViaApi()` in `lib/api/fetcher.ts` |
| Live updates | **No realtime.** Quest play loop polls `GET /api/quest/sessions/[id]/state` (~every 2.5s) via SWR; the MVP fetches player state on demand after each action (no polling loop) |
| Identity | Quest: `quest_device_id` cookie set by `proxy.ts` (`lib/device-id.ts` client-safe + `lib/device-id.server.ts` server-only). MVP: `localStorage` `player_id` (`lib/mvp/player-storage.ts`; `DEMO_GAME_ID` in `lib/mvp/constants.ts`) |
| Auth | None. No RLS — access is trusted server-side (demo trade-off) |
| Hosting | Vercel |
| Tests | Vitest — 65 tests across 13 files currently pass |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Run prod build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (watch) |
| `npm run test:run` | Vitest (single pass) |
| `npm run enrich` | `dotenv -e .env.local -- tsx scripts/enrich-buildings.ts` — backfills `building_enrichments` from Foursquare |

---

## Contributing notes

- The PRD and the spec sheet sometimes disagree — when they do, **the spec sheet wins** (it captures the hackathon MVP pivot: Kahoot-style join, anagram + geocache puzzles, individual play, no GPS verification).
- Auth is intentionally absent. Identity = `quest_device_id` cookie (Quest) / `localStorage` `player_id` (MVP). Server logic is trusted — there is no per-row auth.
- The `supabase/` directory is **legacy** — old migrations + config kept for historical reference only. It is not used at runtime; the live stack is Neon + Drizzle.

---

*UNSW Quest — DevSoc Halftime Hackathon 2026.*
