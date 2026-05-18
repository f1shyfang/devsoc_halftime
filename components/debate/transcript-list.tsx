import type { TurnEntry } from "@/lib/room-state";
import { TranscriptSkeleton } from "./transcript-skeleton";

export function TranscriptList({
  turns,
  player1,
  pendingLabel,
}: {
  turns: TurnEntry[];
  player1: string;
  pendingLabel: string | null;
}) {
  const ordered = [...turns].sort((a, b) => a.turn_index - b.turn_index);
  return (
    <div className="flex flex-col gap-2">
      {ordered.map((t) => {
        const isP1 = t.player === player1;
        const turnNum = Math.floor(t.turn_index / 2) + 1;
        return (
          <div
            key={t.turn_index}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <span className="font-semibold text-foreground">
              {isP1 ? "P1" : "P2"} · Turn {turnNum}
            </span>
            <span className="ml-2 text-foreground/90">{t.transcript}</span>
          </div>
        );
      })}
      {pendingLabel ? <TranscriptSkeleton label={pendingLabel} /> : null}
    </div>
  );
}
