import type { NoteEvent } from "../types";
import { createNoteEventId, midiToNoteName, midiToPitchClass } from "../theory/pitches";

type DemoNoteSeed = {
  midi: number;
  startBeat: number;
  durationBeats: number;
};

function createDemoMelody(prefix: string, notes: DemoNoteSeed[]): NoteEvent[] {
  return notes.map((note, index) => ({
    id: createNoteEventId(prefix, index),
    midi: note.midi,
    pitchClass: midiToPitchClass(note.midi),
    name: midiToNoteName(note.midi),
    startBeat: note.startBeat,
    durationBeats: note.durationBeats,
    velocity: 0.82,
    source: "demo",
  }));
}

export const demoMelody: NoteEvent[] = createDemoMelody("demo", [
  { midi: 64, startBeat: 0, durationBeats: 1.5 },
  { midi: 67, startBeat: 2, durationBeats: 0.75 },
  { midi: 72, startBeat: 3, durationBeats: 2 },
  { midi: 71, startBeat: 6.25, durationBeats: 1.5 },
  { midi: 69, startBeat: 7.75, durationBeats: 1.5 },
]);

export const longDemoMelody: NoteEvent[] = createDemoMelody("long-demo", [
  { midi: 64, startBeat: 0, durationBeats: 1 },
  { midi: 67, startBeat: 1, durationBeats: 1 },
  { midi: 69, startBeat: 2, durationBeats: 1 },
  { midi: 72, startBeat: 3, durationBeats: 1.5 },
  { midi: 71, startBeat: 4.5, durationBeats: 0.5 },
  { midi: 69, startBeat: 5, durationBeats: 1 },
  { midi: 67, startBeat: 6, durationBeats: 2 },
  { midi: 65, startBeat: 8, durationBeats: 1 },
  { midi: 64, startBeat: 9, durationBeats: 1 },
  { midi: 62, startBeat: 10, durationBeats: 1 },
  { midi: 64, startBeat: 11, durationBeats: 1 },
  { midi: 67, startBeat: 12, durationBeats: 1.5 },
  { midi: 69, startBeat: 13.5, durationBeats: 0.5 },
  { midi: 71, startBeat: 14, durationBeats: 1 },
  { midi: 72, startBeat: 15, durationBeats: 1 },
  { midi: 72, startBeat: 16, durationBeats: 1 },
  { midi: 71, startBeat: 17, durationBeats: 1 },
  { midi: 69, startBeat: 18, durationBeats: 1 },
  { midi: 67, startBeat: 19, durationBeats: 1 },
  { midi: 65, startBeat: 20, durationBeats: 1.5 },
  { midi: 67, startBeat: 21.5, durationBeats: 0.5 },
  { midi: 69, startBeat: 22, durationBeats: 1 },
  { midi: 71, startBeat: 23, durationBeats: 1 },
  { midi: 72, startBeat: 24, durationBeats: 2 },
  { midi: 69, startBeat: 26, durationBeats: 1 },
  { midi: 67, startBeat: 27, durationBeats: 1 },
  { midi: 64, startBeat: 28, durationBeats: 1 },
  { midi: 65, startBeat: 29, durationBeats: 1 },
  { midi: 67, startBeat: 30, durationBeats: 2 },
  { midi: 69, startBeat: 32, durationBeats: 1 },
  { midi: 72, startBeat: 33, durationBeats: 1 },
  { midi: 71, startBeat: 34, durationBeats: 1 },
  { midi: 69, startBeat: 35, durationBeats: 1 },
  { midi: 67, startBeat: 36, durationBeats: 1.5 },
  { midi: 64, startBeat: 37.5, durationBeats: 0.5 },
  { midi: 62, startBeat: 38, durationBeats: 1 },
  { midi: 64, startBeat: 39, durationBeats: 1 },
  { midi: 65, startBeat: 40, durationBeats: 1 },
  { midi: 67, startBeat: 41, durationBeats: 1 },
  { midi: 69, startBeat: 42, durationBeats: 1 },
  { midi: 71, startBeat: 43, durationBeats: 1 },
  { midi: 72, startBeat: 44, durationBeats: 1 },
  { midi: 69, startBeat: 45, durationBeats: 1 },
  { midi: 67, startBeat: 46, durationBeats: 2 },
]);
