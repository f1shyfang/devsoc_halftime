"use client";

import { useEffect, useMemo, useState } from "react";
import { Scoreboard } from "./scoreboard";
import type { Verdict } from "@/lib/verdict-parser";
import { parseVerdict } from "@/lib/verdict-parser";

export type VerdictPayload = {
  verdict: Verdict;
  is_draw: boolean;
  winner_id: string;
  loser_id: string;
  stake: number;
};

export function VerdictReveal({
  streamedText,
  verdict,
  youAre,
  startingCredits,
}: {
  streamedText: string;
  verdict: VerdictPayload | null;
  youAre: "player1" | "player2" | null;
  startingCredits: number;
}) {
  const [showScoreboard, setShowScoreboard] = useState(false);

  useEffect(() => {
    if (verdict) {
      const t = setTimeout(() => setShowScoreboard(true), 400);
      return () => clearTimeout(t);
    }
  }, [verdict]);

  // Strip the <VERDICT> tag from streamed prose for display.
  const proseOnly = useMemo(() => {
    if (!streamedText) return "";
    const parsed = parseVerdict(streamedText);
    return parsed.prose || streamedText;
  }, [streamedText]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          ⚖️ AI Verdict
        </div>
        <p className="font-display mt-3 whitespace-pre-wrap text-lg leading-relaxed text-foreground">
          {proseOnly}
          {!verdict ? (
            <span className="ml-0.5 inline-block h-5 w-2 translate-y-0.5 bg-primary align-middle record-pulse" />
          ) : null}
        </p>
      </div>

      {verdict && showScoreboard ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Scoreboard
            winner={verdict.verdict.winner}
            scoreP1={verdict.verdict.score_player1}
            scoreP2={verdict.verdict.score_player2}
            youAre={youAre}
            startingCredits={startingCredits}
            isDraw={verdict.is_draw}
          />
        </div>
      ) : null}
    </div>
  );
}
