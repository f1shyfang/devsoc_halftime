import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDeviceIdServer } from "@/lib/device-id.server";
import { DisplayNameSheet } from "./_components/DisplayNameSheet";
import { OnboardingCarousel } from "./_components/OnboardingCarousel";

// "Coming Soon" cards — PRD §6.2 says the home should gesture at future
// content. These are static placeholders, no DB rows.
const COMING_SOON = [
  { emoji: "🎃", name: "Horror Night", blurb: "Lights-off campus run, scariest corners, weekly drop near Halloween.", eta: "Spring '26" },
  { emoji: "⚙️", name: "Engineering Mile", blurb: "Red Centre to Tyree, all the lab building easter eggs.", eta: "Sem 2" },
  { emoji: "🧃", name: "Freshers Survival", blurb: "Free pizza spots, cheapest coffee, secret nap nooks. Soft-tutorial vibe.", eta: "O-Week '27" },
];

export const metadata = { title: "UNSW Quest · Pick a hunt" };

export default async function DemoHomePage() {
  const supabase = await createClient();
  const deviceId = await getDeviceIdServer();

  // Make sure the player has a quest profile.
  await supabase.rpc("quest_ensure_profile", {
    p_user_id: deviceId,
    p_display_name: "",
  });

  // Pull the profile so we can show the real display name and decide whether
  // to prompt for one. `quest_ensure_profile` defaults display_name to 'player'.
  const { data: profile } = await supabase
    .from("quest_profiles")
    .select("display_name, avatar_color")
    .eq("user_id", deviceId)
    .maybeSingle();
  const needsName = !profile || profile.display_name === "player";

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
  // Two-step (no nested joins) to sidestep RLS join quirks.
  const { data: memberships } = await supabase
    .from("quest_team_members")
    .select("team_id")
    .eq("user_id", deviceId);
  const teamIds = (memberships ?? []).map((m) => m.team_id);
  const { data: myTeams } = teamIds.length
    ? await supabase
        .from("quest_teams")
        .select("id, hunt_id, name, invite_code")
        .in("id", teamIds)
    : { data: [] };
  const huntSlugById = new Map((hunts ?? []).map((h) => [h.id, h.slug]));
  const activeByHuntId = new Map<string, { teamName: string; code: string; huntSlug: string }>();
  for (const t of myTeams ?? []) {
    const slug = huntSlugById.get(t.hunt_id);
    if (!slug) continue;
    activeByHuntId.set(t.hunt_id, {
      teamName: t.name,
      code: t.invite_code,
      huntSlug: slug,
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

        {/* Coming Soon — gestures at future content (PRD §6.2). */}
        <div className="label" style={{ marginTop: 10, paddingLeft: 4, color: "var(--quest-muted)" }}>
          COMING SOON
        </div>
        {COMING_SOON.map((cs) => (
          <div
            key={cs.name}
            className="card"
            style={{
              padding: 16,
              opacity: 0.7,
              borderStyle: "dashed",
              borderColor: "var(--hair)",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="hand" style={{ fontSize: 22, lineHeight: 1 }}>
                {cs.emoji} {cs.name}
              </div>
              <div className="pill ghost mono" style={{ fontSize: 11 }}>{cs.eta}</div>
            </div>
            <div className="p muted small" style={{ marginTop: 6 }}>{cs.blurb}</div>
          </div>
        ))}
      </div>

      <div className="muted small" style={{ textAlign: "center", marginTop: 16, maxWidth: 360 }}>
        Playing as <b>{profile?.display_name ?? "player"}</b>
      </div>

      <OnboardingCarousel />
      {needsName ? <DisplayNameSheet initialName={profile?.display_name ?? ""} /> : null}
    </div>
  );
}
