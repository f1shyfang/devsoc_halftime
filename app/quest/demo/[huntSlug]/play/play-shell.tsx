"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import useSWR from "swr";
import { postJson, swrFetcher, uploadViaApi } from "@/lib/api/fetcher";
import type { Clue, Hunt, MemberRow, ProgressRow, Session, TeamSummary } from "./types";
import { haversineM } from "./geo";
import { QRScanner } from "./QRScanner";
import { QuestIcon } from "../../../_components/QuestIcon";
import { InviteQRModal } from "./InviteQRModal";
import { LeafletMap } from "./LeafletMap";

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
const MAP_PENALTY_SEC = 180;

function formatClock(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Render a penalty as a short, human-friendly cost like "1 min" or "3 min".
// Falls back to seconds for non-multiples of 60.
function formatPenalty(sec: number) {
  if (sec >= 60 && sec % 60 === 0) {
    const m = sec / 60;
    return `${m} min`;
  }
  return `${sec}s`;
}

export function PlayShell(props: Props) {
  const router = useRouter();

  const [session, setSession] = useState<Session>(props.session);
  const [members, setMembers] = useState<MemberRow[]>(props.members);
  const [progress, setProgress] = useState<ProgressRow[]>(props.initialProgress);

  const { data: polled } = useSWR<{ session: Session; progress: ProgressRow[]; members: MemberRow[] }>(
    `/api/quest/sessions/${props.session.id}/state`,
    swrFetcher,
    { refreshInterval: 2500 },
  );
  useEffect(() => {
    if (!polled) return;
    setSession(polled.session);
    setProgress(polled.progress);
    setMembers(polled.members);
  }, [polled]);

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
      setSession={setSession}
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
  const isLeader = team.leader_user_id === currentUserId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "code" | "link">("idle");
  const [qrOpen, setQrOpen] = useState(false);

  const joinLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/quest/demo/${hunt.slug}?code=${team.invite_code}`
      : `/quest/demo/${hunt.slug}?code=${team.invite_code}`;

  const start = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await postJson<Session>("/api/quest/sessions/start", { teamId: team.id });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Could not start");
      return;
    }
    onStarted(data);
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
    try {
      await navigator.clipboard.writeText(joinLink);
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
        url: joinLink,
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
          aria-label={copied === "code" ? "Invite code copied" : "Copy invite code"}
          title="Tap to copy"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
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
          <span>{team.invite_code}</span>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              opacity: copied === "code" ? 1 : 0.6,
              transition: "opacity 160ms ease",
            }}
          >
            <QuestIcon name={copied === "code" ? "check" : "copy"} size={22} />
          </span>
        </button>
        <div
          className="muted small"
          style={{ textAlign: "center", marginTop: 6, fontSize: 11 }}
        >
          {copied === "code" ? "Copied to clipboard" : "Tap the code to copy"}
        </div>
        <div className="row gap-2" style={{ marginTop: 14 }}>
          <button
            className="btn primary grow row gap-1"
            onClick={share}
            type="button"
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            {copied === "link" ? (
              <>
                <QuestIcon name="check" size={14} /> Link copied
              </>
            ) : (
              <>
                <QuestIcon name="share" size={14} /> Share link
              </>
            )}
          </button>
          <button
            className="btn ink-btn grow row gap-1"
            onClick={() => setQrOpen(true)}
            type="button"
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <QuestIcon name="camera" size={14} /> Show QR
          </button>
        </div>
        <div className="muted small" style={{ textAlign: "center", marginTop: 10 }}>
          Friends can join at <b>/quest/demo</b> → <i>Join with code</i>
        </div>
      </div>

      {qrOpen ? (
        <InviteQRModal
          link={joinLink}
          teamName={team.name}
          inviteCode={team.invite_code}
          onClose={() => setQrOpen(false)}
          onCopyLink={copyLink}
          linkCopied={copied === "link"}
        />
      ) : null}

      {/* Team grid */}
      <div style={{ width: "100%" }}>
        <div className="label" style={{ marginBottom: 8 }}>
          TEAM · {members.length} / 6
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
  setSession,
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
  setSession: (s: Session) => void;
  members: MemberRow[];
  progress: ProgressRow[];
  clues: Clue[];
  clue: Clue;
  headerSlot: ReactNode;
  currentUserId: string;
}) {
  // Wall-clock timer based on started_at.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Optimistic penalty buffer: bumped instantly on hint/map confirm so the
  // displayed timer jumps without waiting for the server. Cleared when the
  // RPC response replaces the session row.
  const [pendingPenaltySec, setPendingPenaltySec] = useState(0);
  const startedMs = session.started_at ? new Date(session.started_at).getTime() : now;
  const elapsedSec =
    Math.floor((now - startedMs) / 1000)
    + (session.hint_penalty_seconds ?? 0)
    + pendingPenaltySec;

  // Hints revealed for the current clue.
  const [hintsRevealed, setHintsRevealed] = useState<number>(0);
  // Whether the player has paid to see the map for this clue. Once paid,
  // re-opening the drawer is free and the location name + distance are
  // exposed on the clue card.
  const [mapsPaid, setMapsPaid] = useState<Set<string>>(new Set());
  const mapPaidForClue = mapsPaid.has(clue.id);
  // Reset on clue change.
  const clueKey = `${clue.tier}-${clue.sequence_in_tier}`;
  const prevClueKey = useRef(clueKey);
  useEffect(() => {
    if (prevClueKey.current !== clueKey) {
      setHintsRevealed(0);
      setHintConfirmOpen(false);
      setMapConfirmOpen(false);
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

  // Per PRD §6.5: the "Mark as arrived" override must not appear in
  // <2 minutes of dwell on a clue — no premature escape hatch.
  const [showOverride, setShowOverride] = useState(false);
  useEffect(() => {
    setShowOverride(false);
    const t = setTimeout(() => setShowOverride(true), 120_000);
    return () => clearTimeout(t);
  }, [clueKey]);

  // UI state
  const [mapOpen, setMapOpen] = useState(false);
  const [mapConfirmOpen, setMapConfirmOpen] = useState(false);
  const [hintConfirmOpen, setHintConfirmOpen] = useState(false);
  const [qrScannerOpen, setQRScannerOpen] = useState(false);
  const [unlockOverlay, setUnlockOverlay] = useState<"none" | "clue" | "tier">("none");
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [photoForClueId, setPhotoForClueId] = useState<string | null>(null);
  const [pendingNext, setPendingNext] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isQRClue = clue.verification_type === "qr";

  // Charge a time penalty to the session immediately so the timer reflects
  // the cost the moment a hint/map is taken. We bump pendingPenaltySec
  // synchronously so the visible clock jumps without waiting for the
  // network; when the RPC returns with the updated session, the bump is
  // cleared and session.hint_penalty_seconds takes over.
  const chargePenalty = async (seconds: number): Promise<boolean> => {
    setPendingPenaltySec((p) => p + seconds);
    const { data, error } = await postJson<Session>("/api/quest/sessions/penalty", {
      sessionId: session.id,
      seconds,
    });
    if (error || !data) {
      setError(error?.message ?? "Could not apply penalty");
      setPendingPenaltySec((p) => Math.max(0, p - seconds));
      return false;
    }
    setSession(data);
    setPendingPenaltySec((p) => Math.max(0, p - seconds));
    return true;
  };

  const unlock = async (opts?: { manualOverride?: boolean; photoUrl?: string | null }) => {
    setBusy(true);
    setError(null);
    // Penalties are charged on hint/map confirm now, so unlock no longer adds
    // any seconds — we pass 0 to keep the RPC contract stable.
    const { data, error } = await postJson<Session>("/api/quest/sessions/unlock", {
      sessionId: session.id,
      clueId: clue.id,
      manualOverride: !!opts?.manualOverride,
      hintsUsed: 0,
      photoUrl: opts?.photoUrl ?? null,
      mapsUsed: 0,
    });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Could not unlock");
      return;
    }
    const next = data;
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
        <div className="pill solid row gap-1" style={{ flexShrink: 0, fontSize: 12, alignItems: "center" }}>
          <QuestIcon name="stopwatch" size={14} />
          {formatClock(elapsedSec)}
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
          {mapPaidForClue && clue.location_name
            ? `Find the ${clue.location_name}`
            : "Riddle me this…"}
        </div>
        <div className="riddle" style={{ fontSize: 28, lineHeight: 1.2 }}>
          {clue.body_text}
        </div>

        {hintsRevealed >= 1 && hints[0] ? (
          <div className="card tint" style={{ padding: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 4, alignItems: "center" }}>
              <QuestIcon name="bulb" size={16} style={{ color: "var(--accent)" }} />
              <div className="label" style={{ color: "var(--accent)" }}>Hint 1 of 2</div>
            </div>
            <div className="hand" style={{ fontSize: 18, lineHeight: 1.3 }}>{hints[0]}</div>
          </div>
        ) : null}
        {hintsRevealed >= 2 && hints[1] ? (
          <div className="card tint" style={{ padding: 12 }}>
            <div className="row gap-2" style={{ marginBottom: 4, alignItems: "center" }}>
              <QuestIcon name="bulb" size={16} style={{ color: "var(--accent)" }} />
              <div className="label" style={{ color: "var(--accent)" }}>Hint 2 of 2</div>
            </div>
            <div className="hand" style={{ fontSize: 18, lineHeight: 1.3 }}>{hints[1]}</div>
          </div>
        ) : null}

        <div className="hr" />
        <div className="row" style={{ justifyContent: "space-between" }}>
          {hintsRevealed < 2 ? (
            <button
              className="hand row gap-1"
              style={{
                fontSize: 16,
                color: "var(--ink)",
                padding: 0,
                background: "none",
                border: 0,
                cursor: "pointer",
                alignItems: "center",
              }}
              onClick={() => setHintConfirmOpen(true)}
              disabled={busy}
            >
              <QuestIcon name="bulb" size={18} />
              hint <span className="acc">(+{formatPenalty(HINT_PENALTY_SEC)})</span>
            </button>
          ) : (
            <div className="hand muted" style={{ fontSize: 15 }}>no hints left</div>
          )}
          <button
            className="hand row gap-1"
            style={{
              fontSize: 16,
              color: "var(--ink)",
              padding: 0,
              background: "none",
              border: 0,
              cursor: "pointer",
              alignItems: "center",
            }}
            onClick={() => {
              if (mapPaidForClue) setMapOpen(true);
              else setMapConfirmOpen(true);
            }}
            disabled={busy}
          >
            <QuestIcon name="map" size={18} />
            map
            {mapPaidForClue ? null : (
              <span className="acc"> (+{formatPenalty(MAP_PENALTY_SEC)})</span>
            )}
          </button>
        </div>

        {isQRClue ? (
          <>
            <button
              className="btn primary row gap-2"
              onClick={() => setQRScannerOpen(true)}
              disabled={busy}
              style={{ width: "100%", minHeight: 52, fontSize: 15, justifyContent: "center", alignItems: "center" }}
            >
              <QuestIcon name="camera" size={20} />
              Scan QR code
            </button>
            <div className="muted small" style={{ textAlign: "center" }}>
              {mapPaidForClue
                ? `The laminated code is at ${clue.location_name ?? "the checkpoint"}.`
                : "Solve the riddle to find the laminated code."}
            </div>
          </>
        ) : (
          <>
            <button
              className="btn primary row gap-2"
              onClick={() => unlock()}
              disabled={busy || !withinGeofence}
              style={{
                width: "100%",
                minHeight: 52,
                fontSize: 15,
                opacity: !withinGeofence ? 0.6 : 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {withinGeofence ? (
                <>
                  I&apos;m here · verify <QuestIcon name="check" size={16} />
                </>
              ) : (
                "Walking there →"
              )}
            </button>
            {gpsErr ? (
              <div className="muted small" style={{ textAlign: "center" }}>{gpsErr}</div>
            ) : null}
          </>
        )}
        {showOverride && (isQRClue || !withinGeofence) ? (
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
      {mapOpen ? (
        <MapDrawer
          clue={clue}
          distanceM={distanceM}
          accuracy={coords?.accuracy ?? null}
          playerCoords={coords ? { lat: coords.lat, lng: coords.lng } : null}
          onClose={() => setMapOpen(false)}
        />
      ) : null}

      {/* QR SCANNER */}
      {qrScannerOpen && isQRClue && clue.qr_code_payload ? (
        <QRScanner
          expectedPayload={clue.qr_code_payload}
          locationName={clue.location_name ?? null}
          onClose={() => setQRScannerOpen(false)}
          onMatch={() => {
            setQRScannerOpen(false);
            unlock();
          }}
        />
      ) : null}

      {/* MAP CONFIRM */}
      {mapConfirmOpen ? (
        <MapConfirm
          onCancel={() => setMapConfirmOpen(false)}
          onConfirm={async () => {
            const ok = await chargePenalty(MAP_PENALTY_SEC);
            if (!ok) return;
            setMapsPaid((prev) => {
              const next = new Set(prev);
              next.add(clue.id);
              return next;
            });
            setMapConfirmOpen(false);
            setMapOpen(true);
          }}
        />
      ) : null}

      {/* HINT CONFIRM */}
      {hintConfirmOpen ? (
        <HintConfirm
          which={hintsRevealed + 1}
          onCancel={() => setHintConfirmOpen(false)}
          onConfirm={async () => {
            const ok = await chargePenalty(HINT_PENALTY_SEC);
            if (!ok) return;
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
              const blob = dataUrlToBlob(dataUrl);
              stored = await uploadViaApi(blob);
            } catch {
              // Swallow — we'll fall back to a data URL stub below.
            }
            const finalUrl = stored ?? `inline:${dataUrl.slice(0, 80)}…`;
            await postJson("/api/quest/progress/photo", {
              sessionId: session.id,
              clueId: clue.id,
              photoUrl: finalUrl,
            });
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
  playerCoords,
  onClose,
}: {
  clue: Clue;
  distanceM: number | null;
  accuracy: number | null;
  playerCoords: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const hasCheckpointCoords = clue.location_lat != null && clue.location_lng != null;
  const checkpoint = hasCheckpointCoords
    ? { lat: Number(clue.location_lat), lng: Number(clue.location_lng) }
    : null;
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
        <div style={{ position: "relative", height: 240, marginBottom: 12 }}>
          {checkpoint ? (
            <LeafletMap
              checkpoint={checkpoint}
              player={playerCoords}
              geofenceRadiusM={clue.geofence_radius_m ?? 25}
              accuracyM={accuracy}
              locationName={clue.location_name}
            />
          ) : (
            <div
              className="ph-box map"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 14,
                padding: 16,
                textAlign: "center",
              }}
            >
              checkpoint coordinates missing
            </div>
          )}
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

function MapConfirm({
  onCancel,
  onConfirm,
}: {
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
        <div className="row gap-2" style={{ marginBottom: 10, alignItems: "center" }}>
          <QuestIcon name="map" size={22} style={{ color: "var(--accent)" }} />
          <div className="h2">Show the map?</div>
        </div>
        <div className="p muted" style={{ marginBottom: 14 }}>
          Opening the map reveals exactly where this clue is and adds{" "}
          <b style={{ color: "var(--accent)" }}>+{formatPenalty(MAP_PENALTY_SEC)}</b> to your
          running time. You only pay once per clue.
        </div>
        <div className="row gap-2">
          <button className="btn ghost grow" onClick={onCancel}>Keep solving</button>
          <button className="btn primary grow" onClick={onConfirm}>Show map</button>
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
        <div className="row gap-2" style={{ marginBottom: 10, alignItems: "center" }}>
          <QuestIcon name="bulb" size={22} style={{ color: "var(--accent)" }} />
          <div className="h2">Reveal hint {which}?</div>
        </div>
        <div className="p muted" style={{ marginBottom: 14 }}>
          This adds <b style={{ color: "var(--accent)" }}>+{formatPenalty(HINT_PENALTY_SEC)}</b> to your running time.
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
          <button
            className="btn primary grow row gap-2"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{ alignItems: "center", justifyContent: "center" }}
          >
            <QuestIcon name="camera" size={18} />
            {busy ? "Uploading…" : "Snap it"}
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
