import type { FoursquarePhoto, FoursquarePlace } from "./types";

const DEFAULT_BASE_URL = "https://api.foursquare.com/v3";

export type FoursquareClient = {
  searchNearby: (args: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
  }) => Promise<FoursquarePlace[]>;
  getFirstPhoto: (placeId: string) => Promise<FoursquarePhoto | null>;
};

export type FoursquareClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class FoursquareError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string,
  ) {
    super(`foursquare ${endpoint} failed (${status}): ${message}`);
    this.name = "FoursquareError";
  }
}

export function createFoursquareClient(
  options: FoursquareClientOptions,
): FoursquareClient {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = {
    Authorization: options.apiKey,
    Accept: "application/json",
  } as const;

  async function get<T>(path: string, search?: URLSearchParams): Promise<T> {
    const url = search
      ? `${baseUrl}${path}?${search.toString()}`
      : `${baseUrl}${path}`;
    const res = await fetchImpl(url, { method: "GET", headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FoursquareError(path, res.status, body.slice(0, 200));
    }
    return (await res.json()) as T;
  }

  return {
    async searchNearby({ lat, lng, radiusMeters, limit = 20 }) {
      const params = new URLSearchParams({
        ll: `${lat},${lng}`,
        radius: String(radiusMeters),
        limit: String(limit),
        fields: "fsq_place_id,name,location,distance",
      });
      const data = await get<{ results: FoursquarePlace[] }>(
        "/places/search",
        params,
      );
      return data.results;
    },

    async getFirstPhoto(placeId: string) {
      const params = new URLSearchParams({ limit: "1" });
      const data = await get<FoursquarePhoto[]>(
        `/places/${encodeURIComponent(placeId)}/photos`,
        params,
      );
      return data.length === 0 ? null : data[0];
    },
  };
}

export function buildPhotoUrl(photo: FoursquarePhoto): string {
  return `${photo.prefix}original${photo.suffix}`;
}
