import type {
  AppState,
  HarmonyCandidate,
  InputMode,
  MidiImportState,
  NoteEvent,
  PitchClass,
  ProjectSettings,
  StoredProjectSnapshot,
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
  | {
      type: "set-midi-import";
      importState: MidiImportState;
      melody: NoteEvent[];
      settings?: Partial<ProjectSettings>;
    }
  | { type: "set-candidates"; candidates: HarmonyCandidate[] }
  | { type: "select-candidate"; candidateId: string }
  | { type: "select-chord"; chordId: string }
  | {
      type: "replace-chord";
      candidateId: string;
      chordId: string;
      replacement: HarmonyCandidate["chords"][number];
    }
  | { type: "set-playback-status"; status: AppState["playback"]["status"] }
  | { type: "set-current-beat"; currentBeat: number }
  | { type: "toggle-melody-muted" }
  | { type: "toggle-harmony-muted" }
  | { type: "reset-playback" }
  | { type: "restore-snapshot"; snapshot: StoredProjectSnapshot }
  | { type: "reset-app"; settings: ProjectSettings }
  | { type: "set-error"; id: string; message: string; tone?: "error" | "status" }
  | { type: "clear-error"; id: string }
  | { type: "set-import-error"; message: string };

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
      melodyMuted: false,
      harmonyMuted: false,
    },
    importState: {
      status: "idle",
      fileName: null,
      selectedTrackIndex: null,
    },
    errors: [],
  };
}

function createIdleImportState(): MidiImportState {
  return {
    status: "idle",
    fileName: null,
    selectedTrackIndex: null,
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
        importState: createIdleImportState(),
      });
    case "load-melody":
      return resetGenerated({
        ...state,
        melody: action.melody,
        importState: createIdleImportState(),
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
        importState: createIdleImportState(),
      });
    case "set-midi-import":
      return resetGenerated({
        ...state,
        settings: {
          ...state.settings,
          ...action.settings,
        },
        melody: action.melody,
        importState: action.importState,
        errors: [],
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
    case "replace-chord":
      return {
        ...state,
        candidates: state.candidates.map((candidate) =>
          candidate.id === action.candidateId
            ? {
                ...candidate,
                chords: candidate.chords.map((placedChord) =>
                  placedChord.id === action.chordId ? action.replacement : placedChord,
                ),
              }
            : candidate,
        ),
        selectedCandidateId: action.candidateId,
        selectedChordId: action.replacement.id,
      };
    case "set-playback-status":
      return {
        ...state,
        playback: {
          ...state.playback,
          status: action.status,
        },
      };
    case "set-current-beat":
      return {
        ...state,
        playback: {
          ...state.playback,
          currentBeat: Math.max(0, action.currentBeat),
        },
      };
    case "toggle-melody-muted":
      return {
        ...state,
        playback: {
          ...state.playback,
          melodyMuted: !state.playback.melodyMuted,
        },
      };
    case "toggle-harmony-muted":
      return {
        ...state,
        playback: {
          ...state.playback,
          harmonyMuted: !state.playback.harmonyMuted,
        },
      };
    case "reset-playback":
      return {
        ...state,
        playback: {
          ...state.playback,
          status: "stopped",
          currentBeat: 0,
        },
      };
    case "restore-snapshot":
      return {
        ...state,
        settings: action.snapshot.settings,
        melody: action.snapshot.melody,
        candidates: action.snapshot.candidates,
        selectedCandidateId: action.snapshot.selectedCandidateId,
        selectedChordId: action.snapshot.selectedChordId,
        importState: action.snapshot.sourceImport
          ? {
              status: "ready",
              fileName: action.snapshot.sourceImport.fileName,
              selectedTrackIndex: action.snapshot.sourceImport.selectedTrackIndex,
              fileSize: action.snapshot.sourceImport.fileSize,
              lastModified: action.snapshot.sourceImport.lastModified,
            }
          : createIdleImportState(),
        playback: {
          ...state.playback,
          status: "stopped",
          currentBeat: 0,
        },
        errors: [],
      };
    case "reset-app":
      return createInitialState(action.settings);
    case "set-error":
      return {
        ...state,
        errors: [
          ...state.errors.filter((error) => error.id !== action.id),
          { id: action.id, message: action.message, tone: action.tone ?? "error" },
        ],
      };
    case "clear-error":
      return {
        ...state,
        errors: state.errors.filter((error) => error.id !== action.id),
      };
    case "set-import-error":
      return {
        ...state,
        importState: {
          ...state.importState,
          status: "error",
        },
        errors: [
          ...state.errors.filter((error) => error.id !== "import"),
          { id: "import", message: action.message },
        ],
      };
  }
}
