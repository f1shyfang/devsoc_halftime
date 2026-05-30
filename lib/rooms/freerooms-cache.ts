import { unstable_cache } from "next/cache";
import { createFreeroomsClient, type FreeroomsClient } from "@/lib/freerooms/client";
import { db } from "@/lib/db/client";
import { buildingEnrichments } from "@/lib/db/schema";

// Wrap the underlying Freerooms client so building/room lists are cached
// at the Next layer for ~24h (per design spec §3). Live status is NOT cached.
export const ONE_DAY_SECONDS = 60 * 60 * 24;

export function createCachedFreeroomsClient(): FreeroomsClient {
  const base = createFreeroomsClient();
  return {
    ...base,
    getBuildings: unstable_cache(
      () => base.getBuildings(),
      ["freerooms-buildings"],
      { revalidate: ONE_DAY_SECONDS, tags: ["freerooms-static"] },
    ),
    getRooms: unstable_cache(
      () => base.getRooms(),
      ["freerooms-rooms"],
      { revalidate: ONE_DAY_SECONDS, tags: ["freerooms-static"] },
    ),
  };
}

export async function readBuildingEnrichments() {
  return db
    .select({
      building_id: buildingEnrichments.buildingId,
      photo_url: buildingEnrichments.photoUrl,
      address: buildingEnrichments.address,
    })
    .from(buildingEnrichments);
}
