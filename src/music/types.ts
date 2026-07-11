export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type Mode = "major" | "minor" | "dorian" | "mixolydian";

export type HarmonyDensity = "bar" | "half-bar";

export type HarmonyRhythmPattern =
  | "bar"
  | "auto-phrase"
  | "strong-beats"
  | "every-beat"
  | "cadence-aware"
  | "sparse";

export type InputMode = "midi" | "manual";

export type PlaybackTonePreset =
  | "acoustic-grand"
  | "nylon-guitar"
  | "electric-guitar"
  | "warm-organ"
  | "glass-bell"
  | "mellow-keys"
  | "soft-pluck";

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

// How a chord relates to the key: a plain scale chord, a tonicizing secondary
// dominant (V7/x), or a chord borrowed from the parallel mode (modal interchange).
export type ChordRole = "diatonic" | "secondary-dominant" | "borrowed";

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
  harmonyRhythm: HarmonyRhythmPattern;
  harmonyDensity?: HarmonyDensity;
  inputMode: InputMode;
  playbackTone: PlaybackTonePreset;
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
  /** Defaults to "diatonic" when absent. */
  role?: ChordRole;
  /** For secondary dominants: the root and roman of the chord it tonicizes. */
  appliedToRoot?: PitchClass;
  appliedToRoman?: string;
  /** For borrowed chords: the mode they are borrowed from (the parallel mode). */
  borrowedFrom?: Mode;
};

export type MelodyRelationship = {
  noteId: string;
  noteName: string;
  relationship: "root" | "third" | "fifth" | "seventh" | "extension" | "non-chord tone";
  weight: number;
};

export type ChordToneRole = "root" | "third" | "fifth" | "seventh" | "extension";

export type FitInfo =
  | { kind: "no-notes" }
  | { kind: "chord-tone"; noteName: string; role: ChordToneRole }
  | { kind: "non-chord"; noteName: string };

export type ClassicalMotionKind =
  | "open-tonic"
  | "open-prep"
  | "d-to-t"
  | "pd-to-d"
  | "t-to-pd"
  | "close-tonic"
  | "tonicization"
  | "borrowed-color"
  | "general";

export type FunctionInfo = {
  functionLabel: FunctionLabel;
  motion?: {
    kind: ClassicalMotionKind;
    from?: FunctionLabel;
    to?: FunctionLabel;
    /** Roman of the tonicization target ("vi") or the borrowed-from mode. */
    target?: string;
  };
};

export type ChordExplanation = {
  fitReason: string;
  functionReason: string;
  melodyRelationships: MelodyRelationship[];
  warnings: string[];
  /** Structured data for localized rendering (the *Reason strings stay for back-compat). */
  fit?: FitInfo;
  functionInfo?: FunctionInfo;
  warningNotes?: string[];
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
  melodyMuted: boolean;
  harmonyMuted: boolean;
};

export type HarmonyStatus = "empty" | "ready" | "outdated";

export type MidiImportState = {
  status: "idle" | "ready" | "error";
  fileName: string | null;
  selectedTrackIndex: number | null;
  fileSize?: number;
  lastModified?: number;
  tracks?: MidiTrackSummary[];
};

export type MidiTrackSummary = {
  index: number;
  name: string;
  instrumentName: string;
  noteCount: number;
  channel: number;
  percussion: boolean;
};

export type MidiImportResult = {
  melody: NoteEvent[];
  tracks: MidiTrackSummary[];
  selectedTrackIndex: number;
  tempo?: number;
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
};

export type AppError = {
  id: string;
  message: string;
  tone?: "error" | "status";
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
  harmonyStatus?: HarmonyStatus;
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
  harmonyStatus: HarmonyStatus;
  playback: PlaybackState;
  importState: MidiImportState;
  errors: AppError[];
};
