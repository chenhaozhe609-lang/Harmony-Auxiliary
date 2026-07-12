// Bass-smoothing inversions (Task 7 P2): a post-process over the chosen chord
// path that voices inner chords in inversion (slash chords) when doing so makes
// the bass line move more smoothly. It never changes which chord is chosen — only
// which chord tone sits in the bass — so melody fit, function, and the path are
// untouched. The first and last chords stay in root position for a firm frame.
import type { ChordDefinition, PitchClass } from "../types";
import { pitchClassToName } from "../theory/pitches";
import type { StyleProfile } from "./transitions";

function minPcInterval(a: number, b: number): number {
  const d = ((a - b) % 12 + 12) % 12;
  return Math.min(d, 12 - d);
}

function withFirstInversion(chord: ChordDefinition): ChordDefinition {
  const third = chord.tones[1];
  // Seventh+ chords keep their plain roman (slash symbol carries the inversion);
  // triads get the figured-bass "6".
  const roman = chord.tones.length > 3 ? chord.roman : `${chord.roman}6`;
  return {
    ...chord,
    bass: third,
    symbol: `${chord.symbol}/${pitchClassToName(third)}`,
    roman,
  };
}

// Choose root position or first inversion (third in the bass) per chord, whichever
// makes the bass leap from the previous chord smaller — charging an inversion
// penalty so root position stays the default unless it clearly smooths the line.
// Only first inversion is used: second-inversion (6/4) chords need special
// function (cadential/passing/pedal) and don't belong to a free bass-smoother.
export function applyBassInversions(
  path: ChordDefinition[],
  profile: StyleProfile,
): ChordDefinition[] {
  if (!profile.bassInversions || path.length === 0) return path;

  let prevBass: PitchClass = path[0].root;
  return path.map((chord, index) => {
    if (index === 0 || index === path.length - 1) {
      prevBass = chord.root;
      return chord; // keep the frame chords in root position
    }
    const third = chord.tones[1];
    const rootCost = minPcInterval(chord.root, prevBass);
    const invCost = minPcInterval(third, prevBass) + profile.inversionPenalty;
    if (third !== undefined && invCost < rootCost) {
      prevBass = third;
      return withFirstInversion(chord);
    }
    prevBass = chord.root;
    return chord;
  });
}
