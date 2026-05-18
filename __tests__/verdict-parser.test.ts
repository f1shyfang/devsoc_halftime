import { describe, expect, it } from "vitest";
import { drawVerdict, parseVerdict } from "@/lib/verdict-parser";

const PROSE =
  "P1 made a strong opening but failed to address the counterargument. P2 had better sourcing on long-term outcomes.";

describe("parseVerdict", () => {
  it("parses prose + valid VERDICT block", () => {
    const raw = `${PROSE}\n<VERDICT>{"winner":"player2","score_player1":6,"score_player2":8}</VERDICT>`;
    const r = parseVerdict(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.verdict.winner).toBe("player2");
      expect(r.verdict.score_player1).toBe(6);
      expect(r.verdict.score_player2).toBe(8);
      expect(r.prose).toContain("P1 made a strong");
    }
  });

  it("ignores trailing prose after </VERDICT>", () => {
    const raw = `${PROSE}\n<VERDICT>{"winner":"player1","score_player1":9,"score_player2":4}</VERDICT>\nignore me`;
    const r = parseVerdict(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.verdict.winner).toBe("player1");
  });

  it("rejects missing VERDICT tag", () => {
    const r = parseVerdict("just prose, no tag");
    expect(r.ok).toBe(false);
  });

  it("rejects malformed JSON inside VERDICT", () => {
    const r = parseVerdict(`${PROSE}\n<VERDICT>not json</VERDICT>`);
    expect(r.ok).toBe(false);
    expect(r.prose).toContain("P1 made");
  });

  it("rejects out-of-range scores", () => {
    const r = parseVerdict(
      `<VERDICT>{"winner":"player1","score_player1":11,"score_player2":2}</VERDICT>`
    );
    expect(r.ok).toBe(false);
  });

  it("rejects invalid winner enum", () => {
    const r = parseVerdict(
      `<VERDICT>{"winner":"draw","score_player1":5,"score_player2":5}</VERDICT>`
    );
    expect(r.ok).toBe(false);
  });

  it("drawVerdict returns equal scores", () => {
    const v = drawVerdict();
    expect(v.score_player1).toBe(v.score_player2);
  });
});
