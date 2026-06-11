import type { Mode, PitchClass } from "../types";
import { normalizePitchClass, pitchClassToName } from "./pitches";

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const NATURAL_MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;

export function getScalePitchClasses(tonic: PitchClass, mode: Mode): PitchClass[] {
  const intervals = mode === "major" ? MAJOR_INTERVALS : NATURAL_MINOR_INTERVALS;
  return intervals.map((interval) => normalizePitchClass(tonic + interval));
}

export function getScaleDegree(
  pitchClass: PitchClass,
  tonic: PitchClass,
  mode: Mode,
): number | null {
  const scale = getScalePitchClasses(tonic, mode);
  const index = scale.indexOf(pitchClass);
  return index < 0 ? null : index + 1;
}

export function getKeyLabel(tonic: PitchClass, mode: Mode): string {
  return `${pitchClassToName(tonic)} ${mode}`;
}

