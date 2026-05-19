import { describe, it, expect, vi } from "vitest";
import { enrichBuildings, type EnrichBuildingsDeps } from "./enrich-buildings";
import type { FreeroomsBuilding } from "@/lib/freerooms/types";
import type { FoursquarePlace } from "@/lib/foursquare/types";

function makeDeps(overrides: {
  buildings: FreeroomsBuilding[];
  candidatesByLatLng?: (
    lat: number,
    lng: number,
  ) => FoursquarePlace[] | Promise<FoursquarePlace[]>;
  existing?: Array<{ building_id: string; match_method: string | null }>;
}): {
  deps: EnrichBuildingsDeps;
  upsertCalls: Array<unknown>;
  logger: { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
} {
  const upsertCalls: Array<unknown> = [];
  const logger = { log: vi.fn(), error: vi.fn() };

  const deps: EnrichBuildingsDeps = {
    freerooms: {
      getBuildings: vi.fn().mockResolvedValue(overrides.buildings),
    },
    foursquare: {
      searchNearby: vi
        .fn()
        .mockImplementation(async ({ lat, lng }: { lat: number; lng: number }) => {
          return overrides.candidatesByLatLng
            ? await overrides.candidatesByLatLng(lat, lng)
            : [];
        }),
    },
    supabase: {
      fetchExistingMethods: vi
        .fn()
        .mockResolvedValue(overrides.existing ?? []),
      upsertEnrichment: vi.fn().mockImplementation(async (row) => {
        upsertCalls.push(row);
        return { error: null };
      }),
    },
    delayMs: 0,
    logger,
  };

  return { deps, upsertCalls, logger };
}

describe("enrichBuildings", () => {
  it("processes high/no_match/manual buildings correctly and reports summary", async () => {
    const buildings: FreeroomsBuilding[] = [
      // 1. High-confidence match: exact name + 5m away.
      {
        id: "K-J17",
        name: "Ainsworth",
        lat: -33.917,
        long: 151.231,
        aliases: [],
      },
      // 2. No candidates returned from Foursquare.
      {
        id: "K-Z99",
        name: "Nowhere",
        lat: -33.92,
        long: 151.24,
        aliases: [],
      },
      // 3. Already marked manual in the DB → must be skipped.
      {
        id: "K-MANUAL",
        name: "Manually Curated Hall",
        lat: -33.918,
        long: 151.235,
        aliases: [],
      },
    ];

    const { deps, upsertCalls, logger } = makeDeps({
      buildings,
      existing: [{ building_id: "K-MANUAL", match_method: "manual" }],
      candidatesByLatLng: (lat) => {
        if (lat === -33.917) {
          return [
            {
              fsq_place_id: "fsq_ains",
              name: "Ainsworth",
              location: { formatted_address: "Anzac Pde, Kensington NSW" },
              distance: 5,
            },
          ];
        }
        return [];
      },
    });

    const summary = await enrichBuildings(deps);

    // Summary counts.
    expect(summary).toEqual({
      high: 1,
      medium: 0,
      low: 0,
      no_match: 1,
      skipped_manual: 1,
    });

    // Two upserts (high + no_match). Manual was skipped, no upsert for it.
    expect(upsertCalls).toHaveLength(2);

    const ainsworthRow = upsertCalls.find(
      (r) => (r as { building_id: string }).building_id === "K-J17",
    );
    expect(ainsworthRow).toEqual({
      building_id: "K-J17",
      building_name: "Ainsworth",
      foursquare_place_id: "fsq_ains",
      photo_url: null,
      address: "Anzac Pde, Kensington NSW",
      match_confidence: "high",
      match_method: "name_and_proximity",
    });

    const noMatchRow = upsertCalls.find(
      (r) => (r as { building_id: string }).building_id === "K-Z99",
    );
    expect(noMatchRow).toEqual({
      building_id: "K-Z99",
      building_name: "Nowhere",
      foursquare_place_id: null,
      photo_url: null,
      address: null,
      match_confidence: "no_match",
      match_method: null,
    });

    // Manual building must NOT have been upserted.
    expect(
      upsertCalls.find(
        (r) => (r as { building_id: string }).building_id === "K-MANUAL",
      ),
    ).toBeUndefined();

    // Manual log line was emitted.
    const manualLog = logger.log.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("K-MANUAL"),
    );
    expect(manualLog?.[0]).toContain("skipped (manual)");

    // Foursquare lookups were NOT done for the manual row.
    expect(deps.foursquare.searchNearby).toHaveBeenCalledTimes(2);

    // Final summary line is logged.
    const summaryLine = logger.log.mock.calls
      .map((c) => c[0])
      .find(
        (l) => typeof l === "string" && l.startsWith("Processed 3:"),
      );
    expect(summaryLine).toBe(
      "Processed 3: 1 high, 0 medium, 0 low, 1 no_match, 1 skipped(manual)",
    );
  });

  it("does not call Foursquare for the manual building", async () => {
    const buildings: FreeroomsBuilding[] = [
      {
        id: "K-MANUAL",
        name: "Hand-curated",
        lat: 0,
        long: 0,
        aliases: [],
      },
    ];

    const { deps } = makeDeps({
      buildings,
      existing: [{ building_id: "K-MANUAL", match_method: "manual" }],
    });

    await enrichBuildings(deps);

    expect(deps.foursquare.searchNearby).not.toHaveBeenCalled();
    expect(deps.supabase.upsertEnrichment).not.toHaveBeenCalled();
  });

  it("continues past per-building errors instead of throwing", async () => {
    const buildings: FreeroomsBuilding[] = [
      { id: "B1", name: "First", lat: 1, long: 1, aliases: [] },
      { id: "B2", name: "Second", lat: 2, long: 2, aliases: [] },
    ];

    const { deps, upsertCalls, logger } = makeDeps({
      buildings,
      candidatesByLatLng: (lat) => {
        if (lat === 1) {
          throw new Error("foursquare rate limited");
        }
        return [];
      },
    });

    const summary = await enrichBuildings(deps);

    // B1 errored → no row counted. B2 yielded no candidates → no_match.
    expect(summary.no_match).toBe(1);
    expect(upsertCalls).toHaveLength(1);
    expect((upsertCalls[0] as { building_id: string }).building_id).toBe("B2");
    expect(logger.error).toHaveBeenCalled();
  });
});
