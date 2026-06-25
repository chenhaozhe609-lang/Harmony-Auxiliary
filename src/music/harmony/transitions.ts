// Transition costs, position/cadence terms, and the three style profiles that
// turn one Viterbi engine into three distinct voices. Profiles differ only by a
// palette flag and a few named weights — not by hardcoded chord loops. Function-
// progression and cadence values are theory-anchored (carried over from the old
// greedy heuristic) so behaviour stays explainable. (Task 7 P1)
import type {
  CandidateMode,
  ChordDefinition,
  FunctionInfo,
  FunctionLabel,
  Mode,
  PitchClass,
} from "../types";

export type StyleProfile = {
  mode: CandidateMode;
  title: string;
  subtitle: string;
  summary: string;
  /** Use diatonic seventh chords (richer/jazzier) instead of triads. */
  paletteSevenths: boolean;
  /** Scales the functional T–PD–D–T progression preference. */
  functionWeight: number;
  /** Scales the phrase-position cadence preference. */
  cadenceWeight: number;
  /** Penalty applied to non-diatonic / colour chords (negative = reward). */
  colorPenalty: number;
  /** Scales voice-leading smoothness (shared tones, bass motion). */
  voiceLeadingWeight: number;
  /** Reward (per segment) for landing on a pop-axis degree (I / IV / V / vi).
   * This is what makes the pop pass loop-friendly without hardcoding any
   * I–V–vi–IV sequence: when several chords fit the melody equally, pop leans
   * toward the four loop chords. 0 for the other passes. */
  loopAnchorWeight: number;
};

export const STYLE_PROFILES: Record<CandidateMode, StyleProfile> = {
  "stable-classical": {
    mode: "stable-classical",
    title: "Stable Classical",
    subtitle: "Clear function, plain cadence",
    summary:
      "A conservative pass that favors chord-tone fit and tonic, predominant, dominant motion.",
    paletteSevenths: false,
    functionWeight: 1,
    cadenceWeight: 1,
    colorPenalty: 1.5,
    voiceLeadingWeight: 0.5,
    loopAnchorWeight: 0,
  },
  "pop-songwriting": {
    mode: "pop-songwriting",
    title: "Pop / Songwriting",
    subtitle: "Loop-friendly, smoother bass",
    summary: "A familiar songwriting pass that keeps the progression easy to loop and audition.",
    paletteSevenths: false,
    functionWeight: 0.5,
    cadenceWeight: 0.5,
    colorPenalty: 1,
    voiceLeadingWeight: 1.2,
    loopAnchorWeight: 1.8,
  },
  "color-tension": {
    mode: "color-tension",
    title: "Color / Tension",
    subtitle: "Borrowed color, brighter edges",
    summary: "A more expressive pass that allows secondary dominant and borrowed-color choices.",
    paletteSevenths: true,
    functionWeight: 0.4,
    cadenceWeight: 0.5,
    colorPenalty: 0.2,
    voiceLeadingWeight: 0.7,
    loopAnchorWeight: 0,
  },
};

// Pop-axis scale degrees, as semitone intervals above the tonic. Major is the
// I–V–vi–IV loop; minor is its Aeolian analog i–III–VI–VII. Mode-aware so the
// pop pass leans on the loop chords that actually belong to the key.
const POP_AXIS_INTERVALS: Record<Mode, Set<number>> = {
  major: new Set([0, 5, 7, 9]), // I, IV, V, vi
  minor: new Set([0, 3, 8, 10]), // i, III, VI, VII
};

// Per-segment reward for landing on a pop-axis degree (see loopAnchorWeight).
// Triads only — a seventh/extension on the loop chord is a colour choice, not the
// plain loop sonority, so it does not earn the anchor.
export function loopAnchorEmission(
  chord: ChordDefinition,
  tonic: PitchClass,
  mode: Mode,
  profile: StyleProfile,
): number {
  if (profile.loopAnchorWeight === 0) return 0;
  const interval = ((chord.root - tonic) % 12 + 12) % 12;
  const isTriad = chord.quality === "major" || chord.quality === "minor";
  return POP_AXIS_INTERVALS[mode].has(interval) && isTriad ? profile.loopAnchorWeight : 0;
}

