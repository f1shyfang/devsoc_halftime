"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SessionRow = {
  id: string;
  team_id: string;
  team_name: string;
  state: string;
  current_tier: number;
  current_sequence: number;
  started_at: string | null;
  completed_at: string | null;
  hint_penalty_seconds: number;
  total_time_seconds: number | null;
};

function elapsedSecondsFor(s: SessionRow, nowMs: number) {
  if (s.state === "completed" && s.total_time_seconds != null) return s.total_time_seconds;
  if (s.state === "in_progress" && s.started_at) {
    return Math.floor((nowMs - new Date(s.started_at).getTime()) / 1000) + (s.hint_penalty_seconds ?? 0);
  }
  return 0;
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function initials(name: string) {
  return name.replace(/^team\s+/i, "").slice(0, 2).toUpperCase();
}

const AV_COLORS = ["#ef5b3a", "#c9f558", "#1a1a22", "#3a6ef0", "#a64bd3", "#1a8c5a"];

export function StandingsView({
  huntId,
  huntName,
  myTeamId,
  initialSessions,
  totalClues,
}: {
  huntId: string;
  huntName: string;
  myTeamId: string | null;
  initialSessions: SessionRow[];
  totalClues: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`hunt-leaderboard:${huntId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quest_hunt_sessions", filter: `hunt_id=eq.${huntId}` },
        async () => {
          const { data: raw } = await supabase
            .from("quest_hunt_sessions")
            .select("*")
            .eq("hunt_id", huntId);
          if (!raw) return;
          const teamIds = raw.map((s) => s.team_id);
          const { data: teams } = teamIds.length
            ? await supabase
                .from("quest_teams")
                .select("id, name")
                .in("id", teamIds)
            : { data: [] };
          const byId = new Map((teams ?? []).map((t) => [t.id, t.name]));
          setSessions(
            raw.map((s) => ({ ...s, team_name: byId.get(s.team_id) ?? "Team" })) as SessionRow[],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, huntId]);

  // Sort: completed first by total_time, then in_progress by clues-unlocked desc + elapsed asc, lobby last.
  const ranked = useMemo(() => {
    const enriched = sessions.map((s) => ({
      ...s,
      unlocked: (s.current_tier - 1) * 99 + (s.current_sequence - 1), // simple ordering signal
      progressLabel: `T${s.current_tier} · C${s.current_sequence}`,
      elapsed: elapsedSecondsFor(s, now),
    }));
    enriched.sort((a, b) => {
      const aDone = a.state === "completed" ? 0 : 1;
      const bDone = b.state === "completed" ? 0 : 1;
      if (aDone !== bDone) return aDone - bDone;
      if (a.state === "completed" && b.state === "completed") {
        return (a.total_time_seconds ?? 0) - (b.total_time_seconds ?? 0);
      }
      if (b.unlocked !== a.unlocked) return b.unlocked - a.unlocked;
      return a.elapsed - b.elapsed;
    });
    return enriched;
  }, [sessions, now]);

  return (
    <section style={{ width: "min(100%, 640px)", display: "flex", flexDirection: "column", gap: 14 }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="hand" style={{ fontSize: 34, lineHeight: 1 }}>Standings</div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {huntName} · {sessions.length} {sessions.length === 1 ? "team" : "teams"}
          </div>
        </div>
        <div className="pill ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--good)",
              boxShadow: "0 0 0 3px rgba(47,158,107,0.18)",
            }}
          />
          updates live
        </div>
      </header>

      <div
        style={{
          background: "var(--paper)",
          border: "var(--stroke) solid var(--ink)",
          borderRadius: 16,
          padding: "8px 10px",
          boxShadow: "4px 6px 0 rgba(26,26,34,0.05)",
        }}
      >
        {ranked.length === 0 ? (
          <div className="p muted" style={{ padding: 16, textAlign: "center" }}>
            No teams yet. Be the first to start the hunt.
          </div>
        ) : (
          ranked.map((s, i) => {
            const isMe = s.team_id === myTeamId;
            const c = AV_COLORS[i % AV_COLORS.length];
            return (
              <div className={`lb ${isMe ? "me" : ""}`} key={s.id} style={{ padding: "10px 8px", fontSize: 13 }}>
                <div className="rank" style={{ fontSize: 13 }}>{i + 1}</div>
                <div
                  className="av lg"
                  style={{ background: c, color: c === "#c9f558" ? "var(--ink)" : "white" }}
                >
                  {initials(s.team_name)}
                </div>
                <div className="nm" style={{ fontSize: 14 }}>
                  {isMe ? `You · ${s.team_name}` : s.team_name}
                </div>
                <div className="pr" style={{ fontSize: 11 }}>
                  {s.state === "completed"
                    ? "done"
                    : s.state === "lobby"
                      ? "lobby"
                      : s.progressLabel}
                </div>
                <div className="tm" style={{ fontSize: 13 }}>{fmt(s.elapsed)}</div>
              </div>
            );
          })
        )}
      </div>
      <div className="muted small" style={{ textAlign: "center" }}>
        {totalClues} clues total · sorted by progress, then time
      </div>
    </section>
  );
}
