import type { FreeRoomRecord } from "@/lib/rooms/types";

export type ClueDraft = {
  tier: number;
  sequence_in_tier: number;
  type: "riddle";
  verification_type: "gps";
  body_text: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  geofence_radius_m: number;
  hints: string[];
};

export type HuntDraft = {
  slug: string;
  name: string;
  description: string;
  duration_minutes: number;
  hero_emoji: string;
  clues: ClueDraft[];
};

export type BuildRoomHuntOpts = {
  slug: string;
  geofenceRadiusM?: number;
  durationMinutes?: number;
  cluesPerTier?: number;
};

/**
 * Turn a list of selected free rooms into a hunt draft (no I/O). Each room
 * becomes one GPS-verified riddle clue anchored to its building coordinates
 * (Freerooms gives building-level coords only). Rooms are chunked into tiers of
 * at most 9 (sequence_in_tier 1-9). Keeping tier within 1-3 is the caller's job:
 * the route caps the room count at 27 so generated tiers never exceed 3.
 */
export function buildRoomHuntDraft(
  selected: FreeRoomRecord[],
  opts: BuildRoomHuntOpts,
): HuntDraft {
  const geofence = opts.geofenceRadiusM ?? 50;
  const perTier = Math.min(opts.cluesPerTier ?? 9, 9);

  const clues: ClueDraft[] = selected.map((room, i) => ({
    tier: Math.floor(i / perTier) + 1,
    sequence_in_tier: (i % perTier) + 1,
    type: "riddle",
    verification_type: "gps",
    body_text: `Make your way to ${room.room_name} (${room.usage}, seats ${room.capacity}) in ${room.building.name}.`,
    location_name: `${room.building.name} — ${room.room_name}`,
    location_lat: room.building.lat,
    location_lng: room.building.lng,
    geofence_radius_m: geofence,
    hints: [`It's in ${room.building.name}.`, `Room ${room.abbr}.`],
  }));

  return {
    slug: opts.slug,
    name: "Free Room Quest",
    description: "A quest through rooms that are free on campus right now.",
    duration_minutes: opts.durationMinutes ?? 30,
    hero_emoji: "🚪",
    clues,
  };
}
