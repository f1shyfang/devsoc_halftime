import { describe, expect, it } from "vitest";
import type { TurnEntry } from "@/lib/room-state";

function appendIfNew(turns: TurnEntry[], turn: TurnEntry) {
  const dupe = turns.some((t) => t.turn_index === turn.turn_index);
  if (dupe) return { duplicate: true, turns };
  return { duplicate: false, turns: [...turns, turn] };
}

describe("turn dedup", () => {
  it("first submit for a turn_index appends", () => {
    const turns: TurnEntry[] = [];
    const t: TurnEntry = { player: "a", transcript: "hello", turn_index: 0 };
    const r = appendIfNew(turns, t);
    expect(r.duplicate).toBe(false);
    expect(r.turns.length).toBe(1);
  });

  it("duplicate turn_index returns idempotent, list unchanged", () => {
    const turns: TurnEntry[] = [
      { player: "a", transcript: "hello", turn_index: 0 },
    ];
    const t: TurnEntry = {
      player: "a",
      transcript: "different text",
      turn_index: 0,
    };
    const r = appendIfNew(turns, t);
    expect(r.duplicate).toBe(true);
    expect(r.turns).toEqual(turns);
  });

  it("different turn_indices accumulate", () => {
    let turns: TurnEntry[] = [];
    for (let i = 0; i < 6; i++) {
      const r = appendIfNew(turns, {
        player: i % 2 === 0 ? "a" : "b",
        transcript: `turn ${i}`,
        turn_index: i,
      });
      turns = r.turns;
    }
    expect(turns).toHaveLength(6);
    expect(turns.map((t) => t.turn_index)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