// Theory-anchored functional progression preference (T–PD–D–T is strongest).
function functionProgression(from: FunctionLabel, to: FunctionLabel): number {
  if (from === "T" && to === "PD") return 2.2;
  if (from === "PD" && to === "D") return 2.4;
  if (from === "D" && to === "T") return 3;
  if (from === "T" && to === "T") return 0.7;
  if (from === "PD" && to === "PD") return 0.4;
  if (from === "D" && to === "D") return -0.9;
  if (from === "D" && to === "PD") return -1.8;
  if (from === "PD" && to === "T") return -0.7;
  if (to === "Color") return -1.5;
  return -0.2;
}

function minPcInterval(a: number, b: number): number {
  const d = ((a - b) % 12 + 12) % 12;
  return Math.min(d, 12 - d);
}

function commonToneCount(prev: ChordDefinition, cur: ChordDefinition): number {
  return cur.tones.filter((tone) => prev.tones.includes(tone)).length;
}

// Voice-leading v1: reward shared tones (smoothness) and a functional root
// motion by 4th/5th; lightly penalise tritone leaps and static repeats. A full
// voicing-based pass (avoid parallels etc.) is P3.
function voiceLeadingV1(prev: ChordDefinition, cur: ChordDefinition): number {
  const rootMove = minPcInterval(prev.root, cur.root);
  // Repeating the exact same chord isn't voice leading, it's stagnation — the
  // shared-tone reward would otherwise be maximal and bias toward repeats.
  if (rootMove === 0 && prev.quality === cur.quality) return -0.5;
  let score = commonToneCount(prev, cur) * 0.6;
  if (rootMove === 5) score += 0.5; // perfect 4th/5th — the functional backbone
  else if (rootMove === 1 || rootMove === 2) score += 0.3; // stepwise
  else if (rootMove === 6) score -= 0.6; // tritone
  else if (rootMove === 0) score -= 0.2; // same root, changed quality (e.g. C→Cm)
  return score;
}

export function transitionScore(
  prev: ChordDefinition,
  cur: ChordDefinition,
  profile: StyleProfile,
): number {
  return (
    profile.functionWeight * functionProgression(prev.functionLabel, cur.functionLabel) +
    profile.voiceLeadingWeight * voiceLeadingV1(prev, cur) -
    profile.colorPenalty * (cur.functionLabel === "Color" ? 1 : 0)
  );
}

// Phrase-position preference, independent of the previous chord (the prev-
// dependent D→T cadence reward lives in transitionScore). Last segment wants a
// real tonic; the lead-up wants dominant then predominant.
export function cadenceEmission(
  step: number,
  segmentCount: number,
  chord: ChordDefinition,
  tonic: PitchClass,
  profile: StyleProfile,
): number {
  const remaining = segmentCount - step - 1;
  let bonus = 0;
  if (remaining === 0) {
    bonus = chord.functionLabel === "T" ? 2.6 : -1.6;
    if (chord.functionLabel === "T" && chord.root === tonic) bonus += 1.6; // true tonic close
  } else if (remaining === 1) {
    bonus = chord.functionLabel === "D" ? 1.4 : -0.5;
  } else if (remaining === 2) {
    bonus = chord.functionLabel === "PD" ? 0.7 : 0;
  }
  return bonus * profile.cadenceWeight;
}

// Human-readable motion reason + structured info for the chosen prev→cur pair.
export function describeMotion(
  prev: ChordDefinition | null,
  cur: ChordDefinition,
  step: number,
  segmentCount: number,
): { reason: string; motion: NonNullable<FunctionInfo["motion"]> } {
  const remaining = segmentCount - step - 1;
  const to = cur.functionLabel;
  if (!prev) {
    return to === "T"
      ? { reason: "The phrase opens from tonic stability.", motion: { kind: "open-tonic" } }
      : {
          reason: `The phrase opens with ${to} function for preparation.`,
          motion: { kind: "open-prep", to },
        };
  }
  const from = prev.functionLabel;
  if (from === "D" && to === "T") {
    return { reason: "Dominant resolves to tonic.", motion: { kind: "d-to-t" } };
  }
  if (from === "PD" && to === "D") {
    return { reason: "Predominant prepares dominant.", motion: { kind: "pd-to-d" } };
  }
  if (from === "T" && to === "PD") {
    return { reason: "Tonic moves toward predominant preparation.", motion: { kind: "t-to-pd" } };
  }
  if (remaining === 0 && to === "T") {
    return { reason: "The phrase closes on tonic function.", motion: { kind: "close-tonic" } };
  }
  return { reason: `${from} to ${to} keeps the progression coherent.`, motion: { kind: "general", from, to } };
}
