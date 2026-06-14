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
import { legacyDensityToRhythm, segmentMelody } from "./segmentMelody";

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

function motionBonus(previous: ScoredChord | null, current: ScoredChord): number {
  if (!previous) return current.chord.functionLabel === "T" ? 1 : 0;

  const from = previous.chord.functionLabel;
  const to = current.chord.functionLabel;

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

function cadenceBonus(
  previous: ScoredChord | null,
  current: ScoredChord,
  index: number,
  segmentCount: number,
): number {
  const remaining = segmentCount - index - 1;
  const roman = current.chord.roman;

  if (remaining === 0) {
    let bonus = current.chord.functionLabel === "T" ? 2.6 : -1.6;
    if (roman.startsWith("I")) bonus += 1.6;
    if (previous?.chord.functionLabel === "D" && current.chord.functionLabel === "T") {
      bonus += 2.2;
    }
    return bonus;
  }

  if (remaining === 1) {
    if (roman.startsWith("V")) return 2.4;
    return current.chord.functionLabel === "D" ? 1.2 : -0.6;
  }

  if (remaining === 2) {
    if (roman === "ii" || roman === "IV") return 1.2;
    return current.chord.functionLabel === "PD" ? 0.6 : 0;
  }

  return 0;
}

function strictNonChordPenalty(scored: ScoredChord): number {
  const sustainedWarnings = scored.explanation.warnings.filter((warning) =>
    warning.includes("sustained non-chord tone"),
  ).length;
  return sustainedWarnings * -1.4;
}

function classicalMotionReason(
  previous: ScoredChord | null,
  current: ScoredChord,
  index: number,
  segmentCount: number,
): string {
  const remaining = segmentCount - index - 1;
  if (!previous) {
    return current.chord.functionLabel === "T"
      ? "Classical motion: the phrase opens from tonic stability."
      : `Classical motion: the phrase opens with ${current.chord.functionLabel} function for preparation.`;
  }

  const motion = `${previous.chord.functionLabel} to ${current.chord.functionLabel}`;
  if (previous.chord.functionLabel === "D" && current.chord.functionLabel === "T") {
    return "Classical motion: dominant resolves to tonic.";
  }
  if (previous.chord.functionLabel === "PD" && current.chord.functionLabel === "D") {
    return "Classical motion: predominant prepares dominant.";
  }
  if (previous.chord.functionLabel === "T" && current.chord.functionLabel === "PD") {
    return "Classical motion: tonic moves toward predominant preparation.";
  }
  if (remaining === 0 && current.chord.functionLabel === "T") {
    return "Classical motion: the phrase closes on tonic function.";
  }
  return `Classical motion: ${motion} keeps the progression explainable.`;
}

function classicalMotionInfo(
  previous: ScoredChord | null,
  current: ScoredChord,
  index: number,
  segmentCount: number,
): NonNullable<ScoredChord["explanation"]["functionInfo"]>["motion"] {
  const remaining = segmentCount - index - 1;
  const to = current.chord.functionLabel;
  if (!previous) {
    return current.chord.functionLabel === "T"
      ? { kind: "open-tonic" }
      : { kind: "open-prep", to };
  }
  const from = previous.chord.functionLabel;
  if (from === "D" && to === "T") return { kind: "d-to-t" };
  if (from === "PD" && to === "D") return { kind: "pd-to-d" };
  if (from === "T" && to === "PD") return { kind: "t-to-pd" };
  if (remaining === 0 && to === "T") return { kind: "close-tonic" };
  return { kind: "general", from, to };
}

function withClassicalExplanation(
  scored: ScoredChord,
  previous: ScoredChord | null,
  index: number,
  segmentCount: number,
): ScoredChord {
  return {
    ...scored,
    explanation: {
      ...scored.explanation,
      functionReason: `${scored.explanation.functionReason} ${classicalMotionReason(
        previous,
        scored,
        index,
        segmentCount,
      )}`,
      functionInfo: {
        functionLabel: scored.chord.functionLabel,
        motion: classicalMotionInfo(previous, scored, index, segmentCount),
      },
    },
  };
}

function adjustedStableScore(
  scored: ScoredChord,
  previous: ScoredChord | null,
  index: number,
  segmentCount: number,
): number {
  return (
    scored.score +
    motionBonus(previous, scored) +
    cadenceBonus(previous, scored, index, segmentCount) +
    strictNonChordPenalty(scored)
  );
}

function chooseStableChord(
  segment: HarmonySegment,
  index: number,
  segmentCount: number,
  tonic: ProjectSettings["keyTonic"],
  previous: ScoredChord | null,
): ScoredChord {
  const palette = getMajorDiatonicChords(tonic);
  const scored = scoreSegment(segment, palette);
  const best = scored
    .map((candidate) => ({
      candidate,
      adjustedScore: adjustedStableScore(candidate, previous, index, segmentCount),
    }))
    .sort((a, b) => b.adjustedScore - a.adjustedScore)[0].candidate;

  return withClassicalExplanation(best, previous, index, segmentCount);
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
    settings.harmonyRhythm ?? legacyDensityToRhythm(settings.harmonyDensity ?? "bar"),
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

    const selectedScoredChords: ScoredChord[] = [];
    for (const [index, segment] of segments.entries()) {
      const previous = selectedScoredChords[index - 1] ?? null;
      const scored =
        mode === "stable-classical"
          ? chooseStableChord(segment, index, segments.length, settings.keyTonic, previous)
          : chooseByPalette(segment, palette, index);
      selectedScoredChords.push(scored);
    }

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
