# UNSW Quest — Product Requirements Document

**Version:** 1.0 (Draft)
**Status:** v1 scope locked, demo-targeted
**Date:** May 2026
**Owner:** [Project lead]

---

## TL;DR

**UNSW Quest is a location-based scavenger hunt game where teams of friends race around the UNSW Kensington campus solving riddles tied to real places, racing each other in real time, and finishing with a shareable photo highlight reel.**

v1 is a curated demo experience: two pre-built hunts (one full, one mini), self-formed teams via invite code, GPS-based checkpoint verification with QR code variants, and a live leaderboard. Built on React Native + Expo with a Supabase backend. Designed to demo end-to-end in 60–75 minutes, with a 15-minute mini-hunt for live presentations.

Long-term, the business model is **society sponsorship**: clubs, faculties, and external brands pay to host branded hunts during O-Week, recruitment events, and faculty mixers. v1 is free for players, with no monetisation infrastructure.

---

## 1. Problem & Opportunity

### 1.1 The Problem

UNSW has 60,000+ students spread across a campus most never fully explore. O-Week onboarding is overwhelming and forgettable. Society events struggle to differentiate from "let's grab drinks at the Roundhouse." Friend groups have nothing to do together on campus beyond eating and studying. The campus itself — its weird buildings, hidden corners, statues, faculties — is underused as a social setting.

Existing options fail in specific ways:

- **Generic scavenger hunt apps** (Goosechase, Actionbound) are designed for corporate team-building, not student culture. They're paid, generic, and don't know what the Red Centre is.
- **Pen-and-paper society hunts** (which some clubs run at O-Week) require enormous organiser effort and don't scale. No live leaderboard, no real verification, no replayability.
- **Pokémon Go-style location games** treat campus as incidental and don't engage with its actual content (buildings, statues, faculty culture).

### 1.2 The Opportunity

A campus-native, social-first treasure hunt experience that:

- Treats UNSW's specific places, history, and culture as the game content.
- Is designed for friend groups (2–6 people) playing live together, not solo.
- Plugs into the existing social rhythm: O-Week, society recruitment, faculty mixers, "what should we do on a Friday afternoon."

UNSW Quest's wedge is **O-Week**: a captive audience of 8,000+ freshers, low competition for their attention, and high downstream value (a fresher who plays in week 1 is a society customer for the next four years).

---

## 2. Target Users

### 2.1 Primary Personas

**The Friend Group (core unit of play)** — 2–6 UNSW students, undergrads, ages 18–22, already in a group chat together. They play hunts for fun on a Friday afternoon, as a society event, or because someone in the group keeps suggesting it.

**The Fresher (O-Week launch wedge)** — Brand new to campus, alone or in a tutorial group of strangers. Doesn't know where the Library is, let alone the Mathews Theatres. Plays UNSW Quest because their O-Week leader put it in the program, or because they saw an Instagram story of someone's results card.

**The Society Organiser (v2 customer)** — Exec member of CSES, MedSoc, Law Soc, ENGSoc, etc. Plans recruitment events. Currently does scavenger hunts on paper or via Google Forms. Will pay (in v2) to run a branded hunt with live verification and a leaderboard.

### 2.2 Jobs To Be Done

- **"Help me do something fun with my friends on campus that isn't eating or drinking."** (Friend Group)
- **"Help me feel less lost in week one."** (Fresher)
- **"Help me run a memorable recruitment event without spending three weekends planning."** (Society Organiser — v2)

---

## 3. Strategic Positioning

UNSW Quest is **a social game with O-Week as its launch wedge**, not a campus utility or an onboarding tool.

The product is defensible because:

1. **It owns the social moment**, not the information layer. Google Maps already knows where the Library is; UNSW Quest knows it's the most romantic clue location on campus.
2. **The viral loop is built into gameplay**: photo challenges become shareable results cards; results cards drive new signups.
3. **The B2B angle (society sponsorship) creates a moat over time** — the more clubs use the platform, the harder it is to dislodge.

Explicit non-strategy: UNSW Quest is **not** trying to be Pokémon Go, Citymapper, or a campus utility app. Those framings get rejected throughout this document.

---

## 4. Goals, Non-Goals & Success Metrics

### 4.1 v1 Goals

1. Deliver a polished, demo-ready playable product that completes the full hunt loop end-to-end.
2. Two playable hunts: one 60–75 min "hero" hunt, one 15–20 min "mini" hunt.
3. Teams of 1–6 can self-form via invite code and play synchronously.
4. Real-time leaderboard updates within 2 seconds of an unlock event.
5. End-of-hunt produces a shareable results card that looks good enough to post.

