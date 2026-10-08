import type { ProjectSettings, NoteEvent, HarmonyCandidate, HarmonyStatus, MidiTrackSummary } from "../music/types";

export type PlaybackState = {
  status: "stopped" | "starting" | "playing" | "paused";
  currentBeat: number;
  melodyMuted: boolean;
  harmonyMuted: boolean;
};

export type MidiImportState = {
  status: "idle" | "ready" | "error";
  fileName: string | null;
  selectedTrackIndex: number | null;
  fileSize?: number;
  lastModified?: number;
  tracks?: MidiTrackSummary[];
};

export type AppError = {
  id: string;
  message: string;
  tone?: "error" | "status";
};

export type AppState = {
  settings: ProjectSettings;
  melody: NoteEvent[];
  candidates: HarmonyCandidate[];
  selectedCandidateId: string | null;
  selectedChordId: string | null;
  harmonyStatus: HarmonyStatus;
  playback: PlaybackState;
  importState: MidiImportState;
  errors: AppError[];
};
