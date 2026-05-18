# UNSW Splash — Eng Review Plan
**Date:** 2026-05-19
**Branch:** main (will fork to worktree for build)
**Source design:** [`docs/unsw-splash/DESIGN.md`](./DESIGN.md)
**Test plan:** [`docs/unsw-splash/TEST-PLAN.md`](./TEST-PLAN.md)
**TODOs:** [`docs/unsw-splash/TODOS.md`](./TODOS.md)
**Review session:** /plan-eng-review on 2026-05-19, against the office-hours design doc
**Outside voice:** Codex (gpt-5.5), reasoning-effort=high

This file captures the engineering review's decisions, the resulting plan adjustments,
and the implementation task list. Read alongside `DESIGN.md` — this is the diff, not
the spec itself.

---

## Review Outcome Summary

| Section | Findings raised | Changes accepted | Kept as-designed |
|---------|-----------------|------------------|------------------|
| Architecture | 6 | 4 | 2 |
| Code Quality | 3 | 3 | 0 |
| Test Review | 1 + diagram | 1 | 0 |
| Performance | 1 | 1 | 0 |
| Outside Voice | 7 (Codex) | 5 fully + 10-batch | 1 deferred + 1 explicit-skip |

Total decisions: 19. Net plan delta: 17 spec adjustments, 2 known-accepted risks.

---

## Decisions

### D1 — Splash RPC race tightening (P1, accepted)
**Change:** In the `splash` RPC, lock the active assignment row FOR UPDATE in step 1
(not just the player rows in step 2). After step 2's player locks acquire, recheck
`hunter.status='alive'`; if not, return `(false, 'already_dead_self')`. Existing
target-status check unchanged. Three SQL lines, one new error code on the client.

**Why:** Without this, a dead hunter can still splash a live target in a race;
admin_undo_splash is the recovery path and that does not survive front-of-audience.

### D2 — Wake Lock visibilitychange re-acquire (P1, accepted)
**Change:** On `/play`, register a `document.addEventListener('visibilitychange', ...)`
handler. When `document.visibilityState === 'visible'` and the previous wakeLock
sentinel has been released, call `navigator.wakeLock.request('screen')` again.
Track the last-visible timestamp; if the page was hidden for >2 min, show a banner
on return: "You were out of the game for {X} min. You're back." Update the door
briefing copy to acknowledge that quick app-switches are tolerated.

**Why:** Wake Lock releases on `visibilitychange → 'hidden'` and does NOT
auto-re-acquire. Without this, every app-switch becomes a tracking dropout that
won't recover until the player notices and tap-refocuses. The briefing copy
"screen stays on automatically" is otherwise misleading.

### D3 — Auto-splice late joiners in join_game (P1, accepted; formula pinned)
**Change:** Extend `join_game(p_event, p_display_name)`: when `games.status='live'`,
pick any one active assignment H→Y (any rule — random is fine), lock it FOR UPDATE,
mutate it to H→N (where N is the new late joiner), insert new active assignment
N→Y. Same canonical-UUID lock order as splash. Three rows touched: H's assignment
(updated), N's row (inserted), N's new assignment (inserted).

**Why:** Design previously said "spliced as new tail" without defining the operation.
The splash RPC reassigns to `target.old_target` and never reads `players` for
unassigned late joiners, so without the splice formula late joiners stay forever-ghost.

### D4 — Commit to @zxing/browser only for QR scanning (P1, accepted)
**Change:** In the finale scanner component, dynamic-import `@zxing/browser` and
use it for QR decode on all browsers. Skip the `BarcodeDetector` native API.

**Why:** iOS Safari does not implement `BarcodeDetector`. ~50-70% of UNSW students
carry iPhones; native-first with fallback means the iOS path is the one that
won't have been tested before Sunday.

### D5 — Heartbeat fan-out: KEEP AS DESIGNED (explicit risk)
**Decision:** Keep 5s heartbeat writing to both `locations` and
`players.last_heartbeat_at`. Saturday-morning 30-client synthetic harness gates
the dial-back per Reviewer Concern #6. If fan-out chokes, drop to 10s + 3s
polling.

**Accepted risk:** Saturday afternoon is build crunch time; redesigning the
data path then is exactly when bugs creep in. User explicitly accepted this
risk to preserve the live-feel on the happy path.

