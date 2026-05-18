# DebateConnect — Hackathon Design Doc
**Date:** 2026-05-18 (revised 2026-05-19 after /plan-eng-review)
**Theme:** Connecting
**Mode:** Builder / Hackathon
**Session:** office-hours → ceo-review → eng-review

---

## The Pitch (30 seconds)

> "Omegle meets poker, but for arguments. You get matched with a stranger on video, you both stake credits, you argue out loud, and an AI judge transcribes and decides who wins. The better your argument, the richer you get."

---

## What It Is

A real-time, video-based debate matchmaking game. Two strangers are paired on live video, given a debate prompt, and take turns arguing out loud. Each turn's audio is transcribed by OpenAI Whisper. An AI judge reads the full transcript and declares a winner. Credits transfer from loser to winner.

**The "connecting" theme is earned:** you're not connecting people over shared interests — you're connecting them face-to-face through structured intellectual conflict. Live faces, real voices, AI-judged stakes. That's more interesting.

---

## Core Loop

```
1. Land on the site → see your credit balance (starts at 100)
2. Hit "Find Opponent" → matchmaking queue
3. Both players matched → redirected to /debate/[id]
4. Daily.co video iframe loads — both players see each other live
5. Prompt revealed (e.g. "Remote work is net negative for society")
6. Each player stakes 25 credits (hardcoded V1)
7. Turn-based debate: 3 turns each, 45 seconds per turn
   - Click "Start Turn" → mic records (MediaRecorder) → submit → Whisper transcribes
   - Auto-stop recording on timer expiry
8. After all 6 turns transcribed → click "Request Judgment"
9. AI reads transcript → streams reasoning prose → drops structured verdict
10. Credits transfer → result card shown (shareable)
11. Play again / find new opponent
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   VERCEL (single deploy)                     │
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │            Next.js App Router               │            │
│  │  /            → Lobby (localStorage credits)│            │
│  │  /debate/[id] → Debate Room (video+audio)   │            │
│  │  /result/[id] → Result Card (shareable)     │            │
│  │  /admin/seed  → Auth-gated debug staging    │            │
│  │                                             │            │
│  │  Daily.co iframe + MediaRecorder for mic    │            │
│  │  Pusher JS client (public broadcast chans)  │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │            API Routes (Fluid Compute)       │            │
│  │                                             │            │
│  │  POST /api/join-queue                       │            │
│  │    → LPUSH + EXPIRE 7200 on "queue"         │            │
│  │    → atomic LPOP count=2; if 2 returned:    │            │
│  │       create room, fetch prompt from Claude,│            │
│  │       write meta with state='waiting'       │            │
│  │    → trigger Pusher "matched" event         │            │
│  │                                             │            │
│  │  POST /api/submit-turn                      │            │
│  │    → state guard: must be waiting|in_prog   │            │
│  │    → idempotent on turn_index               │            │
│  │    → text comes from transcript field       │            │
│  │    → if turn_count=6: set state='complete'  │            │
│  │    → trigger Pusher "turn-submitted"        │            │
│  │                                             │            │
│  │  POST /api/transcribe (multipart audio blob)│            │
│  │    → forward to OpenAI Whisper (whisper-1)  │            │
│  │    → return { transcript: "..." }           │            │
│  │    → caller then POSTs /api/submit-turn     │            │
│  │                                             │            │
│  │  POST /api/judge                            │            │
│  │    → state guard: must be 'complete'        │            │
│  │    → SETNX room:{id}:judging (Redis lock)   │            │
│  │    → set state='judging'                    │            │
│  │    → return early via waitUntil(stream)     │            │
│  │    → in background: stream Claude haiku     │            │
│  │      ⇒ buffer tokens, flush every ~80ms     │            │
│  │      ⇒ Pusher "judgment-chunk" per flush    │            │
│  │      ⇒ on <VERDICT>: Zod parse, retry once  │            │
│  │      ⇒ on double-fail: draw verdict         │            │
│  │      ⇒ set state='done', store verdict      │            │
│  │      ⇒ Pusher "judgment-done" with verdict  │            │
│  │                                             │            │
│  │  (internal) /api/prompt is not a public     │            │
│  │   route; prompt is fetched server-side      │            │
│  │   during /api/join-queue room creation      │            │
│  │   with 3 hardcoded fallbacks                │            │
│  │                                             │            │
│  │  POST /admin/seed (header x-admin-secret)   │            │
│  │    → seed room with pre-transcribed turns   │            │
│  │    → state='complete' so /api/judge works   │            │
│  │    → backup demo path (no video/audio)      │            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
        │                │                │              │
        ▼                ▼                ▼              ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐
│ Upstash     │  │ Pusher       │  │ Claude API  │  │ OpenAI   │
│ Redis       │  │ (public      │  │ (Anthropic) │  │ Whisper  │
│             │  │  broadcast)  │  │             │  │          │
│ queue LIST  │  │              │  │ haiku-4-5   │  │ whisper-1│
│ room:{id}:  │  │ Channels:    │  │ streaming   │  │ batch    │
│   meta HASH │  │ debate-{id}  │  │ prose +     │  │ per turn │
│   turns LIST│  │              │  │ <VERDICT>   │  │          │
│   judging   │  │ Events:      │  │ JSON suffix │  │          │
│ (TTL 2h)    │  │ matched,     │  │             │  │          │
│             │  │ turn-submit, │  │             │  │          │
│             │  │ judgment-    │  │             │  │          │
│             │  │ chunk/done   │  │             │  │          │
└─────────────┘  └──────────────┘  └─────────────┘  └──────────┘
                                                          ▲
                                                          │
                                                    ┌─────┴─────┐
                                                    │ Daily.co  │
                                                    │ prebuilt  │
                                                    │ iframe    │
                                                    │ (video)   │
                                                    └───────────┘
```

