# UNSW Quest — Engineering Spec Sheet

**Version:** 1.0 (Hackathon MVP pivot)
**Status:** Active build target — demo MVP
**Date:** May 2026
**Companion to:** [PRD v1](./PRD_v1.md) (historical — auth, verification, and team model are superseded by this sheet)
**Audience:** Engineers building the demo
**Notable changes vs PRD v1:** Kahoot-style QR join (no email auth) · anagram + geocache-code puzzles (no GPS verification) · individual play (no teams in MVP) · web app on Next.js, pitched via Firefox mobile responsive visualiser · GPS repurposed for **fog-of-war** map (stretch goal only)

> **Implementation note (2026-05-30):** This sheet captured the build target. The demo shipped on **Neon Postgres + Drizzle ORM + Vercel Blob**, with Next.js API route handlers calling Postgres functions and **SWR polling** in place of realtime. Where this sheet says "Supabase / Edge Functions / Realtime / RLS" below, read it as the corresponding Neon/Drizzle/route-handler/polling implementation. See the README and HANDOVER for current architecture.

---

## 1. Core demo user flow (build this first — top priority)

This is the **only** path the demo must support. Build it end-to-end before anything else.

```
[Host displays kickoff QR on a slide / printed at the venue]
            ↓
1. Player scans kickoff QR
   → opens  https://app/join?game=<gameId>
            ↓
2. Name entry screen
   → player types name → "Join" → timer starts
            ↓
3. "Welcome, <name>! Head to the room." (HARDCODED start location)
   → tap "I'm here" to reveal first puzzle
            ↓
4. PUZZLE 1 — Anagram (typed input)
   Prompt: "Unscramble: ROOD"
   Player types "door" → server validates → "Correct!"
            ↓
5. Walk-to prompt: "Now walk to the door."
   (Honour-based. No GPS check.)
            ↓
6. PUZZLE 2 — Riddle pointing to a geocache code
   Prompt: "<riddle whose answer is a campus spot>"
   At that spot, player finds a physical QR or printed alphanumeric code.
   Player either: scans the QR (in-page camera) OR types the code → server validates.
            ↓
7. OPTIONAL — Selfie with the prize
   "Take a selfie with the prize!" → camera → snap → upload (skippable)
            ↓
8. Scoring page
   Player's total time recorded → individual leaderboard updates in real time.
   All players in this game see ranked list of names + times.
```

**MVP rules (non-negotiable for the demo)**
- Starting location is **hardcoded** to the pitch venue. No matchmaking.
- **No GPS verification** anywhere. Puzzle 1 = typed input. Puzzle 2 = QR scan or typed code.
- **Individual play.** Each player = one leaderboard entry. No teams, no invite codes between players.
- **Target viewport:** iPhone 14 (390×844), 15/16 (393×852), Pro Max (430×932).
- **Demo runtime:** Firefox responsive mobile visualiser.

---

## 2. Stretch goals (only after §1 works end-to-end)

In priority order — if there's time:

1. **Dynamic game creation** — host UI to spin up games with non-hardcoded starting locations. Removes the single-hardcoded-game limit.
2. **Fog-of-war UNSW map** — `navigator.geolocation` reveals areas of campus as players walk through them. Map starts fully obscured; visited regions persist per player. Visualises *"how much of UNSW have I uncovered?"* — not a verification mechanism.
3. **More seeded puzzles** populated across UNSW landmarks (pull from `clue_content_v1.md`).
4. **Multi-leg hunts** longer than the demo's two puzzles.

---

## 3. Puzzle types (MVP)

| Type | Mechanic | Verification |
|---|---|---|
| `anagram` | Display scrambled word; player types answer | Server: `lower(trim(input)) === lower(answer)`. Wrong answers allowed unlimited retries, no time penalty in MVP. |
| `riddle_to_geocache` | Text riddle; player walks to physical spot; finds a QR or paper code | QR scan via in-page camera, OR typed code. Server matches against `verification_code`. |
| `photo` | "Take a photo of X" | Optional. Capture via `getUserMedia`, upload to Storage. No validation — recorded for the player's reel. |

**Dropped from PRD v1:** GPS dwell unlock, geofence radius, GPS auto-unlock fallback, hints system, tier gating, manual override, `gps_plus_photo` combo (photo is now its own step).

---

## 4. Tech stack

**Frontend**
- **Next.js App Router** (already in repo). Mobile-first responsive, designed at 390–430px wide.
- **Tailwind + shadcn/ui** (already in repo).
- **QR scanning:** `@zxing/browser` or `html5-qrcode` for the in-page camera scanner. Phone-camera scans of the kickoff QR use the OS camera and a URL → no in-app handler needed.
- **Camera capture:** `getUserMedia()` for the selfie step.
- **Geolocation:** `navigator.geolocation.watchPosition` — **stretch only**, for fog-of-war.