### D6 — Admin auth: KEEP shared token (explicit risk)
**Decision:** `/admin` stays gated on a single `X-Admin-Token` env var. Rotate
the token at Sunday 8:30am. Share only via team Signal. Never paste in Slack
or screenshot `/admin` with the URL in frame.

**Accepted risk:** One leak ends the game; no per-user audit trail. User
explicitly chose hackathon-tier security posture.

### D7 — Audio prime on /play first interaction (P1, accepted)
**Change:** On `/play` mount, after the user-gesture-bearing tap that requests
Wake Lock, also call `audio.play(); audio.pause()` on a hidden
`<audio src="/sounds/splash.wav">` element. Store the element ref. Subsequent
`.play()` calls from Realtime callbacks bypass the autoplay block. Same pattern
for the finale scan-success sound.

**Why:** iOS Safari (and Chrome Android) blocks `Audio.play()` unless triggered
by a user gesture. The water sound is the load-bearing catharsis; if it silently
fails on half the devices, the public-theatre premise is broken.

### D8 — /play lifecycle contract (P1, accepted)
**Change:** Spec in `docs/unsw-splash/DESIGN.md` that `/play` mount returns a
single cleanup function tearing down: Wake Lock sentinel, all 3 Realtime
channels, the 5s heartbeat interval, the Audio element, the finale camera
scanner (when active). Add `app/play/error.tsx` rendering a "connection lost
— reload" card. Add a disconnect banner that engages on `channel.subscribe`
state changes when WS disconnects >5s (using the design's existing 1s
polling fallback).

**Why:** Mobile pages get re-mounted on rotate, foreground-after-OS-kill, and
deep-linking. Without a lifecycle contract, leaks accumulate; without
`error.tsx`, an unhandled RPC error white-screens `/play` mid-game.

### D9 — Centralize splash effect helper (P2, accepted)
**Change:** Create `lib/splash-effect.ts` exporting
`playSplashEffect({role: 'hunter'|'target'|'spectator', intensity?: 'normal'|'finale'})`.
Imported by: hunter's `/play` post-splash success, target's `/play` Realtime
handler, `/room` projector ticker, finale scan-success.

**Why:** Without centralization, the 4 sites' flash duration, sound timing, and
vibrate pattern will drift; the demo's load-bearing moment becomes inconsistent.

### D10 — Test commitment: vitest + Supabase local + 1 Playwright E2E (P1, accepted)
**Change:** Add `vitest` + `@playwright/test` as devDependencies. Use
`supabase start` for the local Postgres stack. RPC unit tests cover: splash
happy path, splash hunter-dead (D1), splash target-dead, splash 2-alive paradox,
splash stale-location, splash out-of-range, late-joiner splice in join_game (D3),
admin_undo restores state, admin_mark_dead unsticks hunter, haversine boundary
at 15m. One Playwright spec walks the happy splash flow across two browser
contexts. Wire to `npm test`.

**Why:** The `splash` RPC is a transactional state machine with ~10 branches
including two race regressions. A bug in any branch silently corrupts game
state mid-event. Test cost with CC is small; production cost of a bug is
front-of-audience.

### D11 — Per-route bundle splitting (P1, accepted)
**Change:** Use Next.js `dynamic(() => import(...), { ssr: false })` for
`maplibre-gl` and `@zxing/browser`. MapLibre only loads inside `/play`. @zxing
only loads when the finale scanner component mounts. `/join` ships ~50KB gzip
instead of ~300KB.

**Why:** Door queue at 9:00am with 50 phones on one cell tower — slow TTI per
phone multiplies across the queue. The QR-card scan should land on a fast page.

### D12 — Outside voice (Codex) accepted: 7 substantive findings + 10-batch fixes
See dedicated sections D13-D19 below.

### D13 — Consent + retention + organizer approval (P0, accepted)
**Change:**
1. Add a consent screen to `/join` BEFORE display_name entry. Bullet copy:
   "We track your live GPS while the game is running. Data deletes 24h after
    the pitch. You can withdraw any time by closing the app." Accept/Decline.
2. Schedule a one-line Postgres maintenance SQL (cron job or manual Monday 5pm):
   ```sql
   delete from locations where updated_at < now() - interval '24h';
   delete from players where game_id='halftime' and joined_at < now() - interval '24h';
   ```
3. Email DevSoc Halftime organizers Friday noon for written approval of the
   game format + live GPS tracking. Same email asks for the venue-cooperation
   confirmation (already a hard gate per Open Questions). Save the reply.

