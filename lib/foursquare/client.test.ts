import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFoursquareClient, buildPhotoUrl } from "./client";

describe("buildPhotoUrl", () => {
  it("assembles a Foursquare photo URL from prefix/suffix", () => {
    const url = buildPhotoUrl({
      prefix: "https://fastly.4sqi.net/img/general/",
      suffix: "/12345_abcdef.jpg",
    });
    expect(url).toBe(
      "https://fastly.4sqi.net/img/general/original/12345_abcdef.jpg",
    );
  });
});

describe("FoursquareClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("searchNearby sends ll, radius, limit, fields and the api key", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });

    await client.searchNearby({ lat: -33.9, lng: 151.2, radiusMeters: 100 });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("/places/search");
    expect(url).toContain("ll=-33.9%2C151.2");
    expect(url).toContain("radius=100");
    expect(url).toContain("limit=20");
    expect(url).toContain("fields=fsq_place_id%2Cname%2Clocation%2Cdistance");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "test-key",
      Accept: "application/json",
    });
  });

  it("searchNearby returns the parsed results array", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              fsq_place_id: "abc",
              name: "Foo",
              location: { formatted_address: "1 Foo St" },
              distance: 12,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });
    const results = await client.searchNearby({
      lat: 0,
      lng: 0,
      radiusMeters: 50,
    });
    expect(results).toHaveLength(1);
    expect(results[0].fsq_place_id).toBe("abc");
  });

  it("getFirstPhoto returns null when the place has zero photos", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });
    const photo = await client.getFirstPhoto("abc");
    expect(photo).toBeNull();
  });

  it("getFirstPhoto returns the first photo when present", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { prefix: "https://x/", suffix: "/y.jpg" },
          { prefix: "https://x/", suffix: "/z.jpg" },
        ]),
        { status: 200 },
      ),
    );
    const client = createFoursquareClient({ apiKey: "test-key" });
    const photo = await client.getFirstPhoto("abc");
    expect(photo).toEqual({ prefix: "https://x/", suffix: "/y.jpg" });
  });

  it("throws on non-2xx", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const client = createFoursquareClient({ apiKey: "test-key" });
    await expect(
      client.searchNearby({ lat: 0, lng: 0, radiusMeters: 50 }),
    ).rejects.toThrow(/foursquare/i);
  });
});