**Backend**
- **Database:** Neon Postgres, accessed via the `@neondatabase/serverless` HTTP driver + Drizzle ORM (client in `lib/db/client.ts`, schema in `lib/db/schema.ts`).
- **Server logic:** Next.js (App Router) route handlers under `app/api/mvp/*` that call Postgres functions (`db/functions.sql`) via thin helpers in `lib/db/rpc.ts`; simple reads use Drizzle directly.
- **Storage:** Vercel Blob (`lib/blob/upload.ts`; upload endpoint `POST /api/uploads/quest-photo`).
- **Identity:** `player_id` (uuid) generated server-side by the join function, returned on join, kept in browser `localStorage` for refresh recovery. (No Supabase auth; no realtime.)

**Hosting**
- Vercel.

---

## 5. Auth & identity (Kahoot-style — replaces PRD §6.1)

| Item | Spec |
|---|---|
| Sign-in | None. No Supabase auth / anon sessions. Players join via QR scan + name entry; identity is purely the server-generated `player_id` held in `localStorage`. |
| Identity | `name` (required string) + `player_id` (uuid generated server-side, returned on join, stored client-side in `localStorage`). |
| Join flow | Kickoff QR encodes `https://app/join?game=<gameId>`. Page asks for name → `POST /join_game` → returns `player_id` + first puzzle. |
| Persistence | `localStorage.player_id` lets a player refresh / re-open the tab without losing progress. |
| UNSW verification | **Dropped for MVP.** No email check. |

**Why:** judges and audience can't be expected to magic-link their inbox in front of a live pitch. Kahoot proved name-only works for room-scale play.

---

## 6. Game session model (replaces PRD §6.3 team model)

- A **game** is one running instance of a hunt, joined by N individual players.
- For the demo: **one hardcoded game** is pre-seeded with a fixed `game_id`. The kickoff QR encodes that ID.
- No team formation in MVP. Each player joins the game directly.

---

## 7. Data model

> This is a logical model. The live schema uses `mvp_`-prefixed table names: `mvp_hunts` / `mvp_puzzles` / `mvp_games` / `mvp_players` / `mvp_puzzle_progress`.

```text
hunts(id pk, name, description, status[draft|published])

puzzles(id pk, hunt_id fk, sequence int,
        type[anagram | riddle_to_geocache | photo],
        prompt text,
        answer text?,             -- anagram solutions
        verification_code text?,  -- geocache codes
        walk_to_prompt text?,     -- "Now walk to the door."
        optional bool)

games(id pk, hunt_id fk,
      status[lobby | active | ended],
      started_at timestamptz,
      hardcoded_start_location text)

players(id pk, game_id fk, name,
        joined_at, started_at, completed_at,
        total_time_seconds int)

puzzle_progress(player_id fk, puzzle_id fk,
                solved_at timestamptz,
                attempts int,
                photo_url text?)
```

**Seed for the demo hunt** (hardcoded):
1. `puzzles[0]` — `anagram`, prompt `"Unscramble: ROOD"`, answer `"door"`
2. `puzzles[1]` — `riddle_to_geocache`, prompt `"<the riddle>"`, verification_code `"<set on the day>"`, walk_to_prompt `"Walk to the door."`
3. `puzzles[2]` — `photo`, prompt `"Take a selfie with the prize!"`, optional `true`

**Stretch — fog of war** adds:
```text
player_locations(player_id fk, lat, lng, recorded_at)
   -- sampled while geolocation permission granted; powers map reveal
```

---

## 8. Server logic

### 8.1 Postgres functions (invoked by Next.js API route handlers)

These are Postgres functions defined in `db/functions.sql`, invoked by Next.js API route handlers (e.g. `POST /api/mvp/join`, `/api/mvp/players/[id]/anagram`, `/geocache`, `/photo`, `/complete`). The actual function names are `mvp_join_game`, `mvp_submit_anagram`, `mvp_submit_geocache_code`, `mvp_record_photo`, `mvp_complete_player`.

| Function | Purpose |
|---|---|
| `mvp_join_game(game_id, name)` | Create `players` row, return `player_id` + first puzzle. |
| `mvp_submit_anagram(player_id, puzzle_id, input)` | Validate against `puzzles.answer`. On match: write `puzzle_progress`, return next puzzle. |
| `mvp_submit_geocache_code(player_id, puzzle_id, code)` | Validate against `puzzles.verification_code`. On match: advance. |
| `mvp_record_photo(player_id, puzzle_id, photo_url)` | Photo is uploaded to Vercel Blob via the upload route, then this records `puzzle_progress` with `photo_url`. |
| `mvp_complete_player(player_id)` | Set `completed_at`, compute `total_time_seconds`. |

