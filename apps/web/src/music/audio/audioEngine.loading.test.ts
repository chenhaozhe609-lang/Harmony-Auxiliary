import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  samplers: [] as { onload: () => void; onerror: (error: unknown) => void }[],
  trigger: vi.fn(),
}));

vi.mock("tone", () => {
  class Voice {
    volume = { value: 0 };
    connect() { return this; }
    toDestination() { return this; }
    dispose() {}
    releaseAll() {}
    triggerAttackRelease = mocks.trigger;
  }
  class Sampler extends Voice {
    constructor(options: typeof mocks.samplers[number]) {
      super();
      mocks.samplers.push(options);
    }
  }
  class Reverb extends Voice { ready = Promise.resolve(); }
  return {
    PolySynth: Voice, Synth: Voice, FMSynth: Voice, AMSynth: Voice, PluckSynth: Voice,
    Sampler, Reverb, start: vi.fn().mockResolvedValue(undefined), now: () => 0,
  };
});

import { AudioEngine } from "./audioEngine";

afterEach(() => {
  mocks.samplers.length = 0;
  mocks.trigger.mockClear();
});

describe("sample loading", () => {
  it("plays a note before sample downloads complete", async () => {
    const engine = new AudioEngine();
    await engine.previewNote(60, "acoustic-grand");
    expect(mocks.samplers).toHaveLength(2);
    expect(engine.isSamplerReady()).toBe(false);
    expect(mocks.trigger).toHaveBeenCalledOnce();
  });

  it("does not replace the latest instruments when an earlier load completes", async () => {
    const engine = new AudioEngine();
    const first = engine.loadTone("acoustic-grand");
    const previous = mocks.samplers.slice();
    await engine.loadTone("glass-bell");
    const latest = engine.loadTone("acoustic-grand");
    previous.forEach((sampler) => sampler.onload());
    expect(await first).toBe("fallback");
    expect(engine.isSamplerReady()).toBe(false);
    mocks.samplers.slice(2).forEach((sampler) => sampler.onload());
    expect(await latest).toBe("sampled");
    expect(engine.isSamplerReady()).toBe(true);
  });

  it("keeps the current sampler ready when an older download fails", async () => {
    const engine = new AudioEngine();
    const first = engine.loadTone("acoustic-grand");
    const previous = mocks.samplers.slice();
    const latest = engine.loadTone("nylon-guitar");
    mocks.samplers.slice(2).forEach((sampler) => sampler.onload());
    await latest;
    previous[0].onerror(new Error("offline"));
    await first;
    expect(engine.isSamplerReady()).toBe(true);
  });
});
