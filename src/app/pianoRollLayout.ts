// Pure piano-roll / timeline layout helpers and constants extracted from App.tsx
// (TASK6 §T6.5 component split). These carry no React state — they map musical
// data to grid coordinates — so they live apart from the App component and stay
// unit-testable in isolation.
import { getHarmonyVoiceRows, makeDisplayVoicing } from "../music/harmony/displayVoicing";
import { beatRangeToGridColumn } from "./timelineGrid";
import {
  createNoteEventId,
  midiToNoteName,
  midiToPitchClass,
} from "../music/theory/pitches";
import type { HarmonyCandidate, NoteEvent, PlacedChord } from "../music/types";

// Three+ chromatic octaves (C2–C7) so the melody roll behaves like an FL Studio
// piano roll: 12 semitone rows per octave, black keys distinguished from white.
export const LOWEST_PITCH_MIDI = 36; // C2
export const HIGHEST_PITCH_MIDI = 96; // C7 — a DAW-scale range so the roll always scrolls vertically
export const PITCH_ROW_HEIGHT = 22;
const BLACK_KEY_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export type PitchRow = {
  label: string;
  midi: number;
  isBlack: boolean;
};

function buildPitchRows(): PitchRow[] {
  const rows: PitchRow[] = [];
  for (let midi = HIGHEST_PITCH_MIDI; midi >= LOWEST_PITCH_MIDI; midi -= 1) {
    rows.push({
      label: midiToNoteName(midi),
      midi,
      isBlack: BLACK_KEY_PITCH_CLASSES.has(midiToPitchClass(midi)),
    });
  }
  return rows;
}

export const PITCH_ROWS: PitchRow[] = buildPitchRows();

export const HARMONY_VOICE_ROWS = getHarmonyVoiceRows();

export function createManualGridNote(
  midi: number,
  startBeat: number,
  durationBeats: number,
  melody: NoteEvent[],
): NoteEvent {
  return {
    id: `${createNoteEventId("manual", melody.length)}-${Math.round(startBeat * 100)}-${midi}`,
    midi,
    pitchClass: midiToPitchClass(midi),
    name: midiToNoteName(midi),
    startBeat,
    durationBeats,
    velocity: 0.8,
    source: "manual",
  };
}

export function noteGridColumn(note: NoteEvent): string {
  return beatRangeToGridColumn(note.startBeat, note.durationBeats);
}

export function placedChordGridColumn(placedChord: PlacedChord): string {
  return beatRangeToGridColumn(placedChord.startBeat, placedChord.durationBeats);
}

export function harmonyVoiceGridRow(voice: (typeof HARMONY_VOICE_ROWS)[number]): number {
  return HARMONY_VOICE_ROWS.indexOf(voice) + 1;
}

function pitchRowIndexForMidi(midi: number): number {
  return PITCH_ROWS.reduce(
    (bestIndex, row, index) =>
      Math.abs(row.midi - midi) < Math.abs(PITCH_ROWS[bestIndex].midi - midi)
        ? index
        : bestIndex,
    0,
  );
}

export function pitchRowIndex(midi: number): number {
  return pitchRowIndexForMidi(midi);
}

export function noteGridRow(note: NoteEvent): number {
  return pitchRowIndexForMidi(note.midi) + 1;
}

export function midiForDraggedPitch(
  originalMidi: number,
  deltaY: number,
  rowHeight: number,
): number {
  const originalIndex = pitchRowIndexForMidi(originalMidi);
  const rowDelta = Math.round(deltaY / rowHeight);
  const nextIndex = Math.max(0, Math.min(PITCH_ROWS.length - 1, originalIndex + rowDelta));
  return PITCH_ROWS[nextIndex].midi;
}

export function updateNoteTiming(
  note: NoteEvent,
  startBeat: number,
  durationBeats: number,
): NoteEvent {
  return {
    ...note,
    startBeat,
    durationBeats,
  };
}

export function updateNotePitch(note: NoteEvent, midi: number): NoteEvent {
  return {
    ...note,
    midi,
    pitchClass: midiToPitchClass(midi),
    name: midiToNoteName(midi),
  };
}

export function selectedCandidateFrom(
  candidates: HarmonyCandidate[],
  selectedCandidateId: string | null,
): HarmonyCandidate | null {
  return candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0] ?? null;
}

export function selectedChordFrom(
  candidate: HarmonyCandidate | null,
  selectedChordId: string | null,
): PlacedChord | null {
  return candidate?.chords.find((chord) => chord.id === selectedChordId) ?? candidate?.chords[0] ?? null;
}

export function candidateProgression(candidate: HarmonyCandidate): string {
  return candidate.chords.map((placedChord) => placedChord.chord.symbol).join(" / ");
}

export { makeDisplayVoicing };
