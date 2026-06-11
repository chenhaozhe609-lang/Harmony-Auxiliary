import { describe, expect, it } from "vitest";
import { generateHarmonyCandidates } from "./generateCandidates";
import { segmentMelody } from "./segmentMelody";
import type { NoteEvent, ProjectSettings } from "../types";

const settings: ProjectSettings = {
  keyTonic: 0,
  mode: "major",
  tempo: 92,
  timeSignature: {
    numerator: 4,
    denominator: 4,
  },
  harmonyDensity: "bar",
  inputMode: "manual",
};

const melody: NoteEvent[] = [
  {
    id: "n1",
    midi: 64,
    pitchClass: 4,
    name: "E4",
    startBeat: 0,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "n2",
    midi: 67,
    pitchClass: 7,
    name: "G4",
    startBeat: 1,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "n3",
    midi: 72,
    pitchClass: 0,
    name: "C5",
    startBeat: 4,
    durationBeats: 2,
    velocity: 0.8,
    source: "manual",
  },
];

describe("melody segmentation", () => {
  it("segments by bar", () => {
    const segments = segmentMelody(melody, "bar", 4);
    expect(segments).toHaveLength(2);
    expect(segments[0].melodyNotes.map((note) => note.name)).toEqual(["E4", "G4"]);
    expect(segments[1].melodyNotes.map((note) => note.name)).toEqual(["C5"]);
  });
});

describe("candidate generation", () => {
  it("generates the three MVP candidate modes", () => {
    const candidates = generateHarmonyCandidates(melody, settings);
    expect(candidates.map((candidate) => candidate.mode)).toEqual([
      "stable-classical",
      "pop-songwriting",
      "color-tension",
    ]);
    expect(candidates).toHaveLength(3);
    expect(candidates[0].chords).toHaveLength(2);
    expect(candidates[0].chords[0].explanation.fitReason).toContain("E4");
  });
});

