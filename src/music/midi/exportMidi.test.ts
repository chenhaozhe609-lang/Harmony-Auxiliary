import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { generateHarmonyCandidates } from "../harmony/generateCandidates";
import type { NoteEvent, PitchClass, ProjectSettings } from "../types";
import { exportCandidateToMidi, createMidiFileName } from "./exportMidi";

const settings: ProjectSettings = {
  keyTonic: 0,
  mode: "major",
  tempo: 108,
  timeSignature: { numerator: 4, denominator: 4 },
  harmonyDensity: "bar",
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

  it("creates stable filenames from source names", () => {
    expect(createMidiFileName("song.mid")).toBe("song-harmony.mid");
    expect(createMidiFileName(null)).toBe("harmony-auxiliary-harmony.mid");
  });
});
