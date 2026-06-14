import * as Tone from "tone";
import type { HarmonyCandidate, NoteEvent, PlacedChord, PlaybackTonePreset } from "../types";

export type PlaybackOptions = {
  melodyMuted: boolean;
  harmonyMuted: boolean;
  tonePreset: PlaybackTonePreset;
  startBeat?: number;
};

type SynthEngine = "synth" | "fm" | "am" | "pluck";

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

type SynthVoiceConfig = {
  engine: SynthEngine;
  options: Record<string, unknown>;
  volume: number;
  velocity: number;
  durationScale: number;
  minDuration: number;
};

type SamplerVoiceConfig = {
  engine: "sampler";
  urls: Record<string, string>;
  baseUrl: string;
  release: number;
  volume: number;
  velocity: number;
  durationScale: number;
  minDuration: number;
  /** Synth voice used while samples are still loading or when loading fails (offline). */
  fallback: SynthVoiceConfig;
};

type VoiceConfig = SynthVoiceConfig | SamplerVoiceConfig;

type PlaybackToneConfig = {
  label: string;
  melody: VoiceConfig;
  harmony: VoiceConfig;
};

export type ToneLoadStatus = "synth" | "sampled" | "fallback";

/**
 * Salamander Grand Piano samples hosted by the Tone.js project. A reduced set keeps the
 * first load light; the sampler interpolates the missing pitches.
 */
const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";
const SALAMANDER_URLS: Record<string, string> = {
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
};

const acousticPianoSynth = {
  melody: {
    engine: "synth",
    options: {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.003, decay: 0.32, sustain: 0.12, release: 0.78 },
    },
    volume: -7,
    velocity: 0.92,
    durationScale: 0.58,
    minDuration: 0.06,
  },
  harmony: {
    engine: "synth",
    options: {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.006, decay: 0.42, sustain: 0.18, release: 1.05 },
    },
    volume: -17,
    velocity: 0.48,
    durationScale: 0.72,
    minDuration: 0.1,
  },
} satisfies Record<"melody" | "harmony", SynthVoiceConfig>;

