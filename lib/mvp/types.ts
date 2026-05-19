export type MvpPuzzleType = "anagram" | "riddle_to_geocache" | "photo";

export type MvpPhase = "welcome" | "walk" | "puzzle" | "photo" | "completed";

export type MvpPuzzlePublic = {
  id: string;
  type: MvpPuzzleType;
  prompt: string;
  optional?: boolean;
};

export type MvpPlayerState = {
  player_id: string;
  name: string;
  game_id: string;
  phase: MvpPhase;
  start_location?: string;
  walk_prompt?: string;
  elapsed_seconds?: number;
  total_time_seconds?: number | null;
  puzzle?: MvpPuzzlePublic;
  ok?: boolean | null;
  message?: string | null;
};

export type MvpLeaderboardRow = {
  id: string;
  name: string;
  completed_at: string | null;
  started_at: string | null;
  total_time_seconds: number | null;
};