**All validation is server-side.** Don't ship `puzzles.answer` or `puzzles.verification_code` to the client — a judge with devtools can see anything in `window.__NEXT_DATA__`.

### 8.2 Live updates (polling, not realtime)

- **There is no realtime.** The leaderboard refreshes when any player finishes — implemented by the client polling a read endpoint (`GET /api/mvp/games/[gameId]/leaderboard`) and refetching after actions.
- The quest variant polls `GET /api/quest/sessions/[id]/state` via SWR (~2.5s).

### 8.3 Access control (no RLS)

- **There is no RLS in the shipped demo;** access is trusted server-side. The protection the original RLS section cared about — never shipping `puzzles.answer` / `puzzles.verification_code` to the client — is instead achieved by:
  - validation happening server-side in the Postgres functions, and
  - a public view `mvp_puzzles_public` that omits the `answer` / `verification_code` columns for any client-facing reads.

**`puzzles.answer` and `puzzles.verification_code` must never reach the client** — a judge with devtools can see anything in `window.__NEXT_DATA__`.

---

## 9. UI targets (iPhone 14–16, Firefox responsive)

- Mobile-first. Test at **390×844 (iPhone 14)**, **393×852 (iPhone 15/16)**, **430×932 (Pro Max)**.
- Single-column layouts, large tap targets (≥44pt), generous spacing.
- Puzzle inputs: `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"` — anagrams break if iOS auto-corrects "rood" to something else.
- Leaderboard: live-updating, current player highlighted.
- Transitions between steps: short and snappy (≤300ms) so the demo doesn't feel laggy on a projector.
- Brand: still undefined (PRD §12.3). Pick a palette + type scale before final polish.

---

## 10. Out of scope for MVP

- Teams, invite codes, lobby waiting rooms (individual play only in MVP).
- Email auth / magic link / UNSW verification badge.
- GPS dwell unlock, geofence rings, GPS auto-unlock fallback.
- Hints system, hint cost penalty.
- Tier gating (flat puzzle sequence in MVP).
- Pause / resume / abandonment recovery beyond `localStorage` refresh.
- Push notifications, email notifications.
- Society creator tools (still v2).
- Tablet, desktop, landscape layouts.

---

## 11. Build status & order

**Already in repo (reusable)**
- Next.js 16 + Tailwind + shadcn/ui.
- Neon + Drizzle data layer.
- Vercel Blob.
- device-id cookie infra (for the quest variant).

**Build order**
1. Schema in `lib/db/schema.ts` + functions in `db/functions.sql`: `hunts`, `puzzles`, `games`, `players`, `puzzle_progress`. Seed the hardcoded demo game + 3 puzzles.
2. `/join?game=<id>` page — name entry → `join_game` Edge Function → push player to `/play`.
3. `/play` flow — puzzle player UI handling all three puzzle types in sequence; renders prompt, accepts input, calls the matching `submit_*` function.
4. In-page QR scanner component (`@zxing/browser` or `html5-qrcode`) for puzzle 2.
5. Selfie capture via `getUserMedia` + upload to Vercel Blob via `/api/uploads/quest-photo`.
6. `/leaderboard` page polling the leaderboard read endpoint (no realtime subscription).
7. Replace landing page with a kickoff CTA (or redirect `/` → `/join` when a `game` query param is present).
8. Visual polish — typography, palette, tap targets, transitions.

**Stretch (after the above works end-to-end)**
- Host UI to spawn games dynamically (no more hardcoded `game_id`).
- `navigator.geolocation` fog-of-war map (new `player_locations` table + canvas/SVG map overlay).
- Seed additional puzzles from `clue_content_v1.md`.

---

## 12. Acceptance checklist for the pitch

- [ ] Judge scans the kickoff QR with their phone camera and reaches the join screen in <5s.
- [ ] Name entry → first puzzle in ≤2 taps.
- [ ] Anagram input accepts the correct answer case-insensitively; wrong answers don't crash and allow retry.
- [ ] Puzzle 2 accepts both QR scan AND typed code paths to the same answer.
- [ ] Selfie step is skippable; skipping doesn't break the flow.
- [ ] Leaderboard updates within ~2s when any player finishes.
- [ ] Renders crisply at iPhone 14/15/16 viewport in Firefox responsive mode.
- [ ] No crash during a 10-minute demo with 3+ concurrent players.

---

*End of Spec Sheet v1.0 — hackathon MVP pivot.*