const playableTonePresets = {
  "acoustic-grand": {
    label: "Grand Piano",
    melody: {
      engine: "sampler",
      urls: SALAMANDER_URLS,
      baseUrl: SALAMANDER_BASE_URL,
      release: 1.1,
      volume: -6,
      velocity: 0.9,
      durationScale: 0.88,
      minDuration: 0.14,
      fallback: acousticPianoSynth.melody,
    },
    harmony: {
      engine: "sampler",
      urls: SALAMANDER_URLS,
      baseUrl: SALAMANDER_BASE_URL,
      release: 1.6,
      volume: -13,
      velocity: 0.56,
      durationScale: 0.92,
      minDuration: 0.18,
      fallback: acousticPianoSynth.harmony,
    },
  },
  "acoustic-piano": {
    label: "Piano",
    melody: {
      engine: "synth",
      options: {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.003, decay: 0.32, sustain: 0.12, release: 0.78 },
      },
      volume: -7,
      velocity: 0.92,
      durationScale: 0.58,
      minDuration: 0.06,
    },
    harmony: {
      engine: "synth",
      options: {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.006, decay: 0.42, sustain: 0.18, release: 1.05 },
      },
      volume: -17,
      velocity: 0.48,
      durationScale: 0.72,
      minDuration: 0.1,
    },
  },
  "electric-piano": {
    label: "Electric Piano",
    melody: {
      engine: "fm",
      options: {
        harmonicity: 3,
        modulationIndex: 7,
        oscillator: { type: "sine" },
        envelope: { attack: 0.006, decay: 0.28, sustain: 0.32, release: 0.85 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.01, decay: 0.22, sustain: 0.18, release: 0.65 },
      },
      volume: -10,
      velocity: 0.82,
      durationScale: 0.78,
      minDuration: 0.08,
    },
    harmony: {
      engine: "fm",
      options: {
        harmonicity: 2,
        modulationIndex: 4,
        oscillator: { type: "sine" },
        envelope: { attack: 0.012, decay: 0.36, sustain: 0.26, release: 1 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.02, decay: 0.24, sustain: 0.12, release: 0.8 },
      },
      volume: -19,
      velocity: 0.45,
      durationScale: 0.82,
      minDuration: 0.1,
    },
  },
  "nylon-guitar": {
    label: "Nylon Guitar",
    melody: {
      engine: "pluck",
      options: { attackNoise: 0.8, dampening: 4200, resonance: 0.82 },
      volume: -8,
      velocity: 0.86,
      durationScale: 0.5,
      minDuration: 0.05,
    },
    harmony: {
      engine: "pluck",
      options: { attackNoise: 0.6, dampening: 3600, resonance: 0.72 },
      volume: -16,
      velocity: 0.42,
      durationScale: 0.56,
      minDuration: 0.08,
    },
  },
  "warm-organ": {
    label: "Organ",
    melody: {
      engine: "am",
      options: {
        harmonicity: 1.5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.018, decay: 0.08, sustain: 0.82, release: 0.38 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.03, decay: 0.08, sustain: 0.7, release: 0.4 },
      },
      volume: -11,
      velocity: 0.82,
      durationScale: 0.96,
      minDuration: 0.12,
    },
    harmony: {
      engine: "am",
      options: {
        harmonicity: 1.25,
        oscillator: { type: "sine" },
        envelope: { attack: 0.035, decay: 0.08, sustain: 0.78, release: 0.7 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.04, decay: 0.1, sustain: 0.62, release: 0.72 },
      },
      volume: -18,
      velocity: 0.48,
      durationScale: 0.98,
      minDuration: 0.12,
    },
  },
  "glass-bell": {
    label: "Bell",
    melody: {
      engine: "fm",
      options: {
        harmonicity: 5.2,
        modulationIndex: 13,
        oscillator: { type: "sine" },
        envelope: { attack: 0.002, decay: 0.72, sustain: 0.04, release: 1.4 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0.02, release: 1.1 },
      },
      volume: -12,
      velocity: 0.7,
      durationScale: 0.62,
      minDuration: 0.08,
    },
    harmony: {
      engine: "fm",
      options: {
        harmonicity: 4,
        modulationIndex: 8,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.86, sustain: 0.08, release: 1.7 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.01, decay: 0.68, sustain: 0.04, release: 1.4 },
      },
      volume: -21,
      velocity: 0.34,
      durationScale: 0.68,
      minDuration: 0.12,
    },
  },
} satisfies Record<Exclude<PlaybackTonePreset, "mellow-keys" | "soft-pluck">, PlaybackToneConfig>;

export const PLAYBACK_TONE_PRESETS: Record<PlaybackTonePreset, PlaybackToneConfig> = {
  ...playableTonePresets,
  "mellow-keys": playableTonePresets["acoustic-piano"],
  "soft-pluck": playableTonePresets["nylon-guitar"],
};

export function isSamplerVoiceConfig(config: VoiceConfig): config is SamplerVoiceConfig {
  return config.engine === "sampler";
}

export function isSampledTonePreset(preset: PlaybackTonePreset): boolean {
  const config = PLAYBACK_TONE_PRESETS[preset];
  return isSamplerVoiceConfig(config.melody) || isSamplerVoiceConfig(config.harmony);
}

/**
 * Resolve the scheduling voice config for a tone preset and role. When a preset is
 * sample-based but the samples are not available (still loading or offline), the synth
 * fallback config is used so playback timing stays consistent.
 */
export function getEffectiveVoiceConfig(
  preset: PlaybackTonePreset,
  role: "melody" | "harmony",
  samplerReady: boolean,
): SynthVoiceConfig {
  const config = PLAYBACK_TONE_PRESETS[preset][role];
  if (isSamplerVoiceConfig(config)) {
    if (samplerReady) {
      return {
        engine: "synth",
        options: {},
        volume: config.volume,
        velocity: config.velocity,
        durationScale: config.durationScale,
        minDuration: config.minDuration,
      };
    }
    return config.fallback;
  }
  return config;
}

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

