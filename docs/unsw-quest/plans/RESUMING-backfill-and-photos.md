# Resume Handoff — Run the Building Enrichment Backfill

**Updated:** 2026-05-19

The `scripts/enrich-buildings.ts` backfill is now on this branch and ready
to run. It populates `public.building_enrichments` with Foursquare match
metadata + addresses for every Freerooms building. **Photos are deliberately
skipped** (Foursquare's `/places/{id}/photos` endpoint is Premium-only and
429s on the free tier) — `photo_url` is written as `NULL`. A photo source
pivot is deferred; the Free-Rooms API already soft-fails missing photos.

---

## Run the backfill

Prereqs in `.env`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOURSQUARE_API_KEY`

From the repo root:

```bash
npx --yes dotenv-cli -e .env -- npm run enrich
```

What it does:
- Fetches all buildings from the Freerooms API
- For each one, calls Foursquare `/places/search` (free) within a 100m radius
- Picks the best candidate via `lib/foursquare/match.ts` (name similarity + distance)
- Upserts a row into `building_enrichments` keyed by `building_id`
- Rows with `match_method = 'manual'` are skipped (preserve hand-curated data)
- Per-building errors are logged and the loop continues

Expected runtime: a few minutes (200ms polite delay between buildings).

---

## Spot-check the data

```sql
select match_confidence, count(*)
  from public.building_enrichments
  group by 1 order by 1;

select building_id, building_name, foursquare_place_id, address
  from public.building_enrichments
  where match_confidence = 'low'
  limit 5;
```

Fix obvious wrongs by editing the row directly and setting
`match_method = 'manual'` — future runs preserve manual rows.

---

## Smoke-test the Free-Rooms endpoint (was Task 13)

```bash
npm run dev
curl -s 'http://localhost:3000/api/rooms/free' | head -c 800
curl -s 'http://localhost:3000/api/rooms/free?capacity=100&usage=LCTR'
curl -s 'http://localhost:3000/api/rooms/free?near_lat=-33.9173&near_lng=151.2336' \
  | jq '[.rooms[:5] | .[] | .building.id]'
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/rooms/free?near_lat=-33.9173'
# expect 400 — covered by a unit test on this branch
```

`building.photo_url` will be `null` on every row until a photo source is wired up.

---

## When to revisit photos

Candidates if/when this becomes worth doing:
- Google Places API (paid, ~$7/1000 calls — verify current pricing)
- Curated CDN (host UNSW building photos in Supabase Storage / Cloudflare R2)
- UNSW media library, if obtainable

Pick a source, write a thin `lib/photos/<source>.ts`, then plug it back into
`scripts/enrich-buildings.ts` where the `photo_url: null` comment lives.

---

## Cleanup

Delete this doc once the backfill has been run and the data spot-checked.
