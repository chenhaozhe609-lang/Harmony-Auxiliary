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
import { pathForRoute, routeFromPath, type AppScreen } from "./appRouter";
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
import { AudioEngine, isSampledTonePreset } from "../music/audio/audioEngine";
import { demoMelody, longDemoMelody } from "../music/fixtures/demoMelodies";
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
  MidiImportResult,
  NoteEvent,
  ScoredChord,
  StoredProjectSnapshot,
} from "../music/types";
import {
  beatToPixel,
  createTimelineGridMetrics,
  getTimelineEndBeat,
  MIN_NOTE_DURATION_BEATS,
  pixelDeltaToSnappedBeats,
  pixelToSnappedBeat,
} from "./timelineGrid";
import {
  PITCH_ROWS,
  PITCH_ROW_HEIGHT,
  candidateProgression,
  createManualGridNote,
  midiForDraggedPitch,
  pitchRowIndex,
  selectedCandidateFrom,
  selectedChordFrom,
  updateNotePitch,
  updateNoteTiming,
} from "./pianoRollLayout";
import { DURATION_OPTIONS, GUIDE_STEPS, type DurationBeats } from "./workspaceConstants";
import "./App.css";
import Landing from "../components/landing/Landing";
import { CommandBar } from "../components/workspace/CommandBar";
import { PianoRoll } from "../components/workspace/PianoRoll";
import { HarmonyLane } from "../components/workspace/HarmonyLane";
import { CandidateStrip } from "../components/workspace/CandidateStrip";
import { DeepDivePanel } from "../components/workspace/DeepDivePanel";
import { Inspector } from "../components/workspace/Inspector";
import { Transport } from "../components/workspace/Transport";
import { GuideOverlay } from "../components/workspace/GuideOverlay";

type NoteDragState = {
  noteId: string;
  mode: "move" | "resize";
  originClientX: number;
  originClientY: number;
  originalNote: NoteEvent;
};