**Why:** Australian Privacy Principles (APP3 collection, APP11 retention) and
UNSW privacy policy apply to live location tracking of students. "Briefed at
door" is not an enforceable consent record.

### D14 — Add admin_check_in_player RPC (P1, accepted)
**Change:** New SECURITY DEFINER RPC:
```sql
function admin_check_in_player(p_player_id uuid) returns void;
-- Auth: admin token. Sets players.checked_in=true for p_player_id.
```
Door staff UI on `/admin` shows a list of `checked_in=false` players with a
one-click check-in button per row.

**Why:** RLS section says `All INSERT/UPDATE: blocked at table level; only via
SECURITY DEFINER RPCs.` Without this RPC, the door flow's "edge-case operator
marks checked_in=true" requires either an RLS exception (architecturally
inconsistent with D6's shared-token decision) or raw SQL on Sunday morning.

### D15 — RLS hunter visibility: KEEP symmetric (explicit choice)
**Decision:** Target CAN see hunter on the map and in player info before being
splashed. RLS stays as designed: `players` SELECT includes the row whose
active assignment targets you; `locations` SELECT includes your hunter's row.

**Why:** User explicitly chose "stalk + evade" gameplay over "asymmetric
stalking." Both directions are valid; this is a taste call. Decision is now
documented rather than implicit.

### D16 — Safety/harassment policy: SKIPPED (explicit accepted risk)
**Decision:** No printed safety card, no withdraw button, no accessibility flag,
no harassment policy.

**Accepted risk:** No playbook for: traffic crossings, accessibility (game is
implicitly run-only), a player who says "stop following me," physical contact
during QR scan, or what happens when someone is in a class/lab/bathroom.
User explicitly chose this. If an incident surfaces during the event, the
team owns it without a written policy to fall back on.

### D17 — Auth recovery via claim code (P1, accepted)
**Change:**
1. Add `claim_code text` column to `players`. On `join_game`, generate a random
   6-char code (e.g., `J4K9-PX`) and store it.
2. `/play` shows the claim code small in a corner with "lost the app? show
   this to the host."
3. New RPC:
   ```sql
   function admin_relink_player(p_claim_code text, p_new_uid uuid) returns void;
   -- Auth: admin token. Fuses p_new_uid to the original players row holding
   -- p_claim_code, preserving assignment + history. The orphaned join_game
   -- row created under p_new_uid is deleted.
   ```
4. `/admin` form: paste claim code + new uid → re-link.

**Why:** Anonymous Supabase auth strands players who scan in Instagram's in-app
browser, Safari Private Mode, clear storage, or switch browsers. Without a
recovery path, every stranded player becomes a permanent ghost; their hunter
hits the 20-min auto-mark-dead path.

### D18 — Batch Codex fixes (10 items, all accepted)
1. **Success bar adjusted.** "≥10 splash events recorded during the day" raised
   to **≥20 splash events**. Math: 30 starters → 4-8 finalists requires
   22-26 deaths; ≥10 leaves too many survivors at pitch time.
2. **Late-joiner edge replacement formula** pinned in D3 above (H→Y becomes
   H→N + N→Y).
3. **Add `game_id` column** to `assignments`, `splashes`, `locations` (FK to
   `games.id`). Indexed. Enables multi-event support, clean dry-run resets,
   and easier debugging.
4. **New RPC `admin_reset_game(p_event text)`** that deletes all rows for a
   game id (cascading via the game_id FK), resets `games.status='lobby'`,
   nulls timestamps. Saturday-dryrun → Sunday-prod transition becomes one
   admin button click.
5. **`admin_undo_splash` rule:** only the MOST RECENT non-reversed splash for
   the affected player is undoable. Older splash undo returns
   `(false, 'newer_splash_exists')`. The host queue UI on `/admin` shows the
   constraint.
6. **Split finale state machine.** `games.status` enum becomes:
   `'lobby' | 'live' | 'finale_called' | 'finale_live' | 'done'`.
   - `finale_called`: host pressed BEGIN FINALE; bibs being distributed;
     players gathering; map removed; no scans yet.
   - `finale_live`: 60s timer running; scans enabled.
   The `admin_trigger_finale` RPC transitions lobby/live → `finale_called`.
   A second admin button `BEGIN 60s` transitions `finale_called` → `finale_live`.
