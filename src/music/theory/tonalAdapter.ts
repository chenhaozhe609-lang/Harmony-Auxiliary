// Tonal → our domain. Tonal (https://github.com/tonaljs/tonal) is the source of
// truth for "what chords are in this key" (major + minor, with correct roman
// numerals and harmonic function); this adapter maps its output onto our own
// `ChordDefinition` so the rest of the app keeps its stable shapes and our
// consistent sharp spelling. (Task 7 P1)
import { Chord, Key, Note } from "tonal";
import type { ChordDefinition, ChordQuality, FunctionLabel, Mode, PitchClass } from "../types";
import { normalizePitchClass, pitchClassToName } from "./pitches";

// Tonal labels harmonic function T / SD / D; we use T / PD / D (+ Color).
function mapFunction(fn: string | undefined): FunctionLabel {
  if (fn === "T") return "T";
  if (fn === "D") return "D";
  if (fn === "SD") return "PD";
  return "Color";
}

// Map a Tonal chord `type` string onto our ChordQuality enum. Covers the
// qualities that occur in diatonic major/minor palettes (P1); richer types
// (secondary dominants etc.) arrive with the same map in P2.
function mapQuality(type: string): ChordQuality {
  switch (type) {
    case "major":
      return "major";
    case "minor":
      return "minor";
    case "diminished":
      return "diminished";
    case "dominant seventh":
      return "dominant7";
    case "major seventh":
      return "major7";
    case "minor seventh":
      return "minor7";
    case "major ninth":
      return "major9";
    case "minor ninth":
      return "minor9";
    // Half-diminished / augmented / diminished-seventh fall back to the nearest
    // triad we model; P1 palettes avoid them, so this is only a safety net.
    case "half-diminished":
      return "diminished";
    default:
      return "major";
  }
}

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  major: "",
  minor: "m",
  diminished: "dim",
  dominant7: "7",
  major7: "maj7",
  minor7: "m7",
  major9: "maj9",
  minor9: "m9",
};

// Build OUR symbol from the root pitch-class + quality, so display stays in the
// app's sharp spelling (C#, F#…) regardless of how Tonal spelled the chord.
function ourSymbol(root: PitchClass, quality: ChordQuality, bass?: PitchClass): string {
  const slash = bass !== undefined && bass !== root ? `/${pitchClassToName(bass)}` : "";
  return `${pitchClassToName(root)}${QUALITY_SUFFIX[quality]}${slash}`;
}

const UPPER_GRADES = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
const LOWER_GRADES = ["i", "ii", "iii", "iv", "v", "vi", "vii"] as const;

function romanFor(degreeIndex: number, quality: ChordQuality): string {
  switch (quality) {
    case "major":
      return UPPER_GRADES[degreeIndex];
    case "dominant7":
      return `${UPPER_GRADES[degreeIndex]}7`;
    case "major7":
      return `${UPPER_GRADES[degreeIndex]}maj7`;
    case "major9":
      return `${UPPER_GRADES[degreeIndex]}maj9`;
    case "minor":
      return LOWER_GRADES[degreeIndex];
    case "minor7":
      return `${LOWER_GRADES[degreeIndex]}7`;
    case "minor9":
      return `${LOWER_GRADES[degreeIndex]}9`;
    case "diminished":
      return `${LOWER_GRADES[degreeIndex]}°`;
  }
}

// Turn a Tonal chord symbol into a ChordDefinition, taking pitch classes from
// Tonal (enharmonically correct) but rebuilding our symbol/roman ourselves.
function chordFromSymbol(
  symbol: string,
  degreeIndex: number,
  fn: FunctionLabel,
  id: string,
): ChordDefinition {
  const info = Chord.get(symbol);
  const tones = info.notes.map((name) => normalizePitchClass(Note.chroma(name) ?? 0)) as PitchClass[];
  const root = tones[0] ?? 0;
  const quality = mapQuality(info.type);
  return {
    id,
    root,
    quality,
    tones,
    symbol: ourSymbol(root, quality),
    roman: romanFor(degreeIndex, quality),
    functionLabel: fn,
  };
}

// Force a diatonic degree to a dominant-7th chord (used for V — a classical
// cadential dominant even when the rest of the palette stays triadic).
function asDominantSeventh(symbol: string, degreeIndex: number, id: string): ChordDefinition {
  const triad = Chord.get(symbol);
  const root = normalizePitchClass(Note.chroma(triad.tonic || triad.notes[0]) ?? 0) as PitchClass;
  const seventh = Chord.getChord("dominant seventh", pitchClassToName(root));
  const tones = seventh.notes.map((name) => normalizePitchClass(Note.chroma(name) ?? 0)) as PitchClass[];
  return {
    id,
    root,
    quality: "dominant7",
    tones,
    symbol: ourSymbol(root, "dominant7"),
    roman: romanFor(degreeIndex, "dominant7"),
    functionLabel: "D",
  };
}

export type DiatonicOptions = {
  /** Use Tonal's diatonic seventh chords instead of triads (pop/colour palettes). */
  sevenths?: boolean;
  /** Always voice the dominant (degree V) as a dominant-7th for cadential pull. */
  dominantSeventh?: boolean;
};

// The diatonic chord palette for a key, as ChordDefinition[] in scale-degree
// order (I…vii°). Backed by Tonal so minor keys (and later modes/borrowing) are
// correct without hand-maintained interval tables.
export function getDiatonicChords(
  tonic: PitchClass,
  mode: Mode,
  options: DiatonicOptions = {},
): ChordDefinition[] {
  const tonicName = pitchClassToName(tonic);
  const useSevenths = options.sevenths ?? false;
  const dominantSeventh = options.dominantSeventh ?? true;
  const idPrefix = mode === "major" ? "maj" : "min";

  let symbols: string[];
  let functions: FunctionLabel[];

  if (mode === "major") {
    const key = Key.majorKey(tonicName);
    symbols = (useSevenths ? key.chords : key.triads).slice();
    functions = key.chordsHarmonicFunction.map(mapFunction);
  } else {
    // Minor: natural minor as the base, but borrow the dominant (V) and leading-
    // tone (vii°) from harmonic minor so the key has a functional dominant.
    const key = Key.minorKey(tonicName);
    const base = useSevenths ? key.natural.chords : key.natural.triads;
    symbols = base.slice();
    symbols[4] = (useSevenths ? key.harmonic.chords : key.harmonic.triads)[4]; // V (major / E7)
    symbols[6] = (useSevenths ? key.harmonic.chords : key.harmonic.triads)[6]; // vii° (dim)
    functions = ["T", "PD", "T", "PD", "D", "T", "D"];
  }

  return symbols.map((symbol, index) => {
    const id = `${idPrefix}-degree-${index + 1}`;
    if (index === 4 && dominantSeventh) {
      return asDominantSeventh(symbol, index, id);
    }
    return chordFromSymbol(symbol, index, functions[index], id);
  });
}
