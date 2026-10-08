import { PLAYBACK_TONE_PRESETS, getEffectiveVoiceConfig, isSamplerVoiceConfig, type ToneLoadStatus, type SynthVoiceConfig, type SamplerVoiceConfig } from "./tonePresets";
export { PLAYBACK_TONE_PRESETS, getEffectiveVoiceConfig, isSampledTonePreset, isSamplerVoiceConfig } from "./tonePresets";
export type { ToneLoadStatus } from "./tonePresets";
import { SampleCache } from "./sampleCache";
import { makeChordVoicing } from "../harmony/voicing";
import * as Tone from "tone";
import type { HarmonyCandidate, NoteEvent, PlaybackTonePreset } from "../types";

export type PlaybackOptions = {
  melodyMuted: boolean;
  harmonyMuted: boolean;
  tonePreset: PlaybackTonePreset;
  startBeat?: number;
};

type PlayableSynth = {
  volume: { value: number };
  dispose: () => void;
  releaseAll: () => void;
  triggerAttackRelease: (
    notes: number | number[],
    duration: number,
    time: number,
    velocity: number,
  ) => void;
};

export type ActivePlayback = {
  stop: () => void;
};

export type ScheduledPlaybackTrigger = {
  delaySeconds: number;
  run: () => void;
};

export type ScheduledBeatEvent<T> = {
  event: T;
  delaySeconds: number;
  durationBeats: number;
};

export function makeScheduledBeatEvents<T extends { startBeat: number; durationBeats: number }>(
  events: T[],
  startBeat: number,
  tempo: number,
): Array<ScheduledBeatEvent<T>> {
  return events
    .filter((event) => event.startBeat + event.durationBeats > startBeat)
    .map((event) => {
      const audibleStartBeat = Math.max(event.startBeat, startBeat);
      return {
        event,
        delaySeconds: beatToSeconds(audibleStartBeat - startBeat, tempo),
        durationBeats: event.startBeat + event.durationBeats - audibleStartBeat,
      };
    });
}

export function scheduleCancellableTriggers(
  triggers: ScheduledPlaybackTrigger[],
  setTimer: (callback: () => void, delayMs: number) => number = window.setTimeout,
  clearTimer: (timer: number) => void = window.clearTimeout,
): ActivePlayback {
  let stopped = false;
  const timers = triggers.map((trigger) =>
    setTimer(() => {
      if (stopped) return;
      trigger.run();
    }, Math.max(0, Math.round(trigger.delaySeconds * 1000))),
  );

  return {
    stop: () => {
      stopped = true;
      timers.forEach((timer) => clearTimer(timer));
    },
  };
}

function beatToSeconds(beat: number, tempo: number): number {
  return (beat * 60) / tempo;
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

type DisposableNode = { dispose: () => void };

function createPolySynth(config: SynthVoiceConfig, destination?: unknown): PlayableSynth {
  const PolySynth = Tone.PolySynth as unknown as new (
    voice: unknown,
    options?: Record<string, unknown>,
  ) => PlayableSynth & {
    toDestination: () => PlayableSynth;
    connect: (node: unknown) => PlayableSynth;
  };
  let voice: unknown = Tone.Synth;

  if (config.engine === "fm") {
    voice = Tone.FMSynth;
  } else if (config.engine === "am") {
    voice = Tone.AMSynth;
  } else if (config.engine === "pluck") {
    voice = Tone.PluckSynth;
  }

  const synth = new PolySynth(voice, config.options);
  if (destination) {
    synth.connect(destination);
  } else {
    synth.toDestination();
  }
  synth.volume.value = config.volume;
  return synth;
}

function createReverb(): DisposableNode & { ready: Promise<void> } {
  const Reverb = Tone.Reverb as unknown as new (options: Record<string, unknown>) => DisposableNode & {
    toDestination: () => unknown;
    ready: Promise<void>;
  };
  const reverb = new Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.16 });
  reverb.toDestination();
  return reverb;
}

function createSampler(
  config: SamplerVoiceConfig,
  destination: unknown,
  buffers: Record<string, AudioBuffer>,
): { sampler: PlayableSynth; loaded: Promise<void> } {
  let resolveLoaded: () => void = () => undefined;
  let rejectLoaded: (error: unknown) => void = () => undefined;
  const loaded = new Promise<void>((resolve, reject) => {
    resolveLoaded = resolve;
    rejectLoaded = reject;
  });

  const Sampler = Tone.Sampler as unknown as new (options: Record<string, unknown>) => PlayableSynth & {
    connect: (node: unknown) => unknown;
  };
  const sampler = new Sampler({
    urls: buffers,
    release: config.release,
    onload: () => resolveLoaded(),
    onerror: (error: unknown) => rejectLoaded(error),
  });
  sampler.connect(destination);
  sampler.volume.value = config.volume;
  return { sampler, loaded };
}

