import { useGuide } from "./useGuide";
import { useMelodyEditing } from "./useMelodyEditing";
import { useProjectSession } from "./useProjectSession";
import { usePlayback } from "./usePlayback";
import { useHarmonyGeneration } from "./useHarmonyGeneration";
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
import type { AppScreen } from "./appRouter";
import {
  clearPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type WorkspaceViewMode,
} from "./preferencesRepository";
import { translate, type Language } from "./i18n";
import { ProjectsPanel } from "./projects/ProjectsPanel";
import { clearAllProjectData } from "./projectRepository";
import { demoMelody, longDemoMelody } from "../music/fixtures/demoMelodies";
import { createMidiFileName, exportCandidateToMidi } from "../music/midi/exportMidi";
import { parseMidiArrayBuffer } from "../music/midi/importMidi";
import type { MidiImportResult, NoteEvent, ScoredChord } from "../music/types";

import {
  createTimelineGridMetrics,
  getTimelineEndBeat,
} from "./timelineGrid";
import {
  PITCH_ROWS,
  PITCH_ROW_HEIGHT,
  candidateProgression,
  pitchRowIndex,
  selectedCandidateFrom,
  selectedChordFrom,
} from "./pianoRollLayout";
import { DURATION_OPTIONS, type DurationBeats } from "./workspaceConstants";
import "./App.css";
import { CommandBar } from "../components/workspace/CommandBar";
import { PianoRoll } from "../components/workspace/PianoRoll";
import { HarmonyLane } from "../components/workspace/HarmonyLane";
import { CandidateStrip } from "../components/workspace/CandidateStrip";
import { DeepDivePanel } from "../components/workspace/DeepDivePanel";
import { Inspector } from "../components/workspace/Inspector";
import { Transport } from "../components/workspace/Transport";
import { GuideOverlay } from "../components/workspace/GuideOverlay";

