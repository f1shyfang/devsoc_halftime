import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { questHunts, questHuntSessions, questClues, questClueProgress, questTeams, questTeamMembers, questProfiles } from "@/lib/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDeviceIdServer } from "@/lib/device-id.server";
import { PlayShell } from "./play-shell";
import { Crumbs } from "../../_components/Crumbs";
import type { Hunt, Clue, Session, TeamSummary, MemberRow, ProgressRow } from "./types";

export const metadata = { title: "UNSW Quest · Play" };

export default async function PlayPage({
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

  // Find this user's team for the hunt. Two-step lookup so we don't hit
  // RLS gotchas on the implicit team_members → teams join.
  const myMemberships = await db
    .select({ team_id: questTeamMembers.teamId })
    .from(questTeamMembers)
    .where(eq(questTeamMembers.userId, deviceId));
  const teamIds = myMemberships.map((m) => m.team_id);
  if (teamIds.length === 0) {
    redirect(`/quest/demo/${huntSlug}`);
  }
  const candidateTeams = await db
    .select({ id: questTeams.id, hunt_id: questTeams.huntId, name: questTeams.name, invite_code: questTeams.inviteCode, leader_user_id: questTeams.leaderUserId })
    .from(questTeams)
    .where(and(inArray(questTeams.id, teamIds), eq(questTeams.huntId, hunt.id)));
  const myTeam = candidateTeams[0] as TeamSummary | undefined;
  if (!myTeam) {
    redirect(`/quest/demo/${huntSlug}`);
  }

  const [sessionRows, rawMembers, clues] = await Promise.all([
    db
      .select({ id: questHuntSessions.id, team_id: questHuntSessions.teamId, hunt_id: questHuntSessions.huntId, state: questHuntSessions.state, started_at: questHuntSessions.startedAt, completed_at: questHuntSessions.completedAt, current_tier: questHuntSessions.currentTier, current_sequence: questHuntSessions.currentSequence, hint_penalty_seconds: questHuntSessions.hintPenaltySeconds, total_time_seconds: questHuntSessions.totalTimeSeconds, created_at: questHuntSessions.createdAt, abandoned_at: questHuntSessions.abandonedAt, results_card_url: questHuntSessions.resultsCardUrl })
      .from(questHuntSessions)
      .where(eq(questHuntSessions.teamId, myTeam.id))
      .limit(1),
    db
      .select({ user_id: questTeamMembers.userId, joined_at: questTeamMembers.joinedAt })
      .from(questTeamMembers)
      .where(eq(questTeamMembers.teamId, myTeam.id)),
    db
      .select({ id: questClues.id, hunt_id: questClues.huntId, tier: questClues.tier, sequence_in_tier: questClues.sequenceInTier, type: questClues.type, body_text: questClues.bodyText, image_url: questClues.imageUrl, verification_type: questClues.verificationType, location_name: questClues.locationName, location_lat: questClues.locationLat, location_lng: questClues.locationLng, geofence_radius_m: questClues.geofenceRadiusM, qr_code_payload: questClues.qrCodePayload, photo_challenge_prompt: questClues.photoChallengePrompt, hints: questClues.hints })
      .from(questClues)
      .where(eq(questClues.huntId, hunt.id))
      .orderBy(asc(questClues.tier), asc(questClues.sequenceInTier)),
  ]);
  const session = sessionRows[0] ?? null;

  const memberUserIds = rawMembers.map((m) => m.user_id);
  const profiles = memberUserIds.length
    ? await db
        .select({ user_id: questProfiles.userId, display_name: questProfiles.displayName, avatar_color: questProfiles.avatarColor })
        .from(questProfiles)
        .where(inArray(questProfiles.userId, memberUserIds))
    : [];
  const profileById = new Map<string, { display_name: string; avatar_color: string }>(
    profiles.map((p) => [
      p.user_id,
      { display_name: p.display_name, avatar_color: p.avatar_color },
    ]),
  );
  const members = rawMembers.map((m) => ({
    user_id: m.user_id,
    joined_at: m.joined_at,
    display_name: profileById.get(m.user_id)?.display_name ?? "Player",
    avatar_color: profileById.get(m.user_id)?.avatar_color ?? "#ef5b3a",
  }));

  if (!session) {
    redirect(`/quest/demo/${huntSlug}`);
  }

  const progress = await db
    .select({ id: questClueProgress.id, hunt_session_id: questClueProgress.huntSessionId, clue_id: questClueProgress.clueId, unlocked_at: questClueProgress.unlockedAt, hints_used: questClueProgress.hintsUsed, manual_override: questClueProgress.manualOverride, photo_capture_url: questClueProgress.photoCaptureUrl, maps_used: questClueProgress.mapsUsed })
    .from(questClueProgress)
    .where(eq(questClueProgress.huntSessionId, session.id));

  if (session.state === "completed") {
    redirect(`/quest/demo/${huntSlug}/finale`);
  }

  return (
    <PlayShell
      hunt={hunt as Hunt}
      session={session as Session}
      team={myTeam}
      currentUserId={deviceId}
      members={members as MemberRow[]}
      clues={(clues ?? []) as Clue[]}
      initialProgress={(progress ?? []) as ProgressRow[]}
      headerSlot={
        <Crumbs
          items={[
            { key: "demo", href: "/quest/demo", label: "demo" },
            { key: "hunt", href: `/quest/demo/${huntSlug}`, label: hunt.slug },
            { key: "play", label: "play" },
          ]}
        />
      }
    />
  );
}