function App() {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const initialRoute = useMemo(
    () => routeFromPath(typeof window === "undefined" ? "/" : window.location.pathname),
    [],
  );
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    createInitialState(initialPreferences),
  );
  const { status: authStatus, user, signOut } = useAuth();
  const [screen, setScreen] = useState<AppScreen>(initialRoute.screen);
  const [isDemo, setIsDemo] = useState(initialRoute.isDemo);
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
  // One unified workspace now (TASK6 §11 Phase B); persist a stable expert mode
  // so any older "guided" preference is migrated forward.
  const viewMode: WorkspaceViewMode = "expert";
  const [activeStep, setActiveStep] = useState(0);
  const [durationBeats, setDurationBeats] = useState<DurationBeats>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [harmonyFlow, setHarmonyFlow] = useState<"compare" | "deep-dive">("compare");
  const [auditioningCandidateId, setAuditioningCandidateId] = useState<string | null>(null);
  const [chordAlternatives, setChordAlternatives] = useState<ScoredChord[]>([]);
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
  const navigateApp = (
    route: { screen: AppScreen; isDemo: boolean },
    mode: "push" | "replace" = "push",
  ) => {
    setScreen(route.screen);
    setIsDemo(route.isDemo);
    if (typeof window === "undefined") return;
    const path = pathForRoute(route);
    if (window.location.pathname === path) return;
    const method = mode === "replace" ? "replaceState" : "pushState";
    window.history[method](null, "", path);
  };

  useEffect(() => {
    const handlePopState = () => {
      const route = routeFromPath(window.location.pathname);
      setScreen(route.screen);
      setIsDemo(route.isDemo);
      if (route.screen === "workspace") setActiveStep(0);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (screen === "workspace" && isDemo && state.melody.length === 0) {
      dispatch({ type: "load-melody", melody: demoMelody });
    }
  }, [screen, isDemo, state.melody.length]);

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
    const rowIndex = pitchRowIndex(averageMidi);
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
      navigateApp({ screen: "landing", isDemo: false }, "replace");
    }
  }, [screen, authStatus, isDemo]);

  const canSaveToCloud = authStatus === "authenticated";

  const enterWorkspace = () => {
    // Unconfigured builds (no Supabase secrets) pass straight through for dev/CI.
    if (authStatus === "authenticated" || authStatus === "unconfigured") {
      setActiveStep(0);
      navigateApp({ screen: "workspace", isDemo: false });
      return;
    }
    setAuthIntent("enter");
    setAuthOpen(true);
  };

  const enterDemo = () => {
    setAuthOpen(false);
    setActiveStep(0);
    navigateApp({ screen: "workspace", isDemo: true });
    if (state.melody.length === 0) {
      dispatch({ type: "load-melody", melody: demoMelody });
    }
  };

  const handleAuthenticated = () => {
    setAuthOpen(false);
    if (authIntent === "enter") {
      if (screen !== "workspace") setActiveStep(0);
      navigateApp({ screen: "workspace", isDemo: false });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigateApp({ screen: "landing", isDemo: false }, "replace");
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
  useEffect(() => {
    if (!selectedChord) {
      setChordAlternatives([]);
      return;
    }

    let cancelled = false;
    import("../music/harmony/chordAlternatives")
      .then(({ getChordAlternatives }) => {
        if (cancelled) return;
        setChordAlternatives(
          getChordAlternatives(state.melody, state.settings, selectedChord).filter(
            (alternative) => alternative.chord.id !== selectedChord.chord.id,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setChordAlternatives([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChord, state.melody, state.settings]);
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

  // TASK6 §11 Phase B: the workspace is one unified expert stage. Guidance is an
  // on-demand popup wizard (`guideOpen`), not a separate view — so the layout no
  // longer branches on a "guided" mode.
  const [guideOpen, setGuideOpen] = useState(false);

  // TASK7 §13 E3: the inspector is the harmony phase's resident "why this chord"
  // panel — no longer a click-to-open sheet. Clicking a chord just selects it;
  // the panel re-reads the selection.
  const selectChord = (chordId: string) => {
    dispatch({ type: "select-chord", chordId });
  };

  // Expert stage (TASK6 §11 Phase A): the melody roll is the full-viewport body
  // and harmony lives in a bottom drawer. It auto-opens once harmony exists so
  // the result is visible (and the chord blocks stay queryable for verify).
  const [harmonyDrawerOpen, setHarmonyDrawerOpen] = useState(false);
  const hasHarmony = Boolean(selectedCandidate && selectedChord);
  useEffect(() => {
    if (hasHarmony) setHarmonyDrawerOpen(true);
  }, [hasHarmony]);

  // TASK7 §11: phase-aware workspace. Editing the melody and exploring harmony
  // are distinct phases — the edit phase shows NO harmony UI (a clean melody
  // editor); the harmony phase brings candidates + harmony forward. Derived from
  // whether harmony exists, with an explicit "back to edit" override.
  const [editOverride, setEditOverride] = useState(false);
  const inHarmonyPhase = (showCandidates || isGenerating) && !editOverride;
  const isDeepDivePhase = inHarmonyPhase && harmonyFlow === "deep-dive" && Boolean(selectedCandidate);

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

  // The unified workspace always shows every region; the guide popup only
  // explains/drives them, it no longer gates visibility.
  const showSourceTools = !isDeepDivePhase;
  const showTransport = true;
  const showPianoRoll = true;
  // Harmony UI (candidate strip + drawer) only appears in the harmony phase, so
  // the edit phase is a clean melody editor (TASK7 §11.2).
  const showCandidateStrip = inHarmonyPhase;
  // The explanation panel is resident in the harmony phase only (TASK7 §13 E3).
  const showInspector = inHarmonyPhase;
  const showStageToolbar = !isDeepDivePhase;

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
    setEditOverride(false); // generating enters the harmony phase
    setHarmonyFlow("compare");
    setAuditioningCandidateId(null);
    setIsGenerating(true);
    window.setTimeout(() => {
      import("../music/harmony/generateCandidates")
        .then(({ generateHarmonyCandidates }) => {
          dispatch({
            type: "set-candidates",
            candidates: generateHarmonyCandidates(state.melody, state.settings),
          });
          // Advance the guided flow to the audition step once candidates exist.
          setActiveStep((current) => (current < 3 ? 3 : current));
        })
        .catch(() => {
          dispatch({ type: "set-error", id: "generate", message: t("message.generateFailure") });
        })
        .finally(() => setIsGenerating(false));
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
    void import("../music/harmony/chordAlternatives").then(({ makeReplacementPlacedChord }) => {
      dispatch({
        type: "replace-chord",
        candidateId: selectedCandidate.id,
        chordId: selectedChord.id,
        replacement: makeReplacementPlacedChord(selectedChord, alternative),
      });
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

  // Keep the navigator in sync when the timeline width or layout changes. A
  // post-layout frame plus a ResizeObserver are needed because an empty project
  // (e.g. logged in with no melody) never fires a scroll or melody change, so a
  // single synchronous measurement can run before the roll has its real width.
  useEffect(() => {
    const el = melodyScrollRef.current;
    const measure = () => updateNavView();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    let observer: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    timelineMetrics,
    hasMelody,
    viewMode,
    harmonyDrawerOpen,
    screen,
    showEditableGrid,
    inHarmonyPhase,
    isDeepDivePhase,
  ]);

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
    setAuditioningCandidateId(null);
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      dispatch({ type: "pause-playback" });
    }
  };

  const resetPlayback = () => {
    audioEngineRef.current?.stop();
    setAuditioningCandidateId(null);
    dispatch({ type: "reset-playback" });
  };

  const startPlaybackAt = async (
    startBeat: number,
    errorMessage: string,
    candidateOverride?: HarmonyCandidate | null,
  ) => {
    if (!canPlayTimeline || state.playback.status === "starting") return;
    const playbackCandidate =
      candidateOverride === undefined
        ? harmonyIsReady
          ? selectedCandidate
          : null
        : candidateOverride;
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
        () => {
          setAuditioningCandidateId(null);
          dispatch({ type: "reset-playback" });
        },
      );
      dispatch({ type: "set-playback-status", status: "playing" });
    } catch {
      setAuditioningCandidateId(null);
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

  const handlePreviewCandidate = async (candidateId: string) => {
    const candidate = state.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    if (auditioningCandidateId === candidateId && state.playback.status === "playing") {
      pausePlayback();
      return;
    }
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      audioEngineRef.current?.stop();
    }
    dispatch({ type: "select-candidate", candidateId });
    setAuditioningCandidateId(candidateId);
    await startPlaybackAt(0, t("message.audioRestart"), candidate);
  };

  const handleDeepDiveCandidate = (candidateId: string) => {
    handleSelectCandidate(candidateId);
    setHarmonyFlow("deep-dive");
  };

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

  // One transport instance, rendered in exactly one place per phase: a bottom
  // bar in the edit phase (melody playback), the harmony drawer header in the
  // harmony phase (TASK7 §11.2).
  const transportEl = showTransport ? (
    <Transport
      t={t}
      canPlayTimeline={canPlayTimeline}
      playbackStatus={state.playback.status}
      melodyMuted={state.playback.melodyMuted}
      harmonyMuted={state.playback.harmonyMuted}
      harmonyIsReady={harmonyIsReady}
      currentBeat={state.playback.currentBeat}
      onPlayFromStart={() => void handlePlayFromStart()}
      onPlayFromCurrentMeasure={() => void handlePlayFromCurrentMeasure()}
      onPlayPause={playSelectedCandidate}
      onToggleMelodyMute={toggleMelodyMute}
      onToggleHarmonyMute={toggleHarmonyMute}
    />
  ) : null;

  const candidateStripEl = showCandidateStrip ? (
    <CandidateStrip
      t={t}
      isGenerating={isGenerating}
      candidates={state.candidates}
      selectedCandidate={selectedCandidate}
      harmonyFlow={harmonyFlow}
      playbackStatus={state.playback.status}
      auditioningCandidateId={auditioningCandidateId}
      harmonyIsOutdated={harmonyIsOutdated}
      hasMelody={hasMelody}
      onPreviewCandidate={(candidateId) => void handlePreviewCandidate(candidateId)}
      onDeepDiveCandidate={handleDeepDiveCandidate}
    />
  ) : null;

  return (
    <main className="app-shell expert">
      <CommandBar
        t={t}
        fileInputRef={fileInputRef}
        onFileSelected={(file) => void handleFileSelected(file)}
        language={language}
        onSetLanguage={setLanguage}
        isDemo={isDemo}
        authStatus={authStatus}
        userEmail={user?.email ?? null}
        onRequestSignIn={() => {
          setAuthIntent("enter");
          setAuthOpen(true);
        }}
        onOpenProjects={() => setProjectsOpen(true)}
        onSignOut={() => void handleSignOut()}
        guideOpen={guideOpen}
        onOpenGuide={() => setGuideOpen(true)}
        settings={state.settings}
        dispatch={dispatch}
        playbackStatus={state.playback.status}
        onPausePlayback={pausePlayback}
        hasMelody={hasMelody}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        inHarmonyPhase={inHarmonyPhase}
        harmonyCandidates={state.candidates}
        selectedCandidateId={state.selectedCandidateId}
        harmonyFlow={harmonyFlow}
        onSelectHarmonyStyle={handleDeepDiveCandidate}
      />

      <section
        className={`workspace-grid is-expert${inHarmonyPhase ? " is-harmony-phase" : ""}${
          isDeepDivePhase ? " is-deep-dive" : ""
        }`}
      >
        <section className="timeline-panel" aria-label="Music timeline">
          <div className="timeline-header">
            <div>
              <span className="eyebrow">
                {inHarmonyPhase ? t("phase.harmonyEyebrow") : t("timeline.label")}
              </span>
              <h2>
                {inHarmonyPhase
                  ? t("phase.harmonyTitle")
                  : hasMelody
                    ? t("timeline.active")
                    : t("timeline.start")}
              </h2>
            </div>
            <div className="timeline-header-aside">
              {toneStatus === "loading" ? (
                <span className="tone-status" data-tone="loading" role="status">
                  {t("tone.loading")}
                </span>
              ) : toneStatus === "fallback" ? (
                <span className="tone-status" data-tone="fallback" role="status">
                  {t("tone.fallback")}
                </span>
              ) : null}
              {inHarmonyPhase ? (
                <button
                  type="button"
                  className="secondary-button phase-nav-button"
                  onClick={() => setEditOverride(true)}
                >
                  {t("phase.backToEdit")}
                </button>
              ) : showCandidates ? (
                <button
                  type="button"
                  className="secondary-button phase-nav-button"
                  onClick={() => setEditOverride(false)}
                >
                  {t("phase.viewHarmony")}
                </button>
              ) : null}
            </div>
          </div>

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

            {/* Transport lives in the harmony drawer header now. */}
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

          {isDeepDivePhase ? candidateStripEl : null}

          {isDeepDivePhase ? (
            <DeepDivePanel
              t={t}
              selectedCandidate={selectedCandidate}
              selectedChord={selectedChord}
              chordAlternatives={chordAlternatives}
              onReplaceChord={handleReplaceChord}
            />
          ) : null}

          {showPianoRoll && showEditableGrid && navView.total > navView.view + 1 ? (
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
            <PianoRoll
              t={t}
              timelineGridStyle={timelineGridStyle}
              timelineMetrics={timelineMetrics}
              rulerScrollRef={rulerScrollRef}
              melodyScrollRef={melodyScrollRef}
              onSyncScroll={syncHorizontalScroll}
              inputMode={state.settings.inputMode}
              melody={state.melody}
              selectedNoteId={selectedNoteId}
              hasMelody={hasMelody}
              showEditableGrid={showEditableGrid}
              playheadLeft={playheadLeft}
              onMelodyLanePointerDown={handleMelodyLanePointerDown}
              onNotePointerMove={handleNotePointerMove}
              onNotePointerUp={handleNotePointerUp}
              onAuditionPitch={auditionPitch}
              onSelectNote={setSelectedNoteId}
              onNotePointerDown={handleNotePointerDown}
              onLoadDemo={handleLoadDemo}
              onLoadLongDemo={handleLoadLongDemo}
            />
          ) : null}

          {!isDeepDivePhase ? candidateStripEl : null}

          {/* Harmony bottom drawer — only in the harmony phase; last child so it
              sticks to the column's bottom, sharing the melody's exact left
              origin (TASK6 §11 Phase A / TASK7 §11.2). */}
          {inHarmonyPhase ? (
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
                  {transportEl}
                </div>
                <div className="harmony-drawer-body" id="harmony-drawer-body">
                  <HarmonyLane
                    t={t}
                    harmonyScrollRef={harmonyScrollRef}
                    onScroll={syncHorizontalScroll}
                    harmonyIsOutdated={harmonyIsOutdated}
                    hasMelody={hasMelody}
                    playheadLeft={playheadLeft}
                    selectedCandidate={selectedCandidate}
                    selectedChord={selectedChord}
                    activePlaybackChordId={activePlaybackChordId}
                    isGenerating={isGenerating}
                    onSelectChord={selectChord}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Edit phase: a slim melody-playback transport at the panel bottom,
              since the harmony drawer (its usual home) is hidden (TASK7 §11.2). */}
          {!inHarmonyPhase && hasMelody ? (
            <div className="melody-transport">{transportEl}</div>
          ) : null}
        </section>

        {showInspector ? (
          <Inspector
            t={t}
            language={language}
            selectedCandidate={selectedCandidate}
            selectedChord={selectedChord}
            hasMelody={hasMelody}
            melodyCount={state.melody.length}
            isGenerating={isGenerating}
            chordAlternatives={chordAlternatives}
            onReplaceChord={handleReplaceChord}
            onCopyProgression={() => void handleCopyProgression()}
            onExportMidi={handleExportMidi}
          />
        ) : null}
      </section>

      {guideOpen ? (
        <GuideOverlay
          t={t}
          onClose={() => setGuideOpen(false)}
          guideStep={guideStep}
          furthestReachable={furthestReachable}
          canAdvanceStep={canAdvanceStep}
          goToStep={goToStep}
          settings={state.settings}
          dispatch={dispatch}
          playbackStatus={state.playback.status}
          onPausePlayback={pausePlayback}
          hasMelody={hasMelody}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          selectedCandidate={selectedCandidate}
          isDemo={isDemo}
          authStatus={authStatus}
          projectsBusy={projectsBusy}
          onCopyProgression={() => void handleCopyProgression()}
          onExportMidi={handleExportMidi}
          onRequestSignIn={() => {
            setAuthIntent("enter");
            setAuthOpen(true);
          }}
          onSaveNewProject={() => void handleSaveNewProject()}
        />
      ) : null}

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
