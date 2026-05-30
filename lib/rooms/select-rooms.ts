import { haversineMeters } from "./distance";
import type { FreeRoomRecord } from "./types";

export type SelectRoomsOpts = {
  count: number;
  nearLat?: number;
  nearLng?: number;
  capacity?: number;
  usage?: string;
  dedupeByBuilding?: boolean;
};

export type SelectRoomsResult = {
  hub: FreeRoomRecord;
  rooms: FreeRoomRecord[];
};

/**
 * Pick rooms for a generated quest ("corral"). Keeps only currently-free rooms,
 * applies optional capacity/usage filters, sorts by proximity when near coords
 * are given, dedupes to one room per building (markers are building-level), and
 * caps at `count`. Returns null when nothing matches. `hub` is the first
 * (nearest) room — the auto-assigned destination.
 */
export function selectRoomsForHunt(
  rooms: FreeRoomRecord[],
  opts: SelectRoomsOpts,
): SelectRoomsResult | null {
  let pool = rooms.filter((r) => r.status === "free");

  if (opts.capacity !== undefined) {
    pool = pool.filter((r) => r.capacity >= opts.capacity!);
  }
  if (opts.usage !== undefined) {
    pool = pool.filter((r) => r.usage === opts.usage);
  }

  if (opts.nearLat !== undefined && opts.nearLng !== undefined) {
    const lat = opts.nearLat;
    const lng = opts.nearLng;
    // `pool` is already a fresh array from the filters above, so sort in place.
    pool.sort(
      (a, b) =>
        haversineMeters(lat, lng, a.building.lat, a.building.lng) -
        haversineMeters(lat, lng, b.building.lat, b.building.lng),
    );
  }

  if (opts.dedupeByBuilding !== false) {
    const seen = new Set<string>();
    pool = pool.filter((r) => {
      if (seen.has(r.building.id)) return false;
      seen.add(r.building.id);
      return true;
    });
  }

  const selected = pool.slice(0, Math.max(0, opts.count));
  if (selected.length === 0) return null;
  return { hub: selected[0], rooms: selected };
}
