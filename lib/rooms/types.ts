import type { RoomStatus } from "@/lib/freerooms/types";

export type FreeRoomBuilding = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  photo_url: string | null;
  address: string | null;
};

export type FreeRoomRecord = {
  room_id: string;
  room_name: string;
  abbr: string;
  capacity: number;
  usage: string;
  school: string;
  building: FreeRoomBuilding;
  status: RoomStatus;
  free_until: string | null;
};

export type FreeRoomsResponse = {
  as_of: string;            // ISO timestamp
  rooms: FreeRoomRecord[];
};

export type GetFreeRoomsParams = {
  at?: string;
  capacity?: number;
  usage?: string;
  duration?: number;
  statusFilter?: "free" | "soon" | "all";
  nearLat?: number;
  nearLng?: number;
};
