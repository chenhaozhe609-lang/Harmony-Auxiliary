import type { ChordDefinition } from "../types";

/** Four voices shared by playback, notation, export and transition scoring.
 * Keep the third, seventh and extension; omit the fifth before the upper root.
 */
export function makeChordVoicing(chord: ChordDefinition): number[] {
  let upper = [...new Set(chord.tones)];
  if (upper.length > 3) upper = upper.filter((tone) => tone !== chord.tones[2]);
  if (upper.length > 3) upper = upper.filter((tone) => tone !== chord.root);
  const rootMidi = 48 + chord.root;
  return [
    36 + (chord.bass ?? chord.root),
    ...upper.slice(0, 3)
      .map((tone) => rootMidi + ((tone - chord.root + 12) % 12))
      .sort((a, b) => a - b),
  ];
}
