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
  const { data: sessions } = await supabase
    .from("quest_hunt_sessions")
    .select("*, quest_teams!inner(id, name)")
    .eq("hunt_id", hunt.id);

  const { data: clues } = await supabase
    .from("quest_clues")
    .select("id, tier, sequence_in_tier")
    .eq("hunt_id", hunt.id)
    .order("tier", { ascending: true })
    .order("sequence_in_tier", { ascending: true });

  const myTeamId = await (async () => {
    const { data } = await supabase
      .from("quest_team_members")
      .select("team_id, quest_teams!inner(hunt_id)")
      .eq("user_id", user.id);
    const mine = (data ?? []).find(
      (m) => (m.quest_teams as unknown as { hunt_id: string }).hunt_id === hunt.id,
    );
    return mine?.team_id ?? null;
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
