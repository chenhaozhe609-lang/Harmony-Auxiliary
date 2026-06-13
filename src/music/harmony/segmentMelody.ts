import type { HarmonyDensity, HarmonyRhythmPattern, HarmonySegment, NoteEvent } from "../types";

export function getSegmentDurationBeats(
  density: HarmonyDensity,
  timeSignatureNumerator: number,
): number {
  return density === "bar" ? timeSignatureNumerator : timeSignatureNumerator / 2;
}

export function legacyDensityToRhythm(density: HarmonyDensity): HarmonyRhythmPattern {
  return density === "half-bar" ? "strong-beats" : "bar";
}

function getStrongBeatOffsets(timeSignatureNumerator: number): number[] {
  if (timeSignatureNumerator <= 2) return [0];
  if (timeSignatureNumerator === 3) return [0, 2];
  return [0, timeSignatureNumerator / 2];
}

function makeBoundaries(
  rhythm: HarmonyRhythmPattern,
  endBeat: number,
  timeSignatureNumerator: number,
): number[] {
  const beatsPerMeasure = Math.max(1, timeSignatureNumerator);
  const measureCount = Math.max(1, Math.ceil(endBeat / beatsPerMeasure));

  if (rhythm === "every-beat") {
    return Array.from({ length: Math.ceil(endBeat) + 1 }, (_, index) => index);
  }

  if (rhythm === "sparse") {
    const duration = beatsPerMeasure * 2;
    const count = Math.max(1, Math.ceil(endBeat / duration));
    return Array.from({ length: count + 1 }, (_, index) => index * duration);
  }

  if (rhythm === "strong-beats") {
    const offsets = getStrongBeatOffsets(beatsPerMeasure);
    return Array.from({ length: measureCount }, (_, measureIndex) =>
      offsets.map((offset) => measureIndex * beatsPerMeasure + offset),
    ).flat();
  }

  if (rhythm === "cadence-aware") {
    const boundaries: number[] = [];
    for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
      const measureStart = measureIndex * beatsPerMeasure;
      boundaries.push(measureStart);
      if (measureIndex === measureCount - 1 && beatsPerMeasure >= 3) {
        const remainingBeats = endBeat - measureStart;
        if (remainingBeats > 1) {
          boundaries.push(
            measureStart + Math.max(1, Math.min(beatsPerMeasure / 2, remainingBeats / 2)),
          );
        }
      }
    }
    return boundaries;
  }

  return Array.from({ length: measureCount }, (_, index) => index * beatsPerMeasure);
}

export function segmentMelody(
  notes: NoteEvent[],
  rhythm: HarmonyRhythmPattern,
  timeSignatureNumerator: number,
): HarmonySegment[] {
  if (notes.length === 0) return [];

  const endBeat = Math.max(...notes.map((note) => note.startBeat + note.durationBeats));
  const starts = Array.from(
    new Set(makeBoundaries(rhythm, endBeat, timeSignatureNumerator).filter((beat) => beat < endBeat)),
  ).sort((a, b) => a - b);

  return starts.map((startBeat, index) => {
    const segmentEnd = starts[index + 1] ?? endBeat;
    const durationBeats = Math.max(0.5, segmentEnd - startBeat);
    const melodyNotes = notes.filter(
      (note) => note.startBeat < segmentEnd && note.startBeat + note.durationBeats > startBeat,
    );

    return {
      id: `segment-${index + 1}`,
      startBeat,
      durationBeats,
      melodyNotes,
      candidateChords: [],
    };
  });
}
