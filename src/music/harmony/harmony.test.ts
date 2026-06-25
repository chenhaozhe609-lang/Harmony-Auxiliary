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
  playbackTone: "mellow-keys",
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
    // Viterbi stable mode closes with a plain authentic cadence V7 → I (triad).
    expect(stable.chords.map((placedChord) => placedChord.chord.roman).slice(2)).toEqual([
      "V7",
      "I",
    ]);
    expect(stable.chords[3].chord.root).toBe(0); // the true tonic (C)
    expect(stable.chords[2].explanation.functionReason).toContain("Predominant prepares dominant.");
    expect(stable.chords[3].explanation.functionReason).toContain("Dominant resolves to tonic.");
  });

  it("harmonizes a minor key with a minor tonic and a functional dominant (Task 7)", () => {
    // C-minor-friendly cadence: G4 → Ab4 → B4 (raised leading tone) → C5.
    const minorCadence: NoteEvent[] = [
      { id: "m1", midi: 67, pitchClass: 7, name: "G4", startBeat: 0, durationBeats: 1, velocity: 0.8, source: "manual" },
      { id: "m2", midi: 68, pitchClass: 8, name: "G#4", startBeat: 4, durationBeats: 1, velocity: 0.8, source: "manual" },
      { id: "m3", midi: 71, pitchClass: 11, name: "B4", startBeat: 8, durationBeats: 1, velocity: 0.8, source: "manual" },
      { id: "m4", midi: 72, pitchClass: 0, name: "C5", startBeat: 12, durationBeats: 2, velocity: 0.8, source: "manual" },
    ];
    const stable = generateHarmonyCandidates(minorCadence, { ...settings, keyTonic: 0, mode: "minor" })[0];
    const romans = stable.chords.map((placedChord) => placedChord.chord.roman);

    // Proper minor tonic exists (the old engine wrongly produced major "Imaj7").
    expect(romans).toContain("i");
    expect(stable.chords.find((c) => c.chord.roman === "i")?.chord.quality).toBe("minor");
    expect(romans).not.toContain("Imaj7");
    // Phrase closes on tonic function.
    expect(stable.chords.at(-1)?.chord.functionLabel).toBe("T");
    // Any dominant present is the functional V7 (from harmonic minor) or vii°.
    const dominant = stable.chords.find((c) => c.chord.functionLabel === "D");
    if (dominant) {
      expect(["V7", "vii°"]).toContain(dominant.chord.roman);
    }
  });

  it("makes the three styles distinct (pop loop anchor; Task 7 P2)", () => {
    const [stable, pop, color] = generateHarmonyCandidates(longDemoMelody, settings);
    const romansOf = (c: typeof stable) => c.chords.map((pc) => pc.chord.roman).join(" ");

    // The known P1 limitation was pop≈stable on diatonic input. The loop anchor
    // must pull the pop pass onto a different progression from the classical one.
    expect(romansOf(pop)).not.toEqual(romansOf(stable));
    expect(romansOf(color)).not.toEqual(romansOf(stable));

    // Pop leans on the I/IV/V/vi axis: the majority of its chords sit on it.
    const popAxis = new Set([0, 5, 7, 9]);
    const onAxis = pop.chords.filter(
      (pc) => popAxis.has(((pc.chord.root - settings.keyTonic) % 12 + 12) % 12),
    ).length;
    expect(onAxis).toBeGreaterThan(pop.chords.length / 2);
  });

  it("uses a resolving secondary dominant in the colour pass (Task 7 P2)", () => {
    // A melody implying C7 (the natural-3rd/♭7 of V7/IV) over bar 1, then F over
    // bar 2 — a textbook V7/IV → IV tonicization the colour pass should reach for.
    const tonicizeIV: NoteEvent[] = [
      { id: "t1", midi: 70, pitchClass: 10, name: "A#4", startBeat: 0, durationBeats: 2, velocity: 0.8, source: "manual" },
      { id: "t2", midi: 64, pitchClass: 4, name: "E4", startBeat: 2, durationBeats: 2, velocity: 0.8, source: "manual" },
      { id: "t3", midi: 65, pitchClass: 5, name: "F4", startBeat: 4, durationBeats: 2, velocity: 0.8, source: "manual" },
      { id: "t4", midi: 69, pitchClass: 9, name: "A4", startBeat: 6, durationBeats: 2, velocity: 0.8, source: "manual" },
    ];
    const color = generateHarmonyCandidates(tonicizeIV, settings).find(
      (c) => c.mode === "color-tension",
    )!;
    const secondary = color.chords.findIndex(
      (pc) => pc.chord.role === "secondary-dominant",
    );
    expect(secondary).toBeGreaterThanOrEqual(0);
    // Whatever it tonicizes, the very next chord resolves to that target root.
    const dom = color.chords[secondary];
    const next = color.chords[secondary + 1];
    expect(next?.chord.root).toBe(dom.chord.appliedToRoot);
    expect(next?.explanation.functionInfo?.motion?.kind).toBe("tonicization");
  });

  it("keeps the chromatic vocabulary out of the stable pass (Task 7 P2)", () => {
    const stable = generateHarmonyCandidates(longDemoMelody, settings)[0];
    expect(stable.chords.every((pc) => (pc.chord.role ?? "diatonic") === "diatonic")).toBe(true);
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
