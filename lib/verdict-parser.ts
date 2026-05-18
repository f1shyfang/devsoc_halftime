import { z } from "zod";
import { VERDICT_OPEN, VERDICT_CLOSE } from "./judge-prompt";

export const verdictSchema = z.object({
  winner: z.enum(["player1", "player2"]),
  score_player1: z.number().int().min(1).max(10),
  score_player2: z.number().int().min(1).max(10),
});

export type Verdict = z.infer<typeof verdictSchema>;

export type ParseResult =
  | { ok: true; verdict: Verdict; prose: string }
  | { ok: false; prose: string };

export function parseVerdict(raw: string): ParseResult {
  const openIdx = raw.indexOf(VERDICT_OPEN);
  if (openIdx === -1) {
    return { ok: false, prose: raw.trim() };
  }
  const prose = raw.slice(0, openIdx).trim();
  const after = raw.slice(openIdx + VERDICT_OPEN.length);
  const closeIdx = after.indexOf(VERDICT_CLOSE);
  const jsonStr = (closeIdx === -1 ? after : after.slice(0, closeIdx)).trim();
  try {
    const parsed = JSON.parse(jsonStr);
    const validated = verdictSchema.parse(parsed);
    return { ok: true, verdict: validated, prose };
  } catch {
    return { ok: false, prose };
  }
}

export function drawVerdict(): Verdict {
  return {
    winner: "player1",
    score_player1: 5,
    score_player2: 5,
  };
}

export function isDraw(v: Verdict): boolean {
  return v.score_player1 === v.score_player2;
}
