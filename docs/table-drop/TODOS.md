# TODOS — TableDrop

Post-Halftime work captured from `docs/table-drop/DESIGN.md`. Source: `/office-hours` on 2026-05-19, design doc revised x2 after adversarial spec reviews.

## V1.1 — Immediately Post-Halftime

### Bounty creation flow (`/bounties/new`)

**What:** Build the `/bounties/new` page — host-authenticated form to create a new bounty (title, description, location, lat/lng, starts_at, ends_at, max_seats). Generates a fresh `slug` and `checkin_token`. Replaces the SQL-seeded Halftime bounty pattern.

**Why:** V1 only ships ONE seeded bounty (Halftime). Without a creation flow, no other host can create their own table — the product can't generalize past the demo.

**Pros:** Unlocks every "host creates their own table" use case. Validates the "third space" generalization premise.

**Cons:** Needs a slug-generator, image upload for `avatar_url` on profiles, calendar/time picker for starts_at/ends_at. Probably needs a draft mode.

**Context:** Explicitly cut from V1 in the design doc: `# CUT FROM V1: /bounties/new, /me  (post-Halftime)`. Auth foundation already exists (Supabase magic link). The host RPCs (`accept_request`, `reject_request`) already verify `auth.uid() == bounties.host_id`, so this slots in naturally.

**Estimated effort:** ~4-6h.

**Depends on:** Supabase magic-link auth working in production (already wired).

---

### User profile page (`/me`)

**What:** Build the `/me` page — shows user's profile (name, avatar, tags), their bounty request history (pending/accepted/rejected), and their check-in history.

**Why:** No way for users to manage their own identity or see their history. Required before any returning-user retention work.

**Pros:** Unlocks profile editing, request history, "you've checked into X tables this month" stats.

**Cons:** Needs profile edit UI, history queries, possibly avatar upload.

**Context:** Explicitly cut from V1 in the design doc (`# CUT FROM V1`). The `profiles` table is already populated by `request_to_join` RPC; only the UI is missing.

**Estimated effort:** ~3-4h.

**Depends on:** Magic-link auth, `/bounties/new` likely lands first.

---

### Bounty feed page visual design

**What:** Design and build the bounty feed page (`/`) — currently ships with one seeded Halftime bounty pinned at top. Post-Halftime: visual treatment for browsing multiple bounties, filtering by location/time, "happening now" vs "upcoming" sections.

**Why:** With `/bounties/new` shipping, there will be N bounties, not 1. The feed has to look intentional — currently it's a stub.

**Pros:** First impression page for any non-link-pasted visit.

**Cons:** Needs design exploration; feed UI is where competitor differentiation lives.

**Context:** Design doc explicitly defers feed visual design to post-Halftime. Halftime demo bypasses the feed entirely (judges scan QR direct to `/b/halftime-tabledrop`).

**Estimated effort:** ~4-6h (design + build).

**Depends on:** `/bounties/new` so there are bounties to feed.

---

## V2 — Curation at Scale

### Curation mechanic at scale: manual vs hybrid vs community-mod

**What:** Decide how curation works when one host can't manually accept every request. Options: (a) keep manual indefinitely (artisanal scarcity), (b) hybrid — host pre-approves tag rules + AI suggests + host confirms in batch, (c) community moderation — accepted joiners vouch for new ones.

**Why:** The whole product premise is "curation is product, not feature." When a popular host gets 200 requests per bounty, manual review collapses. The mechanic that survives scale defines whether this stays a niche thing or becomes a real platform.

**Pros:** Existential — picks the V2 product shape.

**Cons:** Each option has different schema implications. Adding "vouches" needs a relation table; adding "tag rules" needs auto-accept logic in `accept_request`.

**Context:** Open question parked in design doc "Open Questions (Park for Post-Halftime)". Choice affects v1.1 schema, so revisit before that schema lands.

**Estimated effort:** Decision: ~2h research + 1-day prototype. Implementation: depends on choice.