### 4.2 v1 Non-Goals (Explicit)

- AR object hunts
- Sabotage mechanics
- Push notifications during a hunt
- Society creator tools (UGC hunt building)
- Auto-matchmaking for solo joiners (UI gestured, behaviour deferred)
- Casual Explore / Horror Night / Freshers Survival as distinct modes (these are *themes* of future hunts, not separate engines)
- Fog-of-war map discovery
- Cipher / morse / typed-answer puzzles
- Persistent teams (re-formed per hunt in v1)
- Pause/resume hunts
- Offline play
- In-app team chat

### 4.3 Success Metrics

**Demo-quality bars (v1 acceptance criteria):**

- Hero hunt completable end-to-end by a 4-person team in 60–75 minutes, validated by ≥3 full playtests with fresh testers.
- Mini hunt completable in 15–20 minutes by a 1–4 person team, validated by ≥2 playtests.
- Real-time leaderboard latency p95 under 2 seconds (clue unlock → other teams see the update).
- Results card generation completes in <3 seconds and renders correctly on iOS and Android.
- Manual "I'm here" override never visible in <2 minutes of GPS dwell time (no premature escape hatch).
- Zero crashes during a 30-minute demo run.

**Product metrics to instrument (for post-launch evaluation):**

- Hunt completion rate (started → finished without abandonment)
- Average team size
- Hints used per hunt (target: 2–4 — high enough to indicate engagement with hard clues, low enough to indicate clue quality)
- Results card share rate (% of completed hunts that tap "Share")
- Day-7 return rate (played a 2nd hunt within 7 days)

---

## 5. The Core Experience

### 5.1 First-Run User Journey (Fresher, O-Week scenario)

1. Friend sends invite link via iMessage: "join my UNSW Quest team — code K7BX2P"
2. Tap link → App Store (or downloaded already) → open app.
3. **Onboarding carousel** (3 screens): "What is UNSW Quest" / "How a hunt works" / "Sign in with email."
4. Magic link sent to email; one tap to verify.
5. Display name + initials avatar captured.
6. **Home screen** loads. Empty state shows a "Join with code" prominent CTA.
7. Tap "Join" → enter `K7BX2P` → drop into team lobby.
8. Wait for leader to start.
9. Countdown 3 — 2 — 1 — first clue appears.

### 5.2 Repeat-User Journey (Friday afternoon spontaneous play)

1. Open app.
2. Home screen lists 2 available hunts: "UNSW 101" (60 min) and "Library Loop" (15 min).
3. Tap "Library Loop" → hunt detail screen.
4. Tap "Start" → "Create team" → invite code generated.
5. Share code via system share sheet to group chat.
6. Friends join lobby one by one.
7. Leader taps "Start Hunt" → countdown → first clue.

### 5.3 The Hunt Loop (the core gameplay)

For each clue:

1. **Clue card displays** (text riddle or image clue).
2. Team reads, discusses, decides on the answer.
3. **Optional**: tap lightbulb to spend a hint (+60s final time).
4. Team physically walks to the location.
5. Within geofence (or QR scan, depending on clue) → **unlock animation** + haptic + sound.
6. If photo challenge attached → camera UI opens → group photo captured → saved to reel.
7. Next clue appears.

Repeat for 3 clues. Tier 1 complete → tier transition animation → Tier 2 begins. Repeat. Tier 3 ends at the **shared finale location** (Library Lawn) → confetti → results screen.

### 5.4 Tier Structure (Hero Hunt)

- **Tier 1 (warm-up):** 3 clues, mid-difficulty, geographic cluster around Quad / Library.
- **Tier 2 (spread):** 3 clues, harder, spread to Law / Arc / Physics Lawn.
- **Tier 3 (finale):** 3 clues, last one converges all teams at Library Lawn.

Teams cannot unlock Tier 2 until **all 3 Tier 1 clues are solved.** Same for Tier 3. This creates checkpoint convergence — the social moments where teams glimpse each other and tension spikes.

---

## 6. Functional Requirements

### 6.1 Authentication & Identity

- **Sign-in method:** email magic link via Supabase Auth.
- **UNSW verification:** automatic check on email domain (`@*.unsw.edu.au` or `@student.unsw.edu.au`). Verified users display a "✓ UNSW Student" badge throughout the app.
- **Profile:** display name (editable), initials avatar on coloured circle (auto-generated, no upload).
- **No passwords. No phone numbers. No social sign-in (Google/Apple) in v1.**

