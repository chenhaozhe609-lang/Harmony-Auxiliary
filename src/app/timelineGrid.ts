import type { HarmonyCandidate, NoteEvent } from "../music/types";

export const TIMELINE_LABEL_WIDTH = 68;
export const TIMELINE_SUBDIVISIONS_PER_BEAT = 2;
export const TIMELINE_SUBDIVISION_WIDTH = 44;
export const MIN_TIMELINE_MEASURES = 4;
export const MIN_NOTE_DURATION_BEATS = 1 / TIMELINE_SUBDIVISIONS_PER_BEAT;

export type TimelineGridMetrics = {
  beatsPerMeasure: number;
  measureCount: number;
  totalBeats: number;
  columnCount: number;
  contentWidth: number;
  labelWidth: number;
  subdivisionWidth: number;
  beatWidth: number;
  measureWidth: number;
};

function melodyEndBeat(melody: NoteEvent[]): number {
  return melody.reduce(
    (endBeat, note) => Math.max(endBeat, note.startBeat + note.durationBeats),
    0,
  );
}

function harmonyEndBeat(candidate: HarmonyCandidate | null): number {
  return (
    candidate?.chords.reduce(
      (endBeat, placedChord) =>
        Math.max(endBeat, placedChord.startBeat + placedChord.durationBeats),
      0,
    ) ?? 0
  );
}

export function getTimelineEndBeat(
  melody: NoteEvent[],
  candidate: HarmonyCandidate | null,
): number {
  return Math.max(1, melodyEndBeat(melody), harmonyEndBeat(candidate));
}

export function createTimelineGridMetrics(
  endBeat: number,
  beatsPerMeasure: number,
): TimelineGridMetrics {
  const safeBeatsPerMeasure = Math.max(1, beatsPerMeasure);
  const measureCount = Math.max(
    MIN_TIMELINE_MEASURES,
    Math.ceil(Math.max(1, endBeat) / safeBeatsPerMeasure),
  );
  const totalBeats = measureCount * safeBeatsPerMeasure;
  const columnCount = totalBeats * TIMELINE_SUBDIVISIONS_PER_BEAT;
  const beatWidth = TIMELINE_SUBDIVISION_WIDTH * TIMELINE_SUBDIVISIONS_PER_BEAT;
  const measureWidth = beatWidth * safeBeatsPerMeasure;

  return {
    beatsPerMeasure: safeBeatsPerMeasure,
    measureCount,
    totalBeats,
    columnCount,
    contentWidth: TIMELINE_LABEL_WIDTH + columnCount * TIMELINE_SUBDIVISION_WIDTH,
    labelWidth: TIMELINE_LABEL_WIDTH,
    subdivisionWidth: TIMELINE_SUBDIVISION_WIDTH,
    beatWidth,
    measureWidth,
  };
}

export function beatToGridColumn(beat: number): number {
  return Math.max(2, Math.round(beat * TIMELINE_SUBDIVISIONS_PER_BEAT) + 2);
}

export function durationToGridSpan(durationBeats: number): number {
  return Math.max(1, Math.round(durationBeats * TIMELINE_SUBDIVISIONS_PER_BEAT));
}

export function beatRangeToGridColumn(startBeat: number, durationBeats: number): string {
  return `${beatToGridColumn(startBeat)} / span ${durationToGridSpan(durationBeats)}`;
}

export function beatToPixel(beat: number, metrics: TimelineGridMetrics): number {
  const clampedBeat = Math.max(0, Math.min(metrics.totalBeats, beat));
  return metrics.labelWidth + clampedBeat * metrics.beatWidth;
}

export function pixelToSnappedBeat(pixel: number, metrics: TimelineGridMetrics): number {
  const rawBeat = pixel / metrics.beatWidth;
  const snappedSubdivisions = Math.round(rawBeat * TIMELINE_SUBDIVISIONS_PER_BEAT);
  const snappedBeat = snappedSubdivisions / TIMELINE_SUBDIVISIONS_PER_BEAT;
  return Math.max(0, Math.min(metrics.totalBeats, snappedBeat));
}

export function pixelDeltaToSnappedBeats(
  pixelDelta: number,
  metrics: TimelineGridMetrics,
): number {
  const rawBeatDelta = pixelDelta / metrics.beatWidth;
  const snappedSubdivisions = Math.round(rawBeatDelta * TIMELINE_SUBDIVISIONS_PER_BEAT);
  return snappedSubdivisions / TIMELINE_SUBDIVISIONS_PER_BEAT;
}
