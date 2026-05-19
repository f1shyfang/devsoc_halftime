export type FreeroomsBuilding = {
  id: string;            // e.g. "K-J17"
  name: string;          // e.g. "Ainsworth Building"
  lat: number;
  long: number;
  aliases: string[];
};

export type FreeroomsRoom = {
  id: string;            // e.g. "K-J17-305"
  name: string;
  abbr: string;
  usage: FreeroomsUsage;
  capacity: number;
  school: string;
};

export type FreeroomsUsage =
  | "AUD"
  | "CMLB"
  | "LAB"
  | "LCTR"
  | "MEET"
  | "SDIO"
  | "TUSM"
  | string;  // allow forward-compat for unknown codes

export type RoomStatus = "free" | "soon" | "busy";

export type FreeroomsRoomStatus = {
  status: RoomStatus;
  endtime: string;       // ISO string or "" when not applicable
};

// Response shape from GET /api/rooms/status:
// { [building_id]: { [room_number]: FreeroomsRoomStatus } }
export type FreeroomsStatusResponse = Record<
  string,
  Record<string, FreeroomsRoomStatus>
>;

export type FreeroomsStatusQuery = {
  datetime?: string;
  capacity?: number;
  duration?: number;
  usage?: string;
  location?: "upper" | "lower";
};
