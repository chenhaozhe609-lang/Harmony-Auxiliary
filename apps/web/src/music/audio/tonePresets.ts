import type { PlaybackTonePreset } from "../types";

type SynthEngine = "synth" | "fm" | "am" | "pluck";

export type SynthVoiceConfig = {
  engine: SynthEngine;
  options: Record<string, unknown>;
  volume: number;
  velocity: number;
  durationScale: number;
  minDuration: number;
};

export type SamplerVoiceConfig = {
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

const INSTRUMENT_BASE_URL = "https://nbrosowsky.github.io/tonejs-instruments/samples/";

// Sample maps verified available on the tonejs-instruments CDN. Keys are note names,
// values are the hosted filenames (sharps written as "s").
const GUITAR_NYLON_URLS: Record<string, string> = {
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
};

const GUITAR_ELECTRIC_URLS: Record<string, string> = {
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

const ORGAN_URLS: Record<string, string> = {
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

// Offline synth fallbacks, used while samples load or when the CDN is unreachable.
const nylonGuitarSynth = {
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
} satisfies Record<"melody" | "harmony", SynthVoiceConfig>;

const organSynth = {
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
  "nylon-guitar": {
    label: "Nylon Guitar",
    melody: {
      engine: "sampler",
      urls: GUITAR_NYLON_URLS,
      baseUrl: `${INSTRUMENT_BASE_URL}guitar-nylon/`,
      release: 0.9,
      volume: -7,
      velocity: 0.86,
      durationScale: 0.66,
      minDuration: 0.1,
      fallback: nylonGuitarSynth.melody,
    },
    harmony: {
      engine: "sampler",
      urls: GUITAR_NYLON_URLS,
      baseUrl: `${INSTRUMENT_BASE_URL}guitar-nylon/`,
      release: 1.1,
      volume: -15,
      velocity: 0.5,
      durationScale: 0.74,
      minDuration: 0.14,
      fallback: nylonGuitarSynth.harmony,
    },
  },
  "electric-guitar": {
    label: "Electric Guitar",
    melody: {
      engine: "sampler",
      urls: GUITAR_ELECTRIC_URLS,
      baseUrl: `${INSTRUMENT_BASE_URL}guitar-electric/`,
      release: 1,
      volume: -10,
      velocity: 0.82,
      durationScale: 0.72,
      minDuration: 0.1,
      fallback: nylonGuitarSynth.melody,
    },
    harmony: {
      engine: "sampler",
      urls: GUITAR_ELECTRIC_URLS,
      baseUrl: `${INSTRUMENT_BASE_URL}guitar-electric/`,
      release: 1.3,
      volume: -17,
      velocity: 0.5,
      durationScale: 0.8,
      minDuration: 0.14,
      fallback: nylonGuitarSynth.harmony,
    },
  },
  "warm-organ": {
    label: "Organ",
    melody: {
      engine: "sampler",
      urls: ORGAN_URLS,
      baseUrl: `${INSTRUMENT_BASE_URL}organ/`,
      release: 0.5,
      volume: -13,
      velocity: 0.8,
      durationScale: 0.98,
      minDuration: 0.14,
      fallback: organSynth.melody,
    },
    harmony: {
      engine: "sampler",
      urls: ORGAN_URLS,
      baseUrl: `${INSTRUMENT_BASE_URL}organ/`,
      release: 0.7,
      volume: -20,
      velocity: 0.5,
      durationScale: 1,
      minDuration: 0.16,
      fallback: organSynth.harmony,
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
  "mellow-keys": playableTonePresets["acoustic-grand"],
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
