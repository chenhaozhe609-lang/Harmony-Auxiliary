import type { Language } from "./i18n";
import type { HarmonyDensity, InputMode, Mode, PitchClass, ProjectSettings } from "../music/types";

const STORAGE_KEY = "harmony-auxiliary/preferences/v1";

export type StoredPreferences = {
  keyTonic: PitchClass;
  mode: Mode;
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  harmonyDensity: HarmonyDensity;
  inputMode: InputMode;
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
  harmonyDensity: "bar",
  inputMode: "midi",
  language: "zh",
};

function isPitchClass(value: unknown): value is PitchClass {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 11;
}

export function loadPreferences(): StoredPreferences {
  if (typeof window === "undefined") return defaultPreferences;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;

    const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
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
      harmonyDensity:
        parsed.harmonyDensity === "half-bar" ? "half-bar" : defaultPreferences.harmonyDensity,
      inputMode: parsed.inputMode === "manual" ? "manual" : "midi",
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
    harmonyDensity: settings.harmonyDensity,
    inputMode: settings.inputMode,
    language,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function clearPreferences(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
