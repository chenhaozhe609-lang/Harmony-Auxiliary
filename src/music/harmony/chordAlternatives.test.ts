import { describe, expect, it } from "vitest";
import { generateHarmonyCandidates } from "./generateCandidates";
import { getChordAlternatives, makeReplacementPlacedChord } from "./chordAlternatives";
import type { NoteEvent, PitchClass, ProjectSettings } from "../types";

const settings: ProjectSettings = {
  keyTonic: 0,
  mode: "major",
  tempo: 92,
  timeSignature: { numerator: 4, denominator: 4 },
  harmonyRhythm: "bar",
  inputMode: "manual",
};

const melody: NoteEvent[] = [
  {
    id: "n1",
    midi: 60,
    pitchClass: 0 as PitchClass,
    name: "C4",
    startBeat: 0,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "n2",
    midi: 67,
    pitchClass: 7 as PitchClass,
    name: "G4",
    startBeat: 2,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
];

describe("chord alternatives", () => {
  it("returns scored alternatives for a selected segment", () => {
    const selectedChord = generateHarmonyCandidates(melody, settings)[0].chords[0];
    const alternatives = getChordAlternatives(melody, settings, selectedChord);

    expect(alternatives.length).toBeGreaterThan(1);
    expect(alternatives[0].explanation.fitReason).toContain(alternatives[0].chord.symbol);
  });

  it("preserves timing when creating a replacement chord", () => {
    const selectedChord = generateHarmonyCandidates(melody, settings)[0].chords[0];
    const replacement = makeReplacementPlacedChord(
      selectedChord,
      getChordAlternatives(melody, settings, selectedChord)[1],
    );

    expect(replacement.startBeat).toBe(selectedChord.startBeat);
    expect(replacement.durationBeats).toBe(selectedChord.durationBeats);
    expect(replacement.id).not.toBe(selectedChord.id);
  });
});