### 6.2 Hunt Browse & Detail

- **Home screen:** lists available hunts as cards. Each card: hunt name, hero image, estimated duration, difficulty indicator, "Play" CTA.
- **v1 cards displayed:** 2 real hunts ("UNSW 101", "Library Loop") + 3–4 "Coming Soon" cards (Horror Night, Engineering Mile, etc.) to gesture at future content.
- **Hunt detail screen:** larger hero image, description (2–3 sentences), duration, recommended team size, sample clue (teaser), "Start" CTA.

### 6.3 Team Formation

- **Two paths on "Start":** Create Team / Join Team.
- **Create Team:** generates a 6-character alphanumeric invite code (uppercase, no ambiguous chars — no `0`/`O`/`1`/`I`). Leader can edit team name (default: `Team K7BX2P`).
- **Join Team:** enter 6-character code → drops into lobby.
- **Lobby screen:** team name, member list with avatars, hunt summary, "Start Hunt" button (visible to leader only).
- **Solo play allowed**: a team of 1 can start. Display a soft nudge: "Treasure hunts are better with friends — share your code."
- **Auto-matchmaking button visible but disabled** with "Coming soon" pill (placeholder for v1.5 capability).
- **Hard cap:** 6 members per team.

### 6.4 The Clue Experience (Primary Screen)

- **Clue card dominates the screen.** Text riddle (or image, displayed full-width) at the top. Hint button (lightbulb icon) and map button below. Verification CTA at the bottom (varies by clue type).
- **For text riddles:** clue text in large, readable typography. No flourishes that distract from the puzzle.
- **For image clues:** image fills 60% of the screen; below it, instruction text ("Find this place on campus").
- **Map button:** opens a secondary map view showing the geofence ring around the target location and the team's blue dot. Designed to be glanceable, then dismissed.
- **Geofence ring is visible** on the map so players understand "how close is close enough" — prevents the confusion of "I'm right next to it, why won't it unlock."

### 6.5 Verification Mechanisms

Each clue specifies a `verification_type`:

- **`gps`** — Default. Player within `geofence_radius` (default 25m, configurable per clue) for ≥3 seconds → unlock. Auto-unlock fallback: within 50m for ≥45s with reported GPS accuracy >20m.
- **`qr`** — Physical QR code placed at the location. Player opens scanner from clue card → scans → unlock. Used for 2–3 high-emotion clues per hunt (e.g., a specific bench, a plaque). Setup: printed laminated codes, placed before the demo, retrieved after.
- **`gps_plus_photo`** — GPS unlocks the clue; photo challenge appears as a non-blocking prompt. Photo is captured, stored, displayed in the highlight reel. Skipping the photo does not block progression.

**Manual override:** "Stuck? Mark as arrived" button appears after 2 minutes of GPS dwell time at the same approximate location without unlock. Records `manual_override: true` on the clue progress.

### 6.6 Hint Mechanics

- **2 hints per clue**, both available immediately, no waiting period.
- **Cost:** +60 seconds added to the team's final clock per hint used (configurable per hunt for future tuning).
- **Hint 1:** subtle nudge (disambiguates the riddle).
- **Hint 2:** explicit category (narrows to building/area).
- **Confirmation dialog** before spending a hint: "Use a hint? +60 seconds added to your final time."
- **No third hint, no skip button.** After hint 2, options are: keep thinking, use manual override, or quit.

### 6.7 Live Leaderboard (Visible Race)

- **Always-visible, collapsible component** during a hunt. Displays each team in the current hunt with: team name, current tier/clue progress (e.g., "Tier 2, clue 5 ✅"), elapsed time.
- **Updates in real time** via Supabase realtime channel subscribed to `hunt_session` table changes filtered by `hunt_id`.
- **No team-to-team chat. No map dots showing other teams' positions.** Rival teams exist as numbers on a leaderboard, never as locations.
- **Toast banner** on key events: "🏃 Team B unlocked Tier 2!" (in-app only, no push).

### 6.8 Finale Experience

On Tier 3 final-clue unlock:

