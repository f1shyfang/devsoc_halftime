import type {
  FreeroomsBuilding,
  FreeroomsRoom,
  FreeroomsStatusQuery,
  FreeroomsStatusResponse,
} from "./types";

export type FreeroomsClient = {
  getBuildings: () => Promise<FreeroomsBuilding[]>;
  getRooms: () => Promise<Record<string, FreeroomsRoom>>;
  getRoomStatus: (
    query?: FreeroomsStatusQuery,
  ) => Promise<FreeroomsStatusResponse>;
};

export type FreeroomsClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = "https://freerooms.devsoc.app/api";

export class FreeroomsError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string,
  ) {
    super(`freerooms ${endpoint} failed (${status}): ${message}`);
    this.name = "FreeroomsError";
  }
}

export function createFreeroomsClient(
  options: FreeroomsClientOptions = {},
): FreeroomsClient {
  const baseUrl =
    options.baseUrl ?? process.env.FREEROOMS_BASE_URL ?? DEFAULT_BASE_URL;

  async function get<T>(path: string, search?: URLSearchParams): Promise<T> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const url = search
      ? `${baseUrl}${path}?${search.toString()}`
      : `${baseUrl}${path}`;
    const res = await fetchImpl(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FreeroomsError(path, res.status, body.slice(0, 200));
    }
    return (await res.json()) as T;
  }

  return {
    async getBuildings() {
      const data = await get<{ buildings: FreeroomsBuilding[] }>("/buildings");
      return data.buildings;
    },

    async getRooms() {
      const data = await get<{ rooms: Record<string, FreeroomsRoom> }>(
        "/rooms",
      );
      return data.rooms;
    },

    async getRoomStatus(query: FreeroomsStatusQuery = {}) {
      const params = new URLSearchParams();
      if (query.datetime) params.set("datetime", query.datetime);
      if (query.capacity !== undefined)
        params.set("capacity", String(query.capacity));
      if (query.duration !== undefined)
        params.set("duration", String(query.duration));
      if (query.usage) params.set("usage", query.usage);
      if (query.location) params.set("location", query.location);

      const raw = await get<Record<string, unknown>>(
        "/rooms/status",
        params.size ? params : undefined,
      );

      // Upstream wraps each building as { numAvailable, roomStatuses: {...} }.
      // Normalize to our flat { [buildingId]: { [roomNumber]: status } } type.
      // Stay tolerant of an already-flat shape (used in tests / older API).
      const normalized: FreeroomsStatusResponse = {};
      for (const [buildingId, value] of Object.entries(raw)) {
        if (
          value &&
          typeof value === "object" &&
          "roomStatuses" in value &&
          typeof (value as { roomStatuses: unknown }).roomStatuses === "object"
        ) {
          normalized[buildingId] = (
            value as { roomStatuses: FreeroomsStatusResponse[string] }
          ).roomStatuses;
        } else {
          normalized[buildingId] = value as FreeroomsStatusResponse[string];
        }
      }
      return normalized;
    },
  };
}
