# TODOS — UNSW Splash

Deferred work surfaced during `/office-hours` design + `/plan-eng-review` on 2026-05-19. Items live here when they were intentionally deferred from V1 with reasoning attached.

## V1.5 — Same-Week-as-Halftime

### `splashes_public` view (defense-in-depth privacy)

**What:** Create a Postgres view `splashes_public` that excludes `target_id` and `hunter_id` columns. Update RLS so the public `SELECT` permission applies to the view, not the base `splashes` table. `/room/halftime` subscribes to the view.

**Why:** Premise P6 promises "client-rendered V1, view-enforced V1.5." Currently the public projector subscription joins to `players` for the ticker; a malicious viewer can bypass client-side anonymization. Defense-in-depth not critical V1, but cheap to add post-Halftime.

**Pros:** Closes the only RLS-level privacy leak in the design. Makes "P6 is enforced by the DB" a true statement.

**Cons:** Requires `splashes` SELECT to be revoked from public and granted on the view instead. Minor migration.

**Context:** Carried forward from design Reviewer Concern #1. Was non-blocking for V1.

**Estimated effort:** ~30 min.

**Depends on:** Splash ticker confirmed working with current RLS (i.e., after V1 ships).

---

### iPhone Audio Low-Power-Mode warning

**What:** Detect when the audio prime fails (the silent `.play()` rejects) and surface a one-line warning on `/play`: "Audio may not play on your device. Turn off Low Power Mode." Optional: log to Supabase for ops visibility.

**Why:** D7 audio prime works in the common case but iOS Low Power Mode throttles `play()` calls silently. Players hit by this will think the app is broken when the water sound doesn't fire.

**Pros:** Closes the silent-failure mode of D7. Players self-diagnose.

**Cons:** Adds a code branch and a logging path.

**Estimated effort:** ~20 min.

**Depends on:** D7 audio prime shipped.

---

## V2 — Post-Halftime Candidates

### DevSoc Freerooms safe-zone integration (Approach B)

**What:** Integrate the DevSoc GraphQL API to read active class timetables. Buildings with ongoing classes become safe zones — players inside cannot be splashed. Add a `safe_zones` Postgres view that derives polygons from the API + a server-side check inside `splash` RPC.

**Why:** "Active classes = sanctuary" gives the game tactical depth — players retreat to libraries mid-class for safety. Codex named this and the audience-as-gamemaster as the "playable spectacle" stretch.

**Pros:** Tactical complexity. Real DevSoc data integration. Demo-able for an event run as a club showcase post-Halftime.

**Cons:** API access + rate limits unverified. ~30-40h of work. Need a polling cron to refresh safe zones every 10 min.

**Context:** Cut from V1 in office-hours design. Listed as Approach B (DEFERRED) in design doc.

**Estimated effort:** ~30-40h.

**Depends on:** DevSoc GraphQL API approval + rate-limit confirmation. Probably also depends on a real-club partnership for the post-Halftime event.

---

### Audience-as-gamemaster finale (Approach B continued)

**What:** During the 60s finale, audience members scan a `/audience-vote` QR and vote N/S/E/W to compress the play area every 15s. Finalists physically pushed toward the center as the safe area shrinks.

**Why:** Codex named this as the "playable spectacle not a demo" hook. Audience becomes active participant; the finale becomes a multi-actor moment.

**Pros:** Adds a "wow" beat to the finale. Audience engagement.

**Cons:** Requires a second device flow (audience QR), an additional realtime channel (vote tallying), and a UI for the finalists to see the closing zone.

**Estimated effort:** ~12-20h.

**Depends on:** Successful V1 Halftime run; venue space large enough for compression to mean something.

---

### Anonymous Hunters mode (Approach C)

**What:** Radically anonymous variant: no display names, hunter identity unknown until splash, obituary feed on elimination, mass identity reveal at finale.

**Why:** Different emotional arc — paranoia + reveal theatre instead of race theatre. Same effort tier as V1 (`~30-40h`).

**Pros:** Strong privacy story. Different demo posture suitable for non-Halftime venues (e.g., a launch party).