export class AudioEngine {
  private melodySynth: PlayableSynth | null = null;
  private harmonySynth: PlayableSynth | null = null;
  private auxNodes: DisposableNode[] = [];
  private activePlayback: ActivePlayback | null = null;
  private activeTonePreset: PlaybackTonePreset | null = null;
  private samplerReady = false;
  private tonePromise: Promise<ToneLoadStatus> | null = null;
  private toneGeneration = 0;
  private playbackGeneration = 0;
  private disposed = false;
  private sampleCache = new SampleCache((bytes) => Tone.getContext().decodeAudioData(bytes));
  private pendingSamplers: PlayableSynth[] = [];

  /** Whether the active preset is currently playing through loaded samples. */
  isSamplerReady(): boolean {
    return this.samplerReady;
  }

  async ensureStarted(tonePreset: PlaybackTonePreset = "mellow-keys"): Promise<void> {
    await Tone.start();
    // loadTone builds the fallback synchronously; sample downloads happen in
    // the background and must never hold up the first note.
    void this.loadTone(tonePreset);
  }

  /**
   * Build (or reuse) the instruments for a preset. Sample-based presets load their buffers
   * asynchronously; until the buffers are ready (or if loading fails offline) a synth
   * fallback voice keeps playback audible. Returns the resolved tone status.
   */
  loadTone(tonePreset: PlaybackTonePreset): Promise<ToneLoadStatus> {
    if (this.disposed) return Promise.resolve("fallback");
    if (this.activeTonePreset === tonePreset && this.tonePromise) {
      return this.tonePromise;
    }

    this.disposeInstruments();
    const generation = ++this.toneGeneration;
    this.activeTonePreset = tonePreset;
    this.samplerReady = false;

    const config = PLAYBACK_TONE_PRESETS[tonePreset];

    if (!isSamplerVoiceConfig(config.melody) && !isSamplerVoiceConfig(config.harmony)) {
      this.melodySynth = createPolySynth(config.melody as SynthVoiceConfig);
      this.harmonySynth = createPolySynth(config.harmony as SynthVoiceConfig);
      this.tonePromise = Promise.resolve<ToneLoadStatus>("synth");
      return this.tonePromise;
    }

    const reverb = createReverb();
    this.auxNodes.push(reverb);
    const melodyConfig = config.melody as SamplerVoiceConfig;
    const harmonyConfig = config.harmony as SamplerVoiceConfig;

    // Start with the synth fallback so playback works instantly and offline.
    this.melodySynth = createPolySynth(melodyConfig.fallback, reverb);
    this.harmonySynth = createPolySynth(harmonyConfig.fallback, reverb);

    this.tonePromise = Promise.all([
      reverb.ready,
      this.sampleCache.loadBank(melodyConfig.baseUrl, melodyConfig.urls),
      this.sampleCache.loadBank(harmonyConfig.baseUrl, harmonyConfig.urls),
    ]).then(async ([, melodyBuffers, harmonyBuffers]) => {
      if (this.toneGeneration !== generation || this.disposed) return "fallback" as const;
      const melody = createSampler(melodyConfig, reverb, melodyBuffers);
      // Track each node immediately: a later constructor failure still cleans it up.
      this.pendingSamplers.push(melody.sampler);
      const harmony = createSampler(harmonyConfig, reverb, harmonyBuffers);
      this.pendingSamplers.push(harmony.sampler);
      await Promise.all([melody.loaded, harmony.loaded]);
      if (this.toneGeneration !== generation || this.disposed) return "fallback" as const;
      this.melodySynth?.dispose();
      this.harmonySynth?.dispose();
      this.melodySynth = melody.sampler;
      this.harmonySynth = harmony.sampler;
      this.pendingSamplers = [];
      this.samplerReady = true;
      return "sampled" as const;
    }).catch<ToneLoadStatus>(() => {
      if (this.toneGeneration === generation) {
        this.pendingSamplers.forEach((sampler) => sampler.dispose());
        this.pendingSamplers = [];
        this.samplerReady = false;
      }
      return "fallback";
    });

    return this.tonePromise;
  }

  private disposeInstruments(): void {
    this.pendingSamplers.forEach((sampler) => sampler.dispose());
    this.pendingSamplers = [];
    this.melodySynth?.dispose();
    this.harmonySynth?.dispose();
    this.melodySynth = null;
    this.harmonySynth = null;
    this.auxNodes.forEach((node) => node.dispose());
    this.auxNodes = [];
    this.tonePromise = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.toneGeneration;
    this.stop();
    this.disposeInstruments();
    this.sampleCache.dispose();
    this.activeTonePreset = null;
    this.samplerReady = false;
  }

