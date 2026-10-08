import { describe, expect, it } from "vitest";
import type { PitchClass } from "../types";
import { makeChordVoicing } from "./voicing";
import { getDiatonicChords } from "../theory/tonalAdapter";

describe("four voice model", () => {
  it("retains the third, seventh and ninth by omitting fifth and doubled root", () => {
    const chord = getDiatonicChords(0, "major")[0];
    expect(makeChordVoicing({ ...chord, quality: "major9", tones: [0, 4, 7, 11, 2] })).toEqual([36, 50, 52, 59]);
  });
  it("always includes a separate bass and sorted upper voices in every key", () => {
    for (let root = 0; root < 12; root++) {
      const chord = getDiatonicChords(root as PitchClass, "major")[0];
      const voices = makeChordVoicing(chord);
      expect(voices).toHaveLength(4);
      expect(voices[0]).toBe(36 + root);
      expect(voices).toEqual([...voices].sort((a, b) => a - b));
      expect(new Set(voices).size).toBe(4);
    }
  });
});
