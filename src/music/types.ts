export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type Mode = "major" | "minor";

export type HarmonyDensity = "bar" | "half-bar";

export type InputMode = "midi" | "manual";

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "dominant7"
  | "major7"
  | "minor7"
  | "major9"
  | "minor9";

export type FunctionLabel = "T" | "PD" | "D" | "Color";

export type CandidateMode = "stable-classical" | "pop-songwriting" | "color-tension";

export type NoteSource = "midi" | "manual" | "generated" | "demo";

export type NoteEvent = {
  id: string;
  midi: number;
  pitchClass: PitchClass;
  name: string;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  source: NoteSource;
};

export type ProjectSettings = {
  keyTonic: PitchClass;
  mode: Mode;
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  harmonyDensity: HarmonyDensity;
  inputMode: InputMode;
};

export type ChordDefinition = {
  id: string;
  root: PitchClass;
  quality: ChordQuality;
  tones: PitchClass[];
  bass?: PitchClass;
  symbol: string;
  roman: string;
  functionLabel: FunctionLabel;
};

export type MelodyRelationship = {
  noteId: string;
  noteName: string;
  relationship: "root" | "third" | "fifth" | "seventh" | "extension" | "non-chord tone";
  weight: number;
};

export type ChordExplanation = {
  fitReason: string;
  functionReason: string;
  melodyRelationships: MelodyRelationship[];
  warnings: string[];
};

export type ScoredChord = {
  chord: ChordDefinition;
  score: number;
  explanation: ChordExplanation;
};

export type HarmonySegment = {
  id: string;
  startBeat: number;
  durationBeats: number;
  melodyNotes: NoteEvent[];
  candidateChords: ScoredChord[];
};

export type PlacedChord = {
  id: string;
  chord: ChordDefinition;
  startBeat: number;
  durationBeats: number;
  explanation: ChordExplanation;
};

export type HarmonyCandidate = {
  id: string;
  mode: CandidateMode;
  title: string;
  subtitle: string;
  chords: PlacedChord[];
  score: number;
  summary: string;
};

export type PlaybackState = {
  status: "stopped" | "starting" | "playing" | "paused";
  currentBeat: number;
};

export type MidiImportState = {
  status: "idle" | "ready" | "error";
  fileName: string | null;
  selectedTrackIndex: number | null;
};

export type AppError = {
  id: string;
  message: string;
};

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
  sourceImport?: {
    fileName: string;
    fileSize: number;
    lastModified: number;
    selectedTrackIndex: number | null;
    storedBlobId?: string;
  };
};

export type AppState = {
  settings: ProjectSettings;
  melody: NoteEvent[];
  candidates: HarmonyCandidate[];
  selectedCandidateId: string | null;
  selectedChordId: string | null;
  playback: PlaybackState;
  importState: MidiImportState;
  errors: AppError[];
};

