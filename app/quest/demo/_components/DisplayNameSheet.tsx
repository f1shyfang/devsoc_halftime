"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDeviceIdClient } from "@/lib/device-id";

const PALETTE = ["#ef5b3a", "#c9f558", "#3a6ef0", "#a64bd3", "#1a8c5a", "#1a1a22"];

export function DisplayNameSheet({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName === "player" ? "" : initialName);
  const [color, setColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const deviceId = getDeviceIdClient();
    const { error: profileErr } = await supabase.rpc("quest_ensure_profile", {
      p_user_id: deviceId,
      p_display_name: trimmed,
    });
    if (profileErr) {
      setBusy(false);
      setError(profileErr.message);
      return;
    }
    // avatar_color isn't covered by quest_ensure_profile — write it directly.
    // RLS is disabled on quest_profiles per migration 00006, so anon can update.
    const { error: colorErr } = await supabase
      .from("quest_profiles")
      .update({ avatar_color: color })
      .eq("user_id", deviceId);
    setBusy(false);
    if (colorErr) {
      setError(colorErr.message);
      return;
    }
    router.refresh();
  };

  const initials = (name.trim() || "?").slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,34,0.55)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{ width: "min(100%, 380px)", padding: 22, background: "var(--paper)" }}
      >
        <div className="label" style={{ marginBottom: 4 }}>WELCOME</div>
        <div className="hand" style={{ fontSize: 28, lineHeight: 1.05, marginBottom: 6 }}>
          Pick a name for your team.
        </div>
        <div className="muted small" style={{ marginBottom: 14 }}>
          Your teammates see this on the leaderboard. You can change it later.
        </div>

        <div className="row gap-2" style={{ alignItems: "center", marginBottom: 14 }}>
          <div
            className="av lg"
            style={{
              background: color,
              color: color === "#c9f558" ? "var(--ink)" : "white",
              borderColor: "var(--ink)",
            }}
          >
            {initials}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={24}
            autoFocus
            style={{
              border: "var(--stroke) solid var(--ink)",
              borderRadius: 12,
              padding: "10px 12px",
              fontFamily: "var(--ui)",
              fontSize: 16,
              background: "var(--paper)",
              color: "var(--ink)",
              flex: 1,
              minWidth: 0,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div className="label" style={{ marginBottom: 6 }}>AVATAR COLOUR</div>
        <div className="row gap-2" style={{ marginBottom: 18, flexWrap: "wrap" }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Avatar colour ${c}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: c,
                border:
                  c === color
                    ? "3px solid var(--ink)"
                    : "2px solid var(--hair)",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>

        <button
          className="btn primary"
          onClick={submit}
          disabled={busy}
          style={{ width: "100%", minHeight: 48, fontSize: 15 }}
        >
          {busy ? "Saving…" : "Let's play →"}
        </button>
        {error ? (
          <div className="p" style={{ color: "var(--bad)", marginTop: 10, textAlign: "center" }}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