7. **Bib token pool.** Pre-create 12 random `bib_qr_token` values at the
   Saturday-evening migration (insert into a `bib_pool` table or hard-coded
   list). `admin_trigger_finale` assigns from the pool sequentially to
   finalists. Bibs are pre-printed with the pool tokens Saturday evening.
8. **Distribution Plan correction.** Fix "1 teammate at the door 9:30am-10:30am"
   to "2 teammates at the door 9:00am-10:30am" (matches premise P2).
9. **Drop domain registration.** Use Vercel's auto-assigned `*.vercel.app`
   URL or a pre-owned short link. DNS is not part of the demo. Open Question
   on "product name" still applies for the splash branding but doesn't require
   a domain.
10. **Future refactor: `splice_cycle` primitive.** Note in `docs/unsw-splash/TODOS.md`
    that splash, admin_mark_dead, admin_undo_splash, and join_game (live-splice
    path) all mutate the same cycle. After D10 tests reveal duplication,
    refactor to a shared internal primitive `_splice_cycle(remove_id uuid?, insert_id uuid?)`.
    Deferred — not blocking.

### D19 — Prior plans disposition: KEEP all three as candidates
**Decision:** UNSW Splash is the active V1, but `docs/debate-connect/` and
`docs/table-drop/` remain in the repo as candidates. Root `TODOS.md` will
reference all three projects.

---

## NOT in Scope (V1)

These items were considered and explicitly deferred. Most go to `docs/unsw-splash/TODOS.md`
with full context.

- **Background GPS via service worker** — design pillar P1 is foreground-only.
- **Multi-target / "nearest target" gameplay** — Codex flagged single-target
  graph as low-event-rate; rejected as too-late redesign. Single-target is
  the design.
