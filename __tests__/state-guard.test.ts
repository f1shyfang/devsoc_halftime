import { describe, expect, it } from "vitest";
import {
  canJudge,
  canSubmitTurn,
  nextStateAfterTurn,
} from "@/lib/room-state";

describe("state guards", () => {
  it("submit-turn accepts waiting and in_progress", () => {
    expect(canSubmitTurn("waiting")).toBe(true);
    expect(canSubmitTurn("in_progress")).toBe(true);
  });

  it("submit-turn rejects complete, judging, done", () => {
    expect(canSubmitTurn("complete")).toBe(false);
    expect(canSubmitTurn("judging")).toBe(false);
    expect(canSubmitTurn("done")).toBe(false);
  });

  it("judge accepts only complete", () => {
    expect(canJudge("complete")).toBe(true);
    expect(canJudge("waiting")).toBe(false);
    expect(canJudge("in_progress")).toBe(false);
    expect(canJudge("judging")).toBe(false);
    expect(canJudge("done")).toBe(false);
  });

  it("first turn moves waiting → in_progress", () => {
    expect(nextStateAfterTurn("waiting", 1, 6)).toBe("in_progress");
  });

  it("final turn moves in_progress → complete", () => {
    expect(nextStateAfterTurn("in_progress", 6, 6)).toBe("complete");
  });

  it("mid-debate turn stays in_progress", () => {
    expect(nextStateAfterTurn("in_progress", 3, 6)).toBe("in_progress");
  });
});
