import type { ChordDefinition, NoteEvent, PlacedChord, ProjectSettings, ScoredChord } from "../types";
import { getColorChords, getMajorDiatonicChords, getPopLoopChords } from "../theory/chords";
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
  const palette = uniqueChords([
    ...getMajorDiatonicChords(settings.keyTonic),
    ...getPopLoopChords(settings.keyTonic),
    ...getColorChords(settings.keyTonic),
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
