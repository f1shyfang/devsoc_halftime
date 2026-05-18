import { CreditTicker } from "./credit-ticker";
import { STAKE } from "@/lib/config";

export type ScoreboardProps = {
  winner: "player1" | "player2";
  scoreP1: number;
  scoreP2: number;
  youAre: "player1" | "player2" | null;
  startingCredits: number;
  isDraw: boolean;
};

export function Scoreboard({
  winner,
  scoreP1,
  scoreP2,
  youAre,
  startingCredits,
  isDraw,
}: ScoreboardProps) {
  const p1Won = winner === "player1";
  const p2Won = winner === "player2";

  // Per-side deltas are tied to which side won, not to which side you are —
  // so the shareable result page renders correctly for spectators (youAre = null).
  const p1Delta = isDraw ? 0 : p1Won ? STAKE : -STAKE;
  const p2Delta = isDraw ? 0 : p2Won ? STAKE : -STAKE;

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
      <div
        className={`flex flex-col items-center justify-center gap-3 p-8 transition ${
          p1Won && !isDraw
            ? "bg-primary/10 ring-2 ring-primary"
            : "bg-secondary/30"
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Player 1
        </div>
        <div className="font-mono-num text-5xl font-bold">{scoreP1}/10</div>
        {youAre === "player1" ? (
          <div className="text-xs text-muted-foreground">(you)</div>
        ) : null}
        <CreditDelta delta={p1Delta} />
      </div>
      <div
        className={`flex flex-col items-center justify-center gap-3 p-8 transition ${
          p2Won && !isDraw
            ? "bg-primary/10 ring-2 ring-primary"
            : "bg-card"
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Player 2
        </div>
        <div className="font-mono-num text-5xl font-bold">{scoreP2}/10</div>
        {youAre === "player2" ? (
          <div className="text-xs text-muted-foreground">(you)</div>
        ) : null}
        <CreditDelta delta={p2Delta} />
      </div>
      <div className="col-span-2 border-t border-border bg-background px-6 py-4 text-center text-sm text-muted-foreground">
        {isDraw ? (
          <span>Draw — stakes refunded.</span>
        ) : (
          <span>
            {p1Won ? "Player 1" : "Player 2"} wins{" "}
            <span className="font-mono-num font-semibold text-primary">
              <CreditTicker from={0} to={STAKE} />
            </span>{" "}
            credits.
          </span>
        )}
      </div>
      {/* Hidden initial-credits anchor used by parent to drive global ticker. */}
      <span className="hidden">{startingCredits}</span>
    </div>
  );
}

function CreditDelta({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-sm text-muted-foreground">±0</span>;
  }
  const positive = delta > 0;
  return (
    <span
      className={`font-mono-num text-sm font-semibold ${
        positive ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {positive ? "+" : "−"}
      {Math.abs(delta)} credits
    </span>
  );
}
