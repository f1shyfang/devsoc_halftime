import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createFreeroomsClient,
  type FreeroomsClient,
} from "./client";

describe("FreeroomsClient", () => {
  let client: FreeroomsClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = createFreeroomsClient({ baseUrl: "https://example.test/api" });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("getBuildings hits /api/buildings and returns the building array", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          buildings: [
            { id: "K-J17", name: "Ainsworth", lat: -33.9, long: 151.2, aliases: [] },
          ],
        }),
        { status: 200 },
      ),
    );

    const buildings = await client.getBuildings();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.test/api/buildings",
      expect.objectContaining({ method: "GET" }),
    );
    expect(buildings).toHaveLength(1);
    expect(buildings[0].id).toBe("K-J17");
  });

  it("getRooms hits /api/rooms and returns rooms keyed by id", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          rooms: {
            "K-J17-305": {
              id: "K-J17-305",
              name: "Brass Lab",
              abbr: "BrassME305",
              usage: "CMLB",
              capacity: 30,
              school: "COMPSC",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const rooms = await client.getRooms();

    expect(rooms["K-J17-305"].capacity).toBe(30);
  });

  it("getRoomStatus passes query params through and parses response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "K-J17": {
            "305": { status: "free", endtime: "2026-05-19T14:00:00Z" },
          },
        }),
        { status: 200 },
      ),
    );

    const status = await client.getRoomStatus({
      datetime: "2026-05-19T13:00:00Z",
      capacity: 20,
      usage: "CMLB",
    });

    const url = (fetchSpy.mock.calls[0][0] as string);
    expect(url).toContain("/rooms/status");
    expect(url).toContain("datetime=2026-05-19T13%3A00%3A00Z");
    expect(url).toContain("capacity=20");
    expect(url).toContain("usage=CMLB");
    expect(status["K-J17"]["305"].status).toBe("free");
  });

  it("getRoomStatus unwraps the upstream { numAvailable, roomStatuses } shape", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "K-G27": {
            numAvailable: 2,
            roomStatuses: {
              "108": { status: "free", endtime: "" },
              "109": { status: "soon", endtime: "2026-05-19T14:00:00Z" },
            },
          },
        }),
        { status: 200 },
      ),
    );

    const status = await client.getRoomStatus();

    expect(status["K-G27"]["108"].status).toBe("free");
    expect(status["K-G27"]["109"].status).toBe("soon");
    // numAvailable must not leak through as a pseudo-room.
    expect(status["K-G27"]).not.toHaveProperty("numAvailable");
  });

  it("throws a typed error on non-2xx responses", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("server exploded", { status: 500 }),
    );

    await expect(client.getBuildings()).rejects.toThrow(/freerooms/i);
  });
});
