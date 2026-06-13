import * as Tone from "tone";
import type { HarmonyCandidate, NoteEvent, PlacedChord, PlaybackTonePreset } from "../types";

export type PlaybackOptions = {
  melodyMuted: boolean;
  harmonyMuted: boolean;
  tonePreset: PlaybackTonePreset;
};

type SynthVoiceConfig = {
  oscillator: "sine" | "triangle";
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  volume: number;
  velocity: number;
};

type PlaybackToneConfig = {
  melody: SynthVoiceConfig;
  harmony: SynthVoiceConfig;
};

export const PLAYBACK_TONE_PRESETS: Record<PlaybackTonePreset, PlaybackToneConfig> = {
  "mellow-keys": {
    melody: {
      oscillator: "triangle",
      envelope: { attack: 0.012, decay: 0.16, sustain: 0.46, release: 0.38 },
      volume: -9,
      velocity: 0.9,
    },
    harmony: {
      oscillator: "sine",
      envelope: { attack: 0.04, decay: 0.26, sustain: 0.38, release: 0.8 },
      volume: -16,
      velocity: 0.55,
    },
  },
  "warm-organ": {
    melody: {
      oscillator: "sine",
      envelope: { attack: 0.018, decay: 0.08, sustain: 0.78, release: 0.42 },
      volume: -11,
      velocity: 0.82,
    },
    harmony: {
      oscillator: "triangle",
      envelope: { attack: 0.035, decay: 0.08, sustain: 0.74, release: 0.7 },
      volume: -18,
      velocity: 0.48,
    },
  },
  "soft-pluck": {
    melody: {
      oscillator: "triangle",
      envelope: { attack: 0.004, decay: 0.18, sustain: 0.18, release: 0.28 },
      volume: -8,
      velocity: 0.88,
    },
    harmony: {
      oscillator: "triangle",
      envelope: { attack: 0.008, decay: 0.26, sustain: 0.22, release: 0.58 },
      volume: -15,
      velocity: 0.5,
    },
  },
  "glass-bell": {
    melody: {
      oscillator: "sine",
      envelope: { attack: 0.006, decay: 0.5, sustain: 0.14, release: 1.05 },
      volume: -10,
      velocity: 0.78,
    },
    harmony: {
      oscillator: "sine",
      envelope: { attack: 0.02, decay: 0.6, sustain: 0.18, release: 1.35 },
      volume: -18,
      velocity: 0.42,
    },
  },
};

type ActivePlayback = {
  stop: () => void;
};

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

export class AudioEngine {
  private melodySynth: Tone.PolySynth | null = null;
  private harmonySynth: Tone.PolySynth | null = null;
  private activePlayback: ActivePlayback | null = null;
  private activeTonePreset: PlaybackTonePreset | null = null;

  async ensureStarted(tonePreset: PlaybackTonePreset = "mellow-keys"): Promise<void> {
    await Tone.start();
    this.melodySynth ??= new Tone.PolySynth(Tone.Synth).toDestination();
    this.harmonySynth ??= new Tone.PolySynth(Tone.Synth).toDestination();
    this.applyTonePreset(tonePreset);
  }

  private applyTonePreset(tonePreset: PlaybackTonePreset): void {
    if (this.activeTonePreset === tonePreset) return;

    const config = PLAYBACK_TONE_PRESETS[tonePreset];
    this.melodySynth?.set({
      oscillator: { type: config.melody.oscillator },
      envelope: config.melody.envelope,
    });
    this.harmonySynth?.set({
      oscillator: { type: config.harmony.oscillator },
      envelope: config.harmony.envelope,
    });
    if (this.melodySynth) this.melodySynth.volume.value = config.melody.volume;
    if (this.harmonySynth) this.harmonySynth.volume.value = config.harmony.volume;
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

    const startTime = Tone.now() + 0.05;
    const timers: number[] = [];
    let animationFrame: number | null = null;
    let stopped = false;
    const endBeat = getPlaybackEndBeat(melody, candidate);
    const endSeconds = beatToSeconds(endBeat, tempo);

    if (!options.melodyMuted) {
      for (const note of melody) {
        this.melodySynth?.triggerAttackRelease(
          midiToFrequency(note.midi),
          Math.max(0.08, beatToSeconds(note.durationBeats, tempo) * 0.92),
          startTime + beatToSeconds(note.startBeat, tempo),
          Math.min(1, note.velocity * toneConfig.melody.velocity),
        );
      }
    }

    if (!options.harmonyMuted) {
      for (const placedChord of candidate.chords) {
        this.harmonySynth?.triggerAttackRelease(
          chordToMidiVoicing(placedChord).map(midiToFrequency),
          Math.max(0.12, beatToSeconds(placedChord.durationBeats, tempo) * 0.9),
          startTime + beatToSeconds(placedChord.startBeat, tempo),
          toneConfig.harmony.velocity,
        );
      }
    }

    const startedAt = performance.now() + 50;
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
    timers.push(
      window.setTimeout(() => {
        if (stopped) return;
        stopped = true;
        if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
        onBeat(0);
        onEnded();
      }, Math.ceil((endSeconds + 0.12) * 1000)),
    );

    this.activePlayback = {
      stop: () => {
        stopped = true;
        timers.forEach((timer) => window.clearTimeout(timer));
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
