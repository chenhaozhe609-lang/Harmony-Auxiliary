import type { Language } from "./i18n";
import type {
  HarmonyDensity,
  HarmonyRhythmPattern,
  InputMode,
  Mode,
  PlaybackTonePreset,
  PitchClass,
  ProjectSettings,
} from "../music/types";
import { legacyDensityToRhythm } from "../music/harmony/segmentMelody";

const STORAGE_KEY = "harmony-auxiliary/preferences/v1";

export type StoredPreferences = {
  keyTonic: PitchClass;
  mode: Mode;
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  harmonyRhythm: HarmonyRhythmPattern;
  harmonyDensity?: HarmonyDensity;
  inputMode: InputMode;
  playbackTone: PlaybackTonePreset;
  language: Language;
};

export const defaultPreferences: StoredPreferences = {
  keyTonic: 0,
  mode: "major",
  tempo: 92,
  timeSignature: {
    numerator: 4,
    denominator: 4,
  },
  harmonyRhythm: "bar",
  harmonyDensity: "bar",
  inputMode: "midi",
  playbackTone: "acoustic-grand",
  language: "zh",
};

function isPitchClass(value: unknown): value is PitchClass {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 11;
}

function isHarmonyRhythm(value: unknown): value is HarmonyRhythmPattern {
  return (
    value === "bar" ||
    value === "strong-beats" ||
    value === "every-beat" ||
    value === "cadence-aware" ||
    value === "sparse"
  );
}

function isPlaybackTone(value: unknown): value is PlaybackTonePreset {
  return (
    value === "acoustic-grand" ||
    value === "mellow-keys" ||
    value === "acoustic-piano" ||
    value === "electric-piano" ||
    value === "nylon-guitar" ||
    value === "warm-organ" ||
    value === "soft-pluck" ||
    value === "glass-bell"
  );
}

export function loadPreferences(): StoredPreferences {
  if (typeof window === "undefined") return defaultPreferences;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;

    const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
    const legacyDensity = parsed.harmonyDensity === "half-bar" ? "half-bar" : "bar";
    return {
      keyTonic: isPitchClass(parsed.keyTonic) ? parsed.keyTonic : defaultPreferences.keyTonic,
      mode: parsed.mode === "minor" ? "minor" : "major",
      tempo:
        typeof parsed.tempo === "number" && parsed.tempo >= 40 && parsed.tempo <= 220
          ? parsed.tempo
          : defaultPreferences.tempo,
      timeSignature:
        parsed.timeSignature?.numerator === 3
          ? { numerator: 3, denominator: 4 }
          : defaultPreferences.timeSignature,
      harmonyRhythm: isHarmonyRhythm(parsed.harmonyRhythm)
        ? parsed.harmonyRhythm
        : legacyDensityToRhythm(legacyDensity),
      harmonyDensity: legacyDensity,
      inputMode: parsed.inputMode === "manual" ? "manual" : "midi",
      playbackTone: isPlaybackTone(parsed.playbackTone)
        ? parsed.playbackTone
        : defaultPreferences.playbackTone,
      language: parsed.language === "en" ? "en" : "zh",
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(settings: ProjectSettings, language = defaultPreferences.language): void {
  if (typeof window === "undefined") return;

  const preferences: StoredPreferences = {
    keyTonic: settings.keyTonic,
    mode: settings.mode,
    tempo: settings.tempo,
    timeSignature: settings.timeSignature,
    harmonyRhythm: settings.harmonyRhythm,
    harmonyDensity: settings.harmonyRhythm === "strong-beats" ? "half-bar" : "bar",
    inputMode: settings.inputMode,
    playbackTone: settings.playbackTone,
    language,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function clearPreferences(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