  stop(): void {
    ++this.playbackGeneration;
    this.activePlayback?.stop();
    this.activePlayback = null;
    this.melodySynth?.releaseAll();
    this.harmonySynth?.releaseAll();
  }

  /** Audition a single pitch, e.g. when the user taps a piano-roll key. */
  async previewNote(midi: number, tonePreset: PlaybackTonePreset = "mellow-keys"): Promise<void> {
    await this.ensureStarted(tonePreset);
    if (this.disposed) return;
    this.melodySynth?.triggerAttackRelease(midiToFrequency(midi), 0.55, Tone.now(), 0.85);
  }

  async playCandidate(
    melody: NoteEvent[],
    candidate: HarmonyCandidate | null,
    tempo: number,
    options: PlaybackOptions,
    onBeat: (beat: number) => void,
    onEnded: () => void,
  ): Promise<boolean> {
    this.stop();
    const generation = this.playbackGeneration;
    const tonePreset = options.tonePreset ?? "mellow-keys";
    await this.ensureStarted(tonePreset);
    if (this.disposed || this.playbackGeneration !== generation) return false;
    const melodyVoice = getEffectiveVoiceConfig(tonePreset, "melody", this.samplerReady);
    const harmonyVoice = getEffectiveVoiceConfig(tonePreset, "harmony", this.samplerReady);
    const toneConfig = { melody: melodyVoice, harmony: harmonyVoice };

    const leadSeconds = 0.05;
    const startTime = Tone.now() + leadSeconds;
    let animationFrame: number | null = null;
    let stopped = false;
    const endBeat = getPlaybackEndBeat(melody, candidate);
    const playbackStartBeat = Math.max(0, Math.min(options.startBeat ?? 0, endBeat));
    const playbackDurationBeats = Math.max(0, endBeat - playbackStartBeat);
    const endSeconds = beatToSeconds(playbackDurationBeats, tempo);
    const triggers: ScheduledPlaybackTrigger[] = [];

    if (!options.melodyMuted) {
      for (const scheduledNote of makeScheduledBeatEvents(melody, playbackStartBeat, tempo)) {
        triggers.push({
          delaySeconds: leadSeconds + scheduledNote.delaySeconds,
          run: () => {
            this.melodySynth?.triggerAttackRelease(
              midiToFrequency(scheduledNote.event.midi),
              Math.max(
                toneConfig.melody.minDuration,
                beatToSeconds(scheduledNote.durationBeats, tempo) * toneConfig.melody.durationScale,
              ),
              Tone.now(),
              Math.min(1, scheduledNote.event.velocity * toneConfig.melody.velocity),
            );
          },
        });
      }
    }

    if (candidate && !options.harmonyMuted) {
      for (const scheduledChord of makeScheduledBeatEvents(candidate.chords, playbackStartBeat, tempo)) {
        triggers.push({
          delaySeconds: leadSeconds + scheduledChord.delaySeconds,
          run: () => {
            this.harmonySynth?.triggerAttackRelease(
              makeChordVoicing(scheduledChord.event.chord).map(midiToFrequency),
              Math.max(
                toneConfig.harmony.minDuration,
                beatToSeconds(scheduledChord.durationBeats, tempo) * toneConfig.harmony.durationScale,
              ),
              Tone.now(),
              toneConfig.harmony.velocity,
            );
          },
        });
      }
    }

    const triggerPlayback = scheduleCancellableTriggers(triggers, window.setTimeout, window.clearTimeout);
    const startedAt = performance.now() + (startTime - Tone.now()) * 1000;
    const tick = () => {
      if (stopped) return;
      const elapsedSeconds = Math.max(0, (performance.now() - startedAt) / 1000);
      const currentBeat = Math.min(endBeat, playbackStartBeat + (elapsedSeconds * tempo) / 60);
      onBeat(currentBeat);
      if (currentBeat < endBeat) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    const endTimer = window.setTimeout(() => {
      if (stopped) return;
      stopped = true;
      triggerPlayback.stop();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      onBeat(0);
      onEnded();
    }, Math.ceil((endSeconds + 0.12) * 1000));

    this.activePlayback = {
      stop: () => {
        stopped = true;
        triggerPlayback.stop();
        window.clearTimeout(endTimer);
        if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      },
    };
    return true;
  }
}

export function getPlaybackEndBeat(melody: NoteEvent[], candidate: HarmonyCandidate | null): number {
  const melodyEnd = melody.reduce(
    (end, note) => Math.max(end, note.startBeat + note.durationBeats),
    0,
  );
  const harmonyEnd =
    candidate?.chords.reduce(
      (end, placedChord) => Math.max(end, placedChord.startBeat + placedChord.durationBeats),
      0,
    ) ?? 0;
  return Math.max(1, melodyEnd, harmonyEnd);
}
