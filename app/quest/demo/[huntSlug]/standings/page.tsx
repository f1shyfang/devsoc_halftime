import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { questHunts, questHuntSessions, questClues, questTeams, questTeamMembers } from "@/lib/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDeviceIdServer } from "@/lib/device-id.server";
import { StandingsView } from "./standings-view";
import { Crumbs } from "../../_components/Crumbs";

export const metadata = { title: "UNSW Quest · Standings" };

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ huntSlug: string }>;
}) {
  const { huntSlug } = await params;
  const deviceId = await getDeviceIdServer();

  const hunt =
    (
      await db
        .select({ id: questHunts.id, slug: questHunts.slug, name: questHunts.name, description: questHunts.description, duration_minutes: questHunts.durationMinutes, recommended_team_size: questHunts.recommendedTeamSize, hero_emoji: questHunts.heroEmoji, status: questHunts.status, created_at: questHunts.createdAt })
        .from(questHunts)
        .where(eq(questHunts.slug, huntSlug))
        .limit(1)
    )[0] ?? null;
  if (!hunt) notFound();

  // Initial fetch — client subscribes to updates from here.
  const sessionsRaw = await db
    .select({ id: questHuntSessions.id, team_id: questHuntSessions.teamId, hunt_id: questHuntSessions.huntId, state: questHuntSessions.state, started_at: questHuntSessions.startedAt, completed_at: questHuntSessions.completedAt, current_tier: questHuntSessions.currentTier, current_sequence: questHuntSessions.currentSequence, hint_penalty_seconds: questHuntSessions.hintPenaltySeconds, total_time_seconds: questHuntSessions.totalTimeSeconds, created_at: questHuntSessions.createdAt, abandoned_at: questHuntSessions.abandonedAt, results_card_url: questHuntSessions.resultsCardUrl })
    .from(questHuntSessions)
    .where(eq(questHuntSessions.huntId, hunt.id));
  const sessionTeamIds = sessionsRaw.map((s) => s.team_id);
  const teamsForSessions = sessionTeamIds.length
    ? await db
        .select({ id: questTeams.id, name: questTeams.name })
        .from(questTeams)
        .where(inArray(questTeams.id, sessionTeamIds))
    : [];
  const teamNameById = new Map(teamsForSessions.map((t) => [t.id, t.name]));
  const sessions = sessionsRaw.map((s) => ({
    ...s,
    quest_teams: { id: s.team_id, name: teamNameById.get(s.team_id) ?? "Team" },
  }));

  const clues = await db
    .select({ id: questClues.id, tier: questClues.tier, sequence_in_tier: questClues.sequenceInTier })
    .from(questClues)
    .where(eq(questClues.huntId, hunt.id))
    .orderBy(asc(questClues.tier), asc(questClues.sequenceInTier));

  const myTeamId = await (async () => {
    const mems = await db
      .select({ team_id: questTeamMembers.teamId })
      .from(questTeamMembers)
      .where(eq(questTeamMembers.userId, deviceId));
    const ids = mems.map((m) => m.team_id);
    if (ids.length === 0) return null;
    const matching = await db
      .select({ id: questTeams.id })
      .from(questTeams)
      .where(and(inArray(questTeams.id, ids), eq(questTeams.huntId, hunt.id)))
      .limit(1);
    return matching[0]?.id ?? null;
  })();

  return (
    <div className="viewer" style={{ gap: 16 }}>
      <Crumbs
        items={[
          { key: "demo", href: "/quest/demo", label: "demo" },
          { key: "hunt", href: `/quest/demo/${huntSlug}`, label: hunt.slug },
          { key: "standings", label: "standings" },
        ]}
      />

      <StandingsView
        huntId={hunt.id}
        huntName={hunt.name}
        myTeamId={myTeamId}
        initialSessions={
          (sessions ?? []).map((s) => ({
            ...s,
            team_name: (s.quest_teams as unknown as { name: string }).name,
          })) as never
        }
        totalClues={clues?.length ?? 0}
      />

      <Link
        href={`/quest/demo/${huntSlug}/play`}
        className="muted small"
        style={{ borderBottom: "1px dashed currentColor" }}
      >
        ← back to hunt
      </Link>
    </div>
  );
}
