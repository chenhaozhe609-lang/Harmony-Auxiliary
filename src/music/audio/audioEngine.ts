import * as Tone from "tone";
import type { HarmonyCandidate, NoteEvent, PlacedChord } from "../types";

export type PlaybackOptions = {
  melodyMuted: boolean;
  harmonyMuted: boolean;
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

  async ensureStarted(): Promise<void> {
    await Tone.start();
    this.melodySynth ??= new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.01,
        decay: 0.12,
        sustain: 0.5,
        release: 0.25,
      },
    }).toDestination();
    this.harmonySynth ??= new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.03,
        decay: 0.22,
        sustain: 0.42,
        release: 0.55,
      },
    }).toDestination();
    this.melodySynth.volume.value = -8;
    this.harmonySynth.volume.value = -15;
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
    await this.ensureStarted();
    this.stop();

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
          note.velocity,
        );
      }
    }

    if (!options.harmonyMuted) {
      for (const placedChord of candidate.chords) {
        this.harmonySynth?.triggerAttackRelease(
          chordToMidiVoicing(placedChord).map(midiToFrequency),
          Math.max(0.12, beatToSeconds(placedChord.durationBeats, tempo) * 0.9),
          startTime + beatToSeconds(placedChord.startBeat, tempo),
          0.55,
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