### Redis Data Model

```
queue                → LIST of player sessionIds waiting (EXPIRE 7200 every LPUSH)
room:{id}:meta       → HASH {
                          player1, player2,
                          prompt,
                          stake=25 (hardcoded V1),
                          state: 'waiting'|'in_progress'|'complete'|'judging'|'done',
                          turn_count,
                          verdict (JSON, written when state='done')
                        }
room:{id}:turns      → LIST of JSON { player, transcript, turn_index, audio_duration }
room:{id}:judging    → STRING lock key (SETNX, prevents duplicate judgment)
```

All keys: TTL 2 hours. `queue` LIST gets `EXPIRE 7200` after every `LPUSH` (TTL doesn't auto-extend on LIST writes).

### Room State Machine

```
                  ┌──────────┐
join-queue match→ │ waiting  │ (room created, prompt written, 0 turns)
                  └────┬─────┘
                       │ first submit-turn
                       ▼
                  ┌──────────────┐
                  │ in_progress  │ (1-5 turns submitted)
                  └────┬─────────┘
                       │ 6th submit-turn lands
                       ▼
                  ┌──────────┐
                  │ complete │ (all turns transcribed, ready for judge)
                  └────┬─────┘
                       │ /api/judge SETNX succeeds
                       ▼
                  ┌──────────┐
                  │ judging  │ (Claude streaming, Pusher delivering chunks)
                  └────┬─────┘
                       │ verdict parsed (or draw fallback)
                       ▼
                  ┌──────────┐
                  │   done   │ (verdict stored, result page renders)
                  └──────────┘
```

Every API route guards on state. submit-turn rejects unless `waiting`|`in_progress`. judge rejects unless `complete`. All transitions are HSET on `room:{id}:meta`.

---

## Tech Stack

### Frontend
- **Next.js 15** (App Router) on Vercel Fluid Compute
- **Daily.co prebuilt iframe** for video — drop `<iframe src="https://YOUR-SUBDOMAIN.daily.co/{roomId}">`
- **Browser MediaRecorder** for per-turn audio capture (separate mic stream from Daily, parallel consumer)
- **Pusher JS client** for matchmaking + turn relay + judgment streaming (public channels, no auth endpoint)
- **localStorage** for sessionId UUID (generated once via `crypto.randomUUID()`) and fake credit balance
- **Zod** for runtime verdict schema validation
- TailwindCSS + shadcn/ui (already installed)

### Backend
- **Next.js API routes** (Fluid Compute, default Node.js 24 LTS, 300s timeout)
- **`waitUntil()`** in /api/judge so client fetch returns instantly while streaming continues server-side
- **Pusher** (broadcast-only, public channels — no presence, no auth endpoint per D1 cut)
- **Upstash Redis** (REST client, atomic LPOP count, EXPIRE on LIST writes)
- **OpenAI Whisper API** (whisper-1, batch per turn — audio blob in, transcript out)

### AI
- **Claude API** (haiku-4-5 for speed, sonnet-4-6 fallback if needed)

- **Prompt generation** (server-side at room creation, NOT a public endpoint):
  ```
  Generate a controversial but not offensive debate topic for strangers.
  One sentence. No need to pick a side. Return JSON: {"prompt": "..."}

  Hardcoded fallback topics (used if Claude call fails):
  - "Remote work is net negative for society"
  - "Social media has done more harm than good"
  - "AI will eliminate more jobs than it creates"
  ```

- **Judgment prompt** (prose + structured tag, stream-friendly):
  ```
  You are an impartial debate judge. The two players spoke their arguments
  aloud; the text below is the Whisper transcript of each turn.

  TRANSCRIPT:
  [Player 1 — Turn 1]: <transcript>
  [Player 2 — Turn 1]: <transcript>
  ... (6 turns total)

  Write your reasoning as natural prose (3-5 sentences). Evaluate:
  argument quality, evidence, logical consistency, persuasiveness.

  After your reasoning, on a new line, output ONLY:
  <VERDICT>{"winner": "player1" | "player2", "score_player1": 1-10,
  "score_player2": 1-10}</VERDICT>

  No extra text after </VERDICT>.
  ```

- **Streaming render**: client renders prose tokens until it sees `<VERDICT>`, then parses the JSON tag for structured fields. Zod validates the parsed object; on parse failure, server regenerates ONCE with a stricter prompt; on second failure, returns a draw verdict with stakes refunded.

- **Streaming transport**: tokens buffered in /api/judge handler, flushed every ~80ms via Pusher `trigger()`. Cuts trigger count ~20× vs per-chunk.

### Audio Capture & Transcription

- Browser uses `navigator.mediaDevices.getUserMedia({audio: true})` for the SECOND mic stream (Daily.co holds the FIRST for video chat). Chromium allows multiple consumers of the same mic.
- `MediaRecorder` captures audio per turn into a blob (~45s of opus-encoded audio, typically 200-500KB).
- On submit (or auto-stop at timer expiry), client POSTs blob multipart to `/api/transcribe`.
- Server forwards to OpenAI Whisper (whisper-1 model) and returns `{ transcript: "..." }`.
- Client then POSTs `{ roomId, turn_index, transcript }` to `/api/submit-turn`.

**Mic-sharing test:** verify on demo laptop the night before. Daily holds the mic for video chat; MediaRecorder grabs a parallel stream. Works on Chrome/Edge; needs verification on whatever browser the demo uses.

### Identity (no auth)

- `localStorage.getItem('sessionId') ?? crypto.randomUUID()` on first visit.
- All API calls send `x-session-id` header (small fetch wrapper).
- sessionId is the player ID in queue entries and room meta.

### Rooms
- Room ID = 6-char random string (also serves as the Daily.co room slug)
- Shareable result URL: `/result/[room-id]`

---

## Features

### Matchmaking
- POST /api/join-queue with sessionId
- LPUSH queue + EXPIRE queue 7200
- Atomic `LPOP queue count=2` — if 2 returned, create room
- Room creation steps in order: HSET meta (state='waiting', player1, player2), fetch prompt server-side (with hardcoded fallback), HSET meta.prompt, Pusher trigger "matched" to `debate-{roomId}` with { roomId, prompt, players }
- Client receives matched event, redirects to /debate/[id]
- Cancel button: RPUSH or LREM to take sessionId out of queue

### Debate Room — Video + Audio
- Daily.co iframe loads on mount with `roomId` as room slug
- MediaRecorder requests parallel mic permission for transcription stream
- Prompt + stake displayed prominently
- Turn UI: "It's your turn" / "Opponent is speaking" / "Click Start to record"
- Active turn: red recording indicator, 45s countdown, big stop/submit button
- On stop or timer expiry: blob → POST /api/transcribe → POST /api/submit-turn → transcript appears in turn history list

### AI Judgment
- "Request Judgment" button enabled when state=complete (turn_count=6)
- POST /api/judge → SETNX lock → state→judging
- Server returns `{ ok: true, judging: true }` immediately via waitUntil
- In background, Claude streams; buffered chunks flushed via Pusher every ~80ms
- Client renders streaming prose, parses `<VERDICT>` tag, displays structured winner/scores
- On parse failure: server regenerates once with stricter prompt; on double-fail, returns draw and stakes refund

### Demo Staging (debug backup)
- `POST /admin/seed` with `x-admin-secret` header
- Body: `{ prompt, transcripts: [string, string, string, string, string, string] }` (6 pre-transcribed turns alternating player1/player2)
- Creates room in Redis with state='complete', skipping the video/audio path
- Returns `roomId` and `/debate/{roomId}` URL — useful for testing /api/judge directly without live mics

---

## UI Screens

### 1. Lobby
```
[ DebateConnect ]              Balance: 🪙 100 credits

  Ready to argue out loud?

  Stake: 25 credits/match

  [ Find Opponent ]

  "Connect through conflict."
```

### 2. Debate Room
```
[ DebateConnect ]    Round 2/3    ⏱ 0:32    Stake: 25 credits

PROMPT: "Remote work is net negative for society"

┌─────────────────┐  ┌─────────────────┐
│  YOU (FOR)      │  │ OPPONENT (AGAINST)
│  [video tile]   │  │  [video tile]   │
└─────────────────┘  └─────────────────┘

Turn history (transcripts):
[P1, T1] "Remote work has shown that distributed teams can ship..."
[P2, T1] "Studies show isolation has measurable cognitive..."
[P1, T2] (you, currently recording — 0:32 left)

         [ ⏺ Recording — Stop & Submit ]
```

### 3. AI Judgment Screen
```
⚖️ AI VERDICT

[Streaming prose:
"This was a close debate. Player 1 opened with a strong empirical
claim about distributed-team productivity but failed to address the
counterargument about cognitive isolation. Player 2 consistently
attacked the premise and provided better sourcing on the long-term
loneliness data..."]

🏆 Player 2 wins 25 credits!  Scores: P1=6, P2=8

[ Play Again ]  [ Share Result ]
```

---

## Error Handling

| Failure | User Sees | Recovery |
|---|---|---|
| Mic permission denied | "Allow microphone to debate" + retry button | User grants → page reloads |
| Daily.co iframe blocked/failed | "Video unavailable, debate continues audio-only" | Audio recording still works; iframe hidden |
| Whisper API down (transcribe) | "Couldn't transcribe — try again" + retry button on that turn | Retry without losing room; turn stays open |
| Whisper API slow (>15s) | Spinner + "Transcribing..." indicator | Wait; do not advance turn |
| Claude API down (judgment) | "AI judge unavailable" | Retry button; 2nd failure → draw, stakes returned |
| Claude returns malformed verdict | (silent retry once) → if double-fail → draw verdict | Stakes returned, both players see draw screen |
| Claude API down (prompt at room creation) | Instant fallback prompt | One of 3 hardcoded topics used; no user-visible error |
| Pusher disconnect | "Reconnecting..." banner | Pusher SDK auto-reconnects |
| Pusher reconnect >30s | Spinner | Fall back to polling `/api/room-state` every 2s |
| Redis unavailable | "Matchmaking down" toast | Blocked until Redis recovers |
| Redis TTL expires | 404: "This debate has ended" | — |
| Submit-turn while not in valid state | 409 with current state | Client refetches room state, re-syncs UI |
| Duplicate /judge call | Second caller sees 409 | First caller's stream still delivers to both via Pusher |
| Mic shared between Daily + MediaRecorder fails | Recording fails silently | Verified on demo laptop the night before; fallback is type-text input on that turn |
| Browser refresh mid-debate | sessionId in localStorage matches a player → resume current turn state from server | If sessionId is lost: cannot rejoin (acceptable hackathon scope) |

---

## Build Order (revised for video+audio scope)

**Total: ~10 hours.** Hackathon budget is 8h with 1h buffer; this is honestly over. Scope cut candidates if budget tightens: skip the 4-test smoke kit (-40min), skip result-card animation polish (-30min), use only one hardcoded fallback prompt instead of 3 (-10min).

1. **Pusher + Upstash Redis + Daily.co + OpenAI + Anthropic setup** (1h)
   - Create all 5 accounts, get credentials
   - `.env.example` updated with all required vars + `ADMIN_SECRET`
   - Wire up env vars in Vercel
   - Test: publish event from API route, subscribe in browser; create a Daily room manually; smoke-test Whisper API with a sample audio file

2. **Matchmaking + room creation** (1h)
   - sessionId localStorage UUID + fetch wrapper
   - POST /api/join-queue with atomic LPOP count=2, EXPIRE on queue
   - Server-side prompt fetch + state='waiting' on room creation
   - Redirect both players to /debate/[id]

3. **Daily.co video integration** (1h)
   - Drop iframe into /debate/[id] using roomId as Daily room slug
   - Auto-generated Daily room (or pre-created via API)
   - Both players see each other's tiles

4. **MediaRecorder + /api/transcribe + Whisper** (2h)
   - getUserMedia for parallel mic stream
   - MediaRecorder per-turn capture, 45s timer, auto-stop on expiry
   - POST audio blob to /api/transcribe → Whisper → transcript
   - Client renders transcript list as turns complete

5. **Submit-turn + state machine + dedup** (1h)
   - POST /api/submit-turn with turn_index, transcript
   - State guards + idempotent on duplicate turn_index
   - Pusher relay "turn-submitted" so opponent sees the transcript live
   - Auto-transition to state='complete' on 6th turn

6. **AI judgment endpoint with streaming** (1h)
   - POST /api/judge with SETNX lock, state guard, waitUntil()
   - Claude haiku stream, buffer tokens, flush via Pusher every ~80ms
   - Verdict prompt with prose + `<VERDICT>` tag
   - Zod schema, regenerate once on parse failure, draw fallback
   - Frontend: streaming-text state machine (prose mode → verdict-tag mode)

7. **Lobby + fake credits + /admin/seed (auth)** (45min)
   - localStorage credit balance, hardcoded 25 stake
   - "Find Opponent" + cancel button
   - /admin/seed with x-admin-secret header check, body validation

8. **Result card + polish** (1h)
   - /result/[id] reads verdict from Redis
   - Credit delta animation
   - Shareable URL works in any browser

9. **4-test smoke kit** (40min)
   - vitest install + config
   - verdict-parser.test.ts
   - matchmaking.test.ts (mock Upstash)
   - turn-dedup.test.ts
   - state-guard.test.ts

**Buffer:** -2h vs the 8h target. Realistically this is 1.5 days of focused work, not 1. Honest math.

---

## The 3-Minute Demo Plan

**Staged setup (do this the night before / morning of):**

1. Deploy to Vercel
2. Test mic-sharing on the actual demo laptop in the actual demo browser
3. Test full loop with two physical devices end-to-end on prod
4. As backup: hit `/admin/seed` with pre-transcribed spicy debate → verify result page renders
5. Record screen-capture of a working live debate as ultimate fallback

**On stage (90 seconds):**

1. Show both screens side-by-side; ideally one is the stage laptop, one is a teammate's laptop projected
2. Click "Find Opponent" on both → matched within a second
3. Daily.co video shows both faces
4. Prompt appears
5. You speak Turn 1 live (45s, real audio, mic on)
6. Teammate speaks Turn 2 live
7. Skip remaining turns or speak quickly to fit budget
8. Hit "Request Judgment" → AI verdict streams in live — this is the "whoa" moment
9. Result card: winner declared, credits transferring

**Pitch (60 seconds):**

- "Online debate is either a cesspool or a circle-jerk. No real stakes, no real structure."
- "Stakes change behavior. When you have to SAY it out loud, with a stranger looking at you, with credits on the line — you actually think before you speak."
- "This is the beginning of a credit economy for intellectual skill."

**Backup paths (in priority order):**

1. If mic/video works but Whisper is flaky → narrate "the AI is transcribing live" and hope
2. If Daily fails → audio-only debate (still works for transcription)
3. If audio-stack fails entirely → switch to /admin/seed-loaded room, click "Request Judgment" directly, narrate the rest
4. If everything fails → play the screen recording

---

## What to Skip (V1)

- Auth / accounts — localStorage UUID is fine for sessionId
- Persistent credit balance across sessions — localStorage only (V2 TODO)
- Mobile responsiveness — demo on desktop (V2 TODO)
- Chat / social features — post-hackathon
- ELO / leaderboard — post-hackathon
- Credit purchase / top-up — post-hackathon
- **Presence/forfeit handling** (cut in eng-review D1) — staged demo doesn't exercise it; reclaim 1h. Captured in TODOS.md.
- **Stake adjuster UI** (cut in eng-review D7) — hardcoded 25. Captured in TODOS.md.

---

## Hackathon-Day Checklist

- [ ] Deploy to Vercel (single deploy)
- [ ] Upstash Redis: free instance, env vars
- [ ] Pusher: app + env vars (no auth secret needed without presence)
- [ ] Anthropic API key
- [ ] OpenAI API key
- [ ] Daily.co subdomain + room API key
- [ ] ADMIN_SECRET env var (any random string)
- [ ] Test mic-sharing (Daily + MediaRecorder parallel) on demo laptop in demo browser
- [ ] Test full loop on prod with two devices the night before
- [ ] Run /admin/seed to create backup demo room, confirm it loads
- [ ] Stage backup screen recording
- [ ] Print/display credit balance prominently — it's the hook
- [ ] Bring phone + laptop for two-screen demo
- [ ] Test on hackathon WiFi (Daily.co + Whisper both need decent upload)

---

## The Angle for Judges

**Not:** "We built a debate app."
**Yes:** "We built a credit economy for intellectual skill. Live video, live voice, AI-transcribed and AI-judged. The better you argue, the richer you get. Connecting strangers through conflict instead of consensus."

---

## Post-Hackathon Vision (say this in the pitch, don't build it now)

- Real credit system (on-chain or in-app currency)
- ELO ratings for debate skill
- Invite tokens (Luma-style) to host debate tournaments
- Spectator mode with live crowd voting vs AI verdict
- Topic categories: sports, politics, tech, philosophy
- Debate leagues and brackets
- Persistent credits with server-side truth (Supabase already wired in repo)
- Forfeit + presence detection for real-world abandonment

---

## CEO Review Decisions (2026-05-18)

| Decision | Choice | Rationale |
|---|---|---|
| Real-time layer | Pusher (managed WS) | Single Vercel deploy, no Railway/Fly.io CORS complexity |
| State storage | Upstash Redis | Serverless Next.js can't use in-memory; Redis is free tier |
| Disconnect handling | Presence channels + 60s forfeit | **REVERSED in eng-review D1** — cut to reclaim 1h budget |
| Demo staging | /admin/seed endpoint | Now auth-gated per eng-review D6 |
| AI output format | Structured JSON | Refined in eng-review D4 to prose + `<VERDICT>` tag |
| Turn timer | Auto-submit on expiry | Adapted: auto-stop recording at 0s (audio path) |

---

## Eng Review Decisions (2026-05-19)

| # | Question | Choice | Rationale |
|---|---|---|---|
| D1 | Presence/forfeit | **CUT entirely** | Staged demo never exercises forfeit; reclaim 1h. Reverses CEO SE-1. TODO in V2. |
| D2 | Matchmaking atomicity | Atomic `LPOP count=2` | Upstash supports atomic multi-pop. Single REST call. Race impossible. |
| D3 | Judgment streaming | Buffer chunks, flush every ~80ms | Cuts Pusher trigger count ~20× vs per-chunk. Standard token-buffering. |
| D4 | Verdict rendering | Prose + `<VERDICT>` JSON suffix | Stream renders readable prose; structured fields tucked in tag. |
| D5 | Room state machine | Explicit 5-state field | waiting → in_progress → complete → judging → done. Every API guards. |
| D6 | /admin/seed auth | `x-admin-secret` header check | Two lines, closes a real attack surface on public Vercel URL. |
| D7 | Stake adjuster | Hardcoded 25 credits | Removes lobby flow + reconciliation logic; V2 TODO. |
| D8 | Queue TTL | `EXPIRE queue 7200` after each `LPUSH` | LIST TTL doesn't auto-extend; prevents stale-session accumulation. |
| D9 | Session identity | localStorage UUID via `crypto.randomUUID()` | Stable per-browser, no auth, matches localStorage-credits pattern. |
| D10 | Verdict parsing | Zod + retry once + draw fallback | Cheap insurance against the single most likely demo-killer. |
| D11 | Prompt timing | Server-side at room creation, written to meta.prompt | One source of truth; no client race; /api/prompt becomes internal. |
| D12 | Test scope | 4-test smoke kit (vitest) | Targets the 4 silent-failure modes specifically: verdict, match, dedup, state. |
| D13 | /api/judge response | `waitUntil(stream)` + immediate 200 | Caller fetch returns instantly; prevents double-click during demo. |
| D14 | Outside voice | (skipped — user redirected to scope expansion) | See D15. |
| D15 | Webcam + Whisper scope | **Full video + audio + Whisper, REPLACES text** | User-driven scope expansion. Budget revised to ~10h. |
| D16 | Video provider + audio | Daily.co prebuilt iframe + client-side MediaRecorder | Fastest viable path: ~30min Daily + ~1.5h audio/Whisper. |
| D17 | TODO: presence/forfeit | Added to TODOS.md as V2 | Captures the reversed CEO decision so it's not lost. |
| D18 | TODO: stake adjuster | Added to TODOS.md as V2 | Variable stakes is a marquee V2 feature. |

### Unresolved decisions
- **Outside voice (codex review of the revised plan)** — skipped because D14 was used for scope expansion. If time permits before hackathon day, run `codex review` against the updated plan independently. Risk of skipping: single-reviewer blind spots on the new video+Whisper scope survive into implementation.
- **Mic-sharing browser compatibility** — Daily + MediaRecorder parallel consumers work on Chrome/Edge. Verify on the actual demo browser the night before. If it fails, fallback path is to use only the Daily audio track and pull it via Daily's client SDK (1-2h pivot, eats buffer).

### Failure modes (1 critical gap flagged)
- **Mic-sharing failure on demo browser** is the single critical gap. If Daily + parallel MediaRecorder don't coexist on the demo device, the entire audio-transcription path breaks ON STAGE with no obvious recovery. Mitigation: night-before test + Daily SDK pivot ready as plan B.

### Worktree parallelization
- **Lane A** (sequential): Tasks T1, T7, T10 — `app/api/join-queue/route.ts` (atomic LPOP, queue EXPIRE, prompt-at-creation, state init)
- **Lane B** (sequential): Tasks T2, T3, T9, T12 — `app/api/judge/route.ts` (buffered streaming, verdict prompt+parser, waitUntil)
- **Lane C** (independent): Tasks T13, T14 — Daily integration + MediaRecorder/Whisper (no overlap with API layer)
- **Lane D** (independent): Task T11 — test setup + 4 smoke tests
- **Lane E** (sequential after A & B): Task T4 — room state machine (touches join-queue, submit-turn, judge)
- **Conflict flag:** Lane A and Lane E both touch `app/api/join-queue/route.ts`; do A first, then E. Lane B and Lane E both touch `app/api/judge/route.ts`; same ordering.
- Launch: A + C + D in parallel (3 worktrees). Then B. Then E to integrate state machine.

---

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific decision above. Run with Claude Code or Codex; checkbox as you ship. Full JSONL artifact for /autoplan at `~/.gstack/projects/f1shyfang-devsoc_halftime/tasks-eng-review-20260519-002302.jsonl`.

- [ ] **T1 (P1, human: ~20min / CC: ~5min)** — matchmaking — Use atomic LPOP count=2 in /api/join-queue
  - Surfaced by: D2 (Architecture) — 'LPOP × 2' as two calls is racy
  - Files: app/api/join-queue/route.ts, lib/redis.ts
  - Verify: vitest matchmaking.test.ts
- [ ] **T2 (P1, human: ~30min / CC: ~10min)** — judge-streaming — Buffer Claude tokens, flush via Pusher every ~80ms
  - Surfaced by: D3 (Architecture) — per-chunk Pusher trigger stalls demo
  - Files: app/api/judge/route.ts
  - Verify: manual stream test, measure flush count <25 per judgment
- [ ] **T3 (P1, human: ~20min / CC: ~5min)** — judge-prompt — Prose + `<VERDICT>JSON</VERDICT>` suffix
  - Surfaced by: D4 (Architecture) — streaming raw JSON renders ugly
  - Files: lib/judge-prompt.ts, components/debate-judgment.tsx
- [ ] **T4 (P1, human: ~30min / CC: ~10min)** — room-state — Explicit state field + guards in every API route
  - Surfaced by: D5 (Architecture) — implicit state leaves race windows
  - Files: lib/room-state.ts, app/api/submit-turn/route.ts, app/api/judge/route.ts, app/api/join-queue/route.ts
  - Verify: vitest state-guard.test.ts
- [ ] **T5 (P1, human: ~10min / CC: ~3min)** — admin-seed — `x-admin-secret` header check
  - Surfaced by: D6 (Architecture) — unauthenticated seed on public URL
  - Files: app/admin/seed/route.ts, .env.example
- [ ] **T6 (P2, human: ~15min / CC: ~5min)** — lobby — Hardcode stake to 25; remove adjuster UI
  - Surfaced by: D7 (Code Quality) — stake reconciliation undefined
  - Files: app/page.tsx, components/lobby.tsx
- [ ] **T7 (P2, human: ~5min / CC: ~2min)** — matchmaking — `EXPIRE queue 7200` after each LPUSH
  - Surfaced by: D8 (Architecture) — LIST TTL doesn't auto-extend
  - Files: app/api/join-queue/route.ts
- [ ] **T8 (P1, human: ~20min / CC: ~5min)** — session — localStorage UUID + x-session-id fetch wrapper
  - Surfaced by: D9 (Code Quality) — sessionId source undefined
  - Files: lib/session.ts, lib/fetch-with-session.ts
- [ ] **T9 (P1, human: ~30min / CC: ~10min)** — verdict-parser — Zod + regenerate once + draw fallback
  - Surfaced by: D10 (Code Quality) — JSON.parse with no robustness crashes demo
  - Files: lib/verdict-parser.ts, app/api/judge/route.ts
  - Verify: vitest verdict-parser.test.ts
- [ ] **T10 (P1, human: ~15min / CC: ~5min)** — prompt-routing — Server-side at room creation, write to meta.prompt
  - Surfaced by: D11 (Code Quality) — client-called /api/prompt races
  - Files: app/api/join-queue/route.ts, lib/anthropic.ts
- [ ] **T11 (P2, human: ~40min / CC: ~15min)** — tests — Install vitest + 4 smoke tests
  - Surfaced by: D12 (Test Review) — 0/27 paths covered
  - Files: vitest.config.ts, app/__tests__/{verdict-parser,matchmaking,turn-dedup,state-guard}.test.ts
- [ ] **T12 (P1, human: ~15min / CC: ~5min)** — judge-streaming — `waitUntil()` so /api/judge returns immediately
  - Surfaced by: D13 (Performance) — client fetch hangs 5-15s otherwise
  - Files: app/api/judge/route.ts
- [ ] **T13 (P1, human: ~60min / CC: ~20min)** — video — Daily.co prebuilt iframe in /debate/[id]
  - Surfaced by: D15/D16 (Scope) — video replaces text
  - Files: components/debate-video.tsx, app/debate/[id]/page.tsx, .env.example
- [ ] **T14 (P1, human: ~90min / CC: ~30min)** — audio-whisper — MediaRecorder + /api/transcribe + Whisper
  - Surfaced by: D15/D16 (Scope) — audio→Whisper transcription is the new turn input
  - Files: components/turn-recorder.tsx, app/api/transcribe/route.ts, lib/openai.ts
- [ ] **T15 (P2, human: ~20min / CC: ~5min)** — clients — Module-level singleton clients
  - Surfaced by: Code quality — Fluid Compute instance reuse
  - Files: lib/pusher.ts, lib/redis.ts, lib/anthropic.ts, lib/openai.ts
- [ ] **T16 (P1, human: ~45min / CC: ~15min)** — result-page — /result/[id] with delta animation + share URL
  - Surfaced by: Build order step 7 — plan didn't break out tasks
  - Files: app/result/[id]/page.tsx, components/result-card.tsx
- [ ] **T17 (P3, human: ~10min / CC: ~3min)** — docs — README env vars section
  - Surfaced by: Repo currently documents only Supabase env vars
  - Files: README.md, .env.example

---

## Design Decisions (2026-05-19)

Synthesized from /plan-design-review. Focused 3-dimension review (brand + IA + interaction states); skipped responsive/a11y per V1 desktop-demo scope.

### Brand Identity (Pass A: 2/10 → 8/10)

| Token | Value | Use |
|---|---|---|
| Theme | Light editorial — "magazine cover" | Sets the mood: spirited debate, not gladiator |
| Background | `#F8F5EE` (cream) | All pages |
| Foreground text | `#0F0F0F` (near-black) | All body and headings |
| Accent | `#E91E63` (electric magenta) | Used ONLY for: active timer, record dot, winner highlight, credit deltas, streaming-prose cursor, primary CTAs |
| Display font | Playfair Display (Google Fonts) | Wordmark, prompt banner, AI verdict prose |
| UI font | Inter (Google Fonts) | All UI labels, buttons, body |
| Numerals | Inter tabular / Geist Mono | All numeric displays (timer, scores, credit balances) |

Wordmark: "DebateConnect" set in Playfair Display Bold, slight tracking, no separate logo mark.

Tone words: spirited, intentional, intellectual.

### Information Architecture (Pass B: 4/10 → 8/10)

Debate room layout: **video-dominant with prompt as editorial banner header**.

```
┌─────────────────────────────────────────────────────────┐
│ DebateConnect          Round 2/3   ⏱ 0:32     25 ¢      │  ← 48px nav
├─────────────────────────────────────────────────────────┤
│                                                          │
│       "Remote work is net negative for society"          │  ← 80-100px PROMPT BANNER
│                                                          │   Playfair 32-36px,
│                                                          │   magenta underline or
│                                                          │   left border
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────┐    ┌────────────────────┐       │
│  │                    │    │                    │       │  ← VIDEO TILES
│  │  YOU (FOR)         │    │ OPPONENT (AGAINST) │       │   16:9 each
│  │                    │    │                    │       │   ~50-55% viewport
│  └────────────────────┘    └────────────────────┘       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ [P1, T1] Remote work has shown that distributed teams.. │
│ [P2, T1] But studies show isolation has measurable...   │  ← TRANSCRIPT LIST
│ [P1, T2] _skeleton, magenta sweep, awaiting Whisper_    │   ~20% viewport
├─────────────────────────────────────────────────────────┤
│   ● 0:32                  [ Stop & Submit ]              │  ← ACTION FOOTER
└─────────────────────────────────────────────────────────┘   ~10-15% viewport
```

Information hierarchy: prompt > video tiles > record button > timer > transcript > nav chips.

### Recording-State Interaction (Pass C: 2/10 → 8/10)

**Live recording visual:** single pulsing magenta filled circle (8-10px, 1s sine ease) beside tabular countdown timer in Inter Mono / Geist Mono at ~64px. "Stop & Submit" primary CTA. No waveform, no level meter.

**Transcribing-wait state (1-3s while Whisper runs):** skeleton placeholder injected into transcript list at the position where the new transcript will land. 3 muted-grey background blocks (the row's expected height). A 1px magenta line sweeps left→right across the top of the skeleton, repeating at ~1s cadence (pure CSS keyframes). On Whisper return: skeleton fades to actual transcript with 200ms fade-in. NO generic spinner.

**Whisper failure:** skeleton row swaps to error state: "Couldn't transcribe — retry" with magenta retry button. Turn timer pauses (turn doesn't advance).

### Verdict Reveal — the "whoa" moment (Pass D: 3/10 → 9/10)

Sequence:
1. Prose streams via buffered Pusher chunks (per eng-review D3 ~80ms cadence). Streaming cursor (1ch wide magenta block) blinks at the end of the prose.
2. `<VERDICT>` tag detected → cursor disappears. **400ms pause** (gravity).
3. Split-screen scoreboard slides up from the bottom edge (300ms ease-out).
   - Left half: magenta-tinted background, "PLAYER 1 — score 6/10"
   - Right half: cream background, "PLAYER 2 — score 8/10"
   - Winning side: subtle magenta border-glow (2px, animated fade-in over 200ms)
4. Credit deltas appear below scores: winner shows "+25 credits" in magenta, loser shows "−25 credits" in muted grey.
5. **Credit numbers tick** from current to new balance over ~800ms with slight overshoot bounce (CSS transform or Framer Motion `useSpring`). Both sides tick simultaneously.
6. After ~500ms settle: "Play Again" and "Share Result" buttons fade in.

This sequence IS the demo's emotional climax. Build it deliberately, not as a "polish pass."

### Skipped (V1 hackathon scope)

- **Mobile responsive design** — V1 is desktop-only demo. V2 TODO already captured.
- **A11y spec (keyboard nav, screen readers, contrast audit)** — V1 demo accepts the gap; V2 must address.
- **Pass 5 (DESIGN.md alignment)** — no DESIGN.md exists yet. Will be seeded from approved mockups via `$D extract` per the TODO.

## Approved Mockups

| Screen | Mockup Path | Status |
|---|---|---|
| Debate room mid-turn | _pending OpenAI org verification_ | DEFERRED — see TODOS.md |
| Verdict reveal mid-stream | _pending OpenAI org verification_ | DEFERRED — see TODOS.md |

Visual mockups deferred because OpenAI org verification required for gpt-image-1 was not yet complete. Briefs are drafted in /plan-design-review session history; regenerate once verification propagates (see TODOS.md "Regenerate visual mockups after OpenAI org verification").

## Design Implementation Tasks

Synthesized from /plan-design-review. Full JSONL artifact at `~/.gstack/projects/f1shyfang-devsoc_halftime/tasks-design-review-20260519-005737.jsonl`.

- [ ] **DT1 (P1, human: ~30min / CC: ~10min)** — brand-tokens — Wire brand tokens (cream bg, magenta accent, Playfair + Inter via next/font) in globals.css + tailwind.config.ts
  - Surfaced by: D4/D5 (Brand) — light editorial magazine cover
  - Files: app/globals.css, tailwind.config.ts, app/layout.tsx
- [ ] **DT2 (P1, human: ~60min / CC: ~20min)** — debate-room-layout — Build video-dominant layout with prompt banner header
  - Surfaced by: D6 (IA)
  - Files: app/debate/[id]/page.tsx, components/debate-room.tsx, components/prompt-banner.tsx
- [ ] **DT3 (P1, human: ~30min / CC: ~10min)** — record-state-ui — Pulsing magenta dot + tabular countdown, no waveform
  - Surfaced by: D7 (Record viz)
  - Files: components/turn-recorder.tsx, components/recording-indicator.tsx
- [ ] **DT4 (P1, human: ~20min / CC: ~8min)** — transcribing-skeleton — Skeleton placeholder with magenta sweep during Whisper wait
  - Surfaced by: D8 (Wait state)
  - Files: components/transcript-skeleton.tsx, app/globals.css
- [ ] **DT5 (P1, human: ~60min / CC: ~20min)** — verdict-reveal — Split-screen scoreboard + credit-tick animation
  - Surfaced by: D9 (Verdict drop) — the demo's whoa moment
  - Files: components/verdict-reveal.tsx, components/credit-ticker.tsx, app/debate/[id]/page.tsx
- [ ] **DT6 (P2, human: ~15min / CC: ~5min)** — prompt-banner-typography — Playfair 32-36px with tight tracking
  - Surfaced by: D6 + D4
  - Files: components/prompt-banner.tsx
- [ ] **DT7 (P2, human: ~30min / CC: ~10min)** — scoreboard-component — Reusable split-screen scoreboard
  - Surfaced by: D9
  - Files: components/scoreboard.tsx
- [ ] **DT8 (P2, human: ~30min / CC: ~10min)** — empty-states — Lobby pre-find, queue waiting, room loading copy + treatment
  - Surfaced by: Pass 2 (state coverage) — lobby idle, queue waiting, room loading were gaps
  - Files: app/page.tsx, components/queue-state.tsx, components/room-loading.tsx
- [ ] **DT9 (P3, human: ~15min / CC: 0min)** — mockup-regen — Regenerate visual mockups after OpenAI org verification
  - Surfaced by: D10 (TODO)
  - Files: (none — runs gstack designer)

---

## GSTACK REVIEW REPORT

*Last updated by /plan-design-review — 2026-05-19*

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SELECTIVE EXPANSION; 4 cherry-picks accepted (SE-1 later reversed by eng-review D1) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 13 issues found across Architecture/Code Quality/Tests/Performance, 1 critical gap (mic-sharing), 1 unresolved (outside voice) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | Focused 3-dimension review: brand 2→8/10, IA 4→8/10, recording state 2→8/10, verdict reveal 3→9/10. Mockups deferred pending OpenAI org verification. |
| Outside Voice | `codex review` | Independent 2nd opinion | 0 | — | Skipped — eng-review D14 redirected to scope expansion |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | Not applicable (not a developer-facing product) |

**SCOPE CHANGES:** Eng D1 cut presence/forfeit (1h reclaim). Eng D15 added full video+audio+Whisper (replaces text input). Net budget: ~10h vs original 7h; honestly over the 8h hackathon target. Design review locks brand identity + key interaction specs without expanding scope.

**CRITICAL GAPS:** 1 — mic-sharing browser compatibility on demo device. Mitigation: night-before test + Daily SDK pivot ready as plan B.

**UNRESOLVED:** 1 — outside voice (codex review) not run on revised plan. Run before hackathon day if time permits.

**DEFERRED:** Visual mockups (debate room mid-turn + verdict reveal) await OpenAI org verification propagation. Briefs drafted, ready to generate.

**VERDICT:** ENG + DESIGN CLEARED — ready to implement. The implementer has both architecture spec (eng review) and brand + interaction spec (design review). Start with DT1 (brand tokens) and T1 (matchmaking) in parallel worktrees.

*Generated by gstack /plan-design-review — 2026-05-19*
