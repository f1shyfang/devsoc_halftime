# UNSW Quest — Clue Content v1

**Version:** 1.0 (Draft)
**Status:** Content draft for playtest
**Date:** May 2026
**Companion to:** [PRD v1](./PRD_v1.md) — resolves Open Question §12.2 (clue content for hero + mini hunts)

---

## How to read this doc

Each clue block specifies everything needed to seed the `clues` table per the schema in PRD §8.2:

- **Location** — physical landmark on UNSW Kensington campus.
- **Riddle / body** — the text that appears on the clue card.
- **Verification** — `gps`, `qr`, or `gps_plus_photo`. Default geofence radius is 25m; overrides noted where relevant.
- **Hint 1 / Hint 2** — disambiguation (Hint 1 subtle, Hint 2 explicit category, per PRD §6.6).
- **Photo challenge** — non-blocking prompt for `gps_plus_photo` clues.
- **Designer notes** — playtest watch-points and pacing rationale.

Every riddle is paired with **one alternate** in the puzzle bank (§4), so we can swap if a playtest reveals a clue that consistently stumps or bores testers.

---

## 1. UNSW 101 — Hero Hunt (9 clues, ~60–75 min)

Tier structure per PRD §5.4. Geographic flow is **upper campus → south spread → reconverge at Library Lawn**.

### Tier 1 — Warmup (Quad / Library cluster)

Difficulty: easy. Goal: get every team to feel a unlock within the first 10 minutes.

---

**Clue 1.1 — The Library (main entrance)**

- Location: Main Library, front doors. (`-33.9173, 151.2313` approx.)
- Verification: `gps_plus_photo`. Radius: 25m.
- Body:
  > *"I hold thousands of worlds but never leave my shelf. Stand at my doors and you stand where every essay deadline ends."*
- Hint 1: *"Think about what holds worlds you can travel to."*
- Hint 2: *"You'll find it where students go to study — the main one."*
- Photo prompt: *"Hold up your favourite imaginary book for a team photo at the entrance."*
- Designer notes: First clue must be unambiguous. The "imaginary book" photo is a low-cost icebreaker — gets teams used to the camera flow before a harder photo challenge later.

---

**Clue 1.2 — John Niland Scientia (the glass blade)**

- Location: John Niland Scientia Building. (`-33.9170, 151.2305` approx.)
- Verification: `gps`. Radius: 30m (wide forecourt).
- Body:
  > *"A blade of glass rises from the lawn, slicing the sky in half. Find me where every graduate poses and every thesis is defended."*
- Hint 1: *"The most photographed building on campus."*
- Hint 2: *"Glass and steel, between Library Walk and Anzac Parade."*
- Designer notes: Highly visible from the Library — teams should be able to *see* it before they finish reading the riddle. Pacing reset between the first and third clue.

---

**Clue 1.3 — The Roundhouse**

- Location: Roundhouse, main external wall. (`-33.9181, 151.2289` approx.)
- Verification: `qr`. Laminated code placed at eye level on the southern wall.
- Body:
  > *"I'm shaped like none of my neighbours. Friday nights I'm loudest, and freshers' livers fear me most."*
- Hint 1: *"Famous for trivia, gigs, and cheap drinks."*
- Hint 2: *"The circular Arc venue."*
- Designer notes: First QR of the hunt — surfaces the scanner UX while the stakes are still low. If the QR is torn down (a known risk), the manual override should be tolerated more leniently here than in Tier 3.

**Gate → Tier 2:** All three Tier 1 clues unlocked. Tier transition animation. Banner: *"You know the front lawn. Now go south."*

---

### Tier 2 — Spread (Law / Arc / Physics)

Difficulty: medium. Goal: spread teams out so the leaderboard becomes contested, not just sequential.

---

**Clue 2.1 — Law Building**

- Location: UNSW Law Building, main entrance. (`-33.9159, 151.2286` approx.)
- Verification: `gps`. Radius: 25m.
- Body:
  > *"Future arguments are born here. Every objection in this city starts in one of my classrooms first."*
- Hint 1: *"What kind of profession argues for a living?"*
- Hint 2: *"Look for the faculty named after a courtroom skill."*
- Designer notes: Clean text riddle, deliberately a beat easier than the other two Tier 2 clues so teams don't all stall in the same place.

---

**Clue 2.2 — Arc Precinct**

- Location: Arc @ UNSW (Blockhouse / Quad Lawn entrance). (`-33.9166, 151.2300` approx.)
- Verification: `qr`. Code placed at the Arc info-desk window.
- Body:
  > *"Where clubs recruit and free pizza appears. I take many forms during O-Week — bring a tote bag."*
- Hint 1: *"Think about the central student hub."*
- Hint 2: *"Where societies gather to sign people up."*
- Photo (optional, attached as bonus): *"Mock-receive a free pizza slice — even if there's no pizza there today."*
- Designer notes: This is the second QR, which means **two** of the nine clues use the scanner. If a QR is torn down, fall back to GPS verification at the same coordinates.

