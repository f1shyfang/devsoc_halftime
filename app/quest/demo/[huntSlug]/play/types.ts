import type { Tables } from "@/lib/supabase/database.types";

export type Hunt = Tables<"quest_hunts">;
export type Clue = Tables<"quest_clues">;
export type Session = Tables<"quest_hunt_sessions">;
export type ProgressRow = Tables<"quest_clue_progress">;

export type TeamSummary = {
  id: string;
  hunt_id: string;
  name: string;
  invite_code: string;
  leader_user_id: string;
};

export type MemberRow = {
  user_id: string;
  joined_at: string;
  display_name: string;
  avatar_color: string;
};

export type Hint = { idx: 0 | 1; body: string };
