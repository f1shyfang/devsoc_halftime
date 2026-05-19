import { describe, it, expect, vi } from "vitest";
import { getFreeRooms } from "./get-free-rooms";
import type { FreeroomsClient } from "@/lib/freerooms/client";

function makeFreeroomsClient(overrides: Partial<FreeroomsClient> = {}): FreeroomsClient {
  return {
    getBuildings: vi.fn().mockResolvedValue([
      { id: "K-J17", name: "Ainsworth", lat: -33.91, long: 151.23, aliases: [] },
      { id: "K-E15", name: "Library", lat: -33.917, long: 151.234, aliases: [] },
    ]),
    getRooms: vi.fn().mockResolvedValue({
      "K-J17-305": {
        id: "K-J17-305",
        name: "Ainsworth 305",
        abbr: "Ains305",
        usage: "CMLB",
        capacity: 30,
        school: "COMPSC",
      },
      "K-E15-200": {
        id: "K-E15-200",
        name: "Library 200",
        abbr: "Lib200",
        usage: "LCTR",
        capacity: 150,
        school: "LIB",
      },
    }),
    getRoomStatus: vi.fn().mockResolvedValue({
      "K-J17": { "305": { status: "free", endtime: "2026-05-19T14:00:00Z" } },
      "K-E15": { "200": { status: "soon", endtime: "2026-05-19T13:10:00Z" } },
    }),
    ...overrides,
  };
}

type EnrichmentRow = {
  building_id: string;
  photo_url: string | null;
  address: string | null;
};

function makeEnrichmentReader(rows: EnrichmentRow[]) {
  return vi.fn().mockResolvedValue(rows);
}

describe("getFreeRooms", () => {
  it("returns free rooms with enriched building data", async () => {
    const fr = makeFreeroomsClient();
    const reader = makeEnrichmentReader([
      {
        building_id: "K-J17",
        photo_url: "https://photo/ainsworth.jpg",
        address: "Anzac Pde",
      },
    ]);

    const res = await getFreeRooms(
      { statusFilter: "free" },
      { freerooms: fr, readEnrichments: reader },
    );

    expect(res.rooms).toHaveLength(1);
    const r = res.rooms[0];
    expect(r.room_id).toBe("K-J17-305");
    expect(r.status).toBe("free");
    expect(r.free_until).toBe("2026-05-19T14:00:00Z");
    expect(r.building.id).toBe("K-J17");
    expect(r.building.photo_url).toBe("https://photo/ainsworth.jpg");
    expect(r.building.address).toBe("Anzac Pde");
  });

  it("includes 'soon' rooms when statusFilter is 'soon'", async () => {
    const fr = makeFreeroomsClient();
    const res = await getFreeRooms(
      { statusFilter: "soon" },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    const statuses = res.rooms.map((r) => r.status).sort();
    expect(statuses).toEqual(["free", "soon"]);
  });

  it("includes all rooms when statusFilter is 'all'", async () => {
    const fr = makeFreeroomsClient({
      getRoomStatus: vi.fn().mockResolvedValue({
        "K-J17": { "305": { status: "busy", endtime: "" } },
      }),
    });
    const res = await getFreeRooms(
      { statusFilter: "all" },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.rooms).toHaveLength(1);
    expect(res.rooms[0].status).toBe("busy");
    expect(res.rooms[0].free_until).toBeNull();
  });

  it("falls back to null photo/address when enrichment row is missing", async () => {
    const fr = makeFreeroomsClient();
    const res = await getFreeRooms(
      { statusFilter: "free" },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.rooms[0].building.photo_url).toBeNull();
    expect(res.rooms[0].building.address).toBeNull();
  });

  it("falls back to null photo/address when readEnrichments throws", async () => {
    const fr = makeFreeroomsClient();
    const reader = vi.fn().mockRejectedValue(new Error("supabase down"));

    const res = await getFreeRooms(
      { statusFilter: "free" },
      { freerooms: fr, readEnrichments: reader },
    );
    expect(res.rooms[0].building.photo_url).toBeNull();
    expect(res.rooms[0].building.address).toBeNull();
  });

  it("sorts by distance ascending when nearLat/nearLng are given", async () => {
    const fr = makeFreeroomsClient({
      getRoomStatus: vi.fn().mockResolvedValue({
        "K-J17": { "305": { status: "free", endtime: "2026-05-19T14:00:00Z" } },
        "K-E15": { "200": { status: "free", endtime: "2026-05-19T14:00:00Z" } },
      }),
    });
    const res = await getFreeRooms(
      { statusFilter: "free", nearLat: -33.917, nearLng: 151.234 },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.rooms[0].building.id).toBe("K-E15");
    expect(res.rooms[1].building.id).toBe("K-J17");
  });

  it("passes the freerooms query params through (at, capacity, usage, duration)", async () => {
    const getRoomStatus = vi.fn().mockResolvedValue({});
    const fr = makeFreeroomsClient({ getRoomStatus });

    await getFreeRooms(
      {
        at: "2026-05-19T13:00:00Z",
        capacity: 20,
        usage: "CMLB",
        duration: 30,
      },
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );

    expect(getRoomStatus).toHaveBeenCalledWith({
      datetime: "2026-05-19T13:00:00Z",
      capacity: 20,
      usage: "CMLB",
      duration: 30,
    });
  });

  it("populates as_of with an ISO timestamp", async () => {
    const fr = makeFreeroomsClient();
    const res = await getFreeRooms(
      {},
      { freerooms: fr, readEnrichments: makeEnrichmentReader([]) },
    );
    expect(res.as_of).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
