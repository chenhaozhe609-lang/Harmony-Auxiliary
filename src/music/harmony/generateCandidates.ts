import type {
  CandidateMode,
  HarmonyCandidate,
  HarmonySegment,
  NoteEvent,
  PlacedChord,
  ProjectSettings,
  ScoredChord,
} from "../types";
import { getColorChords, getMajorDiatonicChords, getPopLoopChords } from "../theory/chords";
import { scoreChordForSegment } from "./scoreChords";
import { segmentMelody } from "./segmentMelody";

const CANDIDATE_META: Record<CandidateMode, { title: string; subtitle: string; summary: string }> = {
  "stable-classical": {
    title: "Stable Classical",
    subtitle: "Clear function, plain cadence",
    summary:
      "A conservative pass that favors chord-tone fit and tonic, predominant, dominant motion.",
  },
  "pop-songwriting": {
    title: "Pop / Songwriting",
    subtitle: "Loop-friendly, smoother bass",
    summary: "A familiar songwriting pass that keeps the progression easy to loop and audition.",
  },
  "color-tension": {
    title: "Color / Tension",
    subtitle: "Borrowed color, brighter edges",
    summary:
      "A more expressive pass that allows secondary dominant and borrowed-color choices.",
  },
};

function scoreSegment(segment: HarmonySegment, chords: ReturnType<typeof getMajorDiatonicChords>) {
  return chords
    .map<ScoredChord>((chord) => {
      const scored = scoreChordForSegment(chord, segment.melodyNotes, segment.startBeat);
      return {
        chord,
        score: scored.score,
        explanation: scored.explanation,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function chooseStableChord(
  segment: HarmonySegment,
  index: number,
  tonic: ProjectSettings["keyTonic"],
): ScoredChord {
  const palette = getMajorDiatonicChords(tonic);
  const scored = scoreSegment(segment, palette);
  const cadenceIndex = index % 4;
  const cadenceRoman = cadenceIndex === 1 ? "IV" : cadenceIndex === 2 ? "V7" : null;
  const cadenceMatch = cadenceRoman
    ? scored.find((candidate) => candidate.chord.roman === cadenceRoman)
    : null;
  return cadenceMatch && cadenceMatch.score > -0.5 ? cadenceMatch : scored[0];
}

function chooseByPalette(
  segment: HarmonySegment,
  palette: ReturnType<typeof getMajorDiatonicChords>,
  index: number,
): ScoredChord {
  const scored = scoreSegment(segment, palette);
  const preferred = palette[index % palette.length];
  const preferredScored = scored.find((candidate) => candidate.chord.id === preferred.id);
  if (preferredScored && preferredScored.score >= scored[0].score - 3) return preferredScored;
  return scored[0];
}

function makePlacedChord(scored: ScoredChord, segment: HarmonySegment, index: number): PlacedChord {
  return {
    id: `${segment.id}-${scored.chord.id}-${index + 1}`,
    chord: scored.chord,
    startBeat: segment.startBeat,
    durationBeats: segment.durationBeats,
    explanation: scored.explanation,
  };
}

export function generateHarmonyCandidates(
  melody: NoteEvent[],
  settings: ProjectSettings,
): HarmonyCandidate[] {
  const segments = segmentMelody(
    melody,
    settings.harmonyDensity,
    settings.timeSignature.numerator,
  );

  if (segments.length === 0) return [];

  const modes: CandidateMode[] = ["stable-classical", "pop-songwriting", "color-tension"];

  return modes.map((mode) => {
    const palette =
      mode === "pop-songwriting"
        ? getPopLoopChords(settings.keyTonic)
        : mode === "color-tension"
          ? getColorChords(settings.keyTonic)
          : getMajorDiatonicChords(settings.keyTonic);

    const selectedScoredChords = segments.map((segment, index) => {
      const scored =
        mode === "stable-classical"
          ? chooseStableChord(segment, index, settings.keyTonic)
          : chooseByPalette(segment, palette, index);
      return scored;
    });

    const chords = selectedScoredChords.map((scored, index) => {
      const segment = segments[index];
      return makePlacedChord(scored, segment, index);
    });

    const meta = CANDIDATE_META[mode];
    return {
      id: mode,
      mode,
      title: meta.title,
      subtitle: meta.subtitle,
      chords,
      score: selectedScoredChords.reduce((total, scored) => total + scored.score, 0),
      summary: meta.summary,
    };
  });
}
