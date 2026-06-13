import { describe, expect, it } from "vitest";
import type { PlacedChord } from "../types";
import { makeDisplayVoicing } from "./displayVoicing";
import { getMajorDiatonicChords } from "../theory/chords";

function placedChord(symbol: string): PlacedChord {
  const chord = getMajorDiatonicChords(0).find((item) => item.symbol === symbol);
  if (!chord) throw new Error(`Missing test chord ${symbol}`);

  return {
    id: `test-${chord.id}`,
    chord,
    startBeat: 0,
    durationBeats: 4,
    explanation: {
      fitReason: "",
      functionReason: "",
      melodyRelationships: [],
      warnings: [],
    },
  };
}

describe("makeDisplayVoicing", () => {
  it("expands a triad into bass and upper voices", () => {
    const voices = makeDisplayVoicing(placedChord("F"));

    expect(voices.map((voice) => voice.voice)).toEqual(["Bass", "Lower", "Middle", "Upper"]);
    expect(voices.map((voice) => voice.noteName)).toEqual(["F2", "F3", "A3", "C4"]);
  });

  it("keeps seventh chords visible across four display voices", () => {
    const voices = makeDisplayVoicing(placedChord("G7"));

    expect(voices.map((voice) => voice.noteName)).toEqual(["G2", "G3", "B3", "D4"]);
  });
});

