"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api/fetcher";

type GenerateResponse = { slug: string; huntId: string };
type CreateTeamResponse = { team_id: string; invite_code: string; session_id: string };

// Best-effort geolocation; resolves to null if denied/unavailable/slow.
function getCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

export function SpawnRoomQuest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = async () => {
    setBusy(true);
    setError(null);

    const coords = await getCoords();

    const gen = await postJson<GenerateResponse>("/api/quest/rooms/generate", {
      count: 6,
      ...(coords ? { nearLat: coords.lat, nearLng: coords.lng } : {}),
    });
    if (gen.error || !gen.data) {
      setBusy(false);
      setError(gen.error?.message ?? "Could not find free rooms right now.");
      return;
    }

    const team = await postJson<CreateTeamResponse>("/api/quest/teams/create", {
      huntId: gen.data.huntId,
    });
    if (team.error || !team.data) {
      setBusy(false);
      setError(team.error?.message ?? "Could not create a team.");
      return;
    }

    router.push(`/quest/demo/${gen.data.slug}/play`);
  };

  return (
    <div className="card" style={{ padding: 18, borderColor: "var(--accent)" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="hand row gap-2" style={{ fontSize: 24, lineHeight: 1, alignItems: "center" }}>
          🚪 Free Room Quest
        </div>
        <div className="pill lime">live</div>
      </div>
      <div className="p muted" style={{ marginTop: 8 }}>
        Generates a quest from rooms that are free on campus right now and drops you at the nearest one.
      </div>
      <button
        className="btn primary grow"
        style={{ marginTop: 14, width: "100%" }}
        onClick={spawn}
        disabled={busy}
      >
        {busy ? "Finding free rooms…" : "Spawn a free-room quest →"}
      </button>
      {error ? (
        <div className="p" style={{ color: "var(--bad)", marginTop: 10 }}>{error}</div>
      ) : null}
    </div>
  );
}
