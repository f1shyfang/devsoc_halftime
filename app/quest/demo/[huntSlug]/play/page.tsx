import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayShell } from "./play-shell";
import type { Hunt, Clue, Session, TeamSummary, MemberRow, ProgressRow } from "./types";

export const metadata = { title: "UNSW Quest · Play" };

export default async function PlayPage({
  params,
}: {
  params: Promise<{ huntSlug: string }>;
}) {
  const { huntSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/quest/demo/${huntSlug}/play`);

  const { data: hunt } = await supabase
    .from("quest_hunts")
    .select("*")
    .eq("slug", huntSlug)
    .maybeSingle();
  if (!hunt) notFound();

  // Find this user's team for the hunt. Two-step lookup so we don't hit
  // RLS gotchas on the implicit team_members → teams join.
  const { data: myMemberships, error: memErr } = await supabase
    .from("quest_team_members")
    .select("team_id")
    .eq("user_id", user.id);
  if (memErr) {
    console.error("quest play: memberships fetch failed", memErr);
  }
  const teamIds = (myMemberships ?? []).map((m) => m.team_id);
  if (teamIds.length === 0) {
    redirect(`/quest/demo/${huntSlug}`);
  }
  const { data: candidateTeams, error: teamErr } = await supabase
    .from("quest_teams")
    .select("id, hunt_id, name, invite_code, leader_user_id")
    .in("id", teamIds)
    .eq("hunt_id", hunt.id);
  if (teamErr) {
    console.error("quest play: teams fetch failed", teamErr);
  }
  const myTeam = (candidateTeams ?? [])[0] as TeamSummary | undefined;
  if (!myTeam) {
    redirect(`/quest/demo/${huntSlug}`);
  }

  const [{ data: session }, { data: rawMembers }, { data: clues }] = await Promise.all([
    supabase
      .from("quest_hunt_sessions")
      .select("*")
      .eq("team_id", myTeam.id)
      .maybeSingle(),
    supabase
      .from("quest_team_members")
      .select("user_id, joined_at")
      .eq("team_id", myTeam.id),
    supabase
      .from("quest_clues")
      .select("*")
      .eq("hunt_id", hunt.id)
      .order("tier", { ascending: true })
      .order("sequence_in_tier", { ascending: true }),
  ]);

  const memberUserIds = (rawMembers ?? []).map((m) => m.user_id);
  const { data: profiles } = memberUserIds.length
    ? await supabase
        .from("quest_profiles")
        .select("user_id, display_name, avatar_color")
        .in("user_id", memberUserIds)
    : { data: [] };
  const profileById = new Map<string, { display_name: string; avatar_color: string }>(
    (profiles ?? []).map((p) => [
      p.user_id,
      { display_name: p.display_name, avatar_color: p.avatar_color },
    ]),
  );
  const members = (rawMembers ?? []).map((m) => ({
    user_id: m.user_id,
    joined_at: m.joined_at,
    display_name: profileById.get(m.user_id)?.display_name ?? "Player",
    avatar_color: profileById.get(m.user_id)?.avatar_color ?? "#ef5b3a",
  }));

  if (!session) {
    redirect(`/quest/demo/${huntSlug}`);
  }

  const { data: progress } = await supabase
    .from("quest_clue_progress")
    .select("*")
    .eq("hunt_session_id", session.id);

  if (session.state === "completed") {
    redirect(`/quest/demo/${huntSlug}/finale`);
  }

  return (
    <PlayShell
      hunt={hunt as Hunt}
      session={session as Session}
      team={myTeam}
      currentUserId={user.id}
      members={members as MemberRow[]}
      clues={(clues ?? []) as Clue[]}
      initialProgress={(progress ?? []) as ProgressRow[]}
      headerSlot={
        <div className="crumbs" style={{ marginBottom: 8 }}>
          <Link href="/quest/demo">demo</Link>
          <span className="sep">/</span>
          <Link href={`/quest/demo/${huntSlug}`}>{hunt.slug}</Link>
          <span className="sep">/</span>
          <span>play</span>
        </div>
      }
    />
  );
}
