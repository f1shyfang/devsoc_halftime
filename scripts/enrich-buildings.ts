#!/usr/bin/env tsx
import {
  createFoursquareClient,
  type FoursquareClient,
} from "../lib/foursquare/client";
import {
  classifyConfidence,
  nameSimilarity,
  pickBestCandidate,
  type MatchConfidence,
  type ScoredCandidate,
} from "../lib/foursquare/match";
import { createFreeroomsClient, type FreeroomsClient } from "../lib/freerooms/client";
import { createAdminClient } from "../lib/supabase/admin";

const SEARCH_RADIUS_M = 100;
const SEARCH_LIMIT = 5;
const POLITE_DELAY_MS = 200;

export type EnrichmentInsert = {
  building_id: string;
  building_name: string;
  foursquare_place_id: string | null;
  photo_url: string | null;
  address: string | null;
  match_confidence: MatchConfidence;
  match_method: "name_and_proximity" | null;
};

export type EnrichmentSummary = {
  high: number;
  medium: number;
  low: number;
  no_match: number;
  skipped_manual: number;
};

/**
 * Minimal admin-client surface used by the enrichment loop. Keeps the loop
 * decoupled from `@supabase/supabase-js`'s full type so tests can inject a
 * straightforward fake.
 */
export type EnrichmentSupabase = {
  fetchExistingMethods: () => Promise<
    Array<{ building_id: string; match_method: string | null }>
  >;
  upsertEnrichment: (row: EnrichmentInsert) => Promise<{ error: unknown }>;
};

export type EnrichBuildingsDeps = {
  freerooms: Pick<FreeroomsClient, "getBuildings">;
  foursquare: Pick<FoursquareClient, "searchNearby">;
  supabase: EnrichmentSupabase;
  /** Inter-building delay; defaults to 200ms. Tests pass 0. */
  delayMs?: number;
  /** Logger; defaults to console. Tests can override to capture output. */
  logger?: Pick<Console, "log" | "error">;
};

/**
 * Run the enrichment loop. Pure of process.env: all I/O is via injected deps.
 * Returns the summary so callers (CLI + tests) can render or assert.
 */
export async function enrichBuildings(
  deps: EnrichBuildingsDeps,
): Promise<EnrichmentSummary> {
  const log = deps.logger ?? console;
  const delayMs = deps.delayMs ?? POLITE_DELAY_MS;

  const existing = await deps.supabase.fetchExistingMethods();
  const manualIds = new Set(
    existing
      .filter((row) => row.match_method === "manual")
      .map((row) => row.building_id),
  );

  const buildings = await deps.freerooms.getBuildings();
  log.log(
    `Enriching ${buildings.length} buildings (skipping ${manualIds.size} manual)`,
  );

  const summary: EnrichmentSummary = {
    high: 0,
    medium: 0,
    low: 0,
    no_match: 0,
    skipped_manual: 0,
  };

  for (const b of buildings) {
    if (manualIds.has(b.id)) {
      summary.skipped_manual++;
      log.log(`[${b.id}] ${b.name} → skipped (manual)`);
      continue;
    }

    let row: EnrichmentInsert;

    try {
      const candidates = await deps.foursquare.searchNearby({
        lat: b.lat,
        lng: b.long,
        radiusMeters: SEARCH_RADIUS_M,
        limit: SEARCH_LIMIT,
      });

      const scored: ScoredCandidate[] = candidates.map((c) => ({
        id: c.fsq_place_id,
        name: c.name,
        nameScore: nameSimilarity(b.name, c.name),
        distanceMeters: c.distance,
      }));

      const best = pickBestCandidate(scored);

      if (!best) {
        row = {
          building_id: b.id,
          building_name: b.name,
          foursquare_place_id: null,
          photo_url: null,
          address: null,
          match_confidence: "no_match",
          match_method: null,
        };
      } else {
        const confidence = classifyConfidence(
          best.nameScore,
          best.distanceMeters,
        );
        const fullCandidate = candidates.find(
          (c) => c.fsq_place_id === best.id,
        );

        row = {
          building_id: b.id,
          building_name: b.name,
          foursquare_place_id: best.id,
          // Photos intentionally skipped: Foursquare's /places/{id}/photos endpoint
          // is now Premium-only and 429s on the free tier. Photo source TBD.
          photo_url: null,
          address:
            fullCandidate?.location.formatted_address ??
            fullCandidate?.location.address ??
            null,
          match_confidence: confidence,
          match_method: "name_and_proximity",
        };
      }
    } catch (err) {
      log.error(`[${b.id}] ${b.name} → ERROR`, err);
      continue;
    }

    summary[row.match_confidence]++;
    log.log(
      `[${b.id}] ${b.name} → ${row.match_confidence} (${row.foursquare_place_id ?? "no_match"})`,
    );

    const { error: upsertErr } = await deps.supabase.upsertEnrichment(row);
    if (upsertErr) {
      log.error(`[${b.id}] upsert failed`, upsertErr);
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  log.log(
    `Processed ${buildings.length}: ${summary.high} high, ${summary.medium} medium, ${summary.low} low, ${summary.no_match} no_match, ${summary.skipped_manual} skipped(manual)`,
  );

  return summary;
}

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`error: required environment variable ${name} is not set`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  assertEnv("NEXT_PUBLIC_SUPABASE_URL");
  assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = assertEnv("FOURSQUARE_API_KEY");

  const freerooms = createFreeroomsClient();
  const foursquare = createFoursquareClient({ apiKey });
  const admin = createAdminClient();

  const supabase: EnrichmentSupabase = {
    async fetchExistingMethods() {
      const { data, error } = await admin
        .from("building_enrichments")
        .select("building_id, match_method");
      if (error) throw error;
      return data ?? [];
    },
    async upsertEnrichment(row) {
      const { error } = await admin
        .from("building_enrichments")
        .upsert(row, { onConflict: "building_id" });
      return { error };
    },
  };

  await enrichBuildings({ freerooms, foursquare, supabase });
}

// Only run when invoked directly (not when imported by tests).
// tsx sets process.argv[1] to the resolved script path; we match on filename.
const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  /enrich-buildings\.ts$/.test(process.argv[1]);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
