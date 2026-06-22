import { describe, expect, it } from "vitest";
import { viterbi } from "./viterbi";

describe("viterbi", () => {
  it("finds the globally optimal path, not the greedy one", () => {
    // Step 0 greedy-best is A (emission 10), but committing to A caps the total
    // at 10. The lower-emission B (9) unlocks a strong B→Y transition (+5), so
    // the global optimum is [B, Y] = 14. A per-segment greedy would miss it.
    const states: Record<number, string[]> = { 0: ["A", "B"], 1: ["X", "Y"] };
    const emission = (step: number, s: string) =>
      step === 0 ? (s === "A" ? 10 : 9) : 0;
    const transition = (_step: number, prev: string, cur: string) =>
      prev === "B" && cur === "Y" ? 5 : 0;

    const path = viterbi<string>({
      length: 2,
      statesAt: (step) => states[step],
      emission,
      transition,
      keyOf: (s) => s,
    });

    expect(path).toEqual(["B", "Y"]);
  });

  it("returns one state per step and an empty path for zero length", () => {
    expect(viterbi<string>({ length: 0, statesAt: () => ["A"], emission: () => 0, transition: () => 0, keyOf: (s) => s })).toEqual([]);

    const single = viterbi<string>({
      length: 3,
      statesAt: () => ["A", "B"],
      emission: (_s, st) => (st === "B" ? 1 : 0),
      transition: () => 0,
      keyOf: (s) => s,
    });
    expect(single).toEqual(["B", "B", "B"]);
  });
});
