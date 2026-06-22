import type {
  CandidateMode,
  ChordDefinition,
  ChordExplanation,
  HarmonyCandidate,
  HarmonySegment,
  NoteEvent,
  PlacedChord,
  ProjectSettings,
} from "../types";
import { getDiatonicChords } from "../theory/tonalAdapter";
import { scoreChordForSegment } from "./scoreChords";
import { legacyDensityToRhythm, segmentMelody } from "./segmentMelody";
import {
  STYLE_PROFILES,
  cadenceEmission,
  describeMotion,
  transitionScore,
  type StyleProfile,
} from "./transitions";
import { viterbi } from "./viterbi";

const MODES: CandidateMode[] = ["stable-classical", "pop-songwriting", "color-tension"];

type Emission = { score: number; explanation: ChordExplanation };

function buildCandidate(
  profile: StyleProfile,
  segments: HarmonySegment[],
  settings: ProjectSettings,
): HarmonyCandidate {
  const palette = getDiatonicChords(settings.keyTonic, settings.mode, {
    sevenths: profile.paletteSevenths,
  });
  const indexOf = new Map(palette.map((chord, index) => [chord.id, index]));
  const count = segments.length;

  // Emission cache: melody-fit score + explanation for every (segment, chord).
  const emissions: Emission[][] = segments.map((segment) =>
    palette.map((chord) => scoreChordForSegment(chord, segment.melodyNotes, segment.startBeat)),
  );

  const emissionOf = (step: number, chord: ChordDefinition): number => {
    const base = emissions[step][indexOf.get(chord.id) ?? 0].score;
    return base + cadenceEmission(step, count, chord, settings.keyTonic, profile);
  };

  // Globally optimal chord path, not a per-segment greedy.
  const path = viterbi<ChordDefinition>({
    length: count,
    statesAt: () => palette,
    emission: emissionOf,
    transition: (_step, prev, cur) => transitionScore(prev, cur, profile),
    keyOf: (chord) => chord.id,
  });

  const chords: PlacedChord[] = path.map((chord, step) => {
    const segment = segments[step];
    const base = emissions[step][indexOf.get(chord.id) ?? 0];
    const previous = step > 0 ? path[step - 1] : null;
    const { reason, motion } = describeMotion(previous, chord, step, count);

    const explanation: ChordExplanation = {
      ...base.explanation,
      functionReason: `${base.explanation.functionReason} ${reason}`,
      functionInfo: { functionLabel: chord.functionLabel, motion },
    };

    return {
      id: `${segment.id}-${chord.id}-${step + 1}`,
      chord,
      startBeat: segment.startBeat,
      durationBeats: segment.durationBeats,
      explanation,
    };
  });

  const score = path.reduce(
    (total, chord, step) => total + emissions[step][indexOf.get(chord.id) ?? 0].score,
    0,
  );

  return {
    id: profile.mode,
    mode: profile.mode,
    title: profile.title,
    subtitle: profile.subtitle,
    chords,
    score,
    summary: profile.summary,
  };
}

export function generateHarmonyCandidates(
  melody: NoteEvent[],
  settings: ProjectSettings,
): HarmonyCandidate[] {
  const segments = segmentMelody(
    melody,
    settings.harmonyRhythm ?? legacyDensityToRhythm(settings.harmonyDensity ?? "bar"),
    settings.timeSignature.numerator,
  );

  if (segments.length === 0) return [];

  return MODES.map((mode) => buildCandidate(STYLE_PROFILES[mode], segments, settings));
}