1. **Celebration animation:** confetti, "🎉 You finished UNSW 101!", final time displayed prominently.
2. **Results screen:** time, rank ("2nd of 7 teams"), 1st-place badge if applicable, breakdown stats (hints used, manual overrides, photos captured, distance walked).
3. **Highlight reel:** swipeable carousel of the team's photo challenge captures, each captioned with the challenge prompt.
4. **Shareable results card:** server-side-generated 9:16 PNG containing hunt name, team name, time, rank, hero photo, UNSW Quest brand mark. "Share" → system share sheet.
5. **CTAs:** Play again / View leaderboard (per-hunt) / Done.

### 6.9 Notifications

- **In-app (during hunt):** haptic + sound on clue unlock; toast banner on rival team tier-completion events; tier transition animation between tiers.
- **Push notifications:** only for invite received ("Alice invited you to a UNSW Quest team"). No push during active hunt (battery, permission friction, attention).
- **No email notifications.**

### 6.10 Onboarding (First-Run)

- **3-screen welcome carousel** (skippable): "Race campus puzzles with friends" / "Solve clues, walk there, unlock the next" / "Sign in to play."
- **Sign-in screen:** email field → magic link sent → tap link in mail app → returns to app authenticated.
- **Display name + avatar capture:** one screen, both fields.
- **First-hunt UX:** tooltip overlay on the clue card showing the lightbulb (hints) and map button. Dismissed on first tap.
- **No mandatory tutorial hunt.** The mini hunt ("Library Loop") functions as a soft tutorial because it's short and uses every mechanic.

---

## 7. Non-Functional Requirements

### 7.0 Platform & Form Factor

UNSW Quest is **mobile-first by design.** All UI/UX is built for a phone in portrait orientation as the primary form factor. Tablet, desktop, and landscape layouts are out of scope for v1 — they may render but are not designed or tested against.

### 7.1 Performance

- App launch to home screen: <2 seconds on iPhone 12 / Pixel 6 or equivalent.
- Clue card render after unlock: <500ms.
- Realtime leaderboard update propagation: p95 <2 seconds.
- Results card generation: <3 seconds.

### 7.2 Reliability

- All hunt state is server-authoritative. No critical state lives only on the client.
- Disconnect/reconnect during a hunt: state syncs automatically on resume; player drops back into current clue without loss.
- Idle abandonment: no clue-progress events for 30 minutes → mark hunt session `abandoned`. No leaderboard entry. Recoverable on app re-open (warn user that 30 minutes have passed and ask to continue or quit).

### 7.3 Accessibility

- **Colour-blind safe palette** — never use red/green alone to signal state (e.g., geofence proximity uses radius + numeric distance, not just colour).
- **VoiceOver / TalkBack labels** on all interactive elements.
- **Dynamic text sizing** respected (clue card text scales with system setting).
- **High-contrast mode** deferred to v1.5.
- **Motor accessibility:** no required gestures more complex than tap. No required time-pressure interactions (everything has a 5+ second tolerance window).

### 7.4 Privacy & Data

- Location data is sampled only while the app is in a hunt. Not collected on home/lobby/results screens.
- Photo captures stored in Supabase Storage with row-level security; visible only to team members of the originating team.
- Results cards stored in a public bucket (intended to be shareable URLs) — but only contain non-sensitive aggregate info (time, rank, hunt name, team name, one photo).
- No third-party analytics or advertising SDKs in v1.
- Privacy policy linked from sign-in and settings.

---

## 8. Technical Architecture

### 8.1 Stack

- **Frontend:** React Native + Expo (managed workflow). Target iOS 16+ and Android 11+.
- **Maps:** Google Maps SDK via `react-native-maps`.
- **Location:** `expo-location` for GPS + geofencing.
- **Camera:** `expo-camera` for photo challenges and QR scanning.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions + Realtime).
- **Hosting:** Supabase managed cloud for v1; self-host option preserved.

### 8.2 Data Model (Core Entities)