export default function Workspace({ active, isDemo, navigateApp }: {
  active: boolean;
  isDemo: boolean;
  navigateApp: (route: { screen: AppScreen; isDemo: boolean }, mode?: "push" | "replace") => void;
}) {
  const screen = active ? "workspace" : "landing";
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    createInitialState(initialPreferences),
  );
  const [language, setLanguage] = useState<Language>(initialPreferences.language);
  // One unified workspace now (TASK6 §11 Phase B); persist a stable expert mode
  // so any older "guided" preference is migrated forward.
  const viewMode: WorkspaceViewMode = "expert";
  const [durationBeats, setDurationBeats] = useState<DurationBeats>(1);
  const { isGenerating, generate } = useHarmonyGeneration(state, dispatch, () => {
    setActiveStep((current) => Math.max(3, current));
  }, active);
  const [isImporting, setIsImporting] = useState(false);
  const [harmonyFlow, setHarmonyFlow] = useState<"compare" | "deep-dive">("compare");
  const [chordAlternatives, setChordAlternatives] = useState<ScoredChord[]>([]);
  const [currentMidiFile, setCurrentMidiFile] = useState<{
    file: File;
    arrayBuffer: ArrayBuffer;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);
  const melodyScrollRef = useRef<HTMLDivElement | null>(null);
  const harmonyScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncRef = useRef(false);
  const melodyCenteredRef = useRef(false);
  const navTrackRef = useRef<HTMLDivElement | null>(null);
  // Mini timeline navigator: the visible viewport over the full timeline width.
  const [navView, setNavView] = useState({ left: 0, view: 1, total: 1 });
  const t = (key: string) => translate(language, key);
  const { clearAudioData, progress, auditioningCandidateId, setAuditioningCandidateId, toneStatus, pausePlayback, resetPlayback,
    handlePlayFromStart, handlePlayFromCurrentMeasure, playSelectedCandidate, toggleMelodyMute,
    toggleHarmonyMute, handleSelectCandidate, handlePreviewCandidate, auditionPitch } = usePlayback(state, dispatch, t, active);
  const { projects, setProjects, activeProjectId, setActiveProjectId, projectsOpen, setProjectsOpen,
    projectsLoading, projectsBusy, recoveredSnapshot, setRecoveredSnapshot, lastAutosaveAt, setLastAutosaveAt,
    setClearingLocalData, loadProjects, handleSaveNewProject, handleUpdateCurrentProject, handleOpenProject,
    handleRenameProject, handleDeleteProject, handleDeleteAllProjects, restoreAutosave, discardAutosave } = useProjectSession(
      state, dispatch, t, () => { resetPlayback(); setSelectedNoteId(null); setCurrentMidiFile(null); }, (step) => setActiveStep(step), active);
  useEffect(() => {
    if (screen === "workspace" && isDemo && state.melody.length === 0) {
      dispatch({ type: "load-melody", melody: demoMelody });
    }
  }, [screen, isDemo]);

  useEffect(() => {
    savePreferences(state.settings, language, viewMode);
  }, [state.settings, language, viewMode]);

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
  const { setActiveStep, guideOpen, setGuideOpen, guideStep, furthestReachable, canAdvanceStep, goToStep } = useGuide(
    hasMelody, showCandidates, Boolean(selectedCandidate));
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
          getChordAlternatives(state.melody, state.settings, selectedChord, 7, selectedCandidate ?? undefined).filter(
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
  }, [selectedChord, selectedCandidate, state.melody, state.settings]);
  const timelineEndBeat = useMemo(
    () => getTimelineEndBeat(state.melody, selectedCandidate),
    [state.melody, selectedCandidate],
  );
  const timelineMetrics = useMemo(
    () => createTimelineGridMetrics(timelineEndBeat, state.settings.timeSignature.numerator),
    [timelineEndBeat, state.settings.timeSignature.numerator],
  );
  const { selectedNoteId, setSelectedNoteId, handleDeleteSelectedNote, handleMelodyLanePointerDown,
    handleNotePointerDown, handleNotePointerMove, handleNotePointerUp } = useMelodyEditing(
      state, dispatch, timelineMetrics, durationBeats, pausePlayback);
  const timelineGridStyle = {
    "--pitch-row-count": PITCH_ROWS.length,
    "--timeline-grid-columns": `${timelineMetrics.labelWidth}px repeat(${timelineMetrics.columnCount}, ${timelineMetrics.subdivisionWidth}px)`,
    "--timeline-content-width": `${timelineMetrics.contentWidth}px`,
    "--timeline-label-width": `${timelineMetrics.labelWidth}px`,
    "--timeline-subdivision-width": `${timelineMetrics.subdivisionWidth}px`,
    "--timeline-beat-width": `${timelineMetrics.beatWidth}px`,
    "--timeline-measure-width": `${timelineMetrics.measureWidth}px`,
  } as CSSProperties;

  // TASK6 §11 Phase B: the workspace is one unified expert stage. Guidance is an
  // on-demand popup wizard (`guideOpen`), not a separate view — so the layout no
  // longer branches on a "guided" mode.

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
    setActiveProjectId(null);
    setCurrentMidiFile(null);
    setSelectedNoteId(null);
    setActiveStep(0);
    dispatch({ type: "load-melody", melody: demoMelody });
  };

  const handleLoadLongDemo = () => {
    resetPlayback();
    setActiveProjectId(null);
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
    void generate(t("message.generateFailure"));
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
    if (!window.confirm(t("message.clearLocalConfirm"))) return;
    setClearingLocalData(true);
    resetPlayback();
    try {
      await clearAudioData();
      await clearAllProjectData();
      clearPreferences();
      setRecoveredSnapshot(null);
      setCurrentMidiFile(null);
      setLastAutosaveAt(null);
      setProjects([]);
      setActiveProjectId(null);
      setSelectedNoteId(null);
      if (isDemo) navigateApp({ screen: "workspace", isDemo: false }, "replace");
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
    } finally {
      setClearingLocalData(false);
    }
  };

  const applyMidiImport = (
    result: MidiImportResult,
    file: File,
    arrayBuffer: ArrayBuffer,
  ) => {
    resetPlayback();
    setActiveProjectId(null);
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

  const handleDeepDiveCandidate = (candidateId: string) => {
    handleSelectCandidate(candidateId);
    setHarmonyFlow("deep-dive");
  };

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
      progress={progress}
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
        onOpenProjects={() => {
          setProjectsOpen(true);
          void loadProjects();
        }}
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
              <a className="audio-credits" href="/audio-credits.html" target="_blank" rel="noreferrer">{language === "zh" ? "音色来源" : "Audio credits"}</a>
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
              progress={progress}
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
                    progress={progress}
                    selectedCandidate={selectedCandidate}
                    selectedChord={selectedChord}
                    harmonyIsReady={harmonyIsReady}
                    timelineMetrics={timelineMetrics}
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
          projectsBusy={projectsBusy}
          onCopyProgression={() => void handleCopyProgression()}
          onExportMidi={handleExportMidi}
          onSaveNewProject={() => void handleSaveNewProject()}
        />
      ) : null}

      {projectsOpen ? (
        <ProjectsPanel
          language={language}
          projects={projects}
          activeProjectId={activeProjectId}
          loading={projectsLoading}
          busy={projectsBusy}
          notice={state.errors.find((error) => error.id === "projects")}
          canSaveCurrent={hasMelody}
          onClose={() => setProjectsOpen(false)}
          onOpen={handleOpenProject}
          onRename={(id, title) => void handleRenameProject(id, title)}
          onDelete={(id) => void handleDeleteProject(id)}
          onSaveNew={() => void handleSaveNewProject()}
          onUpdateCurrent={() => void handleUpdateCurrentProject()}
          onDeleteAll={() => void handleDeleteAllProjects()}
        />
      ) : null}
    </main>
  );
}
