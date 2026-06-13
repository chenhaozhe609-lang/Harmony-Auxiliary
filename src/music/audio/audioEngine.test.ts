import { describe, expect, it } from "vitest";
import { getPlaybackEndBeat, PLAYBACK_TONE_PRESETS } from "./audioEngine";
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
  it("provides selectable tone presets for melody and harmony playback", () => {
    expect(Object.keys(PLAYBACK_TONE_PRESETS)).toEqual([
      "mellow-keys",
      "warm-organ",
      "soft-pluck",
      "glass-bell",
    ]);
    expect(PLAYBACK_TONE_PRESETS["soft-pluck"].melody.envelope.sustain).toBeLessThan(
      PLAYBACK_TONE_PRESETS["warm-organ"].melody.envelope.sustain,
    );
    expect(PLAYBACK_TONE_PRESETS["glass-bell"].harmony.envelope.release).toBeGreaterThan(
      PLAYBACK_TONE_PRESETS["mellow-keys"].harmony.envelope.release,
    );
  });

  it("uses the latest melody or harmony end beat", () => {
    expect(getPlaybackEndBeat(melody, candidate)).toBe(8);
  });

  it("falls back to at least one beat", () => {
    expect(getPlaybackEndBeat([], null)).toBe(1);
  });
});