```
users
  id (uuid, FK to auth.users)
  display_name
  avatar_color
  unsw_verified (bool)
  created_at

hunts
  id (uuid)
  name
  description
  hero_image_url
  duration_minutes
  recommended_team_size
  status (draft / published / archived)
  created_at

clues
  id (uuid)
  hunt_id (FK)
  tier (1 | 2 | 3)
  sequence_in_tier (1 | 2 | 3)
  type (riddle | image_clue)
  body_text
  image_url (nullable)
  verification_type (gps | qr | gps_plus_photo)
  location_lat
  location_lng
  geofence_radius_m
  qr_code_payload (nullable)
  photo_challenge_prompt (nullable)
  hints jsonb  -- array of 2 hint strings

teams
  id (uuid)
  invite_code (6-char alphanumeric, unique)
  name
  leader_user_id (FK)
  created_at

team_members
  team_id (FK)
  user_id (FK)
  joined_at

hunt_sessions
  id (uuid)
  team_id (FK)
  hunt_id (FK)
  state (lobby | in_progress | completed | abandoned)
  started_at
  completed_at
  total_time_seconds (calculated)
  hint_penalty_seconds (sum of hint costs)
  current_tier
  current_clue_sequence

clue_progress
  hunt_session_id (FK)
  clue_id (FK)
  unlocked_at
  hints_used (0 | 1 | 2)
  manual_override (bool)
  photo_capture_url (nullable)
```

### 8.3 Realtime Architecture

- One Supabase realtime channel per active hunt, scoped to `hunt_id`.
- All clients in any team in that hunt subscribe.
- Server publishes events on `clue_progress` insert/update.
- Leaderboard component renders from this stream + initial `hunt_sessions` query.

### 8.4 Edge Functions

- `generate_results_card(hunt_session_id)` — server-side image generation (PNG) using a template. Triggered on hunt completion. Returns a public URL.
- (Future) `assign_solo_to_team(user_id, hunt_id)` — matchmaking logic for v1.5.

### 8.5 Row-Level Security (RLS)

- `team_members`: users can read rows where they are members; can insert via invite-code flow (enforced via Edge Function).
- `clue_progress`: readable to team members of the session's team; insertable only by team members.
- `clues`: readable to authenticated users **only after** the prior clue in the same hunt is unlocked for their session. Enforced via RLS policy joining `clue_progress`.
- `hunt_sessions`: aggregate fields (`current_tier`, `total_time_seconds`) readable by all authenticated users for leaderboard; full row readable to team members only.

---

## 9. Edge Cases & Error Handling

| Scenario | Behaviour |
|---|---|
| GPS permission denied | Hard-block. Full-screen "We need your location to play" with "Open Settings" CTA. |
| GPS accuracy poor (>20m) | Auto-unlock if within 50m for ≥45s. |
| Player stuck on clue >2 min at location with no unlock | "Stuck? Mark as arrived" button appears. Recorded as `manual_override: true`. |
| Network drops mid-hunt | "Reconnecting..." overlay. State syncs on recovery. Hunt continues. |
| One team member's phone dies | Other members continue. Any member can unlock clues (no leader-locked actions after hunt starts). |
| Team idle 30+ min | Session marked `abandoned`. User prompted on next app open: "Continue this hunt or quit?" |
| Player force-quits and reopens | Drops back into current clue with full state. |
| Team rage-quits | No formal quit flow. Closing the app and not returning = abandonment after 30 min. |
| Two teams unlock same clue simultaneously | Both unlocks recorded with timestamps. Leaderboard sorts by elapsed time, not unlock order. |
| Invite code collision | Codes are 36^6 = 2.1 billion combos; collisions ignored statistically. Database constraint catches the impossible case and re-rolls. |
| Photo challenge skipped | Allowed. No penalty. Reel just shows fewer photos. |

---

## 10. Roadmap

### v1 (Current — Demo Target)

Everything described above.

### v1.5 (First Iteration Post-Demo)

- **Auto-matchmaking** for solo joiners (replace the disabled button with real logic).
- **Cipher / morse code puzzles** (typed-answer input UI).
- **QR-scan-to-join-team** (faster in-person lobby formation).
- **Hint cost tuning** based on playtest data.
- **High-contrast accessibility mode.**

### v2 (Real Product, Not Just a Demo)

- **Society creator tools** — verified Arc clubs build hunts via a creator UI (constrained to known-good clue types).
- **Scheduled events** — society hunts at specific times, registration flow, lobby countdown.
- **Push notifications** for event reminders, "your team is starting in 10 min."
- **Sabotage mechanics** — once core race is proven, layer competitive interactions.
- **Persistent teams** — same friend group plays multiple hunts together with shared history.
- **Casual Explore mode** — fog-of-war discovery for non-race exploration.

### v3 (Scaling & Monetisation)

- **Society sponsorship platform** — branded hunts, sponsorship analytics, payment flow.
- **Multi-campus expansion** — same engine, different content packs (USyd Quest, UQ Quest).
- **Horror Night and other themed seasons** — themed hunt drops timed to academic calendar.
- **Society Pro tier** — paid feature set for active hunt-running clubs.

