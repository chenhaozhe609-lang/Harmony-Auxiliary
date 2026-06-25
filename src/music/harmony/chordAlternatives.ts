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

function notesForPlacedChord(melody: NoteEvent[], placedChord: PlacedChord): NoteEvent[] {
  const endBeat = placedChord.startBeat + placedChord.durationBeats;
  return melody.filter(
    (note) => note.startBeat < endBeat && note.startBeat + note.durationBeats > placedChord.startBeat,
  );
}

export function getChordAlternatives(
  melody: NoteEvent[],
  settings: ProjectSettings,
  placedChord: PlacedChord,
  limit = 6,
): ScoredChord[] {
  // Alternatives are drawn from the same Task 7 vocabulary the generator uses —
  // diatonic triads + sevenths, secondary dominants, and borrowed chords — so a
  // swap stays in the key's chosen palette and its explanation reads consistently.
  const palette = uniqueChords([
    ...getStylePalette(settings.keyTonic, settings.mode, { extended: true }),
    ...getStylePalette(settings.keyTonic, settings.mode, { extended: true, sevenths: true }),
  ]);
  const segmentNotes = notesForPlacedChord(melody, placedChord);

  return palette
    .map((chord) => ({
      chord,
      ...scoreChordForSegment(chord, segmentNotes, placedChord.startBeat),
    }))
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
