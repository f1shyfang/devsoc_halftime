"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Clue, Hunt, MemberRow, ProgressRow, Session, TeamSummary } from "./types";
import { haversineM } from "./geo";

type Props = {
  hunt: Hunt;
  team: TeamSummary;
  currentUserId: string;
  members: MemberRow[];
  clues: Clue[];
  session: Session;
  initialProgress: ProgressRow[];
  headerSlot: ReactNode;
};

const HINT_PENALTY_SEC = 60;

function formatClock(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PlayShell(props: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session>(props.session);
  const [members, setMembers] = useState<MemberRow[]>(props.members);
  const [progress, setProgress] = useState<ProgressRow[]>(props.initialProgress);

  // Subscribe to realtime updates for this session.
  useEffect(() => {
    const channel = supabase
      .channel(`session:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quest_hunt_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.new) setSession(payload.new as Session);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quest_clue_progress",
          filter: `hunt_session_id=eq.${session.id}`,
        },
        async () => {
          const { data } = await supabase
            .from("quest_clue_progress")
            .select("*")
            .eq("hunt_session_id", session.id);
          if (data) setProgress(data as ProgressRow[]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quest_team_members",
          filter: `team_id=eq.${props.team.id}`,
        },
        async () => {
          const { data: rawMembers } = await supabase
            .from("quest_team_members")
            .select("user_id, joined_at")
            .eq("team_id", props.team.id);
          if (!rawMembers) return;
          const ids = rawMembers.map((m) => m.user_id);
          const { data: profiles } = ids.length
            ? await supabase
                .from("quest_profiles")
                .select("user_id, display_name, avatar_color")
                .in("user_id", ids)
            : { data: [] };
          const byId = new Map(
            (profiles ?? []).map((p) => [p.user_id, p]),
          );
          setMembers(
            rawMembers.map((m) => {
              const p = byId.get(m.user_id);
              return {
                user_id: m.user_id,
                joined_at: m.joined_at,
                display_name: p?.display_name ?? "Player",
                avatar_color: p?.avatar_color ?? "#ef5b3a",
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, session.id, props.team.id]);

  // When the session goes to completed, navigate to the finale.
  useEffect(() => {
    if (session.state === "completed") {
      router.push(`/quest/demo/${props.hunt.slug}/finale`);
    }
  }, [session.state, router, props.hunt.slug]);

  if (session.state === "lobby") {
    return (
      <LobbyView
        {...props}
        session={session}
        members={members}
        onStarted={(s) => setSession(s)}
      />
    );
  }

  // in_progress
  const currentClue = props.clues.find(
    (c) => c.tier === session.current_tier && c.sequence_in_tier === session.current_sequence,
  );
  if (!currentClue) {
    return (
      <div className="viewer">
        <div className="hand" style={{ fontSize: 24 }}>No clue found</div>
        <div className="muted small">tier {session.current_tier} · seq {session.current_sequence}</div>
      </div>
    );
  }

  return (
    <ActiveView
      hunt={props.hunt}
      team={props.team}
      session={session}
      members={members}
      progress={progress}
      clues={props.clues}
      clue={currentClue}
      headerSlot={props.headerSlot}
      currentUserId={props.currentUserId}
    />
  );
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function LobbyView({
  hunt,
  team,
  session,
  members,
  currentUserId,
  headerSlot,
  onStarted,
}: Props & { onStarted: (s: Session) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const isLeader = team.leader_user_id === currentUserId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "code" | "link">("idle");

  const start = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("quest_start_hunt", { p_team_id: team.id });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Could not start");
      return;
    }
    onStarted(data as Session);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(team.invite_code);
      setCopied("code");
      setTimeout(() => setCopied("idle"), 1800);
    } catch {
      setError("Could not copy — long-press the code to select.");
    }
  };

  const copyLink = async () => {
    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}/quest/demo/${hunt.slug}?code=${team.invite_code}`
        : "";
    try {
      await navigator.clipboard.writeText(link);
      setCopied("link");
      setTimeout(() => setCopied("idle"), 1800);
    } catch {
      setError("Could not copy link.");
    }
  };

  const share = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${team.name} — UNSW Quest`,
        text: `Join my UNSW Quest team — invite code ${team.invite_code}`,
        url: `${window.location.origin}/quest/demo/${hunt.slug}?code=${team.invite_code}`,
      });
    } catch {
      // user cancelled; ignore
    }
  };

  const empty = Math.max(0, 6 - members.length);
  const slots: Array<MemberRow | null> = [...members, ...Array.from({ length: empty }, () => null)];
  const leaderName =
    members.find((m) => m.user_id === team.leader_user_id)?.display_name ?? "the leader";

  return (
    <div className="viewer" style={{ gap: 16, width: "min(100%, 460px)" }}>
      {headerSlot}

      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div className="label" style={{ marginBottom: 4 }}>WAITING ROOM</div>
        <div className="hand" style={{ fontSize: 36, lineHeight: 1 }}>{team.name}</div>
        <div className="muted small" style={{ marginTop: 4 }}>Playing · {hunt.name}</div>
      </div>

      {/* Invite code panel */}
      <div
        className="card"
        style={{
          padding: 20,
          width: "100%",
          background: "var(--accent-soft)",
          borderColor: "var(--accent)",
        }}
      >
        <div className="label" style={{ textAlign: "center", color: "var(--accent)" }}>
          INVITE CODE
        </div>
        <button
          onClick={copyCode}
          aria-label="Copy invite code"
          title="Tap to copy"
          style={{
            display: "block",
            textAlign: "center",
            fontFamily: "var(--hand)",
            fontSize: 56,
            lineHeight: 1,
            letterSpacing: "0.18em",
            color: "var(--accent)",
            marginTop: 6,
            background: "none",
            border: 0,
            padding: 0,
            width: "100%",
            cursor: "pointer",
          }}
        >
          {team.invite_code}
        </button>
        <div className="row gap-2" style={{ marginTop: 14 }}>
          <button
            className="btn primary grow"
            onClick={copyCode}
            type="button"
            style={{ minHeight: 44 }}
          >
            {copied === "code" ? "✓ Copied" : "Copy code"}
          </button>
          <button
            className="btn ink-btn grow"
            onClick={share}
            type="button"
            style={{ minHeight: 44 }}
          >
            {copied === "link" ? "✓ Link copied" : "Share link"}
          </button>
        </div>
        <div className="muted small" style={{ textAlign: "center", marginTop: 10 }}>
          Friends can join at <b>/quest/demo</b> → <i>Join with code</i>
        </div>
      </div>

      {/* Team grid */}
      <div style={{ width: "100%" }}>
        <div
          className="row"
          style={{ justifyContent: "space-between", marginBottom: 8 }}
        >
          <div className="label">TEAM · {members.length} / 6</div>
          <div className="muted small" style={{ fontFamily: "var(--mono)" }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--good)",
                marginRight: 6,
                boxShadow: "0 0 0 3px rgba(47,158,107,0.18)",
              }}
            />
            live
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {slots.map((m, i) =>
            m ? (
              <div
                key={m.user_id}
                className="card"
                style={{
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: m.user_id === currentUserId ? "var(--accent-soft)" : "var(--paper)",
                  borderColor: m.user_id === currentUserId ? "var(--accent)" : "var(--ink)",
                }}
              >
                <div
                  className="av lg"
                  style={{ background: m.avatar_color, color: "white", borderColor: "var(--ink)" }}
                >
                  {m.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.user_id === currentUserId ? `${m.display_name} (you)` : m.display_name}
                  </div>
                  <div
                    className="mono small muted"
                    style={{ marginTop: 2, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}
                  >
                    {m.user_id === team.leader_user_id ? "Leader" : "Ready"}
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={`empty-${i}`}
                className="card dash"
                style={{
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderColor: "var(--hair)",
                  background: "transparent",
                }}
              >
                <div className="av dash lg" style={{ borderStyle: "dashed" }}>
                  ?
                </div>
                <div className="muted small" style={{ fontSize: 12 }}>
                  Open slot
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Start / waiting */}
      <div style={{ width: "100%" }}>
        {isLeader ? (
          <>
            <button
              className="btn primary"
              onClick={start}
              disabled={busy}
              style={{ width: "100%", minHeight: 52, fontSize: 15 }}
            >
              {busy
                ? "Starting…"
                : `Start hunt → ${members.length} ${members.length === 1 ? "player" : "players"}`}
            </button>
            {members.length < 2 ? (
              <div className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
                Solo runs work, but treasure hunts are better with friends. Share the code first ↑
              </div>
            ) : (
              <div className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
                Everyone in? Tap start when ready.
              </div>
            )}
          </>
        ) : (
          <div
            className="card"
            style={{
              padding: 14,
              textAlign: "center",
              background: "var(--paper)",
              borderStyle: "dashed",
              borderColor: "var(--hair)",
            }}
          >
            <div
              className="hand"
              style={{ fontSize: 20, lineHeight: 1.1 }}
            >
              Waiting for {leaderName} to hit start…
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              You&apos;ll move into the first clue automatically.
            </div>
          </div>
        )}
        {error ? (
          <div className="p" style={{ color: "var(--bad)", marginTop: 10, textAlign: "center" }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* unused props for type-check */}
      <span style={{ display: "none" }}>{session.id}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active hunt loop
// ---------------------------------------------------------------------------

function ActiveView({
  hunt,
  team,
  session,
  members,
  progress,
  clues,
  clue,
  headerSlot,
  currentUserId,
}: {
  hunt: Hunt;
  team: TeamSummary;
  session: Session;
  members: MemberRow[];
  progress: ProgressRow[];
  clues: Clue[];
  clue: Clue;
  headerSlot: ReactNode;
  currentUserId: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  // Wall-clock timer based on started_at.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const startedMs = session.started_at ? new Date(session.started_at).getTime() : now;
  const elapsedSec = Math.floor((now - startedMs) / 1000) + (session.hint_penalty_seconds ?? 0);

  // Hints revealed for the current clue.
  const [hintsRevealed, setHintsRevealed] = useState<number>(0);
  // Reset on clue change.
  const clueKey = `${clue.tier}-${clue.sequence_in_tier}`;
  const prevClueKey = useRef(clueKey);
  useEffect(() => {
    if (prevClueKey.current !== clueKey) {
      setHintsRevealed(0);
      setHintConfirmOpen(false);
      prevClueKey.current = clueKey;
    }
  }, [clueKey]);

  const hints = Array.isArray(clue.hints) ? (clue.hints as string[]) : [];

  // Geolocation
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsErr("Geolocation not available — use 'Mark as arrived' to demo.");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsErr(null);
      },
      (err) => setGpsErr(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const distanceM =
    coords && clue.location_lat != null && clue.location_lng != null
      ? haversineM(coords.lat, coords.lng, Number(clue.location_lat), Number(clue.location_lng))
      : null;

  const withinGeofence =
    distanceM != null && distanceM <= (clue.geofence_radius_m ?? 25);

  // Show "Mark as arrived" override after a short delay (demo).
  const [showOverride, setShowOverride] = useState(false);
  useEffect(() => {
    setShowOverride(false);
    const t = setTimeout(() => setShowOverride(true), 8000);
    return () => clearTimeout(t);
  }, [clueKey]);

  // UI state
  const [mapOpen, setMapOpen] = useState(false);
  const [hintConfirmOpen, setHintConfirmOpen] = useState(false);
  const [unlockOverlay, setUnlockOverlay] = useState<"none" | "clue" | "tier">("none");
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [photoForClueId, setPhotoForClueId] = useState<string | null>(null);
  const [pendingNext, setPendingNext] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async (opts?: { manualOverride?: boolean; photoUrl?: string | null }) => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("quest_unlock_clue", {
      p_session_id: session.id,
      p_clue_id: clue.id,
      p_manual_override: !!opts?.manualOverride,
      p_hints_used: hintsRevealed,
      p_photo_url: opts?.photoUrl ?? undefined,
    });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Could not unlock");
      return;
    }
    const next = data as Session;
    setPendingNext(next);

    // Decide which overlay to show.
    const tierChanged = next.current_tier !== session.current_tier;
    const hasPhoto = clue.verification_type === "gps_plus_photo" && !opts?.photoUrl;
    if (hasPhoto && next.state !== "completed") {
      // Show photo prompt first (inline · later style)
      setPhotoForClueId(clue.id);
      setPhotoPromptOpen(true);
      // Hold the unlock overlay until after photo
      setUnlockOverlay("none");
      return;
    }
    if (next.state === "completed") {
      setUnlockOverlay("clue");
      // The realtime sub will navigate to finale once the session row updates.
      return;
    }
    setUnlockOverlay(tierChanged ? "tier" : "clue");
  };

  // After tier-unlock overlay, brief map-zoomout transition before settling.
  const [tierStage, setTierStage] = useState<"none" | "takeover" | "zoomout">("none");
  useEffect(() => {
    if (unlockOverlay === "tier") {
      setTierStage("takeover");
      const a = setTimeout(() => setTierStage("zoomout"), 2200);
      const b = setTimeout(() => {
        setTierStage("none");
        setUnlockOverlay("none");
      }, 4400);
      return () => {
        clearTimeout(a);
        clearTimeout(b);
      };
    }
    if (unlockOverlay === "clue") {
      const t = setTimeout(() => setUnlockOverlay("none"), 1500);
      return () => clearTimeout(t);
    }
  }, [unlockOverlay]);

  const totalClues = clues.length;
  const completed = progress.length;
  const overallSeq = clues.findIndex(
    (c) => c.tier === clue.tier && c.sequence_in_tier === clue.sequence_in_tier,
  );

  return (
    <div className="viewer" style={{ gap: 18, width: "min(100%, 560px)" }}>
      {headerSlot}

      {/* Top status bar */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: "var(--mono)",
          fontSize: 12,
        }}
      >
        <div className="pill solid" style={{ flexShrink: 0, fontSize: 12 }}>
          ⏱ {formatClock(elapsedSec)}
        </div>
        <div className="muted small" style={{ fontSize: 11 }}>
          Tier {clue.tier} · Clue {overallSeq + 1} of {totalClues}
        </div>
        <div style={{ flex: 1 }} />
        <Link
          href={`/quest/demo/${hunt.slug}/standings`}
          className="pill"
          style={{ textDecoration: "none", fontSize: 11 }}
        >
          standings ↗
        </Link>
      </div>

      {/* Progress dots */}
      <div
        className="dots"
        style={{ flexWrap: "wrap", gap: 6, width: "100%", justifyContent: "flex-start" }}
      >
        {clues.map((c, i) => {
          const done = progress.some((p) => p.clue_id === c.id);
          const isNow = c.id === clue.id;
          return (
            <div
              key={c.id}
              className={`d ${done ? "on" : isNow ? "now" : ""}`}
              aria-label={`clue ${i + 1}`}
            />
          );
        })}
      </div>

      {/* Clue card — full-width web layout, no phone frame */}
      <article
        style={{
          width: "100%",
          background: "#fffdf3",
          border: "var(--stroke) solid var(--ink)",
          borderRadius: 20,
          padding: "24px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "4px 6px 0 rgba(26,26,34,0.06)",
        }}
      >
        <div className="hand" style={{ fontSize: 16, color: "var(--quest-muted)" }}>
          {clue.location_name ? `Find the ${clue.location_name}` : "Riddle me this…"}
        </div>
        <div className="riddle" style={{ fontSize: 28, lineHeight: 1.2 }}>
          {clue.body_text}
        </div>

        {hintsRevealed >= 1 && hints[0] ? (
          <div className="card tint" style={{ padding: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 4 }}>
              <span>💡</span>
              <div className="label" style={{ color: "var(--accent)" }}>Hint 1 of 2</div>
            </div>
            <div className="hand" style={{ fontSize: 18, lineHeight: 1.3 }}>{hints[0]}</div>
          </div>
        ) : null}
        {hintsRevealed >= 2 && hints[1] ? (
          <div className="card tint" style={{ padding: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 4 }}>
              <span>💡</span>
              <div className="label" style={{ color: "var(--accent)" }}>Hint 2 of 2</div>
            </div>
            <div className="hand" style={{ fontSize: 18, lineHeight: 1.3 }}>{hints[1]}</div>
          </div>
        ) : null}

        <div className="hr" />
        <div className="row" style={{ justifyContent: "space-between" }}>
          {hintsRevealed < 2 ? (
            <button
              className="hand"
              style={{
                fontSize: 16,
                color: "var(--ink)",
                padding: 0,
                background: "none",
                border: 0,
                cursor: "pointer",
              }}
              onClick={() => setHintConfirmOpen(true)}
              disabled={busy}
            >
              💡 hint <span className="acc">(+60s)</span>
            </button>
          ) : (
            <div className="hand muted" style={{ fontSize: 15 }}>no hints left</div>
          )}
          <button
            className="hand"
            style={{
              fontSize: 16,
              color: "var(--ink)",
              padding: 0,
              background: "none",
              border: 0,
              cursor: "pointer",
            }}
            onClick={() => setMapOpen(true)}
            disabled={busy}
          >
            🗺️ map
          </button>
        </div>

        <button
          className="btn primary"
          onClick={() => unlock()}
          disabled={busy || !withinGeofence}
          style={{ width: "100%", minHeight: 52, fontSize: 15, opacity: !withinGeofence ? 0.6 : 1 }}
        >
          {withinGeofence ? "I'm here · verify ✓" : "Walking there →"}
        </button>
        <div className="muted small" style={{ textAlign: "center" }}>
          {distanceM != null
            ? `${Math.round(distanceM)} m from ${clue.location_name ?? "checkpoint"}`
            : gpsErr
              ? gpsErr
              : "locating…"}
        </div>
        {showOverride && !withinGeofence ? (
          <button
            className="btn ghost"
            onClick={() => unlock({ manualOverride: true })}
            disabled={busy}
            style={{ width: "100%" }}
          >
            Stuck? Mark as arrived
          </button>
        ) : null}
      </article>

      {error ? (
        <div className="p" style={{ color: "var(--bad)", maxWidth: 320, textAlign: "center" }}>{error}</div>
      ) : null}

      {/* Members strip */}
      <div className="row gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
        {members.map((m) => (
          <div
            key={m.user_id}
            className="av"
            style={{ background: m.avatar_color, color: "white", borderColor: "var(--ink)" }}
            title={m.display_name}
          >
            {m.display_name.slice(0, 2).toUpperCase()}
          </div>
        ))}
      </div>

      {/* MAP DRAWER */}
      {mapOpen ? <MapDrawer clue={clue} distanceM={distanceM} accuracy={coords?.accuracy ?? null} onClose={() => setMapOpen(false)} /> : null}

      {/* HINT CONFIRM */}
      {hintConfirmOpen ? (
        <HintConfirm
          which={hintsRevealed + 1}
          onCancel={() => setHintConfirmOpen(false)}
          onConfirm={() => {
            setHintsRevealed((n) => Math.min(n + 1, 2));
            setHintConfirmOpen(false);
          }}
        />
      ) : null}

      {/* UNLOCK OVERLAY */}
      {unlockOverlay === "clue" ? <UnlockOverlay text="Unlocked!" /> : null}
      {unlockOverlay === "tier" && tierStage === "takeover" ? (
        <UnlockOverlay text={`Tier ${pendingNext?.current_tier ?? clue.tier + 1} unlocked!`} />
      ) : null}
      {unlockOverlay === "tier" && tierStage === "zoomout" ? (
        <TierZoomOverlay nextTier={pendingNext?.current_tier ?? clue.tier + 1} />
      ) : null}

      {/* PHOTO PROMPT */}
      {photoPromptOpen && photoForClueId === clue.id ? (
        <PhotoPrompt
          clue={clue}
          onLater={() => {
            setPhotoPromptOpen(false);
            // Tier transition still needs to play visually for non-completion
            if (pendingNext) {
              const tierChanged = pendingNext.current_tier !== session.current_tier;
              if (pendingNext.state === "completed") setUnlockOverlay("clue");
              else setUnlockOverlay(tierChanged ? "tier" : "clue");
            }
          }}
          onSubmit={async (dataUrl) => {
            setBusy(true);
            // Best-effort: try to upload to a public bucket. If it fails, store base64
            // in clue_progress via a second unlock-with-url call.
            let stored: string | null = null;
            try {
              const fileName = `${session.id}/${clue.id}-${Date.now()}.jpg`;
              const blob = dataUrlToBlob(dataUrl);
              const { error: upErr, data: upData } = await supabase.storage
                .from("quest-photos")
                .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
              if (!upErr && upData) {
                const { data } = supabase.storage.from("quest-photos").getPublicUrl(upData.path);
                stored = data.publicUrl;
              }
            } catch {
              // Swallow — we'll fall back to a data URL stub below.
            }
            const finalUrl = stored ?? `inline:${dataUrl.slice(0, 80)}…`;
            await supabase
              .from("quest_clue_progress")
              .update({ photo_capture_url: finalUrl })
              .eq("hunt_session_id", session.id)
              .eq("clue_id", clue.id);
            setBusy(false);
            setPhotoPromptOpen(false);
            if (pendingNext) {
              const tierChanged = pendingNext.current_tier !== session.current_tier;
              if (pendingNext.state === "completed") setUnlockOverlay("clue");
              else setUnlockOverlay(tierChanged ? "tier" : "clue");
            }
          }}
        />
      ) : null}

      {/* unused */}
      <span style={{ display: "none" }}>{completed}</span>
      <span style={{ display: "none" }}>{team.name}</span>
      <span style={{ display: "none" }}>{currentUserId}</span>
    </div>
  );
}

function MapDrawer({
  clue,
  distanceM,
  accuracy,
  onClose,
}: {
  clue: Clue;
  distanceM: number | null;
  accuracy: number | null;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,34,0.5)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "min(100%, 420px)",
          padding: 18,
          background: "var(--paper)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div className="label">MAP · {clue.location_name}</div>
          <button onClick={onClose} className="pill ghost">close</button>
        </div>
        <div style={{ position: "relative", height: 220, marginBottom: 12 }}>
          <div className="ph-box map" style={{ position: "absolute", inset: 0, borderRadius: 14 }} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 120,
              height: 120,
              border: "2.2px dashed var(--accent)",
              borderRadius: "50%",
              background: "rgba(239,91,58,0.1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 10,
              height: 10,
              background: "var(--accent)",
              border: "2px solid white",
              borderRadius: "50%",
            }}
          />
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="hand" style={{ fontSize: 18 }}>
            {distanceM != null ? `${Math.round(distanceM)} m to checkpoint` : "locating…"}
          </div>
          <div className="muted small">
            {accuracy != null ? `accuracy ±${Math.round(accuracy)}m` : "—"}
          </div>
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Geofence: {clue.geofence_radius_m}m around the checkpoint.
        </div>
      </div>
    </div>
  );
}

function HintConfirm({
  which,
  onCancel,
  onConfirm,
}: {
  which: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,34,0.5)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="card" style={{ width: "min(100%, 360px)", padding: 18 }}>
        <div className="row gap-2" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>💡</span>
          <div className="h2">Reveal hint {which}?</div>
        </div>
        <div className="p muted" style={{ marginBottom: 14 }}>
          This adds <b style={{ color: "var(--accent)" }}>+{HINT_PENALTY_SEC} seconds</b> to your final time.
          {which === 1 ? " You'll have 1 hint left after this." : " This is your last hint."}
        </div>
        <div className="row gap-2">
          <button className="btn ghost grow" onClick={onCancel}>Cancel</button>
          <button className="btn primary grow" onClick={onConfirm}>Spend hint</button>
        </div>
      </div>
    </div>
  );
}

function UnlockOverlay({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--accent)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div className="confetti">
        <i style={{ top: "8%", left: "14%" }} />
        <i style={{ top: "20%", left: "74%", background: "var(--lime)", transform: "rotate(-20deg)" }} />
        <i style={{ top: "30%", left: "30%", background: "white" }} />
        <i style={{ top: "60%", left: "80%" }} />
        <i style={{ top: "72%", left: "18%", background: "var(--lime)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <div className="ring white" />
        <div style={{ fontFamily: "var(--hand)", fontSize: 46, lineHeight: 1 }}>{text}</div>
      </div>
    </div>
  );
}

function TierZoomOverlay({ nextTier }: { nextTier: number }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(100%, 560px)",
          height: "min(60vh, 420px)",
          position: "relative",
          border: "var(--stroke) solid var(--ink)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "8px 10px 0 rgba(26,26,34,0.10)",
        }}
      >
        <div className="ph-box map" style={{ position: "absolute", inset: 0, borderRadius: 0, border: 0 }} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 140,
            height: 140,
            border: "2.4px dashed var(--accent)",
            borderRadius: "50%",
            background: "rgba(239,91,58,0.12)",
          }}
        />
        <div style={{ position: "absolute", top: 18, left: 18, right: 18 }} className="card">
          <div className="label">Tier {nextTier} unlocked</div>
          <div className="h2" style={{ marginTop: 4 }}>New clues are live · map zooming out</div>
        </div>
      </div>
    </div>
  );
}

function PhotoPrompt({
  clue,
  onLater,
  onSubmit,
}: {
  clue: Clue;
  onLater: () => void;
  onSubmit: (dataUrl: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    await onSubmit(dataUrl);
    setBusy(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,34,0.55)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="card" style={{ width: "min(100%, 380px)", padding: 18 }}>
        <div
          className="hand"
          style={{ fontSize: 14, color: "var(--accent)", letterSpacing: "0.08em" }}
        >
          PHOTO CHALLENGE
        </div>
        <div className="h2" style={{ margin: "4px 0 10px" }}>
          {clue.photo_challenge_prompt ?? "Take a team photo"}
        </div>
        <div className="ph-box photo" style={{ height: 120, marginBottom: 12 }} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="row gap-2">
          <button className="btn ghost grow" onClick={onLater} disabled={busy}>Skip</button>
          <button className="btn primary grow" onClick={() => fileRef.current?.click()} disabled={busy}>
            <span>📷</span> {busy ? "Uploading…" : "Snap it"}
          </button>
        </div>
        <div className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
          Skipping doesn&apos;t affect your time.
        </div>
      </div>
    </div>
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const m = /data:([^;]+);base64/.exec(meta);
  const mime = m?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