- **Anti-cheat** — no server-side rate limit on `splash`/`heartbeat`, no GPS
  sanity checks. Documented as `trust-the-client` (design Reviewer Concerns #5).
- **DevSoc GraphQL + Freerooms safe zones** — V2 (Approach B in design).
- **Audience-as-gamemaster finale** — V2 stretch (named by Codex in office-hours).
- **Anonymous Hunters mode** — V2 candidate direction (Approach C).
- **Photo capture** — cut V1; avatar is initials + deterministic HSL color.
- **Safety/harassment policy** — D16 explicit accepted risk.
- **Hard fence on UNSW boundary** — V1 ships soft warning + map fade only.
- **Domain registration** — D18 #9 dropped; use `*.vercel.app`.
- **`splice_cycle` primitive refactor** — D18 #10 deferred until tests reveal
  duplication.
- **`splashes_public` view** — Reviewer Concern #1, defense-in-depth privacy;
  documented in TODOS as V1.5.

---

## What Already Exists

These prior pieces of the repo accelerate the build:

- **Next.js 15 App Router** scaffolding (`app/layout.tsx`, `app/page.tsx`).
- **Supabase client helpers** (`lib/supabase/{client,server,proxy}.ts`) — saves
  ~1h of bootstrap. Anonymous auth is a 1-line swap from password-based.
- **shadcn/ui components** in `components/ui/` (button, card, checkbox,
  dropdown-menu, input, label, badge). All the UI pieces for the splash
  button states, the door form, and the admin queue exist already.
- **Auth pages** (`app/auth/login,sign-up,forgot-password,update-password,confirm`)
  — not directly used by UNSW Splash (anonymous auth + admin token), but
  available if D6's "real Supabase admin auth" decision is revisited.
- **ESLint + TypeScript + Tailwind** config — no setup tax.
- **Prior plans** (`docs/debate-connect/`, `docs/table-drop/`) — parked per D19.

---

## Failure Modes

Each new codepath, one realistic production failure, whether a test covers it,
whether error handling exists, and whether the user sees a clear error.

| Codepath | Failure | Test? | Error handling? | User sees |
|----------|---------|-------|-----------------|-----------|
| splash RPC (state machine) | DB row-lock contention timeout | D10 test (concurrent splash) | RPC returns generic error | "Splash failed, retry" card |
| splash RPC paradox (2-alive) | game.status race | D10 test | inside RPC | finale auto-triggers |
| join_game splice | Two late joiners simultaneously | D10 test | FOR UPDATE serialization | Sequential success |
| Realtime WS disconnect | Cell tower drop on Mathews Lawn | NO unit test | 1s polling fallback (D8) | Banner "connection slow" |
| Wake Lock release on pocket | Page hidden | NO unit test | D2 visibility re-acquire + banner | "You were out for X min" |
| iOS audio blocked | First splash on target's phone | NO unit test (manual iPhone test) | D7 prime path | Sound plays |
| Camera permission denied | Finale scanner first open | NO unit test (manual) | Fallback UI text | "Allow camera in settings" |
| @zxing/browser decode fail | Smudged or partial bib | NO unit test (manual) | Try again button | Retry scan |
| Anonymous auth stranding | In-app browser, private mode | NO automated test | D17 claim code + admin_relink | Player shows code to host |
| Door queue overflow | 50 students at 9:00am | N/A (ops) | 2 teammates (D18 #8) | Acceptable wait |
| Stale GPS reading | Hunter inside concrete building | D10 test (stale_location) | RPC returns `no_recent_location` | Button shows "GPS lagging" |
| Network down on /play | Cell tower outage | NO unit test | D8 error.tsx | Reload card |
| 5s heartbeat lag visible | Hunter approaches target | N/A | Distance shown approximate | Acceptable |
| Bib QR misprint | Wrong token printed Saturday | NO automated test | Pre-flight scan check Saturday | N/A — caught at print test |
| Finale finalist > 12 bibs | Larger-than-expected day finale | NO test | `admin_trigger_finale` errors | Host caps at 12 |
| Consent decline | Player taps Decline on /join | D10 test (join_game) | join_game rejects | Decline screen with re-affirm option |

**Critical gaps** (no test AND no specific error handling AND silent failure):
- **iOS audio first-splash for non-primed Audio element.** D7 prime path is
  load-bearing; if the prime fails silently (e.g., Low Power Mode), every
  splash on that device is silent. Recommend: iPhone manual test Saturday
  morning is non-optional, AND log a client-side warning when prime fails.
- **Bib QR misprint.** Print a test QR Saturday evening with the same
  generator; scan-test all 12 bibs with a phone before stacking them.

---

## Worktree Parallelization Strategy

Build splits naturally into 5 lanes. Lane A is blocking; B/C/D/E can run in
parallel after A's migration lands.

| Lane | Steps | Modules touched | Depends on |
|------|-------|-----------------|------------|
| A — DB foundation | migrations, RLS, RPCs, Realtime publication, type gen | `supabase/migrations/`, `lib/types/db.ts` | — |
| B — Pages + auth | /join, /play stub, /room stub, /admin stub, anonymous auth wiring, consent screen | `app/{join,play,room,admin}/`, `lib/supabase/` | A (types) |
| C — Realtime+GPS+Audio spike | MapLibre, Turf distance, Wake Lock, audio prime, Realtime subscriptions | `app/play/`, `lib/{geo,wake-lock,splash-effect}.ts` | A (locations RPC) |
| D — GeoJSON tracing | boundary polygon + 3 buildings | `public/geojson/` | — |
| E — Door logistics + bibs | non-code: QR cards, briefing card, bib pre-print, organizer email | — | — |

**Execution order:**
1. Launch A as a blocker. Run D and E in parallel — they're fully independent.
2. When A's migration lands, launch B and C in parallel worktrees.
3. Merge B + C. Merge D's GeoJSON.
4. Saturday morning checkpoint: 2-phone splash test on the merged branch.
5. Saturday afternoon: splash UX polish + admin queue + finale mode (single
   lane after merge).

**Conflict flags:**
- Lanes B and C both touch `app/play/`. Order them: B ships the stub + auth
  first; C extends the stub with map + Realtime. Or do them in the same
  worktree if a single dev owns both.

---

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific
decision above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~10 min / CC: ~2 min)** — splash RPC — Tighten state machine: lock active assignment row in step 1, recheck hunter alive after step 2
  - Surfaced by: D1
  - Files: `supabase/migrations/*splash.sql`
  - Verify: vitest test `splash_rpc.test.ts` covering hunter-dead race
- [ ] **T2 (P1, human: ~30 min / CC: ~5 min)** — /play — Wake Lock visibilitychange re-acquire + "you were out" banner
  - Surfaced by: D2
  - Files: `app/play/page.tsx`, `lib/wake-lock.ts`
  - Verify: manual iPhone + Android test; banner shows after 2-min app-switch
- [ ] **T3 (P1, human: ~30 min / CC: ~5 min)** — join_game RPC — Auto-splice late joiners when games.status='live' (H→Y becomes H→N, N→Y)
  - Surfaced by: D3 + D18 #2
  - Files: `supabase/migrations/*join_game.sql`
  - Verify: vitest test `join_game_splice.test.ts`
- [ ] **T4 (P1, human: ~20 min / CC: ~5 min)** — finale scanner — Use @zxing/browser only; dynamic-import lazy on finale entry
  - Surfaced by: D4
  - Files: `app/play/finale-scanner.tsx`
  - Verify: works in iOS Safari + Chrome Android
- [ ] **T5 (P1, human: ~30 min / CC: ~5 min)** — /play — Audio prime on first user gesture
  - Surfaced by: D7
  - Files: `app/play/page.tsx`, `lib/splash-effect.ts`
  - Verify: manual iPhone Low Power Mode test + manual Android test
- [ ] **T6 (P1, human: ~45 min / CC: ~10 min)** — /play — Lifecycle contract: composite useEffect cleanup + error.tsx + disconnect banner
  - Surfaced by: D8
  - Files: `app/play/page.tsx`, `app/play/error.tsx`
  - Verify: navigate-away test (no orphan channels); pull network cable manually
- [ ] **T7 (P2, human: ~15 min / CC: ~3 min)** — lib — Centralize playSplashEffect helper; refactor 4 call sites
  - Surfaced by: D9
  - Files: `lib/splash-effect.ts`, `app/play/page.tsx`, `app/room/halftime/page.tsx`
  - Verify: unit test asserts effect signature; manual visual check across roles
- [ ] **T8 (P1, human: ~3h / CC: ~50 min)** — testing — vitest + Supabase local stack + 1 Playwright happy-path spec
  - Surfaced by: D10
  - Files: `vitest.config.ts`, `tests/*.test.ts`, `playwright.config.ts`, `tests/e2e/splash.spec.ts`, `package.json`
  - Verify: `npm test` green
- [ ] **T9 (P1, human: ~30 min / CC: ~5 min)** — bundles — Dynamic-import MapLibre on /play; dynamic-import @zxing only on finale entry
  - Surfaced by: D11
  - Files: `app/play/page.tsx`, `app/play/finale-scanner.tsx`
  - Verify: `next build` output shows /join bundle <100KB gzip
- [ ] **T10 (P0, human: ~1h incl. organizer email / CC: ~10 min)** — /join — Consent screen + 24h purge cron + organizer approval email
  - Surfaced by: D13
  - Files: `app/join/consent.tsx`, `supabase/migrations/*purge_cron.sql`, organizer email out-of-repo
  - Verify: tap Decline → bounce; tap Accept → proceed; cron entry visible in Supabase
- [ ] **T11 (P1, human: ~5 min / CC: ~1 min)** — admin RPC — Add admin_check_in_player(player_id)
  - Surfaced by: D14
  - Files: `supabase/migrations/*admin_check_in.sql`, `app/admin/page.tsx`
  - Verify: vitest test; manual check-in via /admin
- [ ] **T12 (P1, human: ~30 min / CC: ~5 min)** — players + RPC — Claim code column + admin_relink_player RPC + display on /play + /admin form
  - Surfaced by: D17
  - Files: `supabase/migrations/*claim_code.sql`, `supabase/migrations/*admin_relink.sql`, `app/play/page.tsx`, `app/admin/relink.tsx`
  - Verify: vitest test that relink preserves assignment + history
- [ ] **T13 (P2, human: ~2 min / CC: ~30 sec)** — design — Update Success Criteria from ≥10 splashes to ≥20 splashes
  - Surfaced by: D18 #1
  - Files: `docs/unsw-splash/DESIGN.md`
  - Verify: grep
- [ ] **T14 (P1, human: ~20 min / CC: ~5 min)** — schema — Add game_id columns + FK to games on assignments, splashes, locations
  - Surfaced by: D18 #3
  - Files: `supabase/migrations/*game_id.sql`
  - Verify: vitest test asserts cross-game isolation
- [ ] **T15 (P1, human: ~15 min / CC: ~3 min)** — admin RPC — Add admin_reset_game(p_event)
  - Surfaced by: D18 #4
  - Files: `supabase/migrations/*admin_reset.sql`, `app/admin/page.tsx`
  - Verify: vitest test; manual Saturday-dryrun → reset → Sunday-prod path
- [ ] **T16 (P2, human: ~10 min / CC: ~3 min)** — admin_undo_splash — Reject undo of non-most-recent splashes
  - Surfaced by: D18 #5
  - Files: `supabase/migrations/*admin_undo.sql`, `app/admin/page.tsx`
  - Verify: vitest test
- [ ] **T17 (P1, human: ~45 min / CC: ~10 min)** — games + RPC — Split status enum to finale_called/finale_live; admin button to advance
  - Surfaced by: D18 #6
  - Files: `supabase/migrations/*finale_state.sql`, `app/admin/page.tsx`, `app/play/finale-banner.tsx`
  - Verify: vitest state machine test; manual flow through both finale states
- [ ] **T18 (P1, human: ~20 min / CC: ~5 min)** — schema + RPC — bib_pool table; admin_trigger_finale assigns from pool
  - Surfaced by: D18 #7
  - Files: `supabase/migrations/*bib_pool.sql`
  - Verify: vitest test that pre-seeded pool → finalist assignment is sequential
- [ ] **T19 (P3, human: ~1 min / CC: ~30 sec)** — design — Fix Distribution Plan: 2 teammates 9:00am-10:30am (not 1 at 9:30am)
  - Surfaced by: D18 #8
  - Files: `docs/unsw-splash/DESIGN.md`
  - Verify: grep
- [ ] **T20 (P3, human: ~1 min / CC: ~30 sec)** — design — Drop domain registration step; use vercel.app
  - Surfaced by: D18 #9
  - Files: `docs/unsw-splash/DESIGN.md`
  - Verify: grep
- [ ] **T21 (P2, human: ~10 min / CC: ~3 min)** — /play — Show distinct stale-GPS state instead of generic "MOVE CLOSER"
  - Surfaced by: Section 1 nitpick A8 (folded in)
  - Files: `app/play/page.tsx`
  - Verify: manual test with GPS toggled off mid-game

**Counts:** 21 tasks. P0: 1. P1: 13. P2: 4. P3: 3.

---

## Unresolved / Known Risks (accepted)

These were considered and explicitly accepted:

- **D5: heartbeat fan-out** — kept 5s + dual-table write; Saturday harness gates dial-back.
- **D6: shared admin token** — kept; rotate Sunday 8:30am.
- **D16: safety/harassment policy** — explicitly skipped. If incident surfaces, team owns it.
- **Single-target graph low event rate** (Codex strategic concern) — accepted as design.
- **Finale QR scan social awkwardness** (Codex strategic concern) — Saturday 6pm 10-friend dry-run gates the call.
- **Anti-cheat** — out of V1 scope per design Reviewer Concerns #5.

---

## Cross-Model Tension Resolved

| Topic | Review said | Codex said | User chose |
|-------|-------------|------------|------------|
| Safety / harassment policy | Missed | Critical | Skip |
| RLS hunter visibility | Accepted design | Leak | Keep symmetric (intentional) |
| Single-target graph | Accepted design | Low event rate | Keep (too late) |
| Anonymous auth recovery | Missed | Fragile | Add claim code |
| Domain registration | Implicit | Unnecessary risk | Drop |

Both reviewers agreed on D13 (consent), D14 (admin_check_in_player), D18 #1
(success math), D18 #2-9 (small fixes). No remaining tension.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 (this) | ISSUES_OPEN | 19 issues, 2 critical gaps; 17 changes accepted, 2 explicit accepted risks |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 (this project) | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE VOICE (Codex):** 19 missed-problem findings. 7 accepted as substantive AUQs (D13-D17 + 10-batch in D18). 1 strategic concern rejected as too-late redesign (single-target graph). 1 explicit accepted risk (safety/harassment policy, D16). No remaining cross-model tension.
- **CROSS-MODEL:** Both reviewers agreed on consent/retention (D13), admin_check_in_player (D14), success-math fix (D18 #1), and the 10 small fixes in D18.
- **UNRESOLVED:** 0 unresolved decisions. 4 explicit accepted risks (D5 heartbeat fan-out, D6 shared admin token, D15 hunter visibility, D16 safety policy). 2 critical gaps with manual Saturday mitigation gates (iPhone audio prime test + bib pre-flight scan).
- **VERDICT:** ENG REVIEW COMPLETED with issues_open. Plan is build-ready pending Saturday-morning manual gates. The 4 explicit risks are documented; the 2 critical gaps have mitigation steps in the implementation tasks (T5 + T18). No required-blocker remaining.
