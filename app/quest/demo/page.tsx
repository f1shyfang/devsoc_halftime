import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "UNSW Quest · Pick a hunt" };

export default async function DemoHomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/quest/demo");
  }

  // Make sure the player has a quest profile.
  await supabase.rpc("quest_ensure_profile", { p_display_name: "" });

  const { data: hunts, error } = await supabase
    .from("quest_hunts")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="viewer">
        <div className="hand" style={{ fontSize: 24 }}>Could not load hunts</div>
        <div className="muted small">{error.message}</div>
      </div>
    );
  }

  // Find any active session this user is already part of so we can offer "resume".
  const { data: memberships } = await supabase
    .from("quest_team_members")
    .select("team_id, quest_teams!inner(hunt_id, name, invite_code, quest_hunts!inner(slug))")
    .eq("user_id", user.id);

  const activeByHuntId = new Map<string, { teamName: string; code: string; huntSlug: string }>();
  for (const m of memberships ?? []) {
    // typed as object via the inner join
    const team = m.quest_teams as unknown as {
      hunt_id: string;
      name: string;
      invite_code: string;
      quest_hunts: { slug: string };
    };
    activeByHuntId.set(team.hunt_id, {
      teamName: team.name,
      code: team.invite_code,
      huntSlug: team.quest_hunts.slug,
    });
  }

  return (
    <div className="viewer" style={{ gap: 24 }}>
      <div className="crumbs">
        <Link href="/quest">storyboard</Link>
        <span className="sep">/</span>
        <span>demo</span>
      </div>
      <h1
        style={{
          fontFamily: "var(--hand)",
          fontSize: 38,
          fontWeight: 700,
          lineHeight: 1,
          margin: 0,
          textAlign: "center",
        }}
      >
        UNSW Quest <span style={{ color: "var(--accent)" }}>/ demo</span>
      </h1>
      <div className="muted small" style={{ maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>
        Pick a hunt to start. Create a team or join one with a code.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "min(100%, 420px)",
        }}
      >
        {(hunts ?? []).map((hunt) => {
          const active = activeByHuntId.get(hunt.id);
          return (
            <div key={hunt.id} className="card" style={{ padding: 18 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="hand" style={{ fontSize: 28, lineHeight: 1 }}>
                  {hunt.hero_emoji ?? "🗺️"} {hunt.name}
                </div>
                <div className="pill mono">{hunt.duration_minutes ?? "—"}min</div>
              </div>
              <div className="p muted" style={{ marginTop: 8 }}>{hunt.description}</div>
              <div className="row gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
                <div className="pill ghost">teams of {hunt.recommended_team_size}</div>
                {active ? <div className="pill lime">in a team · {active.code}</div> : null}
              </div>
              <div className="row gap-2" style={{ marginTop: 14 }}>
                {active ? (
                  <Link
                    href={`/quest/demo/${hunt.slug}/play`}
                    className="btn primary grow"
                    style={{ textDecoration: "none" }}
                  >
                    Resume →
                  </Link>
                ) : (
                  <Link
                    href={`/quest/demo/${hunt.slug}`}
                    className="btn primary grow"
                    style={{ textDecoration: "none" }}
                  >
                    Play →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {(!hunts || hunts.length === 0) && (
          <div className="muted small" style={{ textAlign: "center" }}>
            No hunts published yet.
          </div>
        )}
      </div>

      <div className="muted small" style={{ textAlign: "center", marginTop: 16, maxWidth: 360 }}>
        Signed in as {user.email}.
      </div>
    </div>
  );
}
