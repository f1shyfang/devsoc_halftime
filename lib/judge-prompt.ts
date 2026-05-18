import type { TurnEntry } from "./room-state";

export function buildJudgePrompt(
  debatePrompt: string,
  turns: TurnEntry[],
  player1: string,
  player2: string,
  strict = false
): string {
  const ordered = [...turns].sort((a, b) => a.turn_index - b.turn_index);
  const transcript = ordered
    .map((t) => {
      const label = t.player === player1 ? "Player 1" : "Player 2";
      const turnNum = Math.floor(t.turn_index / 2) + 1;
      return `[${label} — Turn ${turnNum}]: ${t.transcript.trim() || "(silence)"}`;
    })
    .join("\n");

  const stricter = strict
    ? "\n\nIMPORTANT: Your previous response did not include a parseable <VERDICT> block. Write at most 4 sentences of prose, then on a new line output ONLY the <VERDICT>...</VERDICT> tag with valid JSON. Do not include any text after </VERDICT>."
    : "";

  return `You are an impartial debate judge. The two players spoke their arguments aloud; the text below is the Whisper transcript of each turn.

DEBATE PROMPT: "${debatePrompt}"

TRANSCRIPT:
${transcript}

Write your reasoning as natural prose (3-5 sentences). Evaluate: argument quality, evidence, logical consistency, persuasiveness.

After your reasoning, on a new line, output ONLY:
<VERDICT>{"winner": "player1" | "player2", "score_player1": 1-10, "score_player2": 1-10}</VERDICT>

No extra text after </VERDICT>.${stricter}`;
}

export const VERDICT_OPEN = "<VERDICT>";
export const VERDICT_CLOSE = "</VERDICT>";
