"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getStoredPlayerId } from "@/lib/mvp/player-storage";
import type { MvpPlayerState } from "@/lib/mvp/types";
import { MvpCodeScanner } from "./MvpCodeScanner";

function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function MvpPlayShell() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<MvpPlayerState | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [anagramInput, setAnagramInput] = useState("");
  const [anagramErr, setAnagramErr] = useState<string | null>(null);
  const [geocodeErr, setGeocodeErr] = useState<string | null>(null);
  const [geocodeInput, setGeocodeInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const refresh = useCallback(
    async (playerId: string) => {
      const { data, error } = await supabase.rpc("mvp_get_player_state", {
        p_player_id: playerId,
      });
      if (error) {
        setLoadErr(error.message);
        return;
      }
      setState(data as MvpPlayerState);
    },
    [supabase],
  );

  useEffect(() => {
    const playerId = getStoredPlayerId();
    if (!playerId) {
      router.replace("/join");
      return;
    }
    void refresh(playerId);
  }, [refresh, router]);

  useEffect(() => {
    if (state?.phase === "completed") {
      router.push(`/leaderboard?game=${state.game_id}`);
    }
  }, [state?.phase, state?.game_id, router]);

  const runRpc = async (
    call: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ) => {
    setBusy(true);
    const { data, error } = await call;
    setBusy(false);
    if (error) {
      setLoadErr(error.message);
      return null;
    }
    const next = data as MvpPlayerState;
    if (next.ok === false && next.message) {
      return next;
    }
    setState(next);
    return next;
  };

  const confirmStart = async () => {
    const playerId = getStoredPlayerId();
    if (!playerId) return;
    await runRpc(supabase.rpc("mvp_confirm_start", { p_player_id: playerId }));
  };

  const ackWalk = async () => {
    const playerId = getStoredPlayerId();
    if (!playerId) return;
    await runRpc(supabase.rpc("mvp_ack_walk", { p_player_id: playerId }));
  };

  const submitAnagram = async () => {
    const playerId = getStoredPlayerId();
    if (!playerId || !state?.puzzle?.id) return;
    setAnagramErr(null);
    const result = await runRpc(
      supabase.rpc("mvp_submit_anagram", {
        p_player_id: playerId,
        p_puzzle_id: state.puzzle!.id,
        p_input: anagramInput,
      }),
    );
    if (result?.ok === false) {
      setAnagramErr(result.message ?? "Try again.");
    } else {
      setAnagramInput("");
    }
  };

  const submitGeocode = async (code: string) => {
    const playerId = getStoredPlayerId();
    if (!playerId || !state?.puzzle?.id) return;
    setGeocodeErr(null);
    setShowScanner(false);
    const result = await runRpc(
      supabase.rpc("mvp_submit_geocache_code", {
        p_player_id: playerId,
        p_puzzle_id: state.puzzle!.id,
        p_code: code,
      }),
    );
    if (result?.ok === false) {
      setGeocodeErr(result.message ?? "Code did not match.");
    }
  };

  const skipPhoto = async () => {
    const playerId = getStoredPlayerId();
    if (!playerId || !state?.puzzle?.id) return;
    await runRpc(
      supabase.rpc("mvp_record_photo", {
        p_player_id: playerId,
        p_puzzle_id: state.puzzle!.id,
        p_photo_url: null,
        p_skipped: true,
      }),
    );
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
    } catch {
      setLoadErr("Camera access denied — you can skip the selfie.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (state?.phase === "photo") {
      void startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.puzzle?.id]);

  const capturePhoto = async () => {
    const playerId = getStoredPlayerId();
    if (!playerId || !state?.puzzle?.id || !videoRef.current) return;
    setPhotoBusy(true);
    try {
      const v = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth || 640;
      canvas.height = v.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("could not capture");

      const path = `mvp/${playerId}/${state.puzzle.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("quest-photos")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("quest-photos").getPublicUrl(path);

      await runRpc(
        supabase.rpc("mvp_record_photo", {
          p_player_id: playerId,
          p_puzzle_id: state.puzzle!.id,
          p_photo_url: urlData.publicUrl,
          p_skipped: false,
        }),
      );
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhotoBusy(false);
      stopCamera();
    }
  };

  if (loadErr && !state) {
    return (
      <div className="p-6 text-center flex flex-col gap-4">
        <p className="text-red-600">{loadErr}</p>
        <Link href="/join" className="text-[#ef5b3a] font-semibold">
          Back to join
        </Link>
      </div>
    );
  }

  if (!state) {
    return <p className="p-8 text-center text-[#6f6f7a]">Loading…</p>;
  }

  const elapsed =
    state.phase === "completed"
      ? (state.total_time_seconds ?? 0)
      : (state.elapsed_seconds ?? 0);

  return (
    <div className="flex flex-col gap-4 w-full max-w-[430px] mx-auto">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{state.name}</span>
        {state.phase !== "welcome" ? (
          <span
            className="tabular-nums font-mono text-[#6f6f7a]"
            style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
          >
            {formatClock(elapsed)}
          </span>
        ) : null}
      </div>

      {state.phase === "welcome" ? (
        <div className="rounded-2xl border-2 border-[#1a1a22] bg-[#fbf7ec] p-6 flex flex-col gap-4">
          <h2
            className="text-3xl leading-tight"
            style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive" }}
          >
            Welcome, {state.name}!
          </h2>
          <p className="text-[#6f6f7a] leading-relaxed">{state.start_location}</p>
          <button
            type="button"
            onClick={confirmStart}
            disabled={busy}
            className="min-h-[48px] rounded-full bg-[#ef5b3a] text-white font-semibold"
          >
            I&apos;m here — start timer
          </button>
        </div>
      ) : null}

      {state.phase === "walk" ? (
        <div className="rounded-2xl border-2 border-[#1a1a22] bg-[#c9f558] p-6 flex flex-col gap-4">
          <p className="text-lg font-semibold">{state.walk_prompt}</p>
          <button
            type="button"
            onClick={ackWalk}
            disabled={busy}
            className="min-h-[48px] rounded-full bg-[#1a1a22] text-[#fbf7ec] font-semibold"
          >
            I&apos;m at the next spot
          </button>
        </div>
      ) : null}

      {state.phase === "puzzle" && state.puzzle?.type === "anagram" ? (
        <div className="rounded-2xl border-2 border-[#1a1a22] bg-[#fbf7ec] p-6 flex flex-col gap-4">
          <p className="text-xl font-medium leading-snug">{state.puzzle.prompt}</p>
          <input
            value={anagramInput}
            onChange={(e) => setAnagramInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAnagram()}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Your answer"
            className="w-full rounded-xl border-2 border-[#1a1a22] px-4 py-3 text-lg"
          />
          {anagramErr ? <p className="text-sm text-red-600">{anagramErr}</p> : null}
          <button
            type="button"
            onClick={submitAnagram}
            disabled={busy}
            className="min-h-[48px] rounded-full bg-[#ef5b3a] text-white font-semibold"
          >
            Submit
          </button>
        </div>
      ) : null}

      {state.phase === "puzzle" && state.puzzle?.type === "riddle_to_geocache" ? (
        <div className="rounded-2xl border-2 border-[#1a1a22] bg-[#fbf7ec] p-6 flex flex-col gap-4">
          <p className="text-xl font-medium leading-snug">{state.puzzle.prompt}</p>
          <input
            value={geocodeInput}
            onChange={(e) => setGeocodeInput(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Type code"
            className="w-full rounded-xl border-2 border-[#1a1a22] px-4 py-3 text-lg"
          />
          {geocodeErr ? <p className="text-sm text-red-600">{geocodeErr}</p> : null}
          <button
            type="button"
            onClick={() => submitGeocode(geocodeInput)}
            disabled={busy}
            className="min-h-[48px] rounded-full bg-[#ef5b3a] text-white font-semibold"
          >
            Submit code
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="min-h-[48px] rounded-full border-2 border-[#1a1a22] font-semibold"
          >
            Scan QR instead
          </button>
          {showScanner ? (
            <MvpCodeScanner
              onCode={(c) => submitGeocode(c)}
              onClose={() => setShowScanner(false)}
            />
          ) : null}
        </div>
      ) : null}

      {state.phase === "photo" ? (
        <div className="rounded-2xl border-2 border-[#1a1a22] bg-[#fbf7ec] p-6 flex flex-col gap-4">
          <p className="text-xl font-medium">{state.puzzle?.prompt}</p>
          <video
            ref={videoRef}
            className="w-full aspect-[3/4] rounded-xl bg-black object-cover"
            muted
            playsInline
          />
          <button
            type="button"
            onClick={capturePhoto}
            disabled={photoBusy}
            className="min-h-[48px] rounded-full bg-[#ef5b3a] text-white font-semibold"
          >
            {photoBusy ? "Saving…" : "Snap selfie"}
          </button>
          <button
            type="button"
            onClick={skipPhoto}
            disabled={busy}
            className="min-h-[44px] text-sm text-[#6f6f7a] underline"
          >
            Skip — finish hunt
          </button>
        </div>
      ) : null}

      <Link
        href={`/leaderboard?game=${state.game_id}`}
        className="text-center text-sm text-[#6f6f7a] hover:text-[#1a1a22] py-2"
      >
        View live leaderboard →
      </Link>

      {loadErr ? <p className="text-sm text-red-600 text-center">{loadErr}</p> : null}
    </div>
  );
}
