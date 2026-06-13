import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { generateHarmonyCandidates } from "../harmony/generateCandidates";
import type { HarmonyCandidate, NoteEvent, PitchClass, ProjectSettings } from "../types";
import { exportCandidateToMidi, createMidiFileName } from "./exportMidi";

const settings: ProjectSettings = {
  keyTonic: 0,
  mode: "major",
  tempo: 108,
  timeSignature: { numerator: 4, denominator: 4 },
  harmonyRhythm: "bar",
  inputMode: "manual",
};

const melody: NoteEvent[] = [
  {
    id: "note-1",
    midi: 60,
    pitchClass: 0 as PitchClass,
    name: "C4",
    startBeat: 0,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "note-2",
    midi: 64,
    pitchClass: 4 as PitchClass,
    name: "E4",
    startBeat: 1,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
];

function parseExport(bytes: Uint8Array): Midi {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Midi(arrayBuffer);
}

describe("exportCandidateToMidi", () => {
  it("writes melody and harmony tracks with tempo metadata", () => {
    const candidate = generateHarmonyCandidates(melody, settings)[0];
    const parsed = parseExport(exportCandidateToMidi(melody, candidate, settings));

    expect(parsed.header.tempos[0]?.bpm).toBeCloseTo(108, 2);
    expect(parsed.tracks.map((track) => track.name)).toEqual(["Melody", "Harmony"]);
    expect(parsed.tracks[0].notes.map((note) => note.midi)).toEqual([60, 64]);
    expect(parsed.tracks[1].notes.length).toBeGreaterThan(0);
  });

  it("exports weak-beat and cross-bar timing with the same beat mapping", () => {
    const timedMelody: NoteEvent[] = [
      {
        id: "weak",
        midi: 62,
        pitchClass: 2 as PitchClass,
        name: "D4",
        startBeat: 1.5,
        durationBeats: 0.5,
        velocity: 0.8,
        source: "manual",
      },
      {
        id: "cross-bar",
        midi: 65,
        pitchClass: 5 as PitchClass,
        name: "F4",
        startBeat: 3.5,
        durationBeats: 2,
        velocity: 0.8,
        source: "manual",
      },
    ];
    const candidate: HarmonyCandidate = generateHarmonyCandidates(timedMelody, {
      ...settings,
      harmonyRhythm: "strong-beats",
    })[0];

    const parsed = parseExport(exportCandidateToMidi(timedMelody, candidate, settings));

    expect(parsed.tracks[0].notes.map((note) => note.ticks)).toEqual([720, 1680]);
    expect(parsed.tracks[0].notes.map((note) => note.durationTicks)).toEqual([240, 960]);
    expect(parsed.tracks[1].notes[0]?.ticks).toBe(0);
    expect(parsed.tracks[1].notes[0]?.durationTicks).toBe(960);
  });

  it("creates stable filenames from source names", () => {
    expect(createMidiFileName("song.mid")).toBe("song-harmony.mid");
    expect(createMidiFileName(null)).toBe("harmony-auxiliary-harmony.mid");
  });
});
