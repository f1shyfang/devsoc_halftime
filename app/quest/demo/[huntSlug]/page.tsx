import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamGate } from "./team-gate";

export const metadata = { title: "UNSW Quest · Hunt detail" };

export default async function HuntDetailPage({
  params,
}: {
  params: Promise<{ huntSlug: string }>;
}) {
  const { huntSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/quest/demo/${huntSlug}`);

  const { data: hunt } = await supabase
    .from("quest_hunts")
    .select("*")
    .eq("slug", huntSlug)
    .maybeSingle();

  if (!hunt) notFound();

  // If user is already in a team for this hunt, send them straight in.
  const { data: myMemberships } = await supabase
    .from("quest_team_members")
    .select("team_id")
    .eq("user_id", user.id);
  const myTeamIds = (myMemberships ?? []).map((m) => m.team_id);
  if (myTeamIds.length > 0) {
    const { data: matching } = await supabase
      .from("quest_teams")
      .select("id")
      .in("id", myTeamIds)
      .eq("hunt_id", hunt.id)
      .limit(1);
    if (matching && matching.length > 0) {
      redirect(`/quest/demo/${huntSlug}/play`);
    }
  }

  const { data: clueCount } = await supabase
    .from("quest_clues")
    .select("id", { count: "exact", head: false })
    .eq("hunt_id", hunt.id);

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
