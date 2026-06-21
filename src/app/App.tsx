import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { appReducer, createInitialState } from "./appState";
import {
  clearPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type WorkspaceViewMode,
} from "./preferencesRepository";
import { translate, type Language } from "./i18n";
import { useAuth } from "./auth/AuthProvider";
import { AuthPanel } from "./auth/AuthPanel";
import { ProjectsPanel } from "./projects/ProjectsPanel";
import {
  createProject,
  deleteAllProjects,
  deleteProject,
  listProjects,
  renameProject,
  updateProject,
  type CloudProject,
} from "../services/projectsRepository";
import {
  describeFit,
  describeFunction,
  describeWarnings,
  relationshipLabel,
} from "./explain";
import { AudioEngine, isSampledTonePreset } from "../music/audio/audioEngine";
import { demoMelody, longDemoMelody } from "../music/fixtures/demoMelodies";
import { getChordAlternatives, makeReplacementPlacedChord } from "../music/harmony/chordAlternatives";
import { getHarmonyVoiceRows, makeDisplayVoicing } from "../music/harmony/displayVoicing";
import { generateHarmonyCandidates } from "../music/harmony/generateCandidates";
import { createMidiFileName, exportCandidateToMidi } from "../music/midi/exportMidi";
import { parseMidiArrayBuffer } from "../music/midi/importMidi";
import {
  clearAllProjectData,
  clearActiveAutosave,
  createProjectSnapshot,
  loadActiveAutosave,
  saveActiveAutosave,
} from "./projectRepository";
import type {
  HarmonyCandidate,
  HarmonyRhythmPattern,
  MidiImportResult,
  NoteEvent,
  PlaybackTonePreset,
  PitchClass,
  PlacedChord,
  StoredProjectSnapshot,
} from "../music/types";
import {
  createNoteEventId,
  midiToPitchClass,
  midiToNoteName,
  pitchClassToName,
} from "../music/theory/pitches";
import {
  beatToGridColumn,
  beatToPixel,
  beatRangeToGridColumn,
  createTimelineGridMetrics,
  durationToGridSpan,
  getTimelineEndBeat,
  MIN_NOTE_DURATION_BEATS,
  pixelDeltaToSnappedBeats,
  pixelToSnappedBeat,
} from "./timelineGrid";
import "./App.css";
import Landing from "../components/landing/Landing";

const DURATION_OPTIONS = [
  { labelKey: "duration.whole", value: 4 },
  { labelKey: "duration.half", value: 2 },
  { labelKey: "duration.quarter", value: 1 },
  { labelKey: "duration.eighth", value: 0.5 },
] as const;

const KEY_OPTIONS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

const PLAYBACK_TONE_OPTIONS: PlaybackTonePreset[] = [
  "acoustic-grand",
  "nylon-guitar",
  "electric-guitar",
  "warm-organ",
  "glass-bell",
];

// Three chromatic octaves (C3–B5) so the melody roll behaves like an FL Studio piano roll:
// 12 semitone rows per octave, black keys distinguished from white keys.
const LOWEST_PITCH_MIDI = 36; // C2
const HIGHEST_PITCH_MIDI = 96; // C7 — a DAW-scale range so the roll always scrolls vertically
const PITCH_ROW_HEIGHT = 22;
const BLACK_KEY_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

type PitchRow = {
  label: string;
  midi: number;
  isBlack: boolean;
};

function buildPitchRows(): PitchRow[] {
  const rows: PitchRow[] = [];
  for (let midi = HIGHEST_PITCH_MIDI; midi >= LOWEST_PITCH_MIDI; midi -= 1) {
    rows.push({
      label: midiToNoteName(midi),
      midi,
      isBlack: BLACK_KEY_PITCH_CLASSES.has(midiToPitchClass(midi)),
    });
  }
  return rows;
}

const PITCH_ROWS: PitchRow[] = buildPitchRows();

const HARMONY_VOICE_ROWS = getHarmonyVoiceRows();

type NoteDragState = {
  noteId: string;
  mode: "move" | "resize";
  originClientX: number;
  originClientY: number;
  originalNote: NoteEvent;
};

function getNextStartBeat(melody: NoteEvent[]): number {
  if (melody.length === 0) return 0;
  return Math.max(...melody.map((note) => note.startBeat + note.durationBeats));
}

function createManualGridNote(
  midi: number,
  startBeat: number,
  durationBeats: number,
  melody: NoteEvent[],
): NoteEvent {
  return {
    id: `${createNoteEventId("manual", melody.length)}-${Math.round(startBeat * 100)}-${midi}`,
    midi,
    pitchClass: midiToPitchClass(midi),
    name: midiToNoteName(midi),
    startBeat,
    durationBeats,
    velocity: 0.8,
    source: "manual",
  };
}

function noteGridColumn(note: NoteEvent): string {
  return beatRangeToGridColumn(note.startBeat, note.durationBeats);
}

function placedChordGridColumn(placedChord: PlacedChord): string {
  return beatRangeToGridColumn(placedChord.startBeat, placedChord.durationBeats);
}

function harmonyVoiceGridRow(voice: (typeof HARMONY_VOICE_ROWS)[number]): number {
  return HARMONY_VOICE_ROWS.indexOf(voice) + 1;
}

function pitchRowIndexForMidi(midi: number): number {
  return PITCH_ROWS.reduce(
    (bestIndex, row, index) =>
      Math.abs(row.midi - midi) < Math.abs(PITCH_ROWS[bestIndex].midi - midi)
        ? index
        : bestIndex,
    0,
  );
}

function noteGridRow(note: NoteEvent): number {
  return pitchRowIndexForMidi(note.midi) + 1;
}

export function midiForDraggedPitch(
  originalMidi: number,
  deltaY: number,
  rowHeight: number,
): number {
  const originalIndex = pitchRowIndexForMidi(originalMidi);
  const rowDelta = Math.round(deltaY / rowHeight);
  const nextIndex = Math.max(0, Math.min(PITCH_ROWS.length - 1, originalIndex + rowDelta));
  return PITCH_ROWS[nextIndex].midi;
}

function updateNoteTiming(note: NoteEvent, startBeat: number, durationBeats: number): NoteEvent {
  return {
    ...note,
    startBeat,
    durationBeats,
  };
}

function updateNotePitch(note: NoteEvent, midi: number): NoteEvent {
  return {
    ...note,
    midi,
    pitchClass: midiToPitchClass(midi),
    name: midiToNoteName(midi),
  };
}

function selectedCandidateFrom(
  candidates: HarmonyCandidate[],
  selectedCandidateId: string | null,
): HarmonyCandidate | null {
  return candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0] ?? null;
}

function selectedChordFrom(
  candidate: HarmonyCandidate | null,
  selectedChordId: string | null,
): PlacedChord | null {
  return candidate?.chords.find((chord) => chord.id === selectedChordId) ?? candidate?.chords[0] ?? null;
}

function candidateProgression(candidate: HarmonyCandidate): string {
  return candidate.chords.map((placedChord) => placedChord.chord.symbol).join(" / ");
}

