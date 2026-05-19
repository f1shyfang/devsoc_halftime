import type { FreeroomsClient } from "@/lib/freerooms/client";
import type { RoomStatus } from "@/lib/freerooms/types";
import { haversineMeters } from "./distance";
import type {
  FreeRoomRecord,
  FreeRoomsResponse,
  GetFreeRoomsParams,
} from "./types";

export type EnrichmentRow = {
  building_id: string;
  photo_url: string | null;
  address: string | null;
};

export type ReadEnrichments = () => Promise<EnrichmentRow[]>;

export type GetFreeRoomsDeps = {
  freerooms: FreeroomsClient;
  readEnrichments: ReadEnrichments;
};

const STATUS_FREE: RoomStatus[] = ["free"];
const STATUS_SOON: RoomStatus[] = ["free", "soon"];
const STATUS_ALL: RoomStatus[] = ["free", "soon", "busy"];

function statusesFor(filter: GetFreeRoomsParams["statusFilter"]): RoomStatus[] {
  switch (filter) {
    case "all":
      return STATUS_ALL;
    case "soon":
      return STATUS_SOON;
    case "free":
    default:
      return STATUS_FREE;
  }
}

export async function getFreeRooms(
  params: GetFreeRoomsParams,
  deps: GetFreeRoomsDeps,
): Promise<FreeRoomsResponse> {
  const allowedStatuses = statusesFor(params.statusFilter);

  // Fetch live + reference data concurrently.
  const [buildings, rooms, status, enrichmentList] = await Promise.all([
    deps.freerooms.getBuildings(),
    deps.freerooms.getRooms(),
    deps.freerooms.getRoomStatus({
      datetime: params.at,
      capacity: params.capacity,
      usage: params.usage,
      duration: params.duration,
    }),
    deps.readEnrichments().catch(() => [] as EnrichmentRow[]),
  ]);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const enrichmentById = new Map(
    enrichmentList.map((e) => [e.building_id, e]),
  );

  const records: FreeRoomRecord[] = [];

  for (const [buildingId, roomMap] of Object.entries(status)) {
    const building = buildingById.get(buildingId);
    if (!building) continue;
    const enrichment = enrichmentById.get(buildingId);

    for (const [roomNumber, roomStatus] of Object.entries(roomMap)) {
      if (!allowedStatuses.includes(roomStatus.status)) continue;
      const roomId = `${buildingId}-${roomNumber}`;
      const room = rooms[roomId];
      if (!room) continue;

      records.push({
        room_id: room.id,
        room_name: room.name,
        abbr: room.abbr,
        capacity: room.capacity,
        usage: room.usage,
        school: room.school,
        building: {
          id: building.id,
          name: building.name,
          lat: building.lat,
          lng: building.long,
          photo_url: enrichment?.photo_url ?? null,
          address: enrichment?.address ?? null,
        },
        status: roomStatus.status,
        free_until:
          roomStatus.status === "busy" || !roomStatus.endtime
            ? null
            : roomStatus.endtime,
      });
    }
  }

  if (params.nearLat !== undefined && params.nearLng !== undefined) {
    const lat = params.nearLat;
    const lng = params.nearLng;
    records.sort(
      (a, b) =>
        haversineMeters(lat, lng, a.building.lat, a.building.lng) -
        haversineMeters(lat, lng, b.building.lat, b.building.lng),
    );
  }

  return {
    as_of: new Date().toISOString(),
    rooms: records,
  };
}
