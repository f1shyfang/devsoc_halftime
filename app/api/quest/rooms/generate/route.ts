import { FreeroomsError } from "@/lib/freerooms/client";
import { getFreeRooms } from "@/lib/rooms/get-free-rooms";
import { selectRoomsForHunt } from "@/lib/rooms/select-rooms";
import { buildRoomHuntDraft } from "@/lib/quest/generate-room-hunt";
import { createRoomHunt } from "@/lib/quest/create-room-hunt";
import { createCachedFreeroomsClient, readBuildingEnrichments } from "@/lib/rooms/freerooms-cache";

const VALID_USAGES = new Set(["AUD", "CMLB", "LAB", "LCTR", "MEET", "SDIO", "TUSM"]);
const MAX_COUNT = 27; // 3 tiers * 9 clues
const DEFAULT_COUNT = 6;

type Body = {
  count?: number;
  capacity?: number;
  usage?: string;
  nearLat?: number;
  nearLng?: number;
};

type Parsed =
  | { ok: true; value: Required<Pick<Body, "count">> & Body }
  | { ok: false; param: string };

function parseBody(raw: Body): Parsed {
  const value: Body & { count: number } = { count: DEFAULT_COUNT };

  if (raw.count !== undefined) {
    if (!Number.isInteger(raw.count) || raw.count < 1 || raw.count > MAX_COUNT) {
      return { ok: false, param: "count" };
    }
    value.count = raw.count;
  }
  if (raw.capacity !== undefined) {
    if (!Number.isInteger(raw.capacity) || raw.capacity < 0) {
      return { ok: false, param: "capacity" };
    }
    value.capacity = raw.capacity;
  }
  if (raw.usage !== undefined) {
    if (!VALID_USAGES.has(raw.usage)) return { ok: false, param: "usage" };
    value.usage = raw.usage;
  }
  const hasLat = raw.nearLat !== undefined;
  const hasLng = raw.nearLng !== undefined;
  if (hasLat !== hasLng) return { ok: false, param: "near_lat_lng" };
  if (hasLat) {
    if (!Number.isFinite(raw.nearLat)) return { ok: false, param: "nearLat" };
    if (!Number.isFinite(raw.nearLng)) return { ok: false, param: "nearLng" };
    value.nearLat = raw.nearLat;
    value.nearLng = raw.nearLng;
  }
  return { ok: true, value };
}

export async function POST(req: Request): Promise<Response> {
  let raw: Body;
  try {
    raw = (await req.json()) as Body;
  } catch {
    raw = {};
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return Response.json({ error: "invalid_param", param: parsed.param }, { status: 400 });
  }
  const { count, capacity, usage, nearLat, nearLng } = parsed.value;

  try {
    const free = await getFreeRooms(
      { statusFilter: "free", capacity, usage, nearLat, nearLng },
      { freerooms: createCachedFreeroomsClient(), readEnrichments: readBuildingEnrichments },
    );

    const selected = selectRoomsForHunt(free.rooms, {
      count,
      capacity,
      usage,
      nearLat,
      nearLng,
    });
    if (!selected) {
      return Response.json({ error: "no_free_rooms" }, { status: 422 });
    }

    const slug = `rooms-${crypto.randomUUID().slice(0, 8)}`;
    const draft = buildRoomHuntDraft(selected.rooms, { slug });
    const created = await createRoomHunt(draft);

    return Response.json(
      { slug: created.slug, huntId: created.huntId, hub_room: selected.hub, rooms: selected.rooms },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof FreeroomsError) {
      return Response.json({ error: "rooms_service_unavailable" }, { status: 503 });
    }
    throw err;
  }
}