function App() {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    createInitialState(initialPreferences),
  );
  const { status: authStatus, user, signOut } = useAuth();
  const [screen, setScreen] = useState<"landing" | "workspace">("landing");
  const [isDemo, setIsDemo] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<"prompt" | "enter">("prompt");
  const [landingPrompted, setLandingPrompted] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsBusy, setProjectsBusy] = useState(false);
  const [migrationOffered, setMigrationOffered] = useState(false);
  const [showMigratePrompt, setShowMigratePrompt] = useState(false);
  const [language, setLanguage] = useState<Language>(initialPreferences.language);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>(initialPreferences.viewMode);
  const [activeStep, setActiveStep] = useState(0);
  const [durationBeats, setDurationBeats] = useState<(typeof DURATION_OPTIONS)[number]["value"]>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [toneStatus, setToneStatus] = useState<"loading" | "sampled" | "fallback" | "synth">(
    "loading",
  );
  const [recoveredSnapshot, setRecoveredSnapshot] = useState<StoredProjectSnapshot | null>(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);
  const [currentMidiFile, setCurrentMidiFile] = useState<{
    file: File;
    arrayBuffer: ArrayBuffer;
  } | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noteDragRef = useRef<NoteDragState | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);
  const melodyScrollRef = useRef<HTMLDivElement | null>(null);
  const harmonyScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncRef = useRef(false);
  const melodyCenteredRef = useRef(false);
  const navTrackRef = useRef<HTMLDivElement | null>(null);
  // Mini timeline navigator: the visible viewport over the full timeline width.
  const [navView, setNavView] = useState({ left: 0, view: 1, total: 1 });
  const t = (key: string) => translate(language, key);
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    savePreferences(state.settings, language, viewMode);
  }, [state.settings, language, viewMode]);

  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
    return () => audioEngineRef.current?.stop();
  }, []);

  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    let cancelled = false;
    if (isSampledTonePreset(state.settings.playbackTone)) {
      setToneStatus("loading");
    }
    engine
      .loadTone(state.settings.playbackTone)
      .then((status) => {
        if (!cancelled) setToneStatus(status);
      })
      .catch(() => {
        if (!cancelled) setToneStatus("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, [state.settings.playbackTone]);

  useEffect(() => {
    let cancelled = false;
    loadActiveAutosave()
      .then((snapshot) => {
        if (!cancelled && snapshot && snapshot.melody.length > 0) {
          setRecoveredSnapshot(snapshot);
        }
      })
      .catch(() => {
        // Recovery is best-effort; user-facing errors are reserved for direct actions.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.melody.length === 0) return;

    const timeout = window.setTimeout(() => {
      saveActiveAutosave(createProjectSnapshot(state))
        .then(() => setLastAutosaveAt(new Date().toLocaleTimeString()))
        .catch(() => {
          // Autosave failures should not interrupt editing or playback.
        });
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [
    state.settings,
    state.melody,
    state.candidates,
    state.selectedCandidateId,
    state.selectedChordId,
    state.importState,
  ]);

  useEffect(() => {
    if (selectedNoteId && !state.melody.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId, state.melody]);

  // Center the piano roll on the melody's pitch range once, so 3 octaves never open on empty rows.
  useEffect(() => {
    if (state.melody.length === 0) {
      melodyCenteredRef.current = false;
      return;
    }
    if (melodyCenteredRef.current) return;
    const element = melodyScrollRef.current;
    if (!element) return;
    const averageMidi = Math.round(
      state.melody.reduce((sum, note) => sum + note.midi, 0) / state.melody.length,
    );
    const rowIndex = pitchRowIndexForMidi(averageMidi);
    const target = rowIndex * PITCH_ROW_HEIGHT - element.clientHeight / 2 + PITCH_ROW_HEIGHT / 2;
    element.scrollTop = Math.max(0, target);
    melodyCenteredRef.current = true;
  }, [state.melody]);

  // Soft gate: on the landing screen, prompt anonymous visitors once to sign in.
  // The prompt is dismissible and never blocks the demo path.
  useEffect(() => {
    if (screen === "landing" && authStatus === "anonymous" && !landingPrompted) {
      setAuthIntent("prompt");
      setAuthOpen(true);
      setLandingPrompted(true);
    }
  }, [screen, authStatus, landingPrompted]);

  // Signing out (or losing the session) while inside the real workspace returns
  // the user to the landing screen. Demo sessions stay put.
  useEffect(() => {
    if (screen === "workspace" && authStatus === "anonymous" && !isDemo) {
      setScreen("landing");
    }
  }, [screen, authStatus, isDemo]);

  const canSaveToCloud = authStatus === "authenticated";

  const enterWorkspace = () => {
    // Unconfigured builds (no Supabase secrets) pass straight through for dev/CI.
    if (authStatus === "authenticated" || authStatus === "unconfigured") {
      setIsDemo(false);
      setActiveStep(0);
      setScreen("workspace");
      return;
    }
    setAuthIntent("enter");
    setAuthOpen(true);
  };

  const enterDemo = () => {
    setAuthOpen(false);
    setIsDemo(true);
    setActiveStep(0);
    setScreen("workspace");
    if (state.melody.length === 0) {
      dispatch({ type: "load-melody", melody: demoMelody });
    }
  };

  const handleAuthenticated = () => {
    setAuthOpen(false);
    if (authIntent === "enter") {
      setIsDemo(false);
      if (screen !== "workspace") setActiveStep(0);
      setScreen("workspace");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsDemo(false);
    setScreen("landing");
    setLandingPrompted(true);
    setProjectsOpen(false);
  };

  const notifyCloud = (messageKey: string, tone: "status" | "error") => {
    dispatch({ type: "set-error", id: "cloud", message: t(messageKey), tone });
    window.setTimeout(() => dispatch({ type: "clear-error", id: "cloud" }), 2200);
  };

  const loadCloudProjects = async () => {
    setProjectsLoading(true);
    try {
      setCloudProjects(await listProjects());
    } catch {
      notifyCloud("message.cloudLoadFailure", "error");
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleSaveNewProject = async () => {
    if (state.melody.length === 0 || projectsBusy) return;
    setProjectsBusy(true);
    try {
      const project = await createProject(
        state.importState.fileName ?? t("projects.defaultTitle"),
        createProjectSnapshot(state),
      );
      setCloudProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
      setActiveProjectId(project.id);
      setShowMigratePrompt(false);
      notifyCloud("message.cloudSaveSuccess", "status");
    } catch {
      notifyCloud("message.cloudSaveFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const handleUpdateCurrentProject = async () => {
    if (!activeProjectId || state.melody.length === 0 || projectsBusy) return;
    setProjectsBusy(true);
    try {
      const project = await updateProject(activeProjectId, createProjectSnapshot(state));
      setCloudProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
      notifyCloud("message.cloudSaveSuccess", "status");
    } catch {
      notifyCloud("message.cloudSaveFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const handleOpenProject = (id: string) => {
    const project = cloudProjects.find((item) => item.id === id);
    if (!project) return;
    resetPlayback();
    setSelectedNoteId(null);
    setCurrentMidiFile(null);
    dispatch({ type: "restore-snapshot", snapshot: project.snapshot });
    setActiveProjectId(project.id);
    setActiveStep(project.snapshot.candidates.length > 0 ? 3 : 0);
    setProjectsOpen(false);
    notifyCloud("message.cloudOpenSuccess", "status");
  };

  const handleRenameProject = async (id: string, title: string) => {
    setProjectsBusy(true);
    try {
      const project = await renameProject(id, title);
      setCloudProjects((prev) => prev.map((item) => (item.id === id ? project : item)));
    } catch {
      notifyCloud("message.cloudSaveFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setProjectsBusy(true);
    try {
      await deleteProject(id);
      setCloudProjects((prev) => prev.filter((item) => item.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
      notifyCloud("message.cloudDeleteSuccess", "status");
    } catch {
      notifyCloud("message.cloudDeleteFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  // Load the signed-in user's projects; clear cloud state on sign-out.
  useEffect(() => {
    if (authStatus === "authenticated") {
      void loadCloudProjects();
    } else {
      setCloudProjects([]);
      setActiveProjectId(null);
      setProjectsOpen(false);
      setMigrationOffered(false);
      setShowMigratePrompt(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // Offer a one-time migration when a signed-in user has unsaved local work.
  useEffect(() => {
    if (
      authStatus === "authenticated" &&
      !isDemo &&
      screen === "workspace" &&
      state.melody.length > 0 &&
      !activeProjectId &&
      !migrationOffered
    ) {
      setShowMigratePrompt(true);
      setMigrationOffered(true);
    }
  }, [authStatus, isDemo, screen, state.melody.length, activeProjectId, migrationOffered]);

  const hasMelody = state.melody.length > 0;
  const showEditableGrid = hasMelody || state.settings.inputMode === "manual";
  const showCandidates = state.candidates.length > 0;
  const selectedCandidate = useMemo(
    () => selectedCandidateFrom(state.candidates, state.selectedCandidateId),
    [state.candidates, state.selectedCandidateId],
  );
  const selectedChord = useMemo(
    () => selectedChordFrom(selectedCandidate, state.selectedChordId),
    [selectedCandidate, state.selectedChordId],
  );
  const harmonyIsReady = state.harmonyStatus === "ready" && selectedCandidate !== null;
  const harmonyIsOutdated = state.harmonyStatus === "outdated";
  const canPlayTimeline = hasMelody;
  const chordAlternatives = useMemo(
    () =>
      selectedChord
        ? getChordAlternatives(state.melody, state.settings, selectedChord).filter(
            (alternative) => alternative.chord.id !== selectedChord.chord.id,
          )
        : [],
    [selectedChord, state.melody, state.settings],
  );
  const timelineEndBeat = useMemo(
    () => getTimelineEndBeat(state.melody, selectedCandidate),
    [state.melody, selectedCandidate],
  );
  const timelineMetrics = useMemo(
    () => createTimelineGridMetrics(timelineEndBeat, state.settings.timeSignature.numerator),
    [timelineEndBeat, state.settings.timeSignature.numerator],
  );
  const timelineGridStyle = {
    "--pitch-row-count": PITCH_ROWS.length,
    "--timeline-grid-columns": `${timelineMetrics.labelWidth}px repeat(${timelineMetrics.columnCount}, ${timelineMetrics.subdivisionWidth}px)`,
    "--timeline-content-width": `${timelineMetrics.contentWidth}px`,
    "--timeline-label-width": `${timelineMetrics.labelWidth}px`,
    "--timeline-subdivision-width": `${timelineMetrics.subdivisionWidth}px`,
    "--timeline-beat-width": `${timelineMetrics.beatWidth}px`,
    "--timeline-measure-width": `${timelineMetrics.measureWidth}px`,
  } as CSSProperties;
  const playheadLeft = beatToPixel(state.playback.currentBeat, timelineMetrics);
  const activePlaybackChordId =
    harmonyIsReady
      ? selectedCandidate?.chords.find(
          (placedChord) =>
            state.playback.currentBeat >= placedChord.startBeat &&
            state.playback.currentBeat < placedChord.startBeat + placedChord.durationBeats,
        )?.id ?? null
      : null;

  // Guided flow (Task 5 / T5.4): a step cursor over the same workspace state.
  // Gates are derived from AppState — activeStep is only a view cursor, never a
  // second source of truth.
  const guided = viewMode === "guided";

  // Expert mode (TASK6 §10): the inspector is an on-demand side-sheet that
  // slides in only when the user explicitly clicks a chord/voice, so the piano
  // roll owns the full width while idle (and after a bare generate). Guided mode
  // keeps its in-flow inspector column.
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const openInspectorOnChord = (chordId: string) => {
    dispatch({ type: "select-chord", chordId });
    setInspectorOpen(true);
  };

  // Expert stage (TASK6 §11 Phase A): the melody roll is the full-viewport body
  // and harmony lives in a bottom drawer. It auto-opens once harmony exists so
  // the result is visible (and the chord blocks stay queryable for verify).
  const [harmonyDrawerOpen, setHarmonyDrawerOpen] = useState(false);
  const hasHarmony = Boolean(selectedCandidate && selectedChord);
  useEffect(() => {
    if (hasHarmony) setHarmonyDrawerOpen(true);
  }, [hasHarmony]);

  const GUIDE_STEPS = ["input", "settings", "generate", "audition", "select", "export"] as const;
  const stepGates = [
    hasMelody, // input -> settings
    hasMelody, // settings -> generate
    showCandidates, // generate -> audition
    Boolean(selectedCandidate), // audition -> select
    Boolean(selectedCandidate), // select -> export
    false, // export is the last step
  ];
  let furthestReachable = 0;
  while (furthestReachable < GUIDE_STEPS.length - 1 && stepGates[furthestReachable]) {
    furthestReachable += 1;
  }
  const guideStep = Math.min(activeStep, furthestReachable);
  const canAdvanceStep = stepGates[guideStep];
  const goToStep = (index: number) => setActiveStep(Math.max(0, Math.min(furthestReachable, index)));

  // Region visibility. In expert mode (`!guided`) everything is shown, exactly
  // as before the guided flow existed.
  const showSourceTools = !guided || guideStep === 0;
  const showTransport = !guided || guideStep === 3 || guideStep === 4;
  const showPianoRoll = !guided || guideStep <= 4;
  const showCandidateStrip = !guided || guideStep === 3 || guideStep === 4;
  const showInspector = !guided || guideStep === 4;
  const showStageToolbar = showSourceTools || showTransport;

  const handleLoadDemo = () => {
    resetPlayback();
    setCurrentMidiFile(null);
    setSelectedNoteId(null);
    setActiveStep(0);
    dispatch({ type: "load-melody", melody: demoMelody });
  };

  const handleLoadLongDemo = () => {
    resetPlayback();
    setCurrentMidiFile(null);
    setSelectedNoteId(null);
    setActiveStep(0);
    dispatch({ type: "load-melody", melody: longDemoMelody });
  };

  const handleGenerate = () => {
    if (!hasMelody) {
      dispatch({ type: "set-error", id: "generate", message: t("message.generateNoMelody") });
      return;
    }
    if (isGenerating) return;

    pausePlayback();
    setIsGenerating(true);
    window.setTimeout(() => {
      dispatch({
        type: "set-candidates",
        candidates: generateHarmonyCandidates(state.melody, state.settings),
      });
      setIsGenerating(false);
      // Advance the guided flow to the audition step once candidates exist.
      setActiveStep((current) => (current < 3 ? 3 : current));
    }, 400);
  };

  const handleDeleteSelectedNote = () => {
    if (!selectedNoteId) return;
    pausePlayback();
    dispatch({ type: "delete-note", noteId: selectedNoteId });
    setSelectedNoteId(null);
  };

  const handleReplaceChord = (alternativeIndex: number) => {
    if (!selectedCandidate || !selectedChord) return;
    const alternative = chordAlternatives[alternativeIndex];
    if (!alternative) return;
    pausePlayback();
    dispatch({
      type: "replace-chord",
      candidateId: selectedCandidate.id,
      chordId: selectedChord.id,
      replacement: makeReplacementPlacedChord(selectedChord, alternative),
    });
  };

  const handleCopyProgression = async () => {
    if (!selectedCandidate) {
      dispatch({ type: "set-error", id: "copy", message: t("message.copyMissing") });
      return;
    }

    const progression = selectedCandidate.chords
      .map((placedChord) => placedChord.chord.symbol)
      .join(" / ");

    try {
      await navigator.clipboard.writeText(progression);
      dispatch({
        type: "set-error",
        id: "copy",
        message: t("message.copySuccess"),
        tone: "status",
      });
      window.setTimeout(() => dispatch({ type: "clear-error", id: "copy" }), 1800);
    } catch {
      dispatch({ type: "set-error", id: "copy", message: t("message.copyFailure") });
    }
  };

  const handleExportMidi = () => {
    if (!selectedCandidate) {
      dispatch({ type: "set-error", id: "export", message: t("message.exportMissing") });
      return;
    }

    try {
      const bytes = exportCandidateToMidi(state.melody, selectedCandidate, state.settings);
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = createMidiFileName(state.importState.fileName);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      dispatch({
        type: "set-error",
        id: "export",
        message: t("message.exportSuccess"),
        tone: "status",
      });
      window.setTimeout(() => dispatch({ type: "clear-error", id: "export" }), 2200);
    } catch {
      dispatch({ type: "set-error", id: "export", message: t("message.exportFailure") });
    }
  };

  const handleClearLocalData = async () => {
    // Local clear never touches cloud projects or the current session.
    if (!window.confirm(t("message.clearLocalConfirm"))) return;
    resetPlayback();
    try {
      await clearAllProjectData();
      clearPreferences();
      setRecoveredSnapshot(null);
      setCurrentMidiFile(null);
      setLastAutosaveAt(null);
      dispatch({ type: "reset-app", settings: defaultPreferences });
      dispatch({
        type: "set-error",
        id: "local-data",
        message: t("message.clearSuccess"),
        tone: "status",
      });
      window.setTimeout(() => dispatch({ type: "clear-error", id: "local-data" }), 2200);
    } catch {
      dispatch({ type: "set-error", id: "local-data", message: t("message.clearFailure") });
    }
  };

  const handleClearCloudData = async () => {
    if (!window.confirm(t("message.clearCloudConfirm"))) return;
    setProjectsBusy(true);
    try {
      await deleteAllProjects();
      setCloudProjects([]);
      setActiveProjectId(null);
      notifyCloud("message.clearCloudSuccess", "status");
    } catch {
      notifyCloud("message.clearCloudFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const applyMidiImport = (
    result: MidiImportResult,
    file: File,
    arrayBuffer: ArrayBuffer,
  ) => {
    resetPlayback();
    setSelectedNoteId(null);
    setActiveStep(0);
    setCurrentMidiFile({ file, arrayBuffer });
    dispatch({
      type: "set-midi-import",
      melody: result.melody,
      importState: {
        status: "ready",
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified,
        selectedTrackIndex: result.selectedTrackIndex,
        tracks: result.tracks,
      },
      settings: {
        ...(result.tempo ? { tempo: result.tempo } : {}),
        ...(result.timeSignature
          ? {
              timeSignature: result.timeSignature,
            }
          : {}),
        inputMode: "midi",
      },
    });
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".mid") && !file.name.toLowerCase().endsWith(".midi")) {
      dispatch({ type: "set-import-error", message: t("message.fileType") });
      return;
    }

    setIsImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = parseMidiArrayBuffer(arrayBuffer);
      applyMidiImport(result, file, arrayBuffer);
    } catch (error) {
      dispatch({
        type: "set-import-error",
        message: error instanceof Error ? error.message : t("message.readMidi"),
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTrackChange = (trackIndex: number) => {
    if (!currentMidiFile) return;
    try {
      const result = parseMidiArrayBuffer(currentMidiFile.arrayBuffer.slice(0), trackIndex);
      applyMidiImport(result, currentMidiFile.file, currentMidiFile.arrayBuffer);
    } catch (error) {
      dispatch({
        type: "set-import-error",
        message: error instanceof Error ? error.message : t("message.switchTrack"),
      });
    }
  };

  const beatFromPointer = (event: ReactPointerEvent<HTMLElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return pixelToSnappedBeat(event.clientX - rect.left - timelineMetrics.labelWidth, timelineMetrics);
  };

  const pitchFromPointer = (event: ReactPointerEvent<HTMLElement>): (typeof PITCH_ROWS)[number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rowHeight = rect.height / PITCH_ROWS.length;
    const rowIndex = Math.max(
      0,
      Math.min(PITCH_ROWS.length - 1, Math.floor((event.clientY - rect.top) / rowHeight)),
    );
    return PITCH_ROWS[rowIndex];
  };

  const updateNavView = () => {
    const el = melodyScrollRef.current;
    if (!el) return;
    setNavView({ left: el.scrollLeft, view: el.clientWidth, total: el.scrollWidth });
  };

  const syncHorizontalScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    if (scrollSyncRef.current) return;
    scrollSyncRef.current = true;
    const left = event.currentTarget.scrollLeft;
    for (const ref of [rulerScrollRef, melodyScrollRef, harmonyScrollRef]) {
      const element = ref.current;
      if (element && element !== event.currentTarget && element.scrollLeft !== left) {
        element.scrollLeft = left;
      }
    }
    scrollSyncRef.current = false;
    updateNavView();
  };

  // Drag (or click) the navigator to pan the shared horizontal viewport; setting
  // scrollLeft fires syncHorizontalScroll, which keeps melody + harmony aligned.
  const handleNavPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = navTrackRef.current;
    const el = melodyScrollRef.current;
    if (!track || !el || el.scrollWidth <= el.clientWidth) return;
    event.preventDefault();
    const trackRect = track.getBoundingClientRect();
    const ratio = el.scrollWidth / trackRect.width;
    const onThumb = (event.target as HTMLElement).closest(".timeline-nav-thumb");
    if (!onThumb) {
      // Click on the track: centre the viewport under the cursor.
      el.scrollLeft = (event.clientX - trackRect.left) * ratio - el.clientWidth / 2;
    }
    const startX = event.clientX;
    const startScroll = el.scrollLeft;
    const onMove = (moveEvent: PointerEvent) => {
      el.scrollLeft = startScroll + (moveEvent.clientX - startX) * ratio;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Keep the navigator in sync when the timeline width or layout changes.
  useEffect(() => {
    updateNavView();
    const onResize = () => updateNavView();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineMetrics, hasMelody, viewMode, harmonyDrawerOpen, screen]);

  const auditionPitch = (midi: number) => {
    void audioEngineRef.current?.previewNote(midi, state.settings.playbackTone);
  };

  const handleMelodyLanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (state.settings.inputMode !== "manual" || event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".note")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const startBeat = Math.min(
      timelineMetrics.totalBeats - durationBeats,
      beatFromPointer(event),
    );
    if (event.clientX - rect.left < timelineMetrics.labelWidth) return;

    const pitch = pitchFromPointer(event);
    const note = createManualGridNote(
      pitch.midi,
      Math.max(0, startBeat),
      durationBeats,
      state.melody,
    );
    pausePlayback();
    dispatch({ type: "add-note", note });
    setSelectedNoteId(note.id);
  };

  const handleNotePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    note: NoteEvent,
    mode: NoteDragState["mode"],
  ) => {
    if (state.settings.inputMode !== "manual" || event.button !== 0) return;
    event.stopPropagation();
    setSelectedNoteId(note.id);
    noteDragRef.current = {
      noteId: note.id,
      mode,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originalNote: note,
    };
    const captureTarget = event.currentTarget.closest(".note") as HTMLElement | null;
    try {
      captureTarget?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a progressive enhancement; dragging still works without it.
    }
  };

  const handleNotePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = noteDragRef.current;
    if (!drag || state.settings.inputMode !== "manual") return;
    event.stopPropagation();

    const signedDeltaBeat = pixelDeltaToSnappedBeats(
      event.clientX - drag.originClientX,
      timelineMetrics,
    );
    const rowHeight = (event.currentTarget.closest(".melody-grid")?.clientHeight ?? 0) / PITCH_ROWS.length;
    const draggedMidi =
      rowHeight > 0
        ? midiForDraggedPitch(
            drag.originalNote.midi,
            event.clientY - drag.originClientY,
            rowHeight,
          )
        : drag.originalNote.midi;
    const latestNote =
      state.melody.find((note) => note.id === drag.noteId) ?? drag.originalNote;

    const updatedNote =
      drag.mode === "move"
        ? updateNotePitch(
            updateNoteTiming(
              latestNote,
              Math.max(
                0,
                Math.min(
                  timelineMetrics.totalBeats - latestNote.durationBeats,
                  drag.originalNote.startBeat + signedDeltaBeat,
                ),
              ),
              latestNote.durationBeats,
            ),
            draggedMidi,
          )
        : updateNoteTiming(
            latestNote,
            latestNote.startBeat,
            Math.max(
              MIN_NOTE_DURATION_BEATS,
              Math.min(
                timelineMetrics.totalBeats - latestNote.startBeat,
                drag.originalNote.durationBeats + signedDeltaBeat,
              ),
            ),
          );

    dispatch({ type: "update-note", noteId: drag.noteId, note: updatedNote });
  };

  const handleNotePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (noteDragRef.current && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    noteDragRef.current = null;
  };

  const restoreAutosave = () => {
    if (!recoveredSnapshot) return;
    resetPlayback();
    setSelectedNoteId(null);
    setCurrentMidiFile(null);
    dispatch({ type: "restore-snapshot", snapshot: recoveredSnapshot });
    setRecoveredSnapshot(null);
  };

  const discardAutosave = async () => {
    await clearActiveAutosave();
    setRecoveredSnapshot(null);
  };

  const pausePlayback = () => {
    audioEngineRef.current?.stop();
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      dispatch({ type: "pause-playback" });
    }
  };

  const resetPlayback = () => {
    audioEngineRef.current?.stop();
    dispatch({ type: "reset-playback" });
  };

  const startPlaybackAt = async (startBeat: number, errorMessage: string) => {
    if (!canPlayTimeline || state.playback.status === "starting") return;
    const playbackCandidate = harmonyIsReady ? selectedCandidate : null;
    audioEngineRef.current?.stop();
    dispatch({ type: "set-current-beat", currentBeat: startBeat });
    dispatch({ type: "set-playback-status", status: "starting" });

    try {
      await audioEngineRef.current?.playCandidate(
        state.melody,
        playbackCandidate,
        state.settings.tempo,
        {
          melodyMuted: state.playback.melodyMuted,
          harmonyMuted: !playbackCandidate || state.playback.harmonyMuted,
          tonePreset: state.settings.playbackTone,
          startBeat,
        },
        (currentBeat) => dispatch({ type: "set-current-beat", currentBeat }),
        () => dispatch({ type: "reset-playback" }),
      );
      dispatch({ type: "set-playback-status", status: "playing" });
    } catch {
      dispatch({ type: "reset-playback" });
      dispatch({ type: "set-error", id: "audio", message: errorMessage });
    }
  };

  const playSelectedCandidate = async () => {
    if (!canPlayTimeline || state.playback.status === "starting") return;

    if (state.playback.status === "playing") {
      pausePlayback();
      return;
    }

    await startPlaybackAt(state.playback.currentBeat, t("message.audioStart"));
  };

  const handlePlayFromStart = async () => {
    await startPlaybackAt(0, t("message.audioRestart"));
  };

  const handlePlayFromCurrentMeasure = async () => {
    const beatsPerMeasure = state.settings.timeSignature.numerator;
    const anchorBeat = state.playback.currentBeat;
    const measureStartBeat = Math.floor(anchorBeat / beatsPerMeasure) * beatsPerMeasure;
    await startPlaybackAt(measureStartBeat, t("message.audioRestart"));
  };

  const toggleMelodyMute = () => {
    if (state.playback.status === "playing") pausePlayback();
    dispatch({ type: "toggle-melody-muted" });
  };

  const toggleHarmonyMute = () => {
    if (state.playback.status === "playing") pausePlayback();
    dispatch({ type: "toggle-harmony-muted" });
  };

  const handleSelectCandidate = (candidateId: string) => {
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      pausePlayback();
    }
    dispatch({ type: "select-candidate", candidateId });
  };

  // Shared project-settings fields, used by both the expert command-bar tray and
  // the guided "settings" step so there is one source of truth for the controls.
  const renderSettingsFields = () => (
    <div className="settings-grid">
      <label>
        {t("settings.key")}
        <select
          value={state.settings.keyTonic}
          onChange={(event) =>
            dispatch({ type: "set-key", keyTonic: Number(event.target.value) as PitchClass })
          }
        >
          {KEY_OPTIONS.map((pitchClass) => (
            <option value={pitchClass} key={pitchClass}>
              {pitchClassToName(pitchClass)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("settings.mode")}
        <select
          value={state.settings.mode}
          onChange={(event) =>
            dispatch({ type: "set-mode", mode: event.target.value === "minor" ? "minor" : "major" })
          }
        >
          <option value="major">{t("settings.major")}</option>
          <option value="minor" disabled>
            {t("settings.minorLater")}
          </option>
        </select>
      </label>
      <label>
        {t("settings.tempo")}
        <input
          type="number"
          value={state.settings.tempo}
          min={40}
          max={220}
          onChange={(event) => dispatch({ type: "set-tempo", tempo: Number(event.target.value) })}
        />
      </label>
      <label>
        {t("settings.density")}
        <select
          value={state.settings.harmonyRhythm}
          onChange={(event) =>
            dispatch({
              type: "set-harmony-rhythm",
              harmonyRhythm: event.target.value as HarmonyRhythmPattern,
            })
          }
        >
          <option value="bar">{t("settings.bar")}</option>
          <option value="strong-beats">{t("settings.strongBeats")}</option>
          <option value="every-beat">{t("settings.everyBeat")}</option>
          <option value="cadence-aware">{t("settings.cadenceAware")}</option>
          <option value="sparse">{t("settings.sparse")}</option>
        </select>
      </label>
      <label>
        {t("settings.tone")}
        <select
          value={state.settings.playbackTone}
          onChange={(event) => {
            if (state.playback.status === "playing") pausePlayback();
            dispatch({
              type: "set-playback-tone",
              playbackTone: event.target.value as PlaybackTonePreset,
            });
          }}
        >
          {PLAYBACK_TONE_OPTIONS.map((tone) => (
            <option value={tone} key={tone}>
              {t(`tone.${tone}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const guideStepKey = GUIDE_STEPS[guideStep];

  const renderStepCoach = () => (
    <div className="guide-coach" data-step={guideStepKey}>
      <div className="guide-coach-head">
        <span className="guide-coach-index">
          {t("guide.step")} {guideStep + 1} {t("guide.of")} {GUIDE_STEPS.length}
        </span>
        <h3>{t(`guide.${guideStepKey}.title`)}</h3>
        <p>{t(`guide.${guideStepKey}.tip`)}</p>
      </div>

      {guideStepKey === "settings" ? (
        <div className="guide-coach-body">{renderSettingsFields()}</div>
      ) : null}

      {guideStepKey === "generate" ? (
        <div className="guide-coach-body guide-generate">
          <button
            type="button"
            className="primary-button"
            disabled={!hasMelody || isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? t("action.generating") : t("action.generate")}
          </button>
        </div>
      ) : null}

      {guideStepKey === "export" ? (
        <div className="guide-coach-body guide-export">
          {selectedCandidate ? (
            <p className="guide-progression">
              <span>{t("guide.progression")}</span>
              <strong>{candidateProgression(selectedCandidate)}</strong>
            </p>
          ) : null}
          <p className="guide-privacy-note">
            {isDemo ? t("privacy.demoNote") : authStatus === "authenticated" ? t("privacy.accountNote") : t("privacy.localNote")}
          </p>
          <div className="guide-export-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleCopyProgression()}
            >
              {t("action.copyProgression")}
            </button>
            <button type="button" className="secondary-button" onClick={handleExportMidi}>
              {t("action.exportMidi")}
            </button>
            {isDemo ? (
              <button
                type="button"
                className="primary-button"
                disabled={authStatus === "unconfigured"}
                onClick={() => {
                  setAuthIntent("enter");
                  setAuthOpen(true);
                }}
              >
                {t("auth.signIn")}
              </button>
            ) : authStatus === "authenticated" ? (
              <button
                type="button"
                className="primary-button"
                disabled={!hasMelody || projectsBusy}
                onClick={() => void handleSaveNewProject()}
              >
                {projectsBusy ? t("projects.saving") : t("projects.saveNew")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="guide-coach-nav">
        <button
          type="button"
          className="secondary-button"
          disabled={guideStep === 0}
          onClick={() => goToStep(guideStep - 1)}
        >
          {t("guide.back")}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!canAdvanceStep}
          onClick={() => goToStep(guideStep + 1)}
        >
          {t("guide.next")}
        </button>
      </div>
    </div>
  );

  const renderStepRail = () => (
    <nav className="guide-rail" aria-label={t("view.guided")}>
      {GUIDE_STEPS.map((key, index) => {
        const reachable = index <= furthestReachable;
        const isCurrent = index === guideStep;
        return (
          <button
            type="button"
            key={key}
            className={`guide-rail-step${isCurrent ? " is-current" : ""}${
              index < guideStep ? " is-done" : ""
            }`}
            aria-current={isCurrent ? "step" : undefined}
            disabled={!reachable}
            onClick={() => goToStep(index)}
          >
            <span className="guide-rail-num">{index + 1}</span>
            <span className="guide-rail-label">{t(`guide.${key}.title`)}</span>
          </button>
        );
      })}
    </nav>
  );

  if (screen === "landing") {
    return (
      <>
        <Landing
          authStatus={authStatus}
          userEmail={user?.email ?? null}
          onSignIn={() => {
            setAuthIntent("prompt");
            setAuthOpen(true);
          }}
          onSignOut={() => void handleSignOut()}
          onEnterWorkspace={enterWorkspace}
          onEnterDemo={enterDemo}
          prefersReducedMotion={prefersReducedMotion}
        />
        {authOpen ? (
          <AuthPanel
            language={language}
            onClose={() => setAuthOpen(false)}
            onAuthenticated={handleAuthenticated}
            onDemo={enterDemo}
          />
        ) : null}
      </>
    );
  }

  // The harmony piano roll, shared between the guided inline layout and the
  // expert bottom drawer (TASK6 §11 Phase A). Rendered in exactly one place at a
  // time, so the harmonyScrollRef stays single-instance. Carries timelineGridStyle
  // when placed in the drawer (outside the timeline-stack) for column alignment.
  // Transport: rendered inline in the stage toolbar (guided) or in the harmony
  // drawer header (expert). One source, one instance at a time.
  const transportEl = (
    <div className="toolbar-transport" aria-label="Playback controls">
      <div className="jump-group" role="group" aria-label="Playback start">
        <button
          type="button"
          disabled={!canPlayTimeline || state.playback.status === "starting"}
          onClick={() => void handlePlayFromStart()}
        >
          {t("action.playFromStart")}
        </button>
        <button
          type="button"
          disabled={!canPlayTimeline || state.playback.status === "starting"}
          onClick={() => void handlePlayFromCurrentMeasure()}
        >
          {t("action.playFromCurrentBar")}
        </button>
      </div>
      <button
        type="button"
        className="play-button"
        aria-label="Play timeline"
        disabled={!canPlayTimeline}
        onClick={playSelectedCandidate}
      >
        {state.playback.status === "playing" ? t("action.pause") : t("action.play")}
      </button>
      <div className="mute-group" role="group" aria-label="Mute tracks">
        <button
          type="button"
          className="mute-chip"
          aria-pressed={state.playback.melodyMuted}
          disabled={!canPlayTimeline}
          onClick={toggleMelodyMute}
        >
          {t("transport.melody")}
        </button>
        <button
          type="button"
          className="mute-chip"
          aria-pressed={state.playback.harmonyMuted}
          disabled={!harmonyIsReady}
          onClick={toggleHarmonyMute}
        >
          {t("transport.harmony")}
        </button>
      </div>
      <span className="beat-readout" aria-live="off">
        {state.playback.currentBeat.toFixed(1)}
        <small>{t("timeline.beat")}</small>
      </span>
    </div>
  );

  const harmonyWindowEl = (
    <div
      className="timeline-window harmony-window"
      ref={harmonyScrollRef}
      onScroll={syncHorizontalScroll}
      aria-label="Harmony voices"
    >
      <div className={`harmony-grid${harmonyIsOutdated ? " is-outdated" : ""}`}>
        <div className="lane-label harmony-lane-label">
          <div className="voice-labels" aria-hidden="true">
            {HARMONY_VOICE_ROWS.map((voice) => (
              <span key={voice}>{voice}</span>
            ))}
            <span>Chord</span>
          </div>
        </div>
        {hasMelody ? (
          <div className="playhead" aria-hidden="true" style={{ left: `${playheadLeft}px` }} />
        ) : null}
        {selectedCandidate && selectedChord ? (
          <>
            {selectedCandidate.chords.flatMap((placedChord) =>
              makeDisplayVoicing(placedChord).map((voice) => (
                <button
                  type="button"
                  className={`harmony-note${
                    selectedChord.id === placedChord.id ? " is-selected" : ""
                  }${activePlaybackChordId === placedChord.id ? " is-active" : ""}`}
                  key={`${placedChord.id}-${voice.voice}`}
                  style={{
                    gridColumn: placedChordGridColumn(placedChord),
                    gridRow: harmonyVoiceGridRow(voice.voice),
                  }}
                  title={`${voice.voice}: ${voice.noteName} in ${placedChord.chord.symbol}`}
                  onClick={() => openInspectorOnChord(placedChord.id)}
                >
                  {voice.noteName}
                </button>
              )),
            )}
            {selectedCandidate.chords.map((placedChord) => (
              <button
                type="button"
                className={`chord-block${
                  selectedChord.id === placedChord.id ? " is-selected" : ""
                }${activePlaybackChordId === placedChord.id ? " is-active" : ""}`}
                key={placedChord.id}
                style={{
                  gridColumn: placedChordGridColumn(placedChord),
                  gridRow: HARMONY_VOICE_ROWS.length + 1,
                }}
                onClick={() => openInspectorOnChord(placedChord.id)}
              >
                <strong>{placedChord.chord.symbol}</strong>
                <span>{placedChord.chord.roman}</span>
              </button>
            ))}
          </>
        ) : (
          <div className="harmony-placeholder">
            {isGenerating ? t("lane.scoring") : t("lane.placeholder")}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className={`app-shell${!guided ? " expert" : ""}`}>
      <header className="command-bar" aria-label="Main controls">
        <div className="brand-lockup">
          <span className="brand-mark">H</span>
          <div>
            <h1>Harmony Auxiliary</h1>
            <p>{t("brand.subtitle")}</p>
          </div>
        </div>

        <nav className="command-actions" aria-label="Project settings">
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept=".mid,.midi,audio/midi"
            onChange={(event) => void handleFileSelected(event.currentTarget.files?.[0] ?? null)}
          />
          <div className="segmented-control" aria-label="Workspace language">
            <button type="button" aria-pressed={language === "zh"} onClick={() => setLanguage("zh")}>
              中文
            </button>
            <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
              EN
            </button>
          </div>
          {isDemo ? (
            <div className="account-cluster" aria-label={t("auth.account")}>
              <span className="demo-badge">{t("auth.demoBadge")}</span>
              {authStatus !== "unconfigured" ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setAuthIntent("enter");
                    setAuthOpen(true);
                  }}
                >
                  {t("auth.signIn")}
                </button>
              ) : null}
            </div>
          ) : authStatus === "authenticated" && user?.email ? (
            <div className="account-cluster" aria-label={t("auth.account")}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setProjectsOpen(true)}
              >
                {t("action.projects")}
              </button>
              <span className="account-email" title={user.email}>
                {user.email}
              </span>
              <button type="button" className="secondary-button" onClick={() => void handleSignOut()}>
                {t("auth.signOut")}
              </button>
            </div>
          ) : null}
          <div className="segmented-control" aria-label={t("view.label")}>
            <button
              type="button"
              aria-pressed={viewMode === "guided"}
              onClick={() => setViewMode("guided")}
            >
              {t("view.guided")}
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "expert"}
              onClick={() => setViewMode("expert")}
            >
              {t("view.expert")}
            </button>
          </div>
          {!guided ? (
            <>
              <details className="settings-tray">
                <summary>{t("settings.projectSettings")}</summary>
                {renderSettingsFields()}
              </details>
              <button
                type="button"
                className="primary-button"
                disabled={!hasMelody || isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? t("action.generating") : t("action.generate")}
              </button>
            </>
          ) : null}
        </nav>
      </header>

      <section
        className={`workspace-grid${guided && !showInspector ? " is-single" : ""}${
          !guided ? " is-expert" : ""
        }`}
      >
        <section className="timeline-panel" aria-label="Music timeline">
          <div className="timeline-header">
            <div>
              <span className="eyebrow">{t("timeline.label")}</span>
              <h2>{hasMelody ? t("timeline.active") : t("timeline.start")}</h2>
            </div>
            {toneStatus === "loading" ? (
              <span className="tone-status" data-tone="loading" role="status">
                {t("tone.loading")}
              </span>
            ) : toneStatus === "fallback" ? (
              <span className="tone-status" data-tone="fallback" role="status">
                {t("tone.fallback")}
              </span>
            ) : null}
          </div>

          {guided ? (
            <>
              {renderStepRail()}
              {renderStepCoach()}
            </>
          ) : null}

          {showStageToolbar ? (
          <div className="stage-toolbar">
            {showSourceTools ? (
            <div className="toolbar-source" aria-label="Input source">
              <div className="segmented-control" aria-label="Input mode">
                <button
                  type="button"
                  aria-pressed={state.settings.inputMode === "midi"}
                  onClick={() => dispatch({ type: "set-input-mode", inputMode: "midi" })}
                >
                  {t("input.midi")}
                </button>
                <button
                  type="button"
                  aria-pressed={state.settings.inputMode === "manual"}
                  onClick={() => dispatch({ type: "set-input-mode", inputMode: "manual" })}
                >
                  {t("input.manual")}
                </button>
              </div>

              {state.settings.inputMode === "manual" ? (
                <>
                  <label className="field duration-select">
                    <span>{t("dock.duration")}</span>
                    <select
                      value={durationBeats}
                      onChange={(event) =>
                        setDurationBeats(Number(event.target.value) as typeof durationBeats)
                      }
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="tool-group" role="group" aria-label="Edit notes">
                    <button
                      type="button"
                      className="tool-button"
                      disabled={!selectedNoteId}
                      onClick={handleDeleteSelectedNote}
                    >
                      {t("action.deleteNote")}
                    </button>
                    <button
                      type="button"
                      className="tool-button"
                      disabled={!hasMelody}
                      onClick={() => {
                        dispatch({ type: "undo-note" });
                        setSelectedNoteId(null);
                      }}
                    >
                      {t("action.undo")}
                    </button>
                    <button
                      type="button"
                      className="tool-button"
                      disabled={!hasMelody}
                      onClick={() => {
                        dispatch({ type: "clear-melody" });
                        setSelectedNoteId(null);
                      }}
                    >
                      {t("action.clear")}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  {isImporting ? t("action.importing") : t("action.importMidi")}
                </button>
              )}

              <details className="overflow-menu">
                <summary aria-label={t("action.more")}>{t("action.more")}</summary>
                <div>
                  <button type="button" className="secondary-button" onClick={handleLoadDemo}>
                    {t("action.loadDemo")}
                  </button>
                  <button type="button" className="secondary-button" onClick={handleLoadLongDemo}>
                    {t("action.loadLongDemo")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleClearLocalData()}
                  >
                    {t("action.clearLocalData")}
                  </button>
                </div>
              </details>
            </div>
            ) : null}

            {/* Expert moves the transport into the harmony drawer header; guided
                keeps it inline in the stage toolbar (TASK6 §11). */}
            {showTransport && guided ? transportEl : null}
          </div>
          ) : null}

          {harmonyIsOutdated ? (
            <div className="harmony-status-banner" role="status">
              <strong>{t("harmony.outdatedTitle")}</strong>
              <span>{t("harmony.outdatedCopy")}</span>
            </div>
          ) : null}

          {state.settings.inputMode === "midi" &&
          (state.importState.tracks?.length || state.importState.fileName) ? (
            <div className="midi-track-panel" aria-label="MIDI track selection">
              {state.importState.tracks?.length ? (
                <label>
                  {t("midi.track")}
                  <select
                    value={state.importState.selectedTrackIndex ?? ""}
                    onChange={(event) => handleTrackChange(Number(event.target.value))}
                    disabled={!currentMidiFile}
                  >
                    {state.importState.tracks.map((track) => (
                      <option value={track.index} key={track.index}>
                        {track.name} - {track.instrumentName} - {track.noteCount} notes
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <strong>{t("midi.restored")}</strong>
              )}
              <span>
                {state.importState.fileName} {t("midi.imported")}
                {state.importState.tracks?.length
                  ? lastAutosaveAt
                    ? ` - ${t("midi.autosaved")} ${lastAutosaveAt}`
                    : ""
                  : ` - ${t("midi.reimport")}`}
              </span>
            </div>
          ) : null}

          {recoveredSnapshot ? (
            <div className="recovery-banner" role="status">
              <div>
                <strong>{t("recovery.title")}</strong>
                <span>
                  {recoveredSnapshot.title}, updated{" "}
                  {new Date(recoveredSnapshot.updatedAt).toLocaleString()}
                </span>
              </div>
              <div className="input-actions">
                <button type="button" className="secondary-button" onClick={restoreAutosave}>
                  {t("action.restore")}
                </button>
                <button type="button" className="secondary-button" onClick={() => void discardAutosave()}>
                  {t("action.discard")}
                </button>
              </div>
            </div>
          ) : null}

          {showMigratePrompt ? (
            <div className="recovery-banner" role="status">
              <div>
                <strong>{t("projects.migratePrompt")}</strong>
              </div>
              <div className="input-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={projectsBusy}
                  onClick={() => void handleSaveNewProject()}
                >
                  {t("projects.migrateCta")}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowMigratePrompt(false)}
                >
                  {t("projects.migrateDismiss")}
                </button>
              </div>
            </div>
          ) : null}

          {state.errors.length > 0 ? (
            <div
              className="message-banner"
              data-tone={state.errors.some((error) => error.tone !== "status") ? "error" : "status"}
              role={state.errors.some((error) => error.tone !== "status") ? "alert" : "status"}
            >
              {state.errors.map((error) => (
                <span key={error.id}>{error.message}</span>
              ))}
            </div>
          ) : null}

          {!guided && showPianoRoll && showEditableGrid && navView.total > navView.view + 1 ? (
            <div
              className="timeline-nav"
              ref={navTrackRef}
              role="scrollbar"
              aria-label="Timeline viewport"
              aria-orientation="horizontal"
              onPointerDown={handleNavPointerDown}
            >
              <div
                className="timeline-nav-thumb"
                style={{
                  left: `${Math.max(0, Math.min(100, (navView.left / navView.total) * 100))}%`,
                  width: `${Math.max(8, Math.min(100, (navView.view / navView.total) * 100))}%`,
                }}
              />
            </div>
          ) : null}

          {showPianoRoll ? (
          <div className="timeline-canvas" data-empty={!hasMelody}>
            {!showEditableGrid ? (
              <div className="empty-state">
                <span className="empty-kicker">{t("empty.kicker")}</span>
                <h3>{t("empty.title")}</h3>
                <p>{t("empty.copy")}</p>
                <button type="button" className="primary-button" onClick={handleLoadDemo}>
                  {t("action.loadDemo")}
                </button>
                <button type="button" className="secondary-button" onClick={handleLoadLongDemo}>
                  {t("action.loadLongDemo")}
                </button>
              </div>
            ) : (
              <div className="timeline-stack" style={timelineGridStyle}>
                <div
                  className="timeline-window ruler-window"
                  ref={rulerScrollRef}
                  onScroll={syncHorizontalScroll}
                  aria-hidden="true"
                >
                  <div className="bar-ruler">
                    <span className="ruler-corner" />
                    {Array.from({ length: timelineMetrics.measureCount }, (_, index) => (
                      <span
                        key={`bar-${index + 1}`}
                        style={{
                          gridColumn: `${beatToGridColumn(
                            index * timelineMetrics.beatsPerMeasure,
                          )} / span ${durationToGridSpan(timelineMetrics.beatsPerMeasure)}`,
                        }}
                      >
                        {index + 1}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="window-title">{t("lane.melody")}</div>
                <div
                  className="timeline-window melody-window"
                  ref={melodyScrollRef}
                  onScroll={syncHorizontalScroll}
                  aria-label="Melody piano roll"
                >
                  <div
                    className="melody-grid"
                    data-editable={state.settings.inputMode === "manual"}
                    onPointerDown={handleMelodyLanePointerDown}
                    onPointerMove={handleNotePointerMove}
                    onPointerUp={handleNotePointerUp}
                    onPointerLeave={handleNotePointerUp}
                  >
                    <div className="piano-keys">
                      {PITCH_ROWS.map((row) => (
                        <button
                          type="button"
                          className="piano-key"
                          data-black={row.isBlack}
                          data-root={row.label.startsWith("C")}
                          key={row.label}
                          aria-label={`Preview ${row.label}`}
                          title={row.label}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => auditionPitch(row.midi)}
                        >
                          {row.label}
                        </button>
                      ))}
                    </div>
                    <div className="piano-roll-cells" aria-hidden="true">
                      {PITCH_ROWS.map((row, index) => (
                        <span
                          key={`row-${row.label}`}
                          data-black={row.isBlack}
                          data-root={row.label.startsWith("C")}
                          style={{ gridRow: index + 1 }}
                        />
                      ))}
                    </div>
                    {hasMelody ? (
                      <div
                        className="playhead"
                        aria-hidden="true"
                        style={{ left: `${playheadLeft}px` }}
                      />
                    ) : null}
                    {state.melody.map((note) => (
                      <button
                        type="button"
                        className={`note${selectedNoteId === note.id ? " is-selected" : ""}`}
                        key={note.id}
                        data-editable={state.settings.inputMode === "manual"}
                        style={{
                          gridColumn: noteGridColumn(note),
                          gridRow: noteGridRow(note),
                        }}
                        aria-label={`${note.name}, ${note.durationBeats} beat(s)`}
                        title={`${note.name}, ${note.durationBeats} beat(s)`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedNoteId(note.id);
                        }}
                        onPointerDown={(event) => handleNotePointerDown(event, note, "move")}
                      >
                        <span>{note.name}</span>
                        {state.settings.inputMode === "manual" ? (
                          <span
                            className="note-resize-handle"
                            aria-hidden="true"
                            onPointerDown={(event) => handleNotePointerDown(event, note, "resize")}
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Guided keeps harmony inline; expert moves it to the bottom
                    drawer below (TASK6 §11 Phase A). */}
                {guided ? (
                  <>
                    <div className="window-title">{t("lane.harmony")}</div>
                    {harmonyWindowEl}
                  </>
                ) : null}
              </div>
            )}
          </div>
          ) : null}

          {showCandidateStrip ? (
          <div className="candidate-strip" aria-label="Harmony candidates">
            {isGenerating
              ? ["stable-classical", "pop-songwriting", "color-tension"].map((mode) => (
                  <div className="candidate candidate-loading" key={mode}>
                    <span>{t(`candidate.${mode}.title`)}</span>
                    <strong>{t("candidate.loading")}</strong>
                    <small>{t("candidate.scoring")}</small>
                  </div>
                ))
              : state.candidates.length > 0
                ? state.candidates.map((candidate) => (
                    <button
                      type="button"
                      className={`candidate${
                        selectedCandidate?.id === candidate.id ? " is-selected" : ""
                      }${harmonyIsOutdated ? " is-outdated" : ""}`}
                      key={candidate.id}
                      title={candidateProgression(candidate)}
                      onClick={() => handleSelectCandidate(candidate.id)}
                    >
                      <span>{t(`candidate.${candidate.mode}.title`)}</span>
                      <strong title={candidateProgression(candidate)}>
                        {candidateProgression(candidate)}
                      </strong>
                      <small>
                        {harmonyIsOutdated
                          ? t("candidate.outdated")
                          : t(`candidate.${candidate.mode}.subtitle`)}
                      </small>
                    </button>
                  ))
                : ["stable-classical", "pop-songwriting", "color-tension"].map((mode) => (
                    <button type="button" className="candidate" disabled key={mode}>
                      <span>{t(`candidate.${mode}.title`)}</span>
                      <strong>{t("candidate.waiting")}</strong>
                      <small>{hasMelody ? t("candidate.ready") : t("candidate.needsMelody")}</small>
                    </button>
                  ))}
          </div>
          ) : null}

          {/* Harmony bottom drawer — last child so it sticks to the column's
              bottom, sharing the melody's exact left origin (TASK6 §11 Phase A). */}
          {!guided && showPianoRoll && showEditableGrid ? (
            <div
              className={`harmony-drawer${harmonyDrawerOpen ? " is-open" : ""}`}
              style={timelineGridStyle}
            >
              <div className="harmony-drawer-inner">
                <span className="harmony-drawer-grip" aria-hidden="true" />
                <div className="harmony-drawer-header">
                  <button
                    type="button"
                    className="harmony-drawer-handle"
                    aria-expanded={harmonyDrawerOpen}
                    aria-controls="harmony-drawer-body"
                    onClick={() => setHarmonyDrawerOpen((open) => !open)}
                  >
                    <span className="window-title">{t("lane.harmony")}</span>
                    {!harmonyDrawerOpen ? (
                      <span className="harmony-drawer-preview">
                        {selectedCandidate
                          ? candidateProgression(selectedCandidate)
                          : t("lane.placeholder")}
                      </span>
                    ) : null}
                    <span className="harmony-drawer-caret" aria-hidden="true" />
                  </button>
                  {showTransport ? transportEl : null}
                </div>
                <div className="harmony-drawer-body" id="harmony-drawer-body">
                  {harmonyWindowEl}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {showInspector ? (
        <aside
          className={`inspector${!guided ? " inspector-sheet" : ""}${
            !guided && inspectorOpen ? " is-open" : ""
          }`}
          aria-label="Selected harmony details"
          aria-hidden={!guided && !inspectorOpen ? true : undefined}
        >
          {!guided ? (
            <button
              type="button"
              className="inspector-close"
              aria-label={t("auth.close")}
              onClick={() => setInspectorOpen(false)}
            >
              ×
            </button>
          ) : null}
          <span className="eyebrow">{t("inspector.label")}</span>
          {selectedCandidate && selectedChord ? (
            <>
              <h2>{selectedChord.chord.symbol}</h2>
              <p className="candidate-summary">
                {t(`candidate.${selectedCandidate.mode}.summary`)}
              </p>
              <div className="inspector-rows">
                <div>
                  <span>{t("inspector.roman")}</span>
                  <strong>{selectedChord.chord.roman}</strong>
                </div>
                <div>
                  <span>{t("inspector.function")}</span>
                  <strong>{selectedChord.chord.functionLabel}</strong>
                </div>
                <div>
                  <span>{t("inspector.melody")}</span>
                  <strong>
                    {selectedChord.explanation.melodyRelationships[0]
                      ? `${selectedChord.explanation.melodyRelationships[0].noteName} = ${relationshipLabel(
                          language,
                          selectedChord.explanation.melodyRelationships[0].relationship,
                        )}`
                      : t("inspector.noNote")}
                  </strong>
                </div>
              </div>
              <p>
                {describeFit(
                  language,
                  selectedChord.chord,
                  selectedChord.explanation.fit,
                  selectedChord.explanation.fitReason,
                )}
              </p>
              <p>
                {describeFunction(
                  language,
                  selectedChord.chord,
                  selectedChord.explanation.functionInfo,
                  selectedChord.explanation.functionReason,
                )}
              </p>
              {selectedChord.explanation.warnings.length > 0 ? (
                <p className="warning-copy">
                  {describeWarnings(
                    language,
                    selectedChord.chord,
                    selectedChord.explanation.warningNotes,
                    selectedChord.explanation.warnings,
                  )}
                </p>
              ) : null}
              <div className="alternative-chords" aria-label="Alternative chords">
                <span>{t("inspector.alternatives")}</span>
                <div>
                  {chordAlternatives.slice(0, 4).map((alternative, index) => (
                    <button
                      type="button"
                      key={`${alternative.chord.id}-${index}`}
                      onClick={() => handleReplaceChord(index)}
                    >
                      <strong>{alternative.chord.symbol}</strong>
                      <small>{alternative.chord.roman}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="export-actions">
                <button type="button" className="secondary-button" onClick={() => void handleCopyProgression()}>
                  {t("action.copyProgression")}
                </button>
                <button type="button" className="secondary-button" onClick={handleExportMidi}>
                  {t("action.exportMidi")}
                </button>
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <h2>{t("inspector.noChord")}</h2>
              <p>{t("inspector.emptyCopy")}</p>
              <div className="inspector-rows">
                <div>
                  <span>{t("inspector.melody")}</span>
                  <strong>
                    {hasMelody
                      ? `${state.melody.length} ${t("inspector.notes")}`
                      : t("inspector.empty")}
                  </strong>
                </div>
                <div>
                  <span>{t("inspector.generate")}</span>
                  <strong>{hasMelody ? t("inspector.available") : t("inspector.disabled")}</strong>
                </div>
              </div>
            </div>
          )}
        </aside>
        ) : null}
      </section>

      {authOpen ? (
        <AuthPanel
          language={language}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
        />
      ) : null}

      {projectsOpen ? (
        <ProjectsPanel
          language={language}
          projects={cloudProjects}
          activeProjectId={activeProjectId}
          loading={projectsLoading}
          busy={projectsBusy}
          canSaveCurrent={hasMelody}
          onClose={() => setProjectsOpen(false)}
          onOpen={handleOpenProject}
          onRename={(id, title) => void handleRenameProject(id, title)}
          onDelete={(id) => void handleDeleteProject(id)}
          onSaveNew={() => void handleSaveNewProject()}
          onUpdateCurrent={() => void handleUpdateCurrentProject()}
          onDeleteAll={() => void handleClearCloudData()}
        />
      ) : null}
    </main>
  );
}

export default App;