---

**Clue 2.3 — Physics Lawn (Einstein)**

- Location: Physics Lawn, near the Albert Einstein bust. (`-33.9176, 151.2316` approx.)
- Verification: `gps_plus_photo`. Radius: 20m (tighter — we want them at the statue, not on the path).
- Body:
  > *"He thought in pictures, dreamed in equations, and famously had his tongue out. Find the lawn that bears his thoughtful silhouette."*
- Hint 1: *"Famous physicist, famous hair."*
- Hint 2: *"Look for the bust of the relativistic German on the Physics Lawn."*
- Photo prompt (PRD example): *"Recreate the Einstein pose at the bust."*
- Designer notes: This is the **hero photo** of the hunt — almost certainly the one that ends up on the results card. Brief the Tier 2 playtest specifically on whether this photo lands.

**Gate → Tier 3:** All three Tier 2 clues unlocked. Banner: *"One tier left. The race converges."*

---

### Tier 3 — Finale (reconverge at Library Lawn)

Difficulty: harder, but locations are visually distinctive. Geographic flow brings everyone back toward the start.

---

**Clue 3.1 — The Red Centre**

- Location: Red Centre, central courtyard. (`-33.9189, 151.2305` approx.)
- Verification: `gps`. Radius: 30m (the building is enormous).
- Body (image clue): cropped photo of one of the Red Centre's distinctive brick cube corners.
  - Caption: *"Find this building."*
- Hint 1: *"Engineering students see this every day."*
- Hint 2: *"Cube-shaped, brick-red, southern half of campus."*
- Designer notes: First image clue of the hunt. Crop should be tight enough to be a puzzle, distinctive enough to be solvable. Photograph the crop *in the actual lighting* the demo will run in — early afternoon shadows look very different to morning ones.

---

**Clue 3.2 — Sir John Clancy Auditorium**

- Location: Sir John Clancy Auditorium, main entrance. (`-33.9171, 151.2295` approx.)
- Verification: `gps`. Radius: 25m.
- Body:
  > *"I host the biggest classes on campus and the loudest applause. Named for a knight who served students, not kings."*
- Hint 1: *"The largest lecture theatre on campus."*
- Hint 2: *"The round auditorium between the Quad and the Mathews Building."*
- Designer notes: Geographic bridge from Red Centre back up to Library Lawn. Pacing: should take ~6–8 minutes from the Red Centre.

---

**Clue 3.3 — Library Lawn (Finale)**

- Location: Library Lawn, centre of the grass. (`-33.9172, 151.2310` approx.)
- Verification: `gps_plus_photo`. Radius: 40m (forgiving — this is the celebration, not the puzzle).
- Body:
  > *"End where you began, but a few steps closer to the sun. Lie down on the grass and you're officially a UNSW student."*
- Hint 1: *"Where students nap between lectures."*
- Hint 2: *"The big grassy lawn outside the main Library."*
- Photo prompt (required for results card, but skippable per PRD §6.5): *"Team starfish on the grass — group photo from above, all of you flat on your backs."*
- Designer notes: Final clue must feel **earned and warm**, not difficult. Confetti, hero photo, results card. The "starfish on the grass" pose is deliberately silly because the results card needs to be share-worthy — a smiling-into-camera photo would be more generic.

---

## 2. Library Loop — Mini Hunt (3 clues, ~15–20 min)

Single tier. Designed as a live-demo hunt for presentations and as a soft tutorial (PRD §6.10). Each clue exercises a different verification type so the audience sees every mechanic.

---

**Clue M.1 — The Library entrance**

- Location: Main Library, front doors.
- Verification: `gps`.
- Body:
  > *"I hold thousands of worlds but never leave my shelf."*
- Hint 1: *"What holds worlds you can travel to?"*
- Hint 2: *"The main library — front entrance."*
- Designer notes: Identical opening clue to the Hero Hunt — deliberate, so a tester who plays both hunts gets a moment of *"oh, this clue again"* recognition. Cheap delight.

---

**Clue M.2 — Library Walk (the central pavement)**

- Location: Library Walk, near the midpoint sculpture. (`-33.9168, 151.2308` approx.)
- Verification: `qr`. Code placed on a planter or column at the midpoint.
- Body:
  > *"Step onto the path where students protest, picnic, and pose in graduation gowns. Find me where four sides meet a centre."*
- Hint 1: *"The famous central walkway."*
- Hint 2: *"Library Walk, near the centre sculpture."*
- Designer notes: Exposes the QR scanner UX. Distance from M.1 is ~90 seconds walking, enough to feel like *movement* but not exhausting.

---

**Clue M.3 — Library Lawn (Finale)**

- Location: Library Lawn, centre of the grass.
- Verification: `gps_plus_photo`.
- Body:
  > *"End where you began, but a few steps to the sun."*
- Hint 1: *"The grass right outside the Library."*
- Hint 2: *"Library Lawn."*
- Photo prompt: *"All hands in the centre, fingertips touching — team huddle photo from above."*
- Designer notes: Mini hunt finale should feel **complete**, not abbreviated. Same celebration animation as Hero Hunt — the results card just shows fewer photos.

