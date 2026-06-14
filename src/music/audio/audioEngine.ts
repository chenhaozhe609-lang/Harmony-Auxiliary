import * as Tone from "tone";
import type { HarmonyCandidate, NoteEvent, PlacedChord, PlaybackTonePreset } from "../types";

export type PlaybackOptions = {
  melodyMuted: boolean;
  harmonyMuted: boolean;
  tonePreset: PlaybackTonePreset;
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

type PlaybackToneConfig = {
  label: string;
  melody: SynthVoiceConfig;
  harmony: SynthVoiceConfig;
};

const playableTonePresets = {
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

export type ActivePlayback = {
  stop: () => void;
};

export type ScheduledPlaybackTrigger = {
  delaySeconds: number;
  run: () => void;
};

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

function createPolySynth(config: SynthVoiceConfig): PlayableSynth {
  const PolySynth = Tone.PolySynth as unknown as new (
    voice: unknown,
    options?: Record<string, unknown>,
  ) => PlayableSynth & { toDestination: () => PlayableSynth };
  let voice: unknown = Tone.Synth;

  if (config.engine === "fm") {
    voice = Tone.FMSynth;
  } else if (config.engine === "am") {
    voice = Tone.AMSynth;
  } else if (config.engine === "pluck") {
    voice = Tone.PluckSynth;
  }

  const synth = new PolySynth(voice, config.options).toDestination();
  synth.volume.value = config.volume;
  return synth;
}

export class AudioEngine {
  private melodySynth: PlayableSynth | null = null;
  private harmonySynth: PlayableSynth | null = null;
  private activePlayback: ActivePlayback | null = null;
  private activeTonePreset: PlaybackTonePreset | null = null;

  async ensureStarted(tonePreset: PlaybackTonePreset = "mellow-keys"): Promise<void> {
    await Tone.start();
    this.applyTonePreset(tonePreset);
  }

  private applyTonePreset(tonePreset: PlaybackTonePreset): void {
    if (this.activeTonePreset === tonePreset) return;

    const config = PLAYBACK_TONE_PRESETS[tonePreset];
    this.melodySynth?.dispose();
    this.harmonySynth?.dispose();
    this.melodySynth = createPolySynth(config.melody);
    this.harmonySynth = createPolySynth(config.harmony);
    this.activeTonePreset = tonePreset;
  }

  stop(): void {
    this.activePlayback?.stop();
    this.activePlayback = null;
    this.melodySynth?.releaseAll();
    this.harmonySynth?.releaseAll();
  }

  async playCandidate(
    melody: NoteEvent[],
    candidate: HarmonyCandidate,
    tempo: number,
    options: PlaybackOptions,
    onBeat: (beat: number) => void,
    onEnded: () => void,
  ): Promise<void> {
    const tonePreset = options.tonePreset ?? "mellow-keys";
    await this.ensureStarted(tonePreset);
    this.stop();
    this.applyTonePreset(tonePreset);
    const toneConfig = PLAYBACK_TONE_PRESETS[tonePreset];

    const leadSeconds = 0.05;
    const startTime = Tone.now() + leadSeconds;
    let animationFrame: number | null = null;
    let stopped = false;
    const endBeat = getPlaybackEndBeat(melody, candidate);
    const endSeconds = beatToSeconds(endBeat, tempo);
    const triggers: ScheduledPlaybackTrigger[] = [];

    if (!options.melodyMuted) {
      for (const note of melody) {
        triggers.push({
          delaySeconds: leadSeconds + beatToSeconds(note.startBeat, tempo),
          run: () => {
            this.melodySynth?.triggerAttackRelease(
              midiToFrequency(note.midi),
              Math.max(
                toneConfig.melody.minDuration,
                beatToSeconds(note.durationBeats, tempo) * toneConfig.melody.durationScale,
              ),
              Tone.now(),
              Math.min(1, note.velocity * toneConfig.melody.velocity),
            );
          },
        });
      }
    }

    if (!options.harmonyMuted) {
      for (const placedChord of candidate.chords) {
        triggers.push({
          delaySeconds: leadSeconds + beatToSeconds(placedChord.startBeat, tempo),
          run: () => {
            this.harmonySynth?.triggerAttackRelease(
              chordToMidiVoicing(placedChord).map(midiToFrequency),
              Math.max(
                toneConfig.harmony.minDuration,
                beatToSeconds(placedChord.durationBeats, tempo) * toneConfig.harmony.durationScale,
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
      const currentBeat = Math.min(endBeat, (elapsedSeconds * tempo) / 60);
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
