import type {
  ChordDefinition,
  ChordExplanation,
  ChordToneRole,
  FitInfo,
  MelodyRelationship,
  NoteEvent,
} from "../types";
import { relationshipToChordTone } from "../theory/chords";

function noteWeight(note: NoteEvent, segmentStartBeat: number): number {
  const relativeStart = note.startBeat - segmentStartBeat;
  const strongBeatBonus = Math.abs(relativeStart % 2) < 0.001 ? 1.6 : 1;
  return Math.max(0.5, note.durationBeats) * strongBeatBonus;
}

function functionReason(chord: ChordDefinition): string {
  switch (chord.functionLabel) {
    case "T":
      return `${chord.symbol} works as a tonic or tonic-substitute sonority.`;
    case "PD":
      return `${chord.symbol} prepares dominant motion without sounding final.`;
    case "D":
      return `${chord.symbol} adds dominant pull toward tonic.`;
    case "Color":
      return `${chord.symbol} is a color choice rather than a strict diatonic function.`;
  }
}

export function scoreChordForSegment(
  chord: ChordDefinition,
  notes: NoteEvent[],
  segmentStartBeat: number,
): { score: number; explanation: ChordExplanation } {
  if (notes.length === 0) {
    return {
      score: chord.functionLabel === "T" ? 1 : 0.6,
      explanation: {
        fitReason: "No melody notes occur in this segment, so the chord is judged by harmonic role.",
        functionReason: functionReason(chord),
        melodyRelationships: [],
        warnings: [],
        fit: { kind: "no-notes" },
        functionInfo: { functionLabel: chord.functionLabel },
        warningNotes: [],
      },
    };
  }

  let score = 0;
  const relationships: MelodyRelationship[] = [];
  const warnings: string[] = [];
  const warningNotes: string[] = [];

  for (const note of notes) {
    const relationship = relationshipToChordTone(note.pitchClass, chord);
    const weight = noteWeight(note, segmentStartBeat);

    relationships.push({
      noteId: note.id,
      noteName: note.name,
      relationship,
      weight,
    });

    if (relationship === "root") score += 2.1 * weight;
    else if (relationship === "third") score += 2.4 * weight;
    else if (relationship === "fifth") score += 1.8 * weight;
    else if (relationship === "seventh") score += 1.5 * weight;
    else if (relationship === "extension") score += 1.2 * weight;
    else {
      score -= 1.1 * weight;
      if (note.durationBeats >= 1) {
        warnings.push(`${note.name} is a sustained non-chord tone against ${chord.symbol}.`);
        warningNotes.push(note.name);
      }
    }
  }

  const bestRelationship =
    relationships
      .filter((relationship) => relationship.relationship !== "non-chord tone")
      .sort((a, b) => b.weight - a.weight)[0] ?? relationships[0];

  const fit: FitInfo =
    bestRelationship.relationship === "non-chord tone"
      ? { kind: "non-chord", noteName: bestRelationship.noteName }
      : {
          kind: "chord-tone",
          noteName: bestRelationship.noteName,
          role: bestRelationship.relationship as ChordToneRole,
        };

  return {
    score,
    explanation: {
      fitReason:
        bestRelationship.relationship === "non-chord tone"
          ? `${bestRelationship.noteName} is outside ${chord.symbol}, so this choice needs contextual support.`
          : `${bestRelationship.noteName} is the ${bestRelationship.relationship} of ${chord.symbol}, giving the segment a clear fit.`,
      functionReason: functionReason(chord),
      melodyRelationships: relationships,
      warnings,
      fit,
      functionInfo: { functionLabel: chord.functionLabel },
      warningNotes,
    },
  };
}

