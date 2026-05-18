"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PusherClient from "pusher-js";
import { Wordmark } from "./wordmark";
import { CreditPill } from "./credit-pill";
import { fetchWithSession } from "@/lib/fetch-with-session";
import { getCredits, getOrCreateSessionId } from "@/lib/session";
import { STAKE, STARTING_CREDITS } from "@/lib/config";

type LobbyStatus = "idle" | "queueing" | "matched" | "error";

type MatchedPayload = {
  roomId: string;
  prompt: string;
  stake: number;
};

export function Lobby() {
  const router = useRouter();
  const [credits, setCredits] = useState<number>(STARTING_CREDITS);
  const [status, setStatus] = useState<LobbyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pusherRef = useRef<PusherClient | null>(null);

  useEffect(() => {
    setCredits(getCredits(STARTING_CREDITS));
    getOrCreateSessionId();
  }, []);

  const handleMatched = useCallback(
    (payload: MatchedPayload) => {
      setStatus("matched");
      router.push(`/debate/${payload.roomId}`);
    },
    [router]
  );

  const findOpponent = useCallback(async () => {
    setError(null);
    if (credits < STAKE) {
      setError(`Need at least ${STAKE} credits to enter a debate.`);
      return;
    }

    const sessionId = getOrCreateSessionId();
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (key && cluster && !pusherRef.current) {
      pusherRef.current = new PusherClient(key, { cluster });
    }
    if (pusherRef.current) {
      const channel = pusherRef.current.subscribe(`lobby-${sessionId}`);
      channel.bind("matched", (data: MatchedPayload) => {
        handleMatched(data);
      });
    }

    setStatus("queueing");
    try {
      const resp = await fetchWithSession("/api/join-queue", { method: "POST" });
      const data = (await resp.json()) as
        | { status: "matched"; roomId: string; prompt: string; stake: number }
        | { status: "waiting" }
        | { error: string };
      if ("status" in data && data.status === "matched") {
        handleMatched(data);
        return;
      }
      if ("error" in data) {
        setStatus("error");
        setError(data.error);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Network error");
    }
  }, [credits, handleMatched]);

  const cancel = useCallback(async () => {
    try {
      await fetchWithSession("/api/join-queue", { method: "DELETE" });
    } catch {
      /* swallow */
    }
    if (pusherRef.current) {
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="w-full border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark className="text-xl" />
          <CreditPill credits={credits} />
        </div>
      </nav>

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-6 py-24 text-center">
        <h1 className="font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          Argue out loud.
          <br />
          <span className="text-primary">For real stakes.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Omegle meets poker — for arguments. Get matched with a stranger on
          video, stake credits, debate live. An AI judge declares the winner.
        </p>

        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Stake:{" "}
            <span className="font-mono-num font-semibold text-foreground">
              {STAKE}
            </span>{" "}
            credits / match
          </div>

          {status === "idle" || status === "error" ? (
            <button
              onClick={findOpponent}
              className="rounded-full bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              disabled={credits < STAKE}
            >
              Find Opponent
            </button>
          ) : null}

          {status === "queueing" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="record-pulse h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">
                  Looking for an opponent…
                </span>
              </div>
              <button
                onClick={cancel}
                className="rounded-full border border-border px-6 py-2 text-sm text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          ) : null}

          {status === "matched" ? (
            <div className="text-sm text-muted-foreground">
              Match found — entering room…
            </div>
          ) : null}

          {error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : null}
        </div>

        <p className="text-sm italic text-muted-foreground">
          Connect through conflict.
        </p>
      </section>
    </main>
  );
}