**Depends on:** Real-world traffic data from V1 → V1.1 — how many requests does an average bounty get?

---

### Bounty content shape differentiation (event vs interest vs proximity)

**What:** Decide how the UX presents different bounty types: scheduled events (party, talk), interest-anchored (anyone into Rust), proximity-anchored (people at this venue right now). Are these three different post-types or one shape with different inputs?

**Why:** "Bounty" is currently one shape. As use cases diverge, the right UX differs significantly. Event has start/end time + RSVPs; interest has tags + no time; proximity has venue + short time window.

**Pros:** Differentiates competitor positioning ("not Lu.ma, not Meetup, not Tinder").

**Cons:** Splitting into 3 shapes triples schema and UX complexity. Keeping one shape forces compromises.

**Context:** Open question parked in design doc. V1.1 design call.

**Estimated effort:** Design decision: ~half-day. Implementation: depends.

---

## V2 — Archetype-Based Seats (Approach C, cut)

### Archetype-based seats (Codex-suggested, cut for V1)

**What:** Pre-define N "seat archetypes" per bounty ("a builder", "a critic", "an outsider"). When joiners request, they pick which archetype they fit. Curation chooses one per archetype slot, ensuring intentional table diversity.

**Why:** The current model accepts joiners FIFO-ish; nothing prevents 8 builders showing up to a 8-seat table. Archetypes guarantee a designed mix.

**Pros:** Strong "table as designed object" pitch. Differentiates from "first 8 to RSVP" platforms.

**Cons:** Archetypes need definition (who defines? host? template?). Adds a step to the request flow. Acceptance logic gets more complex (refuse if archetype slot already filled).

**Context:** Codex proposed this in /office-hours; cut as Approach C ("moved to post-Halftime backlog. Will NOT be attempted Sunday"). Worth revisiting after V1 ships and you see organic patterns.

**Estimated effort:** ~1-2 days (schema + UX + acceptance logic).

**Depends on:** V1 ship + 2-4 weeks of real bounty data to see whether the problem actually manifests.

---

## V2 — Auth & Onboarding

### Production magic-link UX for host onboarding

**What:** Polish the host onboarding flow — currently uses the bare Supabase magic-link UI from `@supabase/ssr` template. For real hosts (not pre-authed demo host), this needs: clear "you're hosting a bounty" framing, email-deliverability checks, custom email template.

**Why:** Magic-link is functional but the demo never had a real host onboarding moment. First impression for a non-demo host is currently a generic Supabase login screen.

**Pros:** Real hosts onboard professionally; no "wait, what is this?" friction.

**Cons:** Requires email template work, possibly transactional email service (Resend, Postmark) for deliverability.

**Context:** Open question parked in design doc.

**Estimated effort:** ~1 day.

---

## V2 — Pitch / Marketing

### Rent-a-gf reference in the pitch: keep or omit

**What:** Decide whether to keep the "rent-a-gf solved paid intimacy; we borrowed the mechanic and stripped the transaction" framing in public-facing pitch material, or replace with a sanitized analog.

**Why:** Memorable AND a PR landmine. Memorable wins attention; landmine costs credibility with certain audiences.

**Pros:** Stays opinionated and quotable.

**Cons:** A press piece could lead with the reference uncharitably.

**Context:** Open question parked in design doc. Suggested inoculation copy in the doc itself.

**Estimated effort:** Decision only.

**Depends on:** First press cycle / first non-builder audience reaction.

---

## Refactors / tech debt

- **`bounties.status` enum was removed in v3** — replaced with computed `now() between starts_at and ends_at`. If you later add `cancelled` or `archived` states, that decision needs reversal.
- **Realtime client-side filter fallback** — if Realtime+RLS proves flaky in production, the doc specifies a one-line switch to "subscribe to ALL `room_presence` changes and filter client-side." Document this in CLAUDE.md when it lands.
- **Tags source** — captured at request-to-join time via tag-chip form. Post-V1, consider profile-level tags so users don't retype them every bounty.
