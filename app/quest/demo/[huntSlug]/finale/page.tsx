import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { questHunts, questHuntSessions, questClues, questClueProgress, questTeams, questTeamMembers } from "@/lib/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDeviceIdServer } from "@/lib/device-id.server";
import { Crumbs } from "../../_components/Crumbs";
import { FinaleActions } from "./FinaleActions";

export const metadata = { title: "UNSW Quest · Finale" };

export default async function FinalePage({
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

  // Find this user's team for the hunt (two-step, no implicit join).
  const mems = await db
    .select({ team_id: questTeamMembers.teamId })
    .from(questTeamMembers)
    .where(eq(questTeamMembers.userId, deviceId));
  const teamIds = mems.map((m) => m.team_id);
  if (teamIds.length === 0) redirect(`/quest/demo/${huntSlug}`);
  const teamsFound = await db
    .select({ id: questTeams.id, hunt_id: questTeams.huntId, name: questTeams.name, invite_code: questTeams.inviteCode })
    .from(questTeams)
    .where(and(inArray(questTeams.id, teamIds), eq(questTeams.huntId, hunt.id)))
    .limit(1);
  const team = teamsFound[0];
  if (!team) redirect(`/quest/demo/${huntSlug}`);

  const session =
    (
      await db
        .select({ id: questHuntSessions.id, team_id: questHuntSessions.teamId, hunt_id: questHuntSessions.huntId, state: questHuntSessions.state, started_at: questHuntSessions.startedAt, completed_at: questHuntSessions.completedAt, current_tier: questHuntSessions.currentTier, current_sequence: questHuntSessions.currentSequence, hint_penalty_seconds: questHuntSessions.hintPenaltySeconds, total_time_seconds: questHuntSessions.totalTimeSeconds, created_at: questHuntSessions.createdAt, abandoned_at: questHuntSessions.abandonedAt, results_card_url: questHuntSessions.resultsCardUrl })
        .from(questHuntSessions)
        .where(eq(questHuntSessions.teamId, team.id))
        .limit(1)
    )[0] ?? null;

  if (!session) redirect(`/quest/demo/${huntSlug}/play`);
  if (session.state !== "completed") redirect(`/quest/demo/${huntSlug}/play`);

  // Compute rank.
  const allSessions = await db
    .select({ id: questHuntSessions.id, team_id: questHuntSessions.teamId, state: questHuntSessions.state, total_time_seconds: questHuntSessions.totalTimeSeconds })
    .from(questHuntSessions)
    .where(eq(questHuntSessions.huntId, hunt.id));

  const completed = allSessions.filter((s) => s.state === "completed");
  completed.sort((a, b) => (a.total_time_seconds ?? 0) - (b.total_time_seconds ?? 0));
  const rank = completed.findIndex((s) => s.id === session.id) + 1;

  // Progress + photo gallery.
  const progress = await db
    .select({ clue_id: questClueProgress.clueId, hints_used: questClueProgress.hintsUsed, manual_override: questClueProgress.manualOverride, photo_capture_url: questClueProgress.photoCaptureUrl, unlocked_at: questClueProgress.unlockedAt })
    .from(questClueProgress)
    .where(eq(questClueProgress.huntSessionId, session.id))
    .orderBy(asc(questClueProgress.unlockedAt));

  // Clue lookup (for photo captions). Pull only what we need for this hunt.
  const clueRows = await db
    .select({ id: questClues.id, photo_challenge_prompt: questClues.photoChallengePrompt, location_name: questClues.locationName })
    .from(questClues)
    .where(eq(questClues.huntId, hunt.id));
  const clueById = new Map(
    clueRows.map((c) => [c.id, c]),
  );

  const hintsUsed = progress.reduce((n, p) => n + (p.hints_used ?? 0), 0);
  const overrides = progress.filter((p) => p.manual_override).length;
  const photosCount = progress.filter((p) => p.photo_capture_url).length;

  // Only include photos with a real, fetchable URL — play-shell falls back to
  // an "inline:data:…" stub when storage upload fails; those can't be rendered
  // as <img src>.
  const photos = progress
    .filter((p) => typeof p.photo_capture_url === "string" && p.photo_capture_url.startsWith("http"))
    .map((p) => {
      const c = clueById.get(p.clue_id);
      return {
        url: p.photo_capture_url as string,
        prompt: c?.photo_challenge_prompt ?? null,
        location: c?.location_name ?? null,
      };
    });

  const totalSec = session.total_time_seconds ?? 0;
  const rankSuffix = rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
  const rankLabel = rank > 0 ? `${rank}${rankSuffix}` : "";
  const medal: "medal" | "flag" = rank >= 1 && rank <= 3 ? "medal" : "flag";

  return (
    <div className="viewer" style={{ gap: 16 }}>
      <Crumbs
        items={[
          { key: "demo", href: "/quest/demo", label: "demo" },
          { key: "hunt", href: `/quest/demo/${huntSlug}`, label: hunt.slug },
          { key: "finale", label: "finale" },
        ]}
      />

      <FinaleActions
        huntName={hunt.name}
        teamName={team.name}
        totalSec={totalSec}
        rank={rank}
        totalCompleted={completed.length}
        rankLabel={rankLabel}
        medal={medal}
        hintsUsed={hintsUsed}
        photosCount={photosCount}
        overrides={overrides}
        photos={photos}
      />

      <Link
        href={`/quest/demo/${huntSlug}/standings`}
        className="btn ghost"
        style={{
          width: "min(100%, 560px)",
          minHeight: 44,
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        <span>↗</span> See full standings
      </Link>

      <Link
        href="/quest/demo"
        className="muted small"
        style={{ borderBottom: "1px dashed currentColor" }}
      >
        back to hunts
      </Link>
    </div>
  );
}