---

## 3. Photo challenge prompt bank

A pool of group-photo prompts that can be attached to any `gps_plus_photo` clue. Designed for: (a) easy to do in 60 seconds, (b) physically expressive (so the photo isn't just heads), (c) shareable without being embarrassing.

| # | Prompt | Best for location |
|---|---|---|
| P1 | "Hold up your favourite imaginary book for a team photo." | Library |
| P2 | "Strike the most dramatic graduation pose you can manage." | Scientia |
| P3 | "Cheers a drink (real or imaginary) on the steps." | Roundhouse |
| P4 | "One teammate plays prosecutor, one plays defendant, the rest play jury." | Law |
| P5 | "Mock-receive a free pizza slice." | Arc Precinct |
| P6 | "Recreate the Einstein pose at the bust." | Physics Lawn |
| P7 | "All hands on the wall — engineering tradition photo." | Red Centre |
| P8 | "Front-row lecture pose, but maximum enthusiasm." | Sir John Clancy Auditorium |
| P9 | "Team starfish on the grass — flat on your backs, photo from above." | Library Lawn |
| P10 | "Team huddle from above — fingertips touching." | Library Lawn |
| P11 | "Pretend you just got an HD on a final — celebration photo." | Anywhere |
| P12 | "Three teammates posing like a society exec headshot. Everyone else photobombs." | Anywhere |

---

## 4. Alternate clues (swap-in bank)

If a playtest reveals a clue that consistently stalls testers without being *intentionally* hard (PRD §11 risk: "one bad clue tanks player experience"), swap in one of these for the same location.

---

**Alternate for Clue 1.2 (Scientia)**

> *"My walls are see-through and my roof is a sail. I'm where degrees are finalised, not where they're earned."*

- Hint 1: *"You can see inside even when it's closed."*
- Hint 2: *"The glass building near Library Walk where graduations happen."*

---

**Alternate for Clue 2.1 (Law)**

> *"In my halls, students learn to disagree professionally. My name shares a syllable with 'order.'"*

- Hint 1: *"Where future barristers train."*
- Hint 2: *"Look for the Law Building."*

---

**Alternate for Clue 2.3 (Physics Lawn)**

> *"A genius sits here in bronze, mid-thought. He gave us relativity, the tongue photo, and a great hairdo."*

- Hint 1: *"Look for a famous physicist in statue form."*
- Hint 2: *"The Einstein bust on Physics Lawn."*

---

**Alternate for Clue 3.1 (Red Centre)**

> *"Stacked like a child's blocks, the colour of fired clay — engineers know me by all my floors and all my late nights."*

- Hint 1: *"Brick, cubed, with a colour name."*
- Hint 2: *"The Red Centre."*

---

**Alternate for Clue 3.2 (Sir John Clancy)**

> *"I am circular like the Roundhouse, but my crowd is here for slides, not beer. Five hundred seats face one stage."*

- Hint 1: *"The biggest lecture theatre on campus."*
- Hint 2: *"Sir John Clancy Auditorium."*

---

**Alternate for Clue 3.3 (Library Lawn finale)**

> *"You've raced past me three times today already. Now sit, and look up — your campus is yours."*

- Hint 1: *"The grass between the books and the sun."*
- Hint 2: *"Library Lawn."*

---

## 5. Designer checklist (before lock)

Per PRD §11 mitigation requirements:

- [ ] All 9 Hero Hunt clues walked end-to-end by ≥3 fresh testers.
- [ ] All 3 Mini Hunt clues walked end-to-end by ≥2 fresh testers.
- [ ] Each QR code laminated and placement-tested under demo lighting.
- [ ] Each geofence radius verified against actual GPS jitter at the location (UNSW has known multipath issues between tall buildings — Library Walk and the Quad are the worst offenders).
- [ ] Each photo prompt physically attempted by a real team — confirm it's actually doable in 60 seconds and produces a shareable image.
- [ ] Alternate riddles tested in at least one playtest if the primary version showed any sign of stalling.

---

## 6. Open content questions

1. **Hero photo for the results card** — currently the Einstein pose (Clue 2.3) is the default candidate. Should the *finale* photo (Clue 3.3, starfish on the grass) be the hero instead? Decide after first playtest sees which photo gets the bigger reaction.
2. **Image clue vs text clue ratio** — currently 8 text clues, 1 image clue (Red Centre). PRD allows either. Consider whether Tier 2 should also have an image clue for variety, vs whether Tier 3 being the only image-clue tier is a useful pacing signal in itself.
3. **Hint copy voice** — currently slightly playful ("famous physicist, famous hair"). Confirm with brand work (PRD Open Question §12.3) before lock.
4. **QR fallback policy** — if a QR is missing at run-time, do we silently fall back to GPS at the same coordinates, or surface the failure? Current draft assumes silent fallback. Confirm.

---

*End of clue_content_v1.md*
