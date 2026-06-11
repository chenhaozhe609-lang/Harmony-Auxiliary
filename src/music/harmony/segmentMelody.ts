import type { HarmonyDensity, HarmonySegment, NoteEvent } from "../types";

export function getSegmentDurationBeats(
  density: HarmonyDensity,
  timeSignatureNumerator: number,
): number {
  return density === "bar" ? timeSignatureNumerator : timeSignatureNumerator / 2;
}

export function segmentMelody(
  notes: NoteEvent[],
  density: HarmonyDensity,
  timeSignatureNumerator: number,
): HarmonySegment[] {
  if (notes.length === 0) return [];

  const segmentDuration = getSegmentDurationBeats(density, timeSignatureNumerator);
  const endBeat = Math.max(...notes.map((note) => note.startBeat + note.durationBeats));
  const count = Math.max(1, Math.ceil(endBeat / segmentDuration));

  return Array.from({ length: count }, (_, index) => {
    const startBeat = index * segmentDuration;
    const segmentEnd = startBeat + segmentDuration;
    const melodyNotes = notes.filter(
      (note) => note.startBeat < segmentEnd && note.startBeat + note.durationBeats > startBeat,
    );

    return {
      id: `segment-${index + 1}`,
      startBeat,
      durationBeats: segmentDuration,
      melodyNotes,
      candidateChords: [],
    };
  });
}

