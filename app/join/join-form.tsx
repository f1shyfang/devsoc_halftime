"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getStoredPlayerId, setStoredPlayerId } from "@/lib/mvp/player-storage";
import type { MvpPlayerState } from "@/lib/mvp/types";

export function JoinForm({
  gameId,
  startLocation,
}: {
  gameId: string;
  startLocation: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name to join.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const existing = getStoredPlayerId();
    const { data, error: rpcErr } = await supabase.rpc("mvp_join_game", {
      p_game_id: gameId,
      p_name: trimmed,
      p_existing_player_id: existing,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const state = data as MvpPlayerState;
    setStoredPlayerId(state.player_id);
    router.push("/play");
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-[390px]">
      <div className="rounded-2xl border-2 border-[#1a1a22] bg-[#fbf7ec] p-6 flex flex-col gap-4">
        <p className="text-sm text-[#6f6f7a] leading-relaxed">{startLocation}</p>
        <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#6f6f7a]">
          Your name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="e.g. Alex"
          maxLength={32}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border-2 border-[#1a1a22] bg-white px-4 py-3 text-lg font-medium text-[#1a1a22] outline-none focus:ring-2 focus:ring-[#ef5b3a]"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={join}
          disabled={busy}
          className="min-h-[48px] rounded-full bg-[#ef5b3a] text-white font-semibold text-base hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {busy ? "Joining…" : "Join game"}
        </button>
      </div>
    </div>
  );
}
