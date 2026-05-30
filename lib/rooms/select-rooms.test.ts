import { describe, it, expect } from "vitest";
import { selectRoomsForHunt } from "./select-rooms";
import type { FreeRoomRecord } from "./types";

function room(over: Partial<FreeRoomRecord> & { id: string; buildingId: string }): FreeRoomRecord {
  return {
    room_id: over.id,
    room_name: over.room_name ?? `Room ${over.id}`,
    abbr: over.abbr ?? over.id,
    capacity: over.capacity ?? 20,
    usage: over.usage ?? "MEET",
    school: over.school ?? "",
    status: over.status ?? "free",
    free_until: over.free_until ?? null,
    building: {
      id: over.buildingId,
      name: `Building ${over.buildingId}`,
      lat: over.building?.lat ?? -33.9,
      lng: over.building?.lng ?? 151.2,
      photo_url: null,
      address: null,
    },
  };
}

describe("selectRoomsForHunt", () => {
  it("keeps only free rooms and caps at count", () => {
    const rooms = [
      room({ id: "A", buildingId: "K-A" }),
      room({ id: "B", buildingId: "K-B", status: "busy" }),
      room({ id: "C", buildingId: "K-C" }),
      room({ id: "D", buildingId: "K-D" }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 2 });
    expect(result).not.toBeNull();
    expect(result!.rooms).toHaveLength(2);
    expect(result!.rooms.every((r) => r.status === "free")).toBe(true);
    expect(result!.hub).toBe(result!.rooms[0]);
  });

  it("filters by minimum capacity and usage", () => {
    const rooms = [
      room({ id: "A", buildingId: "K-A", capacity: 10, usage: "MEET" }),
      room({ id: "B", buildingId: "K-B", capacity: 40, usage: "MEET" }),
      room({ id: "C", buildingId: "K-C", capacity: 40, usage: "LAB" }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 5, capacity: 30, usage: "MEET" });
    expect(result!.rooms.map((r) => r.room_id)).toEqual(["B"]);
  });

  it("dedupes to one room per building by default", () => {
    const rooms = [
      room({ id: "A1", buildingId: "K-A" }),
      room({ id: "A2", buildingId: "K-A" }),
      room({ id: "B1", buildingId: "K-B" }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 5 });
    expect(result!.rooms.map((r) => r.building.id)).toEqual(["K-A", "K-B"]);
  });

  it("keeps multiple rooms per building when dedupeByBuilding is false", () => {
    const rooms = [
      room({ id: "A1", buildingId: "K-A" }),
      room({ id: "A2", buildingId: "K-A" }),
      room({ id: "B1", buildingId: "K-B" }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 5, dedupeByBuilding: false });
    expect(result!.rooms.map((r) => r.room_id)).toEqual(["A1", "A2", "B1"]);
  });

  it("sorts by proximity when near coords are given", () => {
    const rooms = [
      room({ id: "FAR", buildingId: "K-FAR", building: { id: "K-FAR", name: "", lat: -33.95, lng: 151.25, photo_url: null, address: null } }),
      room({ id: "NEAR", buildingId: "K-NEAR", building: { id: "K-NEAR", name: "", lat: -33.901, lng: 151.201, photo_url: null, address: null } }),
    ];
    const result = selectRoomsForHunt(rooms, { count: 5, nearLat: -33.9, nearLng: 151.2 });
    expect(result!.hub.room_id).toBe("NEAR");
  });

  it("returns null when nothing matches", () => {
    expect(selectRoomsForHunt([], { count: 3 })).toBeNull();
    expect(
      selectRoomsForHunt([room({ id: "A", buildingId: "K-A", status: "busy" })], { count: 3 }),
    ).toBeNull();
  });
});
