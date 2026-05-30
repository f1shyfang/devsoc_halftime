import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { questHuntSessions } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const r = (
    await db.select().from(questHuntSessions).where(eq(questHuntSessions.id, id)).limit(1)
  )[0];
  if (!r) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    {
      id: r.id,
      team_id: r.teamId,
      hunt_id: r.huntId,
      state: r.state,
      started_at: r.startedAt,
      completed_at: r.completedAt,
      current_tier: r.currentTier,
      current_sequence: r.currentSequence,
      hint_penalty_seconds: r.hintPenaltySeconds,
      total_time_seconds: r.totalTimeSeconds,
      created_at: r.createdAt,
      abandoned_at: r.abandonedAt,
      results_card_url: r.resultsCardUrl,
    },
    { status: 200 },
  );
}
