import type { ChordDefinition, ChordQuality, FunctionLabel, PitchClass } from "../types";
import { normalizePitchClass, pitchClassToName } from "./pitches";

const MAJOR_ROMANS = ["I", "ii", "iii", "IV", "V", "vi", "vii°"] as const;
const MAJOR_FUNCTIONS: FunctionLabel[] = ["T", "PD", "T", "PD", "D", "T", "D"];
const MAJOR_QUALITIES: ChordQuality[] = [
  "major",
  "minor",
  "minor",
  "major",
  "major",
  "minor",
  "diminished",
];

const TRIAD_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  major9: [0, 4, 7, 11, 2],
  minor9: [0, 3, 7, 10, 2],
};

function qualitySuffix(quality: ChordQuality): string {
  switch (quality) {
    case "major":
      return "";
    case "minor":
      return "m";
    case "diminished":
      return "dim";
    case "dominant7":
      return "7";
    case "major7":
      return "maj7";
    case "minor7":
      return "m7";
    case "major9":
      return "maj9";
    case "minor9":
      return "m9";
  }
}

export function buildChord(
  root: PitchClass,
  quality: ChordQuality,
  roman: string,
  functionLabel: FunctionLabel,
  id: string,
  bass?: PitchClass,
): ChordDefinition {
  const symbol = `${pitchClassToName(root)}${qualitySuffix(quality)}${
    bass !== undefined && bass !== root ? `/${pitchClassToName(bass)}` : ""
  }`;

  return {
    id,
    root,
    quality,
    tones: TRIAD_INTERVALS[quality].map((interval) => normalizePitchClass(root + interval)),
    bass,
    symbol,
    roman,
    functionLabel,
  };
}

export function getMajorDiatonicChords(tonic: PitchClass): ChordDefinition[] {
  const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];

  return majorScaleIntervals.map((interval, index) => {
    const quality =
      index === 4 ? "dominant7" : index === 0 ? "major7" : MAJOR_QUALITIES[index];
    const roman = index === 4 ? "V7" : index === 0 ? "Imaj7" : MAJOR_ROMANS[index];
    return buildChord(
      normalizePitchClass(tonic + interval),
      quality,
      roman,
      MAJOR_FUNCTIONS[index],
      `degree-${index + 1}`,
    );
  });
}

export function getPopLoopChords(tonic: PitchClass): ChordDefinition[] {
  const scale = [0, 2, 4, 5, 7, 9, 11].map((interval) => normalizePitchClass(tonic + interval));
  return [
    buildChord(scale[0], "major", "I", "T", "pop-1"),
    buildChord(scale[4], "major", "V6", "D", "pop-5-6", scale[6]),
    buildChord(scale[5], "minor", "vi", "T", "pop-6"),
    buildChord(scale[3], "major", "IV", "PD", "pop-4"),
  ];
}

export function getColorChords(tonic: PitchClass): ChordDefinition[] {
  const scale = [0, 2, 4, 5, 7, 9, 11].map((interval) => normalizePitchClass(tonic + interval));
  return [
    buildChord(scale[0], "major9", "Imaj9", "T", "color-1"),
    buildChord(scale[2], "dominant7", "V7/vi", "Color", "color-secondary"),
    buildChord(scale[5], "minor9", "vi9", "T", "color-6"),
    buildChord(scale[3], "minor", "iv", "Color", "color-borrowed-4"),
  ];
}

export function relationshipToChordTone(
  pitchClass: PitchClass,
  chord: ChordDefinition,
): "root" | "third" | "fifth" | "seventh" | "extension" | "non-chord tone" {
  const toneIndex = chord.tones.indexOf(pitchClass);
  if (toneIndex === 0) return "root";
  if (toneIndex === 1) return "third";
  if (toneIndex === 2) return "fifth";
  if (toneIndex === 3) return "seventh";
  if (toneIndex >= 4) return "extension";
  return "non-chord tone";
}

