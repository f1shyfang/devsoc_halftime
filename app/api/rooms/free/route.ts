import { FreeroomsError } from "@/lib/freerooms/client";
import { getFreeRooms } from "@/lib/rooms/get-free-rooms";
import type { GetFreeRoomsParams } from "@/lib/rooms/types";
import { createCachedFreeroomsClient, readBuildingEnrichments } from "@/lib/rooms/freerooms-cache";

const VALID_USAGES = new Set([
  "AUD",
  "CMLB",
  "LAB",
  "LCTR",
  "MEET",
  "SDIO",
  "TUSM",
]);
const VALID_STATUSES = new Set(["free", "soon", "all"]);

type ParsedParams =
  | { ok: true; value: GetFreeRoomsParams }
  | { ok: false; param: string }
  | { ok: false; pair: "near_lat_lng" };

function parseParams(url: URL): ParsedParams {
  const params: GetFreeRoomsParams = {};
  const q = url.searchParams;

  const at = q.get("at");
  if (at !== null) {
    if (Number.isNaN(Date.parse(at))) return { ok: false, param: "at" };
    params.at = at;
  }

  const capacity = q.get("capacity");
  if (capacity !== null) {
    const n = Number(capacity);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0)
      return { ok: false, param: "capacity" };
    params.capacity = n;
  }

  const duration = q.get("duration");
  if (duration !== null) {
    const n = Number(duration);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0)
      return { ok: false, param: "duration" };
    params.duration = n;
  }

  const usage = q.get("usage");
  if (usage !== null) {
    if (!VALID_USAGES.has(usage)) return { ok: false, param: "usage" };
    params.usage = usage;
  }

  const statusFilter = q.get("status");
  if (statusFilter !== null) {
    if (!VALID_STATUSES.has(statusFilter))
      return { ok: false, param: "status" };
    params.statusFilter = statusFilter as GetFreeRoomsParams["statusFilter"];
  }

  const nearLat = q.get("near_lat");
  const nearLng = q.get("near_lng");
  if ((nearLat === null) !== (nearLng === null)) {
    return { ok: false, pair: "near_lat_lng" };
  }
  if (nearLat !== null) {
    const n = Number(nearLat);
    if (!Number.isFinite(n)) return { ok: false, param: "near_lat" };
    params.nearLat = n;
  }
  if (nearLng !== null) {
    const n = Number(nearLng);
    if (!Number.isFinite(n)) return { ok: false, param: "near_lng" };
    params.nearLng = n;
  }

  return { ok: true, value: params };
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = parseParams(url);
  if (!parsed.ok) {
    if ("pair" in parsed) {
      return Response.json(
        {
          error: "invalid_param_pair",
          message:
            "near_lat and near_lng must be provided together (both set, or neither).",
          params: ["near_lat", "near_lng"],
        },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "invalid_param", param: parsed.param },
      { status: 400 },
    );
  }

  try {
    const result = await getFreeRooms(parsed.value, {
      freerooms: createCachedFreeroomsClient(),
      readEnrichments: readBuildingEnrichments,
    });
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof FreeroomsError) {
      return Response.json(
        { error: "rooms_service_unavailable" },
        { status: 503 },
      );
    }
    throw err;
  }
}
