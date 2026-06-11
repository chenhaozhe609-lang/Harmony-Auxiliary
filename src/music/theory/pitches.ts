import type { PitchClass } from "../types";

export const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  DB: "C#",
  EB: "D#",
  GB: "F#",
  AB: "G#",
  BB: "A#",
};

export function normalizePitchClass(value: number): PitchClass {
  return (((value % 12) + 12) % 12) as PitchClass;
}

export function midiToPitchClass(midi: number): PitchClass {
  return normalizePitchClass(midi);
}

export function pitchClassToName(pitchClass: PitchClass): string {
  return SHARP_NAMES[pitchClass];
}

export function noteNameToPitchClass(noteName: string): PitchClass {
  const cleaned = noteName.trim().toUpperCase().replace("♯", "#").replace("♭", "B");
  const base = FLAT_TO_SHARP[cleaned] ?? cleaned;
  const index = SHARP_NAMES.findIndex((name) => name.toUpperCase() === base);

  if (index < 0) {
    throw new Error(`Unsupported note name: ${noteName}`);
  }

  return index as PitchClass;
}

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${pitchClassToName(midiToPitchClass(midi))}${octave}`;
}

export function createNoteEventId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

