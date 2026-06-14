import { describe, expect, it } from "vitest";
import { getPlaybackEndBeat, PLAYBACK_TONE_PRESETS, scheduleCancellableTriggers } from "./audioEngine";
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
      "acoustic-piano",
      "electric-piano",
      "nylon-guitar",
      "warm-organ",
      "glass-bell",
      "mellow-keys",
      "soft-pluck",
    ]);
    expect(PLAYBACK_TONE_PRESETS["acoustic-piano"].melody.engine).toBe("synth");
    expect(PLAYBACK_TONE_PRESETS["electric-piano"].melody.engine).toBe("fm");
    expect(PLAYBACK_TONE_PRESETS["nylon-guitar"].melody.engine).toBe("pluck");
    expect(PLAYBACK_TONE_PRESETS["warm-organ"].melody.engine).toBe("am");
    expect(PLAYBACK_TONE_PRESETS["mellow-keys"]).toBe(PLAYBACK_TONE_PRESETS["acoustic-piano"]);
    expect(PLAYBACK_TONE_PRESETS["soft-pluck"]).toBe(PLAYBACK_TONE_PRESETS["nylon-guitar"]);
  });

  it("uses the latest melody or harmony end beat", () => {
    expect(getPlaybackEndBeat(melody, candidate)).toBe(8);
  });

  it("cancels queued playback triggers before they fire", () => {
    const callbacks: Array<() => void> = [];
    const clearedTimers: number[] = [];
    let triggered = 0;
    const playback = scheduleCancellableTriggers(
      [
        { delaySeconds: 0, run: () => { triggered += 1; } },
        { delaySeconds: 1, run: () => { triggered += 1; } },
      ],
      (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      (timer) => clearedTimers.push(timer),
    );

    playback.stop();
    callbacks.forEach((callback) => callback());

    expect(triggered).toBe(0);
    expect(clearedTimers).toEqual([1, 2]);
  });

  it("runs queued playback triggers while active", () => {
    const callbacks: Array<() => void> = [];
    let triggered = 0;
    scheduleCancellableTriggers(
      [{ delaySeconds: 0.25, run: () => { triggered += 1; } }],
      (callback, delayMs) => {
        expect(delayMs).toBe(250);
        callbacks.push(callback);
        return callbacks.length;
      },
      () => undefined,
    );

    callbacks[0]();

    expect(triggered).toBe(1);
  });

  it("falls back to at least one beat", () => {
    expect(getPlaybackEndBeat([], null)).toBe(1);
  });
});
