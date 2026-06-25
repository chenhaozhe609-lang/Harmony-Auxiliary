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

const TONAL_TYPE: Record<ChordQuality, string> = {
  major: "major",
  minor: "minor",
  diminished: "diminished",
  dominant7: "dominant seventh",
  major7: "major seventh",
  minor7: "minor seventh",
  major9: "major ninth",
  minor9: "minor ninth",
};

// Build a chord of a given quality at an arbitrary (possibly chromatic) root,
// taking enharmonically-correct tones from Tonal. Used for the chromatic P2
// vocabulary — secondary dominants and borrowed chords — that sits outside the
// plain diatonic set.
function buildChromaticChord(
  root: PitchClass,
  quality: ChordQuality,
  roman: string,
  functionLabel: FunctionLabel,
  id: string,
  extra: Partial<ChordDefinition>,
): ChordDefinition {
  const info = Chord.getChord(TONAL_TYPE[quality], pitchClassToName(root));
  const tones = info.notes.map((name) => normalizePitchClass(Note.chroma(name) ?? 0)) as PitchClass[];
  return {
    id,
    root,
    quality,
    tones,
    symbol: ourSymbol(root, quality),
    roman,
    functionLabel,
    ...extra,
  };
}

// Secondary dominants (V7/x): a tonicizing dominant-7th a perfect 5th above each
// tonicizable diatonic target (ii, iii, IV, V, vi). The tonic and the diminished
// degrees (ii°/vii°) are skipped — they don't take a stable applied dominant.
// Labelled Color so they stay out of the home-key cadence logic; the tonicization
// reward + explanation come from the role/appliedTo metadata.
export function getSecondaryDominants(
  triads: ChordDefinition[],
): ChordDefinition[] {
  const result: ChordDefinition[] = [];
  triads.forEach((target, index) => {
    if (index === 0 || target.quality === "diminished") return;
    const domRoot = normalizePitchClass(target.root + 7) as PitchClass; // P5 above target
    result.push(
      buildChromaticChord(domRoot, "dominant7", `V7/${target.roman}`, "Color", `sec-dom-${index + 1}`, {
        role: "secondary-dominant",
        appliedToRoot: target.root,
        appliedToRoman: target.roman,
      }),
    );
  });
  return result;
}

// Borrowed chords (modal interchange) from the parallel mode. Major borrows the
// minor-mode predominant colours iv / ♭VI / ♭VII; minor borrows the brightening
// major IV (Dorian colour). A Picardy major tonic is intentionally omitted — as a
// palette member it misfires as an opening chord; Picardy belongs to cadences.
export function getBorrowedChords(tonic: PitchClass, mode: Mode): ChordDefinition[] {
  if (mode === "major") {
    return [
      buildChromaticChord(normalizePitchClass(tonic + 5) as PitchClass, "minor", "iv", "PD", "borrow-iv", {
        role: "borrowed",
        borrowedFrom: "minor",
      }),
      buildChromaticChord(normalizePitchClass(tonic + 8) as PitchClass, "major", "♭VI", "PD", "borrow-flat6", {
        role: "borrowed",
        borrowedFrom: "minor",
      }),
      buildChromaticChord(normalizePitchClass(tonic + 10) as PitchClass, "major", "♭VII", "PD", "borrow-flat7", {
        role: "borrowed",
        borrowedFrom: "minor",
      }),
    ];
  }
  return [
    buildChromaticChord(normalizePitchClass(tonic + 5) as PitchClass, "major", "IV", "PD", "borrow-IV", {
      role: "borrowed",
      borrowedFrom: "major",
    }),
  ];
}

// The palette a style pass searches: the diatonic set, optionally extended with
// the chromatic P2 vocabulary (secondary dominants + borrowed chords). Targets
// for secondary dominants are derived from the triad set so romans read "V7/vi"
// regardless of whether the pass uses seventh chords.
export function getStylePalette(
  tonic: PitchClass,
  mode: Mode,
  options: { sevenths?: boolean; extended?: boolean } = {},
): ChordDefinition[] {
  const diatonic = getDiatonicChords(tonic, mode, { sevenths: options.sevenths });
  if (!options.extended) return diatonic;
  // Plain triads (V as "V", not "V7") so secondary-dominant targets read "V7/V".
  const triads = getDiatonicChords(tonic, mode, { sevenths: false, dominantSeventh: false });
  return [...diatonic, ...getSecondaryDominants(triads), ...getBorrowedChords(tonic, mode)];
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
