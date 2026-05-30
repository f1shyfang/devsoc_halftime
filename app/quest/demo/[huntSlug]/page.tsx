import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { questHunts, questClues, questTeams, questTeamMembers } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getDeviceIdServer } from "@/lib/device-id.server";
import { TeamGate } from "./team-gate";

export const metadata = { title: "UNSW Quest · Hunt detail" };

export default async function HuntDetailPage({
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

  // If user is already in a team for this hunt, send them straight in.
  const myMemberships = await db
    .select({ team_id: questTeamMembers.teamId })
    .from(questTeamMembers)
    .where(eq(questTeamMembers.userId, deviceId));
  const myTeamIds = myMemberships.map((m) => m.team_id);
  if (myTeamIds.length > 0) {
    const matching = await db
      .select({ id: questTeams.id })
      .from(questTeams)
      .where(and(inArray(questTeams.id, myTeamIds), eq(questTeams.huntId, hunt.id)))
      .limit(1);
    if (matching.length > 0) {
      redirect(`/quest/demo/${huntSlug}/play`);
    }
  }

  const clueCount = await db
    .select({ id: questClues.id })
    .from(questClues)
    .where(eq(questClues.huntId, hunt.id));

  return (
    <div className="viewer" style={{ gap: 20 }}>
      <div className="crumbs">
        <Link href="/quest/demo">demo</Link>
        <span className="sep">/</span>
        <span>{hunt.slug}</span>
      </div>

      <div style={{ textAlign: "center" }}>
        <div className="hand" style={{ fontSize: 14, letterSpacing: "0.2em", color: "var(--quest-muted)" }}>
          {hunt.duration_minutes}MIN · TEAMS OF {hunt.recommended_team_size}
        </div>
        <div className="hand" style={{ fontSize: 40, lineHeight: 1, marginTop: 4 }}>
          {hunt.hero_emoji} {hunt.name}
        </div>
      </div>

      <div className="card" style={{ width: "min(100%, 420px)", padding: 18 }}>
        <div className="p">{hunt.description}</div>
        <div className="row gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <div className="pill ghost">{clueCount?.length ?? 0} clues</div>
          <div className="pill ghost">GPS + photo</div>
          <div className="pill ghost">Live leaderboard</div>
        </div>
      </div>

      <Suspense fallback={null}>
        <TeamGate huntId={hunt.id} huntSlug={hunt.slug} />
      </Suspense>
    </div>
  );
}