### Explicitly Never (Anti-Roadmap)

- In-app advertising banners
- Pay-per-hunt for players
- Subscription tier for players
- Selling user data
- AR object hunts (cost / benefit will never justify it)

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| GPS unreliability ruins demo | High | Generous geofences (25m default), auto-unlock fallback, manual override. Outdoor checkpoint selection. |
| One bad clue tanks player experience | High | Mandatory ≥3 playtests per hunt before lock. Watch for confusion patterns. Rewrite anything that consistently stumps testers without being intentionally hard. |
| Results card looks generic / not shareable | Medium | Treat as a real design task. Spend a day in Figma. Don't ship if it's ugly. |
| Demo audience doesn't have a UNSW email | Medium | Any-email auth (already locked). Pre-seeded grader account as fallback. |
| Real-time leaderboard latency embarrassing | Medium | Supabase realtime is generally fast; budget time to load-test with 4+ teams before demo. |
| QR codes get torn down between demo runs | Low | Laminate. Place strategically (not at eye level on heavily-trafficked walls). Have spares. |
| Cold start: nobody else is playing | Low (for demo) | Demo runs with pre-arranged teams. Production-cold-start is a v2 problem. |
| iOS / Android divergence | Medium | Build with Expo managed workflow to minimise platform-specific code. Test on both throughout. |

---

## 12. Open Questions (To Resolve Before Build)

1. **Project context:** team size, timeline, deadline, deliverable format. PRD is currently written assuming a 2–4 person team over 6–10 weeks producing a working demo + supporting documentation. Confirm or override.
2. **Specific clue content** for "UNSW 101" hero hunt (9 clues, locations, riddles, hints). Design exercise to be completed in a separate document; this PRD specifies the schema and gameplay only.
3. **Brand & visual identity:** logo, colour palette, typography. Currently undefined.
4. **Demo environment:** will the demo include a live in-person hunt walkthrough? A recorded video? Both? Shapes content priorities.
5. **Hint cost tuning:** 60 seconds is a guess. Validate via playtest; reserve right to adjust before launch.

---

## 13. Appendix

### 13.1 Example Clue Content (Indicative, Not Final)

**Library clue (text riddle)**
- Body: *"I hold thousands of worlds but never leave my shelf."*
- Location: UNSW Library (Main).
- Hint 1: *"Think about what holds worlds you can travel to."*
- Hint 2: *"You'll find it where students go to study."*

**Law building clue (text riddle)**
- Body: *"Future arguments are born here."*
- Location: Law Building.
- Hint 1: *"What kind of profession argues for a living?"*
- Hint 2: *"Look for the faculty named after a courtroom skill."*

**Arc Precinct clue (text riddle)**
- Body: *"Where clubs recruit and free pizza appears."*
- Location: Arc Precinct.
- Hint 1: *"Think about the central student hub."*
- Hint 2: *"Where societies gather to sign people up."*

**Red Centre clue (image clue)**
- Image: cropped photo of a distinctive Red Centre architectural feature.
- Instruction: *"Find this building."*
- Hint 1: *"Engineering students see this every day."*
- Hint 2: *"Cube-shaped, brick-red, in the southern half of campus."*

**Photo challenge example**
- Prompt: *"Recreate the Einstein pose near the Physics Lawn."*
- Linked to a Tier 2 clue ending at the Physics Lawn.
- Non-blocking: clue unlocks regardless of photo.

### 13.2 Glossary

- **Tier** — One of 3 stages in a hunt. Each tier contains 3 clues. Cannot unlock the next tier until all current-tier clues are solved.
- **Clue** — A single puzzle pointing to a campus location. Solving = arriving and verifying.
- **Verification** — The mechanism that confirms a player is at the clue's location (GPS, QR, photo).
- **Geofence** — A circular region around a clue's location. Player within this region triggers GPS unlock.
- **Hint** — Optional disambiguation for a clue, costs +60s on final time.
- **Override** — Manual "I'm here" confirmation when GPS fails. Recorded but does not penalise.
- **Hunt session** — One team's instance of playing one hunt. Has a state (lobby / in_progress / completed / abandoned).
- **Hero hunt** — The flagship hunt ("UNSW 101"); 9 clues, 3 tiers, ~60–75 min.
- **Mini hunt** — Compressed hunt ("Library Loop"); 3 clues, 1 tier, ~15–20 min. Demo-friendly.

---

*End of PRD v1.0*
