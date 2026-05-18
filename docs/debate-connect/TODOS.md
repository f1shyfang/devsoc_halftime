# TODOS

Post-hackathon work captured during /plan-eng-review on 2026-05-19.

## V2 — Post-Halftime

### Presence/forfeit handling (reverses CEO SE-1, cut in eng-review D1)

**What:** Implement Pusher presence channels + 60s grace timer + auto-forfeit credit transfer when a player abandons mid-debate.

**Why:** Makes the credit economy feel real when a real opponent abandons mid-debate. Required before any non-staged public launch — without it, abandonment is a free way to avoid losing credits.

**Pros:** Closes the abandonment exploit. Polishes the "real stakes" pitch. Pusher auth endpoint groundwork pays for future features (private channels, member presence).

**Cons:** Requires `PUSHER_SECRET` env var, `POST /api/pusher/auth` route, 60s timer state in Redis, forfeit state-machine transition (`in_progress` → `abandoned`), client-side reconnect grace window.

**Context:** Was approved as CEO SE-1 (SELECTIVE EXPANSION). Cut in eng-review D1 to reclaim 1h of hackathon budget when video+audio scope was added. Original CEO review flagged Pusher auth as the riskiest part — without correct setup, presence silently falls back to public channels and forfeit detection breaks invisibly.

**Estimated effort:** ~1h. (With Daily.co video already wired up, presence channel auth is the same pattern.)

**Depends on:** Persistent server-side credit storage (otherwise forfeit transfers are localStorage-only and meaningless across devices).

---

### Variable stake adjuster UI (cut in eng-review D7)

**What:** Re-add the lobby stake adjuster (slider or input). Pick a reconciliation rule: first-player-sets, `min(stake1, stake2)`, or a "do you accept this stake?" interstitial in the debate room.

**Why:** "Stakes change behavior" is a core pitch point. Variable stakes amplify the credit-economy texture. The original pitch — "the better you argue, the richer you get" — implies variable stakes exist.

**Pros:** Deeper game feel. Marquee feature for V2. Pairs naturally with leaderboards and ELO.

**Cons:** Needs server-side stake reconciliation, lobby UI, and possibly a stake-negotiation interstitial. Reconciliation rule choice has UX implications (min-stake is fair but confusing; first-player-sets is simple but unfair).

**Context:** Cut in eng-review D7. Hackathon V1 hardcodes stake to 25 credits. Lobby mockup originally showed `Stake: [25] credits, can adjust` — this becomes a static "25 credits per match" display in V1.

**Estimated effort:** ~45min.

**Depends on:** Persistent server-side credit storage (variable stakes are meaningless when localStorage resets).

---

## V2 — Post-Halftime (lower priority, already documented in plan)

- Auth / accounts (Supabase magic link is already wired in the repo)
- Persistent credit balance (server-side, replace localStorage)
- Mobile responsiveness for /debate/[id] (Daily iframe is already mobile-OK; layout polish needed)
- ELO ratings / leaderboard
- Credit purchase / top-up
- Spectator mode with live crowd voting vs AI verdict
- Topic categories (sports, politics, tech, philosophy)
- Debate leagues and brackets
- Judge prompt eval suite (currently no quality measurement on verdict outputs)

## Design follow-ups (from /plan-design-review on 2026-05-19)

### Regenerate visual mockups after OpenAI org verification

**What:** After OpenAI org verification propagates (submit at platform.openai.com/settings/organization, ~15min for propagation), regenerate the 2 high-stakes mockups using the design briefs already drafted:
- Debate Room mid-turn (video-dominant layout, magenta accent, Playfair prompt banner, pulsing record dot)
- Verdict reveal mid-stream (streaming prose, split-screen scoreboard, counter-tick credit delta)

Run `~/.claude/skills/gstack/design/dist/design variants --brief "..." --count 3 --output-dir ~/.gstack/projects/f1shyfang-devsoc_halftime/designs/<name>-$(date +%Y%m%d)/`. After approval, run `$D extract --image <approved.png>` to seed DESIGN.md with tokens.

**Why:** Plan has detailed text specs but no visual reference. Mockups catch micro-decisions the implementer would otherwise guess (exact type sizes, spacing, magenta saturation, video tile aspect ratios).

**Pros:** Closes the visual-reference loop. DESIGN.md extraction seeds V2 design work. ~10min of generation effort once unblocked.

**Cons:** Blocked on OpenAI org verification (out of your hands). Image generation costs ~$0.30 for 6 variants.

**Context:** Eng review D14 was redirected to scope expansion (D15 video+Whisper). Design review D2/D3 deferred mockups because OpenAI org verification was missing. Briefs are already drafted in the design review conversation history — don't re-write them, reuse.

**Estimated effort:** 10min generation + 5min `extract` once unblocked.

**Depends on:** OpenAI org verification at platform.openai.com/settings/organization.

---

## Refactors / tech debt

- Move magic numbers (turn duration 45s, turn count 3, default stake 25, room ID length 6) into `lib/config.ts`. Currently scattered across handlers and components. Low priority — only matters when game balance is being tuned.
- Standardize API error response shape across all routes: `{ error: { code: string, message: string, retryable: boolean } }`. Currently each handler returns its own shape.