**Cons:** Doesn't double as the Halftime demo; would be a separate product direction.

**Context:** Listed as Approach C (DEFERRED) in design doc.

**Estimated effort:** ~30-40h.

**Depends on:** Decision that the V2 product is paranoia-themed rather than race-themed.

---

### Photo capture (reverses V1 cut)

**What:** Re-add the mobile camera capture to `/join`. Replace the deterministic HSL avatar color with a real selfie. Storage RLS to scope photos to game_id.

**Why:** V1 cut this to save 4-6h. Photos make the reveal moment stronger ("oh wait, I splashed THAT person"). Without photos, the avatar is initials + color — recognizable but less personal.

**Pros:** Stronger emotional payoff at elimination + finale reveal. Aligns design with the original spec.

**Cons:** Mobile camera API + Storage RLS work. Privacy concerns about photos of students stored on Supabase (consent + retention rules from D13 expand to photos).

**Estimated effort:** ~4-6h core + ~1h on RLS + consent copy update.

**Depends on:** D13 consent + retention policy extended to cover photos.

---

### `splice_cycle` primitive refactor (DRY)

**What:** Extract a shared internal Postgres function `_splice_cycle(remove_id uuid?, insert_id uuid?, paradox_handler text?)` that splash, admin_mark_dead, admin_undo_splash, and join_game (live-splice path) all call.

**Why:** D18 #10 — these 4 RPCs all mutate the same cycle structure with similar lock + edge-replacement logic. After D10 tests reveal duplication, consolidate so a bug fix in one path propagates.

**Pros:** One source of truth for cycle mutations. Test surface shrinks.

**Cons:** Premature without the test suite revealing the actual shape of duplication. Forcing it early risks over-abstracting around an incomplete picture.

**Context:** Deferred from D18. Run after D10 tests are green and the duplication is visible.

**Estimated effort:** ~1-2h.

**Depends on:** D10 (RPC test suite) shipped and revealing the duplication.

---

### Hard fence on UNSW boundary

**What:** Make the campus boundary an enforced no-go zone instead of a soft warning. Players outside the polygon are auto-marked dead (or blocked from heartbeating, so they ghost-alive at 20min).

**Why:** V1 ships soft warning + map fade only. Open Question in design. A hard fence prevents abuse (running to an off-campus cafe to evade) but punishes players who briefly cross a boundary (e.g., picking up coffee on Anzac Pde).

**Pros:** Stronger campus-bound game feel. Codex called the boundary a structural question.

**Cons:** Punishes accidental crossings. Adds a heartbeat-validation branch.

**Estimated effort:** ~1h.

**Depends on:** V1 boundary-soft-warning shipped + observed.

---

### Anti-cheat for production

**What:** Server-side rate limit on `heartbeat` (max 1 call / 4s per player). GPS sanity checks (reject heartbeats with `accuracy_m > 50` or location-jump > 100m in <10s). Optional: device-attestation via WebAuthn for the door check-in.

**Why:** Reviewer Concern #5 explicitly says "trust-the-client; never accept for production." Required before any non-hackathon launch.

**Pros:** Closes obvious cheat vectors (GPS spoofing, heartbeat spam).

**Cons:** Real engineering effort. Will reject some legitimate readings (e.g., a player who teleports between cell-tower triangulation snapshots).

**Estimated effort:** ~4-8h.

**Depends on:** Decision to run a public V2 event.

---

### Safety + harassment policy

**What:** Print a half-page safety card. Add a one-tap withdraw button on `/play`. Add a `mobility_relaxed` flag on `players` that relaxes proximity threshold to 30m for wheelchair / cane users.

**Why:** D16 explicitly skipped this for V1. For any post-Halftime run, the safety posture needs to be real.

**Pros:** Makes the game accessible. Gives players agency to leave. Documents the "stop means stop" rule.

**Cons:** Adds card-printing logistics + a withdraw RPC + accessibility code branch.

**Estimated effort:** ~1.5h code + ~30 min card design.

**Context:** Carried forward from D16 explicit accepted risk in V1.

**Depends on:** Decision to run the game again post-Halftime.
