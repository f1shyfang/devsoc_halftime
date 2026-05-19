import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const deviceId = await getDeviceIdServer();

  const { data: hunt } = await supabase
    .from("quest_hunts")
    .select("*")
    .eq("slug", huntSlug)
    .maybeSingle();
  if (!hunt) notFound();

  // Find this user's team for the hunt (two-step, no implicit join).
  const { data: mems } = await supabase
    .from("quest_team_members")
    .select("team_id")
    .eq("user_id", deviceId);
  const teamIds = (mems ?? []).map((m) => m.team_id);
  if (teamIds.length === 0) redirect(`/quest/demo/${huntSlug}`);
  const { data: teamsFound } = await supabase
    .from("quest_teams")
    .select("id, hunt_id, name, invite_code")
    .in("id", teamIds)
    .eq("hunt_id", hunt.id)
    .limit(1);
  const team = teamsFound?.[0];
  if (!team) redirect(`/quest/demo/${huntSlug}`);

  const { data: session } = await supabase
    .from("quest_hunt_sessions")
    .select("*")
    .eq("team_id", team.id)
    .maybeSingle();

  if (!session) redirect(`/quest/demo/${huntSlug}/play`);
  if (session.state !== "completed") redirect(`/quest/demo/${huntSlug}/play`);

  // Compute rank.
  const { data: allSessions } = await supabase
    .from("quest_hunt_sessions")
    .select("id, team_id, state, total_time_seconds")
    .eq("hunt_id", hunt.id);

  const completed = (allSessions ?? []).filter((s) => s.state === "completed");
  completed.sort((a, b) => (a.total_time_seconds ?? 0) - (b.total_time_seconds ?? 0));
  const rank = completed.findIndex((s) => s.id === session.id) + 1;

  // Progress + photo gallery.
  const { data: progress } = await supabase
    .from("quest_clue_progress")
    .select("clue_id, hints_used, manual_override, photo_capture_url, unlocked_at")
    .eq("hunt_session_id", session.id)
    .order("unlocked_at", { ascending: true });

  // Clue lookup (for photo captions). Pull only what we need for this hunt.
  const { data: clueRows } = await supabase
    .from("quest_clues")
    .select("id, photo_challenge_prompt, location_name")
    .eq("hunt_id", hunt.id);
  const clueById = new Map(
    (clueRows ?? []).map((c) => [c.id, c]),
  );

  const hintsUsed = (progress ?? []).reduce((n, p) => n + (p.hints_used ?? 0), 0);
  const overrides = (progress ?? []).filter((p) => p.manual_override).length;
  const photosCount = (progress ?? []).filter((p) => p.photo_capture_url).length;

  // Only include photos with a real, fetchable URL — play-shell falls back to
  // an "inline:data:…" stub when storage upload fails; those can't be rendered
  // as <img src>.
  const photos = (progress ?? [])
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
