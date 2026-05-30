import { describe, it, expect } from "vitest";
import { buildRoomHuntDraft } from "./generate-room-hunt";
import type { FreeRoomRecord } from "@/lib/rooms/types";

function room(id: string, lat: number, lng: number): FreeRoomRecord {
  return {
    room_id: id,
    room_name: `Room ${id}`,
    abbr: `R${id}`,
    capacity: 25,
    usage: "MEET",
    school: "",
    status: "free",
    free_until: null,
    building: { id: `K-${id}`, name: `Building ${id}`, lat, lng, photo_url: null, address: null },
  };
}

describe("buildRoomHuntDraft", () => {
  it("maps each room to a gps riddle clue anchored to building coords", () => {
    const draft = buildRoomHuntDraft([room("A", -33.9, 151.2)], { slug: "rooms-abc123" });
    expect(draft.slug).toBe("rooms-abc123");
    expect(draft.clues).toHaveLength(1);
    const c = draft.clues[0];
    expect(c.type).toBe("riddle");
    expect(c.verification_type).toBe("gps");
    expect(c.location_lat).toBe(-33.9);
    expect(c.location_lng).toBe(151.2);
    expect(c.geofence_radius_m).toBe(50);
    expect(c.tier).toBe(1);
    expect(c.sequence_in_tier).toBe(1);
    expect(c.location_name).toContain("Building A");
    expect(c.location_name).toContain("Room A");
    expect(c.body_text).toContain("Room A");
    expect(c.hints.length).toBeGreaterThanOrEqual(1);
  });

  it("chunks into tiers of at most 9", () => {
    const rooms = Array.from({ length: 11 }, (_, i) => room(String(i), -33.9, 151.2 + i * 0.001));
    const draft = buildRoomHuntDraft(rooms, { slug: "rooms-x" });
    expect(draft.clues[0]).toMatchObject({ tier: 1, sequence_in_tier: 1 });
    expect(draft.clues[8]).toMatchObject({ tier: 1, sequence_in_tier: 9 });
    expect(draft.clues[9]).toMatchObject({ tier: 2, sequence_in_tier: 1 });
    expect(draft.clues[10]).toMatchObject({ tier: 2, sequence_in_tier: 2 });
  });

  it("respects an overridden geofence radius", () => {
    const draft = buildRoomHuntDraft([room("A", -33.9, 151.2)], { slug: "rooms-x", geofenceRadiusM: 80 });
    expect(draft.clues[0].geofence_radius_m).toBe(80);
  });
});
