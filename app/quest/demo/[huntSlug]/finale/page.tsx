import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Crumbs } from "../../_components/Crumbs";

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

  // Find this user's team for the hunt (two-step, no implicit join).
  const { data: mems } = await supabase
    .from("quest_team_members")
    .select("team_id")
    .eq("user_id", user.id);
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

  // Progress + photo gallery (flat select; joins handled separately if needed).
  const { data: progress } = await supabase
    .from("quest_clue_progress")
    .select("clue_id, hints_used, manual_override, photo_capture_url, unlocked_at")
    .eq("hunt_session_id", session.id);

  const hintsUsed = (progress ?? []).reduce((n, p) => n + (p.hints_used ?? 0), 0);
  const overrides = (progress ?? []).filter((p) => p.manual_override).length;
  const photos = (progress ?? []).filter((p) => p.photo_capture_url).length;

  const totalSec = session.total_time_seconds ?? 0;
  const rankSuffix = rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏁";

  return (
    <div className="viewer" style={{ gap: 16 }}>
      <Crumbs
        items={[
          { key: "demo", href: "/quest/demo", label: "demo" },
          { key: "hunt", href: `/quest/demo/${huntSlug}`, label: hunt.slug },
          { key: "finale", label: "finale" },
        ]}
      />

      <article
        style={{
          width: "min(100%, 560px)",
          position: "relative",
          background: "var(--paper)",
          border: "var(--stroke) solid var(--ink)",
          borderRadius: 24,
          padding: "36px 28px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          boxShadow: "6px 8px 0 rgba(26,26,34,0.08)",
          overflow: "hidden",
        }}
      >
        <div className="confetti">
          <i style={{ top: "6%", left: "8%" }} />
          <i style={{ top: "10%", left: "78%", background: "var(--lime)", transform: "rotate(-30deg)" }} />
          <i style={{ top: "30%", left: "4%", background: "var(--ink)" }} />
          <i style={{ top: "42%", left: "88%", background: "var(--lime)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="hand" style={{ fontSize: 18, color: "var(--accent)", letterSpacing: "0.06em" }}>
            YOU FINISHED
          </div>
          <div className="hand" style={{ fontSize: 48, lineHeight: 1, marginTop: 4 }}>{hunt.name}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="mono small muted">Total time</div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            {fmt(totalSec)}
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 4, marginTop: 10 }}>
            <span className="pill acc-pill" style={{ fontSize: 12 }}>
              {rank > 0 ? `${rank}${rankSuffix} of ${completed.length}` : "finished"} {medal}
            </span>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
            marginTop: 4,
          }}
        >
          <div className="card flat" style={{ padding: 14, textAlign: "center" }}>
            <div className="hand" style={{ fontSize: 28 }}>{hintsUsed}</div>
            <div className="xs">hints</div>
          </div>
          <div className="card flat" style={{ padding: 14, textAlign: "center" }}>
            <div className="hand" style={{ fontSize: 28 }}>{photos}</div>
            <div className="xs">photos</div>
          </div>
          <div className="card flat" style={{ padding: 14, textAlign: "center" }}>
            <div className="hand" style={{ fontSize: 28 }}>{overrides}</div>
            <div className="xs">overrides</div>
          </div>
        </div>
        <Link
          href={`/quest/demo/${huntSlug}/standings`}
          className="btn primary"
          style={{ width: "100%", minHeight: 52, fontSize: 15, textDecoration: "none", marginTop: 6 }}
        >
          <span>↗</span> See full standings
        </Link>
      </article>

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
