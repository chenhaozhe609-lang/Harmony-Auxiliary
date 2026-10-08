import type { ProjectSettings, NoteEvent, HarmonyCandidate, HarmonyStatus } from "../music/types";

export type StoredProjectSnapshot = {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  melody: NoteEvent[];
  candidates: HarmonyCandidate[];
  selectedCandidateId: string | null;
  selectedChordId: string | null;
  harmonyStatus?: HarmonyStatus;
  sourceImport?: {
    fileName: string;
    fileSize: number;
    lastModified: number;
    selectedTrackIndex: number | null;
    storedBlobId?: string;
  };
};
