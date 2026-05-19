import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StandingsView } from "./standings-view";

export const metadata = { title: "UNSW Quest · Standings" };

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ huntSlug: string }>;
}) {
  const { huntSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/quest/demo/${huntSlug}/standings`);

  const { data: hunt } = await supabase
    .from("quest_hunts")
    .select("*")
    .eq("slug", huntSlug)
    .maybeSingle();
  if (!hunt) notFound();

  // Initial fetch — client subscribes to updates from here.
  const { data: sessionsRaw } = await supabase
    .from("quest_hunt_sessions")
    .select("*")
    .eq("hunt_id", hunt.id);
  const sessionTeamIds = (sessionsRaw ?? []).map((s) => s.team_id);
  const { data: teamsForSessions } = sessionTeamIds.length
    ? await supabase
        .from("quest_teams")
        .select("id, name")
        .in("id", sessionTeamIds)
    : { data: [] };
  const teamNameById = new Map((teamsForSessions ?? []).map((t) => [t.id, t.name]));
  const sessions = (sessionsRaw ?? []).map((s) => ({
    ...s,
    quest_teams: { id: s.team_id, name: teamNameById.get(s.team_id) ?? "Team" },
  }));

  const { data: clues } = await supabase
    .from("quest_clues")
    .select("id, tier, sequence_in_tier")
    .eq("hunt_id", hunt.id)
    .order("tier", { ascending: true })
    .order("sequence_in_tier", { ascending: true });

  const myTeamId = await (async () => {
    const { data: mems } = await supabase
      .from("quest_team_members")
      .select("team_id")
      .eq("user_id", user.id);
    const ids = (mems ?? []).map((m) => m.team_id);
    if (ids.length === 0) return null;
    const { data: matching } = await supabase
      .from("quest_teams")
      .select("id")
      .in("id", ids)
      .eq("hunt_id", hunt.id)
      .limit(1);
    return matching?.[0]?.id ?? null;
  })();

  return (
    <div className="viewer" style={{ gap: 16 }}>
      <div className="crumbs">
        <Link href="/quest/demo">demo</Link>
        <span className="sep">/</span>
        <Link href={`/quest/demo/${huntSlug}`}>{hunt.slug}</Link>
        <span className="sep">/</span>
        <span>standings</span>
      </div>

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
