"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "./wordmark";
import { Scoreboard } from "./scoreboard";
import { getOrCreateSessionId } from "@/lib/session";
import type { Verdict } from "@/lib/verdict-parser";

type RoomResult = {
  roomId: string;
  state: string;
  player1: string;
  player2: string;
  prompt: string;
  stake: number;
  verdict: {
    winner: "player1" | "player2";
    score_player1: number;
    score_player2: number;
    is_draw?: boolean;
    winner_id?: string;
    loser_id?: string;
  } | null;
};

export function ResultCard({ data }: { data: RoomResult }) {
  const [youAre, setYouAre] = useState<"player1" | "player2" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    if (sid === data.player1) setYouAre("player1");
    else if (sid === data.player2) setYouAre("player2");
    else setYouAre(null);
  }, [data.player1, data.player2]);

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : `/result/${data.roomId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* swallow */
    }
  };

  if (!data.verdict) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">
          Verdict not yet ready. Refresh in a moment.
        </div>
      </main>
    );
  }

  const v = data.verdict as Verdict & { is_draw?: boolean };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="w-full border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Wordmark className="text-lg" />
          <Link
            href="/"
            className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-secondary"
          >
            New debate
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl space-y-6 px-6 py-12">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Verdict
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">
          “{data.prompt}”
        </h1>

        <Scoreboard
          winner={v.winner}
          scoreP1={v.score_player1}
          scoreP2={v.score_player2}
          youAre={youAre}
          startingCredits={0}
          isDraw={Boolean(v.is_draw)}
        />

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/"
            className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Play Again
          </Link>
          <button
            onClick={copy}
            className="rounded-full border border-border px-8 py-3 font-semibold transition hover:bg-secondary"
          >
            {copied ? "Link copied!" : "Share result"}
          </button>
        </div>
      </section>
    </main>
  );
}
