import { positionScore, rescoreCandidate } from "./candidateScoring";
import type {
  CandidateMode,
  ChordDefinition,
  HarmonyCandidate,
  HarmonySegment,
  NoteEvent,
  PlacedChord,
  ProjectSettings,
} from "../types";
import { getStylePalette } from "../theory/tonalAdapter";
import { scoreChordForSegment } from "./scoreChords";
import { legacyDensityToRhythm, segmentMelody } from "./segmentMelody";
import {
  STYLE_PROFILES,
  transitionScore,
  type StyleProfile,
} from "./transitions";
import { applyBassInversions } from "./inversions";
import { viterbi } from "./viterbi";

const MODES: CandidateMode[] = ["stable-classical", "pop-songwriting", "color-tension"];

type Emission = ReturnType<typeof scoreChordForSegment>;

function buildCandidate(
  profile: StyleProfile,
  segments: HarmonySegment[],
  melody: NoteEvent[],
  settings: ProjectSettings,
): HarmonyCandidate {
  const palette = getStylePalette(settings.keyTonic, settings.mode, {
    sevenths: profile.paletteSevenths,
    extended: profile.extendedVocabulary,
  });
  const indexOf = new Map(palette.map((chord, index) => [chord.id, index]));
  const count = segments.length;

  // Emission cache: melody-fit score + explanation for every (segment, chord).
  const emissions: Emission[][] = segments.map((segment) =>
    palette.map((chord) => scoreChordForSegment(chord, segment.melodyNotes, segment.startBeat)),
  );

  const emissionOf = (step: number, chord: ChordDefinition): number => {
    const base = emissions[step][indexOf.get(chord.id) ?? 0].score;
    return (
      base +
      positionScore(chord, step, count, settings, profile)
    );
  };

  // Globally optimal chord path, not a per-segment greedy.
  const path = viterbi<ChordDefinition>({
    length: count,
    statesAt: () => palette,
    emission: emissionOf,
    transition: (_step, prev, cur) => transitionScore(prev, cur, profile),
    keyOf: (chord) => chord.id,
  });

  // Voice the path with bass-smoothing inversions (slash chords). This only
  // changes the bass note, not which chord is chosen, so the emission lookup
  // (keyed by chord id) and the function/root used for motion are unchanged.
  const voiced = applyBassInversions(path, profile);

  const chords: PlacedChord[] = voiced.map((chord, step) => {
    const segment = segments[step];
    const base = emissions[step][indexOf.get(chord.id) ?? 0];
    return {
      id: `${segment.id}-${chord.id}-${step + 1}`,
      chord,
      startBeat: segment.startBeat,
      durationBeats: segment.durationBeats,
      explanation: base.explanation,
    };
  });

  return rescoreCandidate({
    id: profile.mode,
    mode: profile.mode,
    title: profile.title,
    subtitle: profile.subtitle,
    chords,
    score: 0,
    summary: profile.summary,
  }, melody, settings);
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

  return MODES.map((mode) => buildCandidate(STYLE_PROFILES[mode], segments, melody, settings));
}
