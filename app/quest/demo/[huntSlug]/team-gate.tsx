"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TeamGate({ huntId, huntSlug }: { huntId: string; huntSlug: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("quest_create_team", {
      p_hunt_id: huntId,
      p_team_name: teamName.trim() || undefined,
    });
    setBusy(false);
    if (error || !data || data.length === 0) {
      setError(error?.message ?? "Could not create team");
      return;
    }
    router.push(`/quest/demo/${huntSlug}/play`);
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError("Invite codes are 6 characters.");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.rpc("quest_join_team", { p_invite_code: code });
    setBusy(false);
    if (error || !data || data.length === 0) {
      setError(error?.message ?? "Could not join team");
      return;
    }
    router.push(`/quest/demo/${huntSlug}/play`);
  };

  const inputStyle = {
    border: "var(--stroke) solid var(--ink)",
    borderRadius: 12,
    padding: "10px 12px",
    fontFamily: "var(--mono)",
    fontSize: 14,
    background: "var(--paper)",
    color: "var(--ink)",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ width: "min(100%, 420px)", display: "flex", flexDirection: "column", gap: 12 }}>
      {mode === "choose" ? (
        <>
          <button className="btn primary" onClick={() => setMode("create")}>
            Create a team
          </button>
          <button className="btn ink-btn" onClick={() => setMode("join")}>
            Join with code
          </button>
        </>
      ) : null}

      {mode === "create" ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 8 }}>NEW TEAM</div>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name (optional)"
            maxLength={40}
            style={inputStyle}
          />
          <div className="row gap-2" style={{ marginTop: 12 }}>
            <button className="btn ghost grow" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </button>
            <button className="btn primary grow" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create team"}
            </button>
          </div>
          {error ? (
            <div className="p" style={{ color: "var(--bad)", marginTop: 10 }}>{error}</div>
          ) : null}
        </div>
      ) : null}

      {mode === "join" ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 8 }}>JOIN WITH CODE</div>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="ABCDE2"
            maxLength={6}
            style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: "0.2em", textAlign: "center", fontSize: 18 }}
          />
          <div className="row gap-2" style={{ marginTop: 12 }}>
            <button className="btn ghost grow" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </button>
            <button className="btn primary grow" onClick={join} disabled={busy}>
              {busy ? "Joining…" : "Join team"}
            </button>
          </div>
          {error ? (
            <div className="p" style={{ color: "var(--bad)", marginTop: 10 }}>{error}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
