import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { questHuntSessions, questTeams } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ huntId: string }> },
): Promise<Response> {
  const { huntId } = await params;
  const raw = await db.select().from(questHuntSessions).where(eq(questHuntSessions.huntId, huntId));
  const teamIds = raw.map((s) => s.teamId);
  const teams = teamIds.length
    ? await db.select({ id: questTeams.id, name: questTeams.name }).from(questTeams).where(inArray(questTeams.id, teamIds))
    : [];
  const byId = new Map(teams.map((t) => [t.id, t.name]));
  const sessions = raw.map((s) => ({
    id: s.id,
    team_id: s.teamId,
    team_name: byId.get(s.teamId) ?? "Team",
    state: s.state,
    current_tier: s.currentTier,
    current_sequence: s.currentSequence,
    started_at: s.startedAt,
    completed_at: s.completedAt,
    hint_penalty_seconds: s.hintPenaltySeconds,
    total_time_seconds: s.totalTimeSeconds,
  }));
  return Response.json({ sessions }, { status: 200 });
}
