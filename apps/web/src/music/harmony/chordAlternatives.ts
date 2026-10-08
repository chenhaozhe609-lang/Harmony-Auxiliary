import { notesForPlacedChord, positionScore } from "./candidateScoring";
import { STYLE_PROFILES, transitionScore } from "./transitions";
import type { HarmonyCandidate } from "../types";
import type { ChordDefinition, NoteEvent, PlacedChord, ProjectSettings, ScoredChord } from "../types";
import { getStylePalette } from "../theory/tonalAdapter";
import { scoreChordForSegment } from "./scoreChords";

function uniqueChords(chords: ChordDefinition[]): ChordDefinition[] {
  const seen = new Set<string>();
  return chords.filter((chord) => {
    const key = `${chord.symbol}-${chord.roman}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getChordAlternatives(
  melody: NoteEvent[],
  settings: ProjectSettings,
  placedChord: PlacedChord,
  limit = 6,
  candidate?: HarmonyCandidate,
): ScoredChord[] {
  // Alternatives are drawn from the same Task 7 vocabulary the generator uses —
  // diatonic triads + sevenths, secondary dominants, and borrowed chords — so a
  // swap stays in the key's chosen palette and its explanation reads consistently.
  const palette = uniqueChords([
    ...getStylePalette(settings.keyTonic, settings.mode, { extended: true }),
    ...getStylePalette(settings.keyTonic, settings.mode, { extended: true, sevenths: true }),
  ]);
  const segmentNotes = notesForPlacedChord(melody, placedChord);

  const step = candidate?.chords.findIndex((placed) => placed.id === placedChord.id) ?? 0;
  const profile = STYLE_PROFILES[candidate?.mode ?? "stable-classical"];
  const previous = candidate?.chords[step - 1]?.chord;
  const next = candidate?.chords[step + 1]?.chord;

  return palette
    .map((chord) => {
      const base = scoreChordForSegment(chord, segmentNotes, placedChord.startBeat);
      return { chord, ...base, score: base.score
        + positionScore(chord, step, candidate?.chords.length ?? 1, settings, profile)
        + (previous ? transitionScore(previous, chord, profile) : 0)
        + (next ? transitionScore(chord, next, profile) : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function makeReplacementPlacedChord(
  original: PlacedChord,
  scored: ScoredChord,
): PlacedChord {
  return {
    ...original,
    id: `${original.id}-replace-${scored.chord.id}`,
    chord: scored.chord,
    explanation: scored.explanation,
  };
}
