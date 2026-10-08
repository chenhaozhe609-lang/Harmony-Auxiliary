import { afterEach, describe, expect, it, vi } from "vitest";
import { getDiatonicChords } from "../theory/tonalAdapter";
import type { HarmonyCandidate } from "../types";
import { makeDisplayVoicing } from "../harmony/displayVoicing";
import { exportCandidateToMidi } from "../midi/exportMidi";
import { defaultPreferences } from "../../app/preferencesRepository";
import { Midi } from "@tonejs/midi";

const mocks = vi.hoisted(() => ({
  banks: [] as { resolve: (buffers: Record<string, AudioBuffer>) => void; reject: (error: Error) => void }[],
  voices: [] as { dispose: ReturnType<typeof vi.fn> }[],
  samplers: [] as Record<string, unknown>[],
  trigger: vi.fn(),
  start: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./sampleCache", () => ({
  SampleCache: class {
    private banks = new Map<string, Promise<Record<string, AudioBuffer>>>();
    loadBank(url: string) {
      if (!this.banks.has(url)) this.banks.set(url, new Promise((resolve, reject) => {
        mocks.banks.push({ resolve, reject });
      }));
      return this.banks.get(url)!;
    }
    dispose() {}
  },
}));
vi.mock("tone", () => {
  class Voice {
    volume = { value: 0 };
    constructor() { mocks.voices.push(this); }
    connect() { return this; }
    toDestination() { return this; }
    dispose = vi.fn();
    releaseAll() {}
    triggerAttackRelease = mocks.trigger;
  }
  class Sampler extends Voice {
    constructor(options: Record<string, unknown>) {
      super(); mocks.samplers.push(options);
      queueMicrotask(options.onload as () => void);
    }
  }
  class Reverb extends Voice { ready = Promise.resolve(); }
  return { PolySynth: Voice, Synth: Voice, FMSynth: Voice, AMSynth: Voice, PluckSynth: Voice,
    Sampler, Reverb, start: mocks.start, now: () => 0 };
});
import { AudioEngine } from "./audioEngine";
const engines: AudioEngine[] = [];
function engine() { const next = new AudioEngine(); engines.push(next); return next; }
afterEach(() => {
  engines.splice(0).forEach((item) => item.dispose());
  mocks.banks.length = 0; mocks.samplers.length = 0; mocks.voices.length = 0;
  mocks.trigger.mockClear(); mocks.start.mockReset().mockResolvedValue(undefined);
  vi.useRealTimers(); vi.unstubAllGlobals();
});
describe("sample loading", () => {
  it("plays before download completes and requests only one shared bank", async () => {
    const audio = engine();
    await audio.previewNote(60, "acoustic-grand");
    expect(mocks.banks).toHaveLength(1);
    expect(mocks.samplers).toHaveLength(0);
    expect(audio.isSamplerReady()).toBe(false);
    expect(mocks.trigger).toHaveBeenCalledOnce();
  });
  it("does not allocate obsolete sample nodes after switching away", async () => {
    const audio = engine(); const first = audio.loadTone("acoustic-grand");
    await audio.loadTone("glass-bell");
    mocks.banks[0].resolve({});
    expect(await first).toBe("fallback");
    expect(mocks.samplers).toHaveLength(0);
    expect(audio.isSamplerReady()).toBe(false);
  });
  it("keeps the current sampler ready when an older download fails", async () => {
    const audio = engine(); const first = audio.loadTone("acoustic-grand");
    const latest = audio.loadTone("nylon-guitar");
    mocks.banks[1].resolve({});
    expect(await latest).toBe("sampled");
    mocks.banks[0].reject(new Error("offline"));
    expect(await first).toBe("fallback");
    expect(audio.isSamplerReady()).toBe(true);
  });
  it("reuses decoded samples on preset switches and fully disposes nodes", async () => {
    const audio = engine(); const first = audio.loadTone("acoustic-grand");
    mocks.banks[0].resolve({}); await first;
    expect(mocks.samplers[0].urls).toBe(mocks.samplers[1].urls);
    await audio.loadTone("glass-bell"); await audio.loadTone("acoustic-grand");
    expect(mocks.banks).toHaveLength(1);
    audio.dispose(); audio.dispose();
    expect(mocks.voices.every((voice) => voice.dispose.mock.calls.length === 1)).toBe(true);
    expect(audio.isSamplerReady()).toBe(false);
  });
  it("cannot resurrect instruments after disposal during download", async () => {
    const audio = engine(); const loading = audio.loadTone("acoustic-grand");
    audio.dispose(); mocks.banks[0].resolve({});
    expect(await loading).toBe("fallback");
    expect(mocks.samplers).toHaveLength(0);
    expect(mocks.voices.every((voice) => voice.dispose.mock.calls.length === 1)).toBe(true);
  });
  it("stop cancels playback while the audio context is still starting", async () => {
    let resolveStart = () => {};
    mocks.start.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveStart = resolve; }));
    const audio = engine();
    const pending = audio.playCandidate([], null, 100, { melodyMuted: false, harmonyMuted: false, tonePreset: "glass-bell" }, vi.fn(), vi.fn());
    audio.stop(); resolveStart();
    expect(await pending).toBe(false);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("plays exactly the pitches shown and exported for root and inverted sevenths", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame: vi.fn() });
    const audio = engine();
    const seventh = getDiatonicChords(0, "major").find((chord) => chord.symbol === "G7")!;
    for (const chord of [seventh, { ...seventh, bass: 11 as const }]) {
      const placed = { id: "chord", chord, startBeat: 0, durationBeats: 4,
        explanation: { fitReason: "", functionReason: "", melodyRelationships: [], warnings: [] } };
      const candidate: HarmonyCandidate = { id: "test", mode: "stable-classical", title: "", subtitle: "", summary: "", score: 0, chords: [placed] };
      await audio.playCandidate([], candidate, 100, { melodyMuted: true, harmonyMuted: false, tonePreset: "glass-bell" }, vi.fn(), vi.fn());
      vi.advanceTimersByTime(55);
      const played = (mocks.trigger.mock.calls.at(-1)![0] as number[]).map((frequency) => Math.round(69 + 12 * Math.log2(frequency / 440)));
      const displayed = makeDisplayVoicing(placed).map((voice) => voice.midi);
      const bytes = exportCandidateToMidi([], candidate, defaultPreferences);
      const midi = new Midi(bytes);
      expect(played).toEqual(displayed);
      expect(midi.tracks.find((track) => track.name === "Harmony")!.notes.map((note) => note.midi)).toEqual(displayed);
      expect(displayed.some((pitch) => pitch % 12 === 5)).toBe(true);
      audio.stop();
    }
  });
});
