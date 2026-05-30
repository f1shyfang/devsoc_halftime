import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/freerooms/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/freerooms/client")>(
    "@/lib/freerooms/client",
  );
  return { ...actual, createFreeroomsClient: vi.fn() };
});
vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn(() => ({ from: vi.fn().mockResolvedValue([]) })) },
}));
vi.mock("@/lib/rooms/get-free-rooms", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rooms/get-free-rooms")>(
    "@/lib/rooms/get-free-rooms",
  );
  return { ...actual, getFreeRooms: vi.fn() };
});
vi.mock("@/lib/quest/create-room-hunt", () => ({ createRoomHunt: vi.fn() }));

import { POST } from "./route";
import { getFreeRooms } from "@/lib/rooms/get-free-rooms";
import { createRoomHunt } from "@/lib/quest/create-room-hunt";
import type { FreeRoomRecord } from "@/lib/rooms/types";

const mockedGetFreeRooms = vi.mocked(getFreeRooms);
const mockedCreate = vi.mocked(createRoomHunt);

function freeRoom(id: string): FreeRoomRecord {
  return {
    room_id: id,
    room_name: `Room ${id}`,
    abbr: id,
    capacity: 25,
    usage: "MEET",
    school: "",
    status: "free",
    free_until: null,
    building: { id: `K-${id}`, name: `Building ${id}`, lat: -33.9, lng: 151.2, photo_url: null, address: null },
  };
}

function makeReq(body: unknown) {
  return new Request("http://localhost/api/quest/rooms/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/quest/rooms/generate", () => {
  beforeEach(() => {
    mockedGetFreeRooms.mockResolvedValue({ as_of: "t", rooms: [freeRoom("A"), freeRoom("B")] });
    mockedCreate.mockResolvedValue({ huntId: "hunt-1", slug: "rooms-test" });
  });
  afterEach(() => vi.clearAllMocks());

  it("generates a hunt and returns slug + huntId + hub", async () => {
    const res = await POST(makeReq({ count: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toMatch(/^rooms-/);
    expect(body.huntId).toBe("hunt-1");
    // The real selectRoomsForHunt runs and returns the first room as hub when no
    // coords are given, so "A" is the first of the two-room fixture.
    expect(body.hub_room.room_id).toBe("A");
    expect(mockedCreate).toHaveBeenCalledOnce();
  });

  it("returns 422 when no free rooms match", async () => {
    mockedGetFreeRooms.mockResolvedValueOnce({ as_of: "t", rooms: [] });
    const res = await POST(makeReq({ count: 2 }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_free_rooms");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid usage", async () => {
    const res = await POST(makeReq({ usage: "NOPE" }));
    expect(res.status).toBe(400);
    expect((await res.json()).param).toBe("usage");
  });

  it("returns 503 when Freerooms is unavailable", async () => {
    const { FreeroomsError } = await import("@/lib/freerooms/client");
    mockedGetFreeRooms.mockRejectedValueOnce(new FreeroomsError("/rooms/status", 500, "boom"));
    const res = await POST(makeReq({ count: 2 }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("rooms_service_unavailable");
  });

  it("returns 400 when count is 0 (below minimum)", async () => {
    const res = await POST(makeReq({ count: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).param).toBe("count");
  });

  it("returns 400 when count is 28 (above maximum)", async () => {
    const res = await POST(makeReq({ count: 28 }));
    expect(res.status).toBe(400);
    expect((await res.json()).param).toBe("count");
  });

  it("returns 400 when nearLat is provided without nearLng", async () => {
    const res = await POST(makeReq({ nearLat: -33.9 }));
    expect(res.status).toBe(400);
    expect((await res.json()).param).toBe("near_lat_lng");
  });

  it("returns 400 when capacity is -1 (negative)", async () => {
    const res = await POST(makeReq({ capacity: -1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).param).toBe("capacity");
  });
});
