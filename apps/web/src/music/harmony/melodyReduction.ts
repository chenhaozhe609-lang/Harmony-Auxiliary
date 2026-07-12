import type { ChordDefinition, NoteEvent } from "../types";

export type NonChordToneKind = "passing" | "neighbor";

export type MelodyReductionInfo = {
  kind: NonChordToneKind;
  reason: string;
};

function isWeakBeat(note: NoteEvent, segmentStartBeat: number): boolean {
  const relativeStart = note.startBeat - segmentStartBeat;
  return Math.abs(relativeStart % 2) > 0.001;
}

function directedStep(from: NoteEvent, to: NoteEvent): number {
  return to.midi - from.midi;
}

function isStep(value: number): boolean {
  return Math.abs(value) === 1 || Math.abs(value) === 2;
}

function isChordTone(note: NoteEvent, chord: ChordDefinition): boolean {
  return chord.tones.includes(note.pitchClass);
}

export function identifyNonChordTone(
  note: NoteEvent,
  noteIndex: number,
  notes: NoteEvent[],
  chord: ChordDefinition,
  segmentStartBeat: number,
): MelodyReductionInfo | null {
  if (!isWeakBeat(note, segmentStartBeat) || note.durationBeats > 1) return null;

  const previous = notes[noteIndex - 1];
  const next = notes[noteIndex + 1];
  if (!previous || !next || !isChordTone(previous, chord) || !isChordTone(next, chord)) return null;

  const inStep = directedStep(previous, note);
  const outStep = directedStep(note, next);
  if (!isStep(inStep) || !isStep(outStep)) return null;

  if (Math.sign(inStep) === Math.sign(outStep)) {
    return {
      kind: "passing",
      reason: `${note.name} is treated as a weak-beat passing tone between chord tones.`,
    };
  }

  if (previous.pitchClass === next.pitchClass) {
    return {
      kind: "neighbor",
      reason: `${note.name} is treated as a weak-beat neighbor tone around a chord tone.`,
    };
  }

  return null;
}
