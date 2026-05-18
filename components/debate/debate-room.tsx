"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PusherClient from "pusher-js";
import { Wordmark } from "./wordmark";
import { CreditPill } from "./credit-pill";
import { PromptBanner } from "./prompt-banner";
import { DebateVideo } from "./debate-video";
import { TranscriptList } from "./transcript-list";
import { TurnRecorder } from "./turn-recorder";
import { VerdictReveal, type VerdictPayload } from "./verdict-reveal";
import { fetchWithSession } from "@/lib/fetch-with-session";
import {
  adjustCredits,
  getCredits,
  getOrCreateSessionId,
  tryClaimCreditApplication,
} from "@/lib/session";
import {
  STAKE,
  STARTING_CREDITS,
  TURNS_PER_PLAYER,
} from "@/lib/config";
import type { RoomState, TurnEntry } from "@/lib/room-state";

type RoomSnapshot = {
  roomId: string;
  state: RoomState;
  player1: string;
  player2: string;
  prompt: string;
  stake: number;
  turn_count: number;
  turns: TurnEntry[];
  verdict: VerdictPayload | null;
};

export function DebateRoom({ roomId }: { roomId: string }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [credits, setCredits] = useState<number>(STARTING_CREDITS);
  const [transcribing, setTranscribing] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [verdictPayload, setVerdictPayload] = useState<VerdictPayload | null>(
    null
  );
  const [judgeRequested, setJudgeRequested] = useState(false);
  const creditsAppliedRef = useRef(false);
  const pusherRef = useRef<PusherClient | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    setCredits(getCredits(STARTING_CREDITS));
  }, []);

  const refreshRoom = useCallback(async () => {
    const resp = await fetch(`/api/room-state?roomId=${roomId}`);
    if (!resp.ok) return;
    const data = (await resp.json()) as RoomSnapshot;
    setSnapshot(data);
    if (data.verdict) {
      setVerdictPayload(data.verdict);
    }
  }, [roomId]);

  useEffect(() => {
    void refreshRoom();
    const interval = setInterval(() => {
      // Fallback polling; Pusher events drive the fast path.
      if (!verdictPayload) void refreshRoom();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshRoom, verdictPayload]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;
    if (pusherRef.current) return;
    const client = new PusherClient(key, { cluster });
    pusherRef.current = client;
    const channel = client.subscribe(`debate-${roomId}`);

    channel.bind("room-ready", () => {
      void refreshRoom();
    });
    channel.bind(
      "turn-submitted",
      (data: { turn: TurnEntry; turn_count: number; state: RoomState }) => {
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                turns: dedupeTurns([...prev.turns, data.turn]),
                turn_count: data.turn_count,
                state: data.state,
              }
            : prev
        );
      }
    );
    channel.bind("judging-started", () => {
      setSnapshot((prev) => (prev ? { ...prev, state: "judging" } : prev));
      setStreamedText("");
    });
    channel.bind("judgment-chunk", (data: { chunk: string }) => {
      setStreamedText((prev) => prev + data.chunk);
    });
    channel.bind("judgment-done", (data: VerdictPayload) => {
      setVerdictPayload(data);
      setSnapshot((prev) => (prev ? { ...prev, state: "done" } : prev));
    });
    channel.bind("judgment-failed", () => {
      // Lock expires after 5min; allow user to click Request Judgment again.
      setJudgeRequested(false);
      setSnapshot((prev) => (prev ? { ...prev, state: "complete" } : prev));
      setStreamedText("");
    });

    return () => {
      client.unsubscribe(`debate-${roomId}`);
      client.disconnect();
      pusherRef.current = null;
    };
  }, [roomId, refreshRoom]);

  // Apply credit delta exactly once per device per room. The localStorage
  // claim survives page refreshes — without it, reloading a finished debate
  // would re-deduct (or re-credit) the stake on every visit.
  useEffect(() => {
    if (!verdictPayload || !sessionId || creditsAppliedRef.current) return;
    if (!tryClaimCreditApplication(roomId)) {
      creditsAppliedRef.current = true;
      return;
    }
    if (verdictPayload.is_draw) {
      creditsAppliedRef.current = true;
      return;
    }
    const youWon = verdictPayload.winner_id === sessionId;
    const delta = youWon ? STAKE : -STAKE;
    const next = adjustCredits(delta, STARTING_CREDITS);
    setCredits(next);
    creditsAppliedRef.current = true;
  }, [verdictPayload, sessionId, roomId]);

  const requestJudgment = useCallback(async () => {
    if (judgeRequested) return;
    setJudgeRequested(true);
    try {
      await fetchWithSession("/api/judge", {
        method: "POST",
        body: JSON.stringify({ roomId }),
      });
    } catch (err) {
      console.error(err);
      setJudgeRequested(false);
    }
  }, [judgeRequested, roomId]);

  if (!snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Loading debate…</div>
      </main>
    );
  }

  const youAre: "player1" | "player2" | null =
    sessionId === snapshot.player1
      ? "player1"
      : sessionId === snapshot.player2
        ? "player2"
        : null;
  const turnIndex = snapshot.turn_count;
  const isYourTurn =
    youAre &&
    snapshot.state !== "complete" &&
    snapshot.state !== "judging" &&
    snapshot.state !== "done" &&
    ((turnIndex % 2 === 0 && youAre === "player1") ||
      (turnIndex % 2 === 1 && youAre === "player2"));
  const turnsLeftThisPlayer =
    TURNS_PER_PLAYER -
    Math.floor(
      (youAre === "player1"
        ? snapshot.turns.filter((t) => t.player === snapshot.player1).length
        : snapshot.turns.filter((t) => t.player === snapshot.player2).length)
    );
  const currentRound = Math.min(
    TURNS_PER_PLAYER,
    Math.floor(turnIndex / 2) + 1
  );
  const pendingLabel = transcribing
    ? `${youAre === "player1" ? "P1" : "P2"} · Transcribing…`
    : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="w-full border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3 text-sm">
          <Wordmark className="text-lg" />
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              Round{" "}
              <span className="font-mono-num font-semibold text-foreground">
                {currentRound}/{TURNS_PER_PLAYER}
              </span>
            </span>
            <span className="text-muted-foreground">
              Stake{" "}
              <span className="font-mono-num font-semibold text-foreground">
                {snapshot.stake}
              </span>
            </span>
            <CreditPill credits={credits} />
          </div>
        </div>
      </nav>

      <PromptBanner prompt={snapshot.prompt} />

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-6">
        <DebateVideo roomId={roomId} />

        {snapshot.state === "judging" || snapshot.state === "done" ? (
          <VerdictReveal
            streamedText={streamedText}
            verdict={verdictPayload}
            youAre={youAre}
            startingCredits={credits}
          />
        ) : null}

        <section className="space-y-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Transcript
          </div>
          <TranscriptList
            turns={snapshot.turns}
            player1={snapshot.player1}
            pendingLabel={pendingLabel}
          />
        </section>

        {snapshot.state !== "done" ? (
          <section className="border-t border-border pt-6">
            {snapshot.state === "complete" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  All turns submitted. Ready for the AI judge.
                </div>
                <button
                  onClick={requestJudgment}
                  disabled={judgeRequested}
                  className="rounded-full bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  ⚖️ Request Judgment
                </button>
              </div>
            ) : null}
            {snapshot.state === "judging" ? (
              <div className="text-center text-sm text-muted-foreground">
                Judge is deliberating…
              </div>
            ) : null}
            {isYourTurn ? (
              <TurnRecorder
                key={turnIndex}
                roomId={roomId}
                turnIndex={turnIndex}
                onTranscribingChange={setTranscribing}
                onTurnSubmitted={() => void refreshRoom()}
                disabled={transcribing}
              />
            ) : snapshot.state !== "complete" &&
              snapshot.state !== "judging" ? (
              <div className="rounded-md border border-dashed border-border bg-secondary/20 p-5 text-center text-sm text-muted-foreground">
                {youAre
                  ? `Opponent is speaking… (${turnsLeftThisPlayer} of your turns left)`
                  : "Spectating — you're not a player in this room."}
              </div>
            ) : null}
          </section>
        ) : null}

        {snapshot.state === "done" ? (
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border pt-6">
            <Link
              href="/"
              className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Play Again
            </Link>
            <Link
              href={`/result/${roomId}`}
              className="rounded-full border border-border px-8 py-3 font-semibold transition hover:bg-secondary"
            >
              Share Result
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function dedupeTurns(turns: TurnEntry[]): TurnEntry[] {
  const seen = new Map<number, TurnEntry>();
  for (const t of turns) seen.set(t.turn_index, t);
  return [...seen.values()].sort((a, b) => a.turn_index - b.turn_index);
}
