import { describe, expect, it } from "vitest";
import { generateHarmonyCandidates } from "./generateCandidates";
import { segmentMelody } from "./segmentMelody";
import { longDemoMelody } from "../fixtures/demoMelodies";
import type { NoteEvent, ProjectSettings } from "../types";

const settings: ProjectSettings = {
  keyTonic: 0,
  mode: "major",
  tempo: 92,
  timeSignature: {
    numerator: 4,
    denominator: 4,
  },
  harmonyRhythm: "bar",
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

const cadenceMelody: NoteEvent[] = [
  {
    id: "cadence-1",
    midi: 64,
    pitchClass: 4,
    name: "E4",
    startBeat: 0,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "cadence-2",
    midi: 65,
    pitchClass: 5,
    name: "F4",
    startBeat: 4,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "cadence-3",
    midi: 71,
    pitchClass: 11,
    name: "B4",
    startBeat: 8,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "cadence-4",
    midi: 72,
    pitchClass: 0,
    name: "C5",
    startBeat: 12,
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

  it("segments strong beats at beat 1 and beat 3 in 4/4", () => {
    const segments = segmentMelody(melody, "strong-beats", 4);

    expect(segments.map((segment) => segment.startBeat)).toEqual([0, 2, 4]);
    expect(segments.map((segment) => segment.durationBeats)).toEqual([2, 2, 2]);
  });

  it("segments every beat for dense harmonization", () => {
    const segments = segmentMelody(melody, "every-beat", 4);

    expect(segments.map((segment) => segment.startBeat)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(segments.every((segment) => segment.durationBeats === 1)).toBe(true);
  });

  it("adds a final half-bar segment for cadence-aware rhythm", () => {
    const segments = segmentMelody(melody, "cadence-aware", 4);

    expect(segments.map((segment) => segment.startBeat)).toEqual([0, 4, 5]);
    expect(segments.map((segment) => segment.durationBeats)).toEqual([4, 1, 1]);
  });

  it("segments the long melody fixture across each harmony rhythm pattern", () => {
    expect(segmentMelody(longDemoMelody, "bar", 4)).toHaveLength(12);
    expect(segmentMelody(longDemoMelody, "strong-beats", 4)).toHaveLength(24);
    expect(segmentMelody(longDemoMelody, "every-beat", 4)).toHaveLength(48);
    expect(segmentMelody(longDemoMelody, "sparse", 4)).toHaveLength(6);

    const cadenceAware = segmentMelody(longDemoMelody, "cadence-aware", 4);
    expect(cadenceAware).toHaveLength(13);
    expect(cadenceAware.at(-2)?.startBeat).toBe(44);
    expect(cadenceAware.at(-1)?.startBeat).toBe(46);
    expect(cadenceAware.at(-1)?.durationBeats).toBe(2);
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

  it("prefers a classical predominant to dominant to tonic cadence", () => {
    const stable = generateHarmonyCandidates(cadenceMelody, settings)[0];

    expect(stable.chords.map((placedChord) => placedChord.chord.functionLabel)).toEqual([
      "T",
      "PD",
      "D",
      "T",
    ]);
    expect(["ii", "IV"]).toContain(stable.chords[1].chord.roman);
    expect(stable.chords.map((placedChord) => placedChord.chord.roman).slice(2)).toEqual([
      "V7",
      "Imaj7",
    ]);
    expect(stable.chords[2].explanation.functionReason).toContain(
      "Classical motion: predominant prepares dominant.",
    );
    expect(stable.chords[3].explanation.functionReason).toContain(
      "Classical motion: dominant resolves to tonic.",
    );
  });

  it("generates a full 12-bar candidate progression for the long melody fixture", () => {
    const stable = generateHarmonyCandidates(longDemoMelody, settings)[0];
    const lastChord = stable.chords.at(-1);

    expect(stable.chords).toHaveLength(12);
    expect(stable.chords[0].startBeat).toBe(0);
    expect(lastChord).toBeDefined();
    expect(lastChord!.startBeat).toBe(44);
    expect(lastChord!.durationBeats).toBe(4);
    expect(lastChord!.startBeat + lastChord!.durationBeats).toBe(48);
    expect(stable.chords.some((placedChord) => placedChord.explanation.melodyRelationships.length > 0)).toBe(
      true,
    );
  });
});
