import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { parseMidiArrayBuffer } from "./importMidi";

function toArrayBuffer(midi: Midi): ArrayBuffer {
  const bytes = midi.toArray();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("parseMidiArrayBuffer", () => {
  it("imports a simple melody track as beat-based note events", () => {
    const midi = new Midi();
    midi.header.setTempo(96);
    midi.header.timeSignatures.push({
      ticks: 0,
      timeSignature: [3, 4],
      measures: 0,
    });

    const track = midi.addTrack();
    track.name = "Lead";
    track.addNote({ midi: 60, ticks: 0, durationTicks: 480, velocity: 0.75 });
    track.addNote({ midi: 64, ticks: 480, durationTicks: 960, velocity: 0.8 });

    const result = parseMidiArrayBuffer(toArrayBuffer(midi));

    expect(result.selectedTrackIndex).toBe(0);
    expect(result.tempo).toBe(96);
    expect(result.timeSignature).toEqual({ numerator: 3, denominator: 4 });
    expect(result.tracks).toEqual([
      expect.objectContaining({
        index: 0,
        name: "Lead",
        noteCount: 2,
      }),
    ]);
    expect(result.melody).toEqual([
      expect.objectContaining({
        midi: 60,
        name: "C4",
        startBeat: 0,
        durationBeats: 1,
        source: "midi",
      }),
      expect.objectContaining({
        midi: 64,
        name: "E4",
        startBeat: 1,
        durationBeats: 2,
        source: "midi",
      }),
    ]);
  });

  it("chooses the note track with the most notes and supports explicit track selection", () => {
    const midi = new Midi();
    const sparseTrack = midi.addTrack();
    sparseTrack.name = "Counter";
    sparseTrack.addNote({ midi: 72, ticks: 0, durationTicks: 480, velocity: 0.7 });

    const melodyTrack = midi.addTrack();
    melodyTrack.name = "Melody";
    melodyTrack.addNote({ midi: 60, ticks: 0, durationTicks: 480, velocity: 0.7 });
    melodyTrack.addNote({ midi: 62, ticks: 480, durationTicks: 480, velocity: 0.7 });

    const buffer = toArrayBuffer(midi);
    const defaultResult = parseMidiArrayBuffer(buffer);
    const selectedResult = parseMidiArrayBuffer(buffer.slice(0), 0);

    expect(defaultResult.selectedTrackIndex).toBe(1);
    expect(defaultResult.melody.map((note) => note.name)).toEqual(["C4", "D4"]);
    expect(selectedResult.selectedTrackIndex).toBe(0);
    expect(selectedResult.melody.map((note) => note.name)).toEqual(["C5"]);
  });

  it("normalizes weak-beat and cross-bar MIDI timing into beats", () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.name = "Syncopated";
    track.addNote({ midi: 62, ticks: 240, durationTicks: 240, velocity: 0.7 });
    track.addNote({ midi: 65, ticks: 1680, durationTicks: 960, velocity: 0.7 });

    const result = parseMidiArrayBuffer(toArrayBuffer(midi));

    expect(result.melody).toEqual([
      expect.objectContaining({
        name: "D4",
        startBeat: 0,
        durationBeats: 0.5,
      }),
      expect.objectContaining({
        name: "F4",
        startBeat: 3,
        durationBeats: 2,
      }),
    ]);
  });

  it("throws a clear error when no tracks contain notes", () => {
    const midi = new Midi();
    midi.addTrack().name = "Empty";

    expect(() => parseMidiArrayBuffer(toArrayBuffer(midi))).toThrow(
      "This MIDI file has no note tracks.",
    );
  });
});
