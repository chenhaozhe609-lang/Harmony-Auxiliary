// UI option constants shared across the workspace command bar and settings fields
// (TASK6 §T6.5 component split).
import type { PitchClass, PlaybackTonePreset } from "../music/types";

export const DURATION_OPTIONS = [
  { labelKey: "duration.whole", value: 4 },
  { labelKey: "duration.half", value: 2 },
  { labelKey: "duration.quarter", value: 1 },
  { labelKey: "duration.eighth", value: 0.5 },
] as const;

export type DurationBeats = (typeof DURATION_OPTIONS)[number]["value"];

export const KEY_OPTIONS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

export const PLAYBACK_TONE_OPTIONS: PlaybackTonePreset[] = [
  "acoustic-grand",
  "nylon-guitar",
  "electric-guitar",
  "warm-organ",
  "glass-bell",
];

// The six-step guided wizard sequence (TASK6 §11 Phase B). The App owns the gate
// machine that derives the reachable step; the overlay only renders the steps.
export const GUIDE_STEPS = [
  "input",
  "settings",
  "generate",
  "audition",
  "select",
  "export",
] as const;
