import type {
  AppState,
  HarmonyCandidate,
  InputMode,
  NoteEvent,
  PitchClass,
  ProjectSettings,
} from "../music/types";
import { defaultPreferences } from "./preferencesRepository";

export type AppAction =
  | { type: "set-key"; keyTonic: PitchClass }
  | { type: "set-mode"; mode: ProjectSettings["mode"] }
  | { type: "set-tempo"; tempo: number }
  | { type: "set-density"; harmonyDensity: ProjectSettings["harmonyDensity"] }
  | { type: "set-input-mode"; inputMode: InputMode }
  | { type: "add-note"; note: NoteEvent }
  | { type: "load-melody"; melody: NoteEvent[] }
  | { type: "undo-note" }
  | { type: "clear-melody" }
  | { type: "set-candidates"; candidates: HarmonyCandidate[] }
  | { type: "select-candidate"; candidateId: string }
  | { type: "select-chord"; chordId: string };

export function createInitialState(settings = defaultPreferences): AppState {
  return {
    settings,
    melody: [],
    candidates: [],
    selectedCandidateId: null,
    selectedChordId: null,
    playback: {
      status: "stopped",
      currentBeat: 0,
    },
    importState: {
      status: "idle",
      fileName: null,
      selectedTrackIndex: null,
    },
    errors: [],
  };
}

function resetGenerated(state: AppState): AppState {
  return {
    ...state,
    candidates: [],
    selectedCandidateId: null,
    selectedChordId: null,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-key":
      return resetGenerated({
        ...state,
        settings: { ...state.settings, keyTonic: action.keyTonic },
      });
    case "set-mode":
      return resetGenerated({
        ...state,
        settings: { ...state.settings, mode: action.mode },
      });
    case "set-tempo":
      return {
        ...state,
        settings: { ...state.settings, tempo: Math.min(220, Math.max(40, action.tempo)) },
      };
    case "set-density":
      return resetGenerated({
        ...state,
        settings: { ...state.settings, harmonyDensity: action.harmonyDensity },
      });
    case "set-input-mode":
      return {
        ...state,
        settings: { ...state.settings, inputMode: action.inputMode },
      };
    case "add-note":
      return resetGenerated({
        ...state,
        melody: [...state.melody, action.note],
      });
    case "load-melody":
      return resetGenerated({
        ...state,
        melody: action.melody,
      });
    case "undo-note":
      return resetGenerated({
        ...state,
        melody: state.melody.slice(0, -1),
      });
    case "clear-melody":
      return resetGenerated({
        ...state,
        melody: [],
      });
    case "set-candidates": {
      const firstCandidate = action.candidates[0] ?? null;
      const firstChord = firstCandidate?.chords[0] ?? null;
      return {
        ...state,
        candidates: action.candidates,
        selectedCandidateId: firstCandidate?.id ?? null,
        selectedChordId: firstChord?.id ?? null,
      };
    }
    case "select-candidate": {
      const candidate = state.candidates.find((item) => item.id === action.candidateId);
      return {
        ...state,
        selectedCandidateId: action.candidateId,
        selectedChordId: candidate?.chords[0]?.id ?? null,
      };
    }
    case "select-chord":
      return {
        ...state,
        selectedChordId: action.chordId,
      };
  }
}

