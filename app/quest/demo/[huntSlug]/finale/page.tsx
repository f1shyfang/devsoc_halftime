import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Phone } from "../../../_components/Phone";

export const metadata = { title: "UNSW Quest · Finale" };

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default async function FinalePage({
  params,
}: {
  params: Promise<{ huntSlug: string }>;
}) {
  const { huntSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/quest/demo/${huntSlug}/finale`);

  const { data: hunt } = await supabase
    .from("quest_hunts")
    .select("*")
    .eq("slug", huntSlug)
    .maybeSingle();
  if (!hunt) notFound();

  // Find this user's team for the hunt
  const { data: memberships } = await supabase
    .from("quest_team_members")
    .select("team_id, quest_teams!inner(id, hunt_id, name, invite_code)")
    .eq("user_id", user.id);
  const team = (memberships ?? [])
    .map((m) => m.quest_teams as unknown as { id: string; hunt_id: string; name: string; invite_code: string })
    .find((t) => t.hunt_id === hunt.id);
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

  // Progress + photo gallery
  const { data: progress } = await supabase
    .from("quest_clue_progress")
    .select("clue_id, hints_used, manual_override, photo_capture_url, unlocked_at, quest_clues!inner(location_name, tier, sequence_in_tier, photo_challenge_prompt)")
    .eq("hunt_session_id", session.id);

  const hintsUsed = (progress ?? []).reduce((n, p) => n + (p.hints_used ?? 0), 0);
  const overrides = (progress ?? []).filter((p) => p.manual_override).length;
  const photos = (progress ?? []).filter((p) => p.photo_capture_url).length;

  const totalSec = session.total_time_seconds ?? 0;
  const rankSuffix = rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏁";

  return (
    <div className="viewer" style={{ gap: 16 }}>
      <div className="crumbs">
        <Link href="/quest/demo">demo</Link>
        <span className="sep">/</span>
        <Link href={`/quest/demo/${huntSlug}`}>{hunt.slug}</Link>
        <span className="sep">/</span>
        <span>finale</span>
      </div>

      <Phone>
        <div className="body">
          <div className="confetti">
            <i style={{ top: "8%", left: "10%" }} />
            <i style={{ top: "14%", left: "80%", background: "var(--lime)", transform: "rotate(-30deg)" }} />
            <i style={{ top: "36%", left: "6%", background: "var(--ink)" }} />
          </div>
          <div className="pad" style={{ textAlign: "center" }}>
            <div className="hand" style={{ fontSize: 18, color: "var(--accent)" }}>YOU FINISHED</div>
            <div className="hand" style={{ fontSize: 38, lineHeight: 1, marginTop: 2 }}>{hunt.name}</div>
          </div>
          <div className="pad" style={{ paddingTop: 0, textAlign: "center" }}>
            <div className="mono small muted">Total time</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              {fmt(totalSec)}
            </div>
            <div className="row" style={{ justifyContent: "center", gap: 4, marginTop: 4 }}>
              <span className="pill acc-pill">
                {rank > 0 ? `${rank}${rankSuffix} of ${completed.length}` : "finished"} {medal}
              </span>
            </div>
          </div>
          <div className="pad" style={{ paddingTop: 14 }}>
            <div className="row gap-2" style={{ textAlign: "center" }}>
              <div className="card flat grow" style={{ padding: 10, textAlign: "center" }}>
                <div className="hand" style={{ fontSize: 22 }}>{hintsUsed}</div>
                <div className="xs">hints</div>
              </div>
              <div className="card flat grow" style={{ padding: 10, textAlign: "center" }}>
                <div className="hand" style={{ fontSize: 22 }}>{photos}</div>
                <div className="xs">photos</div>
              </div>
              <div className="card flat grow" style={{ padding: 10, textAlign: "center" }}>
                <div className="hand" style={{ fontSize: 22 }}>{overrides}</div>
                <div className="xs">overrides</div>
              </div>
            </div>
          </div>
          <div className="grow" />
          <div className="pad">
            <Link
              href={`/quest/demo/${huntSlug}/standings`}
              className="btn primary"
              style={{ width: "100%", textDecoration: "none" }}
            >
              <span>↗</span> See full standings
            </Link>
          </div>
        </div>
      </Phone>

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