function pitchClassToMidiNearMiddle(pitchClass: number): number {
  const base = 48 + pitchClass;
  return base < 48 ? base + 12 : base;
}

function chordToMidiVoicing(placedChord: PlacedChord): number[] {
  const tones = placedChord.chord.tones
    .slice(0, 4)
    .map((pitchClass) => pitchClassToMidiNearMiddle(pitchClass))
    .sort((a, b) => a - b);

  if (placedChord.chord.bass !== undefined) {
    return [36 + placedChord.chord.bass, ...tones];
  }

  return tones;
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
    urls: config.urls,
    baseUrl: config.baseUrl,
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

  /** Whether the active preset is currently playing through loaded samples. */
  isSamplerReady(): boolean {
    return this.samplerReady;
  }

  async ensureStarted(tonePreset: PlaybackTonePreset = "mellow-keys"): Promise<void> {
    await Tone.start();
    await this.loadTone(tonePreset);
  }

  /**
   * Build (or reuse) the instruments for a preset. Sample-based presets load their buffers
   * asynchronously; until the buffers are ready (or if loading fails offline) a synth
   * fallback voice keeps playback audible. Returns the resolved tone status.
   */
  loadTone(tonePreset: PlaybackTonePreset): Promise<ToneLoadStatus> {
    if (this.activeTonePreset === tonePreset && this.tonePromise) {
      return this.tonePromise;
    }

    this.disposeInstruments();
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

    const melody = createSampler(melodyConfig, reverb);
    const harmony = createSampler(harmonyConfig, reverb);

    this.tonePromise = Promise.all([reverb.ready, melody.loaded, harmony.loaded])
      .then<ToneLoadStatus>(() => {
        if (this.activeTonePreset !== tonePreset) {
          melody.sampler.dispose();
          harmony.sampler.dispose();
          return "fallback";
        }
        melody.sampler.volume.value = melodyConfig.volume;
        harmony.sampler.volume.value = harmonyConfig.volume;
        this.melodySynth?.dispose();
        this.harmonySynth?.dispose();
        this.melodySynth = melody.sampler;
        this.harmonySynth = harmony.sampler;
        this.samplerReady = true;
        return "sampled";
      })
      .catch<ToneLoadStatus>(() => {
        // Offline or blocked CDN: keep the synth fallback already in place.
        melody.sampler.dispose();
        harmony.sampler.dispose();
        this.samplerReady = false;
        return "fallback";
      });

    return this.tonePromise;
  }

  private disposeInstruments(): void {
    this.melodySynth?.dispose();
    this.harmonySynth?.dispose();
    this.melodySynth = null;
    this.harmonySynth = null;
    this.auxNodes.forEach((node) => node.dispose());
    this.auxNodes = [];
    this.tonePromise = null;
  }

  stop(): void {
    this.activePlayback?.stop();
    this.activePlayback = null;
    this.melodySynth?.releaseAll();
    this.harmonySynth?.releaseAll();
  }

  /** Audition a single pitch, e.g. when the user taps a piano-roll key. */
  async previewNote(midi: number, tonePreset: PlaybackTonePreset = "mellow-keys"): Promise<void> {
    await this.ensureStarted(tonePreset);
    this.melodySynth?.triggerAttackRelease(midiToFrequency(midi), 0.55, Tone.now(), 0.85);
  }

  async playCandidate(
    melody: NoteEvent[],
    candidate: HarmonyCandidate | null,
    tempo: number,
    options: PlaybackOptions,
    onBeat: (beat: number) => void,
    onEnded: () => void,
  ): Promise<void> {
    const tonePreset = options.tonePreset ?? "mellow-keys";
    await this.ensureStarted(tonePreset);
    this.stop();
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
              chordToMidiVoicing(scheduledChord.event).map(midiToFrequency),
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
