# Changelog

All notable changes to this project are documented here. The version format is
`MAJOR.MINOR.PATCH.MICRO` (4 digits) and dates use `YYYY-MM-DD`.

## [0.1.0.0] - 2026-05-19

### Added

- **DebateConnect V1**: real-time video debate matchmaking. Two strangers get matched on live video, stake credits, argue out loud, and an AI judge declares the winner.
  - Lobby (`/`) — magenta light-editorial layout with localStorage sessionId + credit balance.
  - Debate room (`/debate/[id]`) — Daily.co prebuilt iframe for video, MediaRecorder + Whisper for per-turn transcription, magenta-sweep skeleton during transcribe, streamed AI verdict with split-screen scoreboard and credit ticker.
  - Result page (`/result/[id]`) — shareable verdict page with absolute-correct deltas for any viewer.
  - Admin seed (`POST /admin/seed`) — `x-admin-secret` gated demo backup that pre-loads a room with transcripts so the judge path works without live audio.
- **Server-side state machine** — explicit `waiting → in_progress → complete → judging → done` with guards on every API route. Atomic LPOP matchmaking, idempotent turn submission, SETNX judging lock.
- **AI judgment streaming** — Claude haiku-4-5 streams prose tokens buffered and flushed to Pusher every ~80ms (~20× fewer trigger calls than per-chunk). Zod-validated `<VERDICT>` JSON tag with retry-once + draw fallback.
- **Smoke test kit** — vitest, 4 files, 22 assertions: verdict parser (draw fallback, malformed retry, schema validation), matchmaking handler (real route with mocked Redis/Pusher/Anthropic), turn dedup, state-machine guards.
- **Brand tokens** — cream `#F8F5EE` background, magenta `#E91E63` accent, Playfair Display + Inter + Geist Mono via `next/font`, custom Tailwind tokens (`magenta`, `cream`, `ink`, `font-display`, `font-mono-num`).
- **Docs** — README rewritten for DebateConnect; `docs/debate-connect/PLAN.md` + `TODOS.md` + `TEST-PLAN.md` capture the full hackathon plan, cuts, and V2 follow-ups.

### Changed

- Replaced the Supabase starter lobby/auth UI on `/` with the DebateConnect lobby. Supabase wiring is kept in the repo (`lib/supabase/`) but unused at V1 — see `docs/debate-connect/TODOS.md` for the V2 auth follow-up.

### Fixed

- `/api/judge` — wrapped final Redis writes + Pusher trigger in try/catch and emit a `judgment-failed` event on Redis failure so clients exit the "Judge is deliberating…" spinner. Lock TTL (5 min) lets a future retry succeed.
- `/api/submit-turn` — added strict turn-index ordering check; previously a misbehaving client could submit turn 5 before turn 1.
- `components/debate/scoreboard.tsx` — credit deltas now key on the absolute winner instead of the viewer, so the shareable `/result/[id]` shows correct +/-stake for spectators.
- `components/debate/debate-room.tsx` — credit delta applies exactly once per device per room via `tryClaimCreditApplication(roomId)` in localStorage. Previously a refresh re-deducted the stake.
- `components/debate/lobby.tsx` — friendlier matchmaking error UX. 500s no longer surface raw `JSON.parse` errors to the user.
- `components/debate/debate-room.tsx` — `/debate/[invalid-or-expired-id]` now shows "Debate not found" with explanation and a "Find a new opponent" CTA, instead of spinning at "Loading debate…" forever.
- `lib/anthropic.ts` — 5s `AbortController` timeout on prompt generation so slow Claude responses fall through to the hardcoded fallback instead of hanging matchmaking.
