import { describe, expect, it } from "vitest";
import { getPlaybackEndBeat } from "./audioEngine";
import type { HarmonyCandidate, NoteEvent } from "../types";

const melody: NoteEvent[] = [
  {
    id: "n1",
    midi: 60,
    pitchClass: 0,
    name: "C4",
    startBeat: 0,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
  {
    id: "n2",
    midi: 64,
    pitchClass: 4,
    name: "E4",
    startBeat: 3,
    durationBeats: 2,
    velocity: 0.8,
    source: "manual",
  },
];

const candidate = {
  chords: [
    {
      startBeat: 0,
      durationBeats: 4,
    },
    {
      startBeat: 4,
      durationBeats: 4,
    },
  ],
} as HarmonyCandidate;

describe("audio playback helpers", () => {
  it("uses the latest melody or harmony end beat", () => {
    expect(getPlaybackEndBeat(melody, candidate)).toBe(8);
  });

  it("falls back to at least one beat", () => {
    expect(getPlaybackEndBeat([], null)).toBe(1);
  });
});

