# DebateConnect

> Omegle meets poker — for arguments. Two strangers get matched on live video, both stake credits, argue out loud, and an AI judge decides who wins. The better your argument, the richer you get.

This repository hosts two hackathon projects. **DebateConnect** is the V1 we're shipping for halftime; see `docs/debate-connect/PLAN.md` for the full design doc and `docs/debate-connect/TODOS.md` for V2 follow-ups.

## Stack

- **Next.js 16** (App Router) on Vercel Fluid Compute
- **Daily.co** prebuilt iframe for live video
- **MediaRecorder + OpenAI Whisper** for per-turn audio transcription
- **Anthropic Claude (haiku-4-5)** for prompt generation + streamed AI judgment
- **Pusher** for matchmaking + judgment broadcast
- **Upstash Redis** for queue + room state (TTL 2h)
- **localStorage** for sessionId + fake credit balance (V1)

See `docs/debate-connect/PLAN.md` for the full architecture diagram.

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values. Required for the live debate path:

| Var | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Room state + matchmaking queue |
| `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` / `PUSHER_CLUSTER` | Server-side broadcast |
| `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` | Client-side subscribe |
| `ANTHROPIC_API_KEY` | Prompt generation + AI judge |
| `OPENAI_API_KEY` | Whisper transcription |
| `NEXT_PUBLIC_DAILY_SUBDOMAIN` | Video iframe origin (`<subdomain>.daily.co`). See "Daily.co rooms" below. |
| `ADMIN_SECRET` | Required by `POST /admin/seed` (`x-admin-secret` header) |

Supabase vars in `.env.example` are unused in V1 (auth is a V2 follow-up).

## Daily.co rooms

The debate room iframe hits `https://{NEXT_PUBLIC_DAILY_SUBDOMAIN}.daily.co/{roomId}` and relies on Daily's **auto-create** behavior — the first visitor to a room URL implicitly creates it. This works out of the box on new Daily accounts.

If your subdomain has auto-create disabled or you see "Room does not exist", you have two options:

1. **Recommended for hackathon:** flip auto-create back on in the Daily dashboard at *Domains → Settings → Privacy → Allow room creation on the fly*.
2. **Server-side pre-create:** add a `DAILY_API_KEY` and call `POST https://api.daily.co/v1/rooms` from `app/api/join-queue/route.ts` immediately after generating `roomId`, before triggering the `room-ready` Pusher event. This is documented in PLAN.md as a V2 follow-up.

The video tile renders a "Video unavailable" placeholder if `NEXT_PUBLIC_DAILY_SUBDOMAIN` is unset; the audio + transcription + judgment loop still works without video.

## Local dev

```bash
npm install
cp .env.example .env.local         # then fill in values
npm run dev                        # http://localhost:3000
```

To exercise the debate path locally you need at least Pusher + Upstash + Anthropic + Daily configured. Without Daily, the video tile shows a "Video unavailable" placeholder but the rest of the loop still works.

## Tests

```bash
npm test          # vitest, 4-test smoke kit (20 assertions)
npm run lint
npm run build
```

The smoke kit covers the four silent-failure modes per `docs/debate-connect/TEST-PLAN.md`:

- `__tests__/verdict-parser.test.ts` — Zod parse, draw fallback, malformed retry
- `__tests__/matchmaking.test.ts` — atomic LPOP, no self-match, third joiner waits
- `__tests__/turn-dedup.test.ts` — idempotent submit-turn by `turn_index`
- `__tests__/state-guard.test.ts` — submit/judge state transitions

## Admin seed (demo backup path)

When stage mic conditions are uncertain, bypass the audio stack and jump straight to AI judgment:

```bash
curl -X POST $URL/admin/seed \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "prompt": "Remote work is net negative for society",
    "transcripts": [
      "Player 1 turn 1 transcript...",
      "Player 2 turn 1 transcript...",
      "Player 1 turn 2 transcript...",
      "Player 2 turn 2 transcript...",
      "Player 1 turn 3 transcript...",
      "Player 2 turn 3 transcript..."
    ]
  }'
```

Returns `{ "roomId": "...", "url": "/debate/..." }`. Open that URL and click "Request Judgment" — the rest of the demo loop runs end-to-end.

## What's not in V1

Per `docs/debate-connect/TODOS.md`, these are deferred:

- Presence/forfeit detection (cut in eng-review D1)
- Variable stake adjuster (cut in eng-review D7 — hardcoded 25 credits)
- Persistent credits across devices (localStorage only)
- Auth / accounts (Supabase wired but unused at V1)
- Mobile responsiveness (desktop demo only)
- ELO / leaderboard / spectator mode
