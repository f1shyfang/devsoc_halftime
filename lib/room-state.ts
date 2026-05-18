export type RoomState =
  | "waiting"
  | "in_progress"
  | "complete"
  | "judging"
  | "done";

export const VALID_STATES: readonly RoomState[] = [
  "waiting",
  "in_progress",
  "complete",
  "judging",
  "done",
];

export type RoomMeta = {
  player1: string;
  player2: string;
  prompt: string;
  stake: number;
  state: RoomState;
  turn_count: number;
  verdict?: string;
  created_at: number;
};

export type TurnEntry = {
  player: string;
  transcript: string;
  turn_index: number;
  audio_duration_ms?: number;
};

export function canSubmitTurn(state: RoomState): boolean {
  return state === "waiting" || state === "in_progress";
}

export function canJudge(state: RoomState): boolean {
  return state === "complete";
}

export function nextStateAfterTurn(
  prevState: RoomState,
  turnCount: number,
  totalTurns: number
): RoomState {
  if (turnCount >= totalTurns) return "complete";
  return prevState === "waiting" ? "in_progress" : prevState;
}

export function generateRoomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function roomMetaKey(roomId: string) {
  return `room:${roomId}:meta`;
}
export function roomTurnsKey(roomId: string) {
  return `room:${roomId}:turns`;
}
export function roomJudgingLockKey(roomId: string) {
  return `room:${roomId}:judging`;
}
