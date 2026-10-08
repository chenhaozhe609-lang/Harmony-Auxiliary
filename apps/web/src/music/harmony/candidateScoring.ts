import type { ChordDefinition, HarmonyCandidate, NoteEvent, PlacedChord, ProjectSettings } from "../types";
import { scoreChordForSegment } from "./scoreChords";
import { STYLE_PROFILES, cadenceEmission, colorEmission, describeMotion, loopAnchorEmission, transitionScore, type StyleProfile } from "./transitions";

export function positionScore(chord: ChordDefinition, step: number, count: number, settings: ProjectSettings, profile: StyleProfile): number {
  return cadenceEmission(step, count, chord, settings.keyTonic, profile)
    + colorEmission(chord, profile)
    + loopAnchorEmission(chord, settings.keyTonic, settings.mode, profile);
}

export function notesForPlacedChord(melody: NoteEvent[], placed: PlacedChord): NoteEvent[] {
  return melody.filter((note) => note.startBeat < placed.startBeat + placed.durationBeats
    && note.startBeat + note.durationBeats > placed.startBeat);
}

/** Rebuild all context explanations and the score of the actual voiced path. */
export function rescoreCandidate(candidate: HarmonyCandidate, melody: NoteEvent[], settings: ProjectSettings): HarmonyCandidate {
  const profile = STYLE_PROFILES[candidate.mode];
  let score = 0;
  const chords = candidate.chords.map((placed, step, path) => {
    const base = scoreChordForSegment(placed.chord, notesForPlacedChord(melody, placed), placed.startBeat);
    const previous = path[step - 1]?.chord ?? null;
    score += base.score + positionScore(placed.chord, step, path.length, settings, profile)
      + (previous ? transitionScore(previous, placed.chord, profile) : 0);
    const { reason, motion } = describeMotion(previous, placed.chord, step, path.length);
    return { ...placed, explanation: {
      ...base.explanation,
      functionReason: `${base.explanation.functionReason} ${reason}`,
      functionInfo: { functionLabel: placed.chord.functionLabel, motion },
    } };
  });
  return { ...candidate, chords, score };
}
