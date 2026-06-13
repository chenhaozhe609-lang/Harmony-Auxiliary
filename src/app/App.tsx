import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { appReducer, createInitialState } from "./appState";
import { clearPreferences, defaultPreferences, loadPreferences, savePreferences } from "./preferencesRepository";
import { translate, type Language } from "./i18n";
import { AudioEngine } from "../music/audio/audioEngine";
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
  PitchClass,
  PlacedChord,
  StoredProjectSnapshot,
} from "../music/types";
import {
  createNoteEventId,
  midiToPitchClass,
  midiToNoteName,
  noteNameToPitchClass,
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

const NOTE_BUTTONS = ["C", "D", "E", "F", "G", "A", "B"] as const;

const DURATION_OPTIONS = [
  { labelKey: "duration.whole", value: 4 },
  { labelKey: "duration.half", value: 2 },
  { labelKey: "duration.quarter", value: 1 },
  { labelKey: "duration.eighth", value: 0.5 },
] as const;

const KEY_OPTIONS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

const PITCH_ROWS = [
  { label: "C5", midi: 72 },
  { label: "B4", midi: 71 },
  { label: "A4", midi: 69 },
  { label: "G4", midi: 67 },
  { label: "F4", midi: 65 },
  { label: "E4", midi: 64 },
  { label: "D4", midi: 62 },
  { label: "C4", midi: 60 },
] as const;

const HARMONY_VOICE_ROWS = getHarmonyVoiceRows();

type NoteDragState = {
  noteId: string;
  mode: "move" | "resize";
  originClientX: number;
  originalNote: NoteEvent;
};

const demoMelody: NoteEvent[] = [
  { midi: 64, startBeat: 0, durationBeats: 1.5 },
  { midi: 67, startBeat: 2, durationBeats: 0.75 },
  { midi: 72, startBeat: 3, durationBeats: 2 },
  { midi: 71, startBeat: 6.25, durationBeats: 1.5 },
  { midi: 69, startBeat: 7.75, durationBeats: 1.5 },
].map((note, index) => ({
  id: createNoteEventId("demo", index),
  midi: note.midi,
  pitchClass: (note.midi % 12) as PitchClass,
  name: midiToNoteName(note.midi),
  startBeat: note.startBeat,
  durationBeats: note.durationBeats,
  velocity: 0.82,
  source: "demo",
}));

function getNextStartBeat(melody: NoteEvent[]): number {
  if (melody.length === 0) return 0;
  return Math.max(...melody.map((note) => note.startBeat + note.durationBeats));
}

function createManualNote(noteName: string, durationBeats: number, melody: NoteEvent[]): NoteEvent {
  const pitchClass = noteNameToPitchClass(noteName);
  const midi = 60 + pitchClass;
  const index = melody.length;
  const startBeat = getNextStartBeat(melody);

  return {
    id: `${createNoteEventId("manual", index)}-${Math.round(startBeat * 100)}-${midi}`,
    midi,
    pitchClass,
    name: midiToNoteName(midi),
    startBeat,
    durationBeats,
    velocity: 0.8,
    source: "manual",
  };
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

function noteGridRow(note: NoteEvent): number {
  const closestIndex = PITCH_ROWS.reduce(
    (bestIndex, row, index) =>
      Math.abs(row.midi - note.midi) < Math.abs(PITCH_ROWS[bestIndex].midi - note.midi)
        ? index
        : bestIndex,
    0,
  );
  return closestIndex + 1;
}

function updateNoteTiming(note: NoteEvent, startBeat: number, durationBeats: number): NoteEvent {
  return {
    ...note,
    startBeat,
    durationBeats,
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

function App() {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    createInitialState(initialPreferences),
  );
  const [screen, setScreen] = useState<"landing" | "workspace">("landing");
  const [language, setLanguage] = useState<Language>(initialPreferences.language);
  const [durationBeats, setDurationBeats] = useState<(typeof DURATION_OPTIONS)[number]["value"]>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [recoveredSnapshot, setRecoveredSnapshot] = useState<StoredProjectSnapshot | null>(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);
  const [currentMidiFile, setCurrentMidiFile] = useState<{
    file: File;
    arrayBuffer: ArrayBuffer;
  } | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noteDragRef = useRef<NoteDragState | null>(null);
  const t = (key: string) => translate(language, key);

  useEffect(() => {
    savePreferences(state.settings, language);
  }, [state.settings, language]);

  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
    return () => audioEngineRef.current?.stop();
  }, []);

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
    "--timeline-grid-columns": `${timelineMetrics.labelWidth}px repeat(${timelineMetrics.columnCount}, ${timelineMetrics.subdivisionWidth}px)`,
    "--timeline-content-width": `${timelineMetrics.contentWidth}px`,
    "--timeline-label-width": `${timelineMetrics.labelWidth}px`,
    "--timeline-subdivision-width": `${timelineMetrics.subdivisionWidth}px`,
    "--timeline-beat-width": `${timelineMetrics.beatWidth}px`,
    "--timeline-measure-width": `${timelineMetrics.measureWidth}px`,
  } as CSSProperties;
  const playheadLeft = beatToPixel(state.playback.currentBeat, timelineMetrics);
  const activePlaybackChordId =
    selectedCandidate?.chords.find(
      (placedChord) =>
        state.playback.currentBeat >= placedChord.startBeat &&
        state.playback.currentBeat < placedChord.startBeat + placedChord.durationBeats,
    )?.id ?? null;

  const handleLoadDemo = () => {
    stopPlayback();
    setCurrentMidiFile(null);
    setSelectedNoteId(null);
    dispatch({ type: "load-melody", melody: demoMelody });
  };

  const handleGenerate = () => {
    if (!hasMelody) {
      dispatch({ type: "set-error", id: "generate", message: t("message.generateNoMelody") });
      return;
    }
    if (isGenerating) return;

    stopPlayback();
    setIsGenerating(true);
    window.setTimeout(() => {
      dispatch({
        type: "set-candidates",
        candidates: generateHarmonyCandidates(state.melody, state.settings),
      });
      setIsGenerating(false);
    }, 400);
  };

  const handleAddNote = (noteName: string) => {
    const note = createManualNote(noteName, durationBeats, state.melody);
    dispatch({
      type: "add-note",
      note,
    });
    setSelectedNoteId(note.id);
  };

  const handleDeleteSelectedNote = () => {
    if (!selectedNoteId) return;
    stopPlayback();
    dispatch({ type: "delete-note", noteId: selectedNoteId });
    setSelectedNoteId(null);
  };

  const handleReplaceChord = (alternativeIndex: number) => {
    if (!selectedCandidate || !selectedChord) return;
    const alternative = chordAlternatives[alternativeIndex];
    if (!alternative) return;
    stopPlayback();
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
    stopPlayback();
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

  const applyMidiImport = (
    result: MidiImportResult,
    file: File,
    arrayBuffer: ArrayBuffer,
  ) => {
    stopPlayback();
    setSelectedNoteId(null);
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
    stopPlayback();
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
    const captureTarget = event.currentTarget.closest(".note") as HTMLElement | null;
    captureTarget?.setPointerCapture(event.pointerId);
    noteDragRef.current = {
      noteId: note.id,
      mode,
      originClientX: event.clientX,
      originalNote: note,
    };
  };

  const handleNotePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = noteDragRef.current;
    if (!drag || state.settings.inputMode !== "manual") return;
    event.stopPropagation();

    const signedDeltaBeat = pixelDeltaToSnappedBeats(
      event.clientX - drag.originClientX,
      timelineMetrics,
    );
    const latestNote =
      state.melody.find((note) => note.id === drag.noteId) ?? drag.originalNote;

    const updatedNote =
      drag.mode === "move"
        ? updateNoteTiming(
            latestNote,
            Math.max(
              0,
              Math.min(
                timelineMetrics.totalBeats - latestNote.durationBeats,
                drag.originalNote.startBeat + signedDeltaBeat,
              ),
            ),
            latestNote.durationBeats,
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

  const handleNotePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (noteDragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    noteDragRef.current = null;
  };

  const restoreAutosave = () => {
    if (!recoveredSnapshot) return;
    stopPlayback();
    setSelectedNoteId(null);
    setCurrentMidiFile(null);
    dispatch({ type: "restore-snapshot", snapshot: recoveredSnapshot });
    setRecoveredSnapshot(null);
  };

  const discardAutosave = async () => {
    await clearActiveAutosave();
    setRecoveredSnapshot(null);
  };

  const stopPlayback = () => {
    audioEngineRef.current?.stop();
    dispatch({ type: "reset-playback" });
  };

  const playSelectedCandidate = async () => {
    if (!selectedCandidate || state.playback.status === "starting") return;

    if (state.playback.status === "playing") {
      stopPlayback();
      return;
    }

    dispatch({ type: "set-playback-status", status: "starting" });

    try {
      await audioEngineRef.current?.playCandidate(
        state.melody,
        selectedCandidate,
        state.settings.tempo,
        {
          melodyMuted: state.playback.melodyMuted,
          harmonyMuted: state.playback.harmonyMuted,
        },
        (currentBeat) => dispatch({ type: "set-current-beat", currentBeat }),
        () => dispatch({ type: "reset-playback" }),
      );
      dispatch({ type: "set-playback-status", status: "playing" });
    } catch {
      dispatch({ type: "reset-playback" });
      dispatch({ type: "set-error", id: "audio", message: t("message.audioStart") });
    }
  };

  const handleRestart = async () => {
    if (!selectedCandidate) return;
    audioEngineRef.current?.stop();
    dispatch({ type: "set-current-beat", currentBeat: 0 });
    dispatch({ type: "set-playback-status", status: "starting" });

    try {
      await audioEngineRef.current?.playCandidate(
        state.melody,
        selectedCandidate,
        state.settings.tempo,
        {
          melodyMuted: state.playback.melodyMuted,
          harmonyMuted: state.playback.harmonyMuted,
        },
        (currentBeat) => dispatch({ type: "set-current-beat", currentBeat }),
        () => dispatch({ type: "reset-playback" }),
      );
      dispatch({ type: "set-playback-status", status: "playing" });
    } catch {
      dispatch({ type: "reset-playback" });
      dispatch({ type: "set-error", id: "audio", message: t("message.audioRestart") });
    }
  };

  const toggleMelodyMute = () => {
    if (state.playback.status === "playing") stopPlayback();
    dispatch({ type: "toggle-melody-muted" });
  };

  const toggleHarmonyMute = () => {
    if (state.playback.status === "playing") stopPlayback();
    dispatch({ type: "toggle-harmony-muted" });
  };

  const handleSelectCandidate = (candidateId: string) => {
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      stopPlayback();
    }
    dispatch({ type: "select-candidate", candidateId });
  };

  if (screen === "landing") {
    return (
      <main className="landing-shell">
        <header className="landing-nav" aria-label="Landing navigation">
          <div className="brand-lockup">
            <span className="brand-mark">H</span>
            <div>
              <h1>Harmony Auxiliary</h1>
              <p>Local-first harmony assistant</p>
            </div>
          </div>
          <button type="button" className="secondary-button" onClick={() => setScreen("workspace")}>
            Open Workspace
          </button>
        </header>

        <section className="landing-hero" aria-label="Product introduction">
          <div className="landing-poster">
            <span className="landing-kicker">MIDI in. Harmony out.</span>
            <h2>
              <span>Harmony,</span>
              <span>heard.</span>
            </h2>
            <button type="button" className="primary-button" onClick={() => setScreen("workspace")}>
              Start Harmonizing
            </button>
          </div>
        </section>

        <section className="workflow-intro" aria-label="Workflow introduction">
          <span className="eyebrow">A compact music workflow</span>
          <h3>From sketch to playable harmony without leaving the browser.</h3>
        </section>

        <section className="workflow-section" aria-label="Import workflow">
          <div className="workflow-copy">
            <span>01</span>
            <h4>Import or sketch</h4>
            <p>Start from a MIDI melody, or click note names when the idea is still small.</p>
          </div>
          <div className="landing-preview" aria-label="Workspace preview">
            <div className="preview-topbar">
              <span>Melody.mid</span>
              <strong>C major · 92 BPM</strong>
            </div>
            <div className="preview-timeline">
              <span className="preview-note" style={{ left: "8%", width: "16%", top: "22%" }}>E4</span>
              <span className="preview-note" style={{ left: "30%", width: "12%", top: "34%" }}>G4</span>
              <span className="preview-note" style={{ left: "48%", width: "20%", top: "18%" }}>C5</span>
              <span className="preview-chord" style={{ left: "8%", width: "22%" }}>Cmaj7</span>
              <span className="preview-chord" style={{ left: "36%", width: "22%" }}>F</span>
              <span className="preview-chord" style={{ left: "64%", width: "24%" }}>G7</span>
            </div>
            <div className="preview-bottom">
              <div>
                <span>Stable Classical</span>
                <strong>Cmaj7 / F / G7 / C</strong>
              </div>
              <div>
                <span>Why it works</span>
                <strong>E is the third of Cmaj7.</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="workflow-section workflow-section-reverse" aria-label="Generate workflow">
          <div className="workflow-copy">
            <span>02</span>
            <h4>Generate and listen</h4>
            <p>Compare classical, songwriting, and color-rich candidates with browser playback.</p>
          </div>
          <div className="workflow-rhythm" aria-hidden="true">
            <span>Cmaj7</span>
            <span>F</span>
            <span>G7</span>
            <span>C</span>
          </div>
        </section>

        <section className="workflow-section" aria-label="Inspect workflow">
          <div className="workflow-copy">
            <span>03</span>
            <h4>Inspect and keep</h4>
            <p>Read the chord logic, replace a segment, copy the progression, or export MIDI.</p>
          </div>
          <div className="workflow-inspector" aria-hidden="true">
            <span>Why it works</span>
            <strong>E is the third of Cmaj7.</strong>
            <p>Tonic color, stable fit, ready to export.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="command-bar" aria-label="Main controls">
        <div className="brand-lockup">
          <span className="brand-mark">H</span>
          <div>
            <h1>Harmony Auxiliary</h1>
            <p>{t("brand.subtitle")}</p>
          </div>
        </div>

        <nav className="control-group" aria-label="Project settings">
          <div className="segmented-control" aria-label="Workspace language">
            <button type="button" aria-pressed={language === "zh"} onClick={() => setLanguage("zh")}>
              中文
            </button>
            <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
              EN
            </button>
          </div>
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
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept=".mid,.midi,audio/midi"
            onChange={(event) => void handleFileSelected(event.currentTarget.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {t("action.importMidi")}
          </button>
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
          <button
            type="button"
            className="primary-button"
            disabled={!hasMelody || isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? t("action.generating") : t("action.generate")}
          </button>
        </nav>
      </header>

      <section className="workspace-grid">
        <section className="timeline-panel" aria-label="Music timeline">
          <div className="timeline-header">
            <div>
              <span className="eyebrow">{t("timeline.label")}</span>
              <h2>{hasMelody ? t("timeline.active") : t("timeline.start")}</h2>
            </div>
            <div className="transport" aria-label="Playback controls">
              <span className="beat-readout">
                {state.playback.currentBeat.toFixed(1)} {t("timeline.beat")}
              </span>
              <button type="button" aria-label="Restart playback" disabled={!showCandidates} onClick={handleRestart}>
                {t("action.restart")}
              </button>
              <button
                type="button"
                className="play-button"
                aria-label="Play selected candidate"
                disabled={!showCandidates}
                onClick={playSelectedCandidate}
              >
                {state.playback.status === "playing" ? t("action.pause") : t("action.play")}
              </button>
              <button
                type="button"
                aria-pressed={state.playback.melodyMuted}
                disabled={!showCandidates}
                onClick={toggleMelodyMute}
              >
                {t("transport.melody")}
              </button>
              <button
                type="button"
                aria-pressed={state.playback.harmonyMuted}
                disabled={!showCandidates}
                onClick={toggleHarmonyMute}
              >
                {t("transport.harmony")}
              </button>
            </div>
          </div>

          <div className="input-dock" aria-label="Input actions">
            <div>
              <strong>
                {state.settings.inputMode === "midi" ? t("dock.midiTitle") : t("dock.manualTitle")}
              </strong>
              <span>
                {state.settings.inputMode === "midi"
                  ? t("dock.midiCopy")
                  : t("dock.manualCopy")}
              </span>
            </div>
            <div className="input-actions">
              {state.settings.inputMode === "manual" ? (
                <label className="duration-select">
                  {t("dock.duration")}
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
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  {isImporting ? t("action.importing") : t("action.chooseFile")}
                </button>
              )}
              <button type="button" className="secondary-button" onClick={handleLoadDemo}>
                {t("action.loadDemo")}
              </button>
              <button type="button" className="secondary-button" onClick={() => void handleClearLocalData()}>
                {t("action.clearLocalData")}
              </button>
            </div>
          </div>

          {state.settings.inputMode === "manual" ? (
            <div className="manual-input" aria-label="Manual note input">
              {NOTE_BUTTONS.map((noteName) => (
                <button type="button" key={noteName} onClick={() => handleAddNote(noteName)}>
                  {noteName}
                </button>
              ))}
              <button
                type="button"
                className="text-tool-button"
                disabled={!selectedNoteId}
                onClick={handleDeleteSelectedNote}
              >
                {t("action.deleteNote")}
              </button>
              <button
                type="button"
                className="text-tool-button"
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
                className="text-tool-button"
                disabled={!hasMelody}
                onClick={() => {
                  dispatch({ type: "clear-melody" });
                  setSelectedNoteId(null);
                }}
              >
                {t("action.clear")}
              </button>
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

          <div className="timeline-canvas" data-empty={!hasMelody}>
            {!showEditableGrid ? (
              <div className="empty-state">
                <span className="empty-kicker">{t("empty.kicker")}</span>
                <h3>{t("empty.title")}</h3>
                <p>{t("empty.copy")}</p>
                <button type="button" className="primary-button" onClick={handleLoadDemo}>
                  {t("action.loadDemo")}
                </button>
              </div>
            ) : (
              <div className="timeline-scroll" aria-label="Scrollable beat grid">
                <div className="timeline-grid" style={timelineGridStyle}>
                  <div className="bar-ruler" aria-hidden="true">
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
                  {showCandidates ? (
                    <div
                      className="playhead"
                      aria-hidden="true"
                      style={{ left: `${playheadLeft}px` }}
                    />
                  ) : null}
                  <div
                    className="lane melody-lane"
                    data-editable={state.settings.inputMode === "manual"}
                    onPointerDown={handleMelodyLanePointerDown}
                  >
                    <div className="lane-label melody-lane-label">
                      <span>{t("lane.melody")}</span>
                      <div className="pitch-labels" aria-hidden="true">
                        {PITCH_ROWS.map((row) => (
                          <span key={row.label}>{row.label}</span>
                        ))}
                      </div>
                    </div>
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
                        onPointerMove={handleNotePointerMove}
                        onPointerUp={handleNotePointerUp}
                        onPointerCancel={handleNotePointerUp}
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

                  <div className="lane chord-lane">
                    <div className="lane-label harmony-lane-label">
                      <span>{t("lane.harmony")}</span>
                      <div className="voice-labels" aria-hidden="true">
                        {HARMONY_VOICE_ROWS.map((voice) => (
                          <span key={voice}>{voice}</span>
                        ))}
                        <span>Chord</span>
                      </div>
                    </div>
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
                              onClick={() => dispatch({ type: "select-chord", chordId: placedChord.id })}
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
                            onClick={() => dispatch({ type: "select-chord", chordId: placedChord.id })}
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
              </div>
            )}
          </div>

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
                      }`}
                      key={candidate.id}
                      onClick={() => handleSelectCandidate(candidate.id)}
                    >
                      <span>{t(`candidate.${candidate.mode}.title`)}</span>
                      <strong>
                        {candidate.chords.map((placedChord) => placedChord.chord.symbol).join(" / ")}
                      </strong>
                      <small>{candidate.subtitle}</small>
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
        </section>

        <aside className="inspector" aria-label="Selected harmony details">
          <span className="eyebrow">{t("inspector.label")}</span>
          {selectedCandidate && selectedChord ? (
            <>
              <h2>{selectedChord.chord.symbol}</h2>
              <p className="candidate-summary">{selectedCandidate.summary}</p>
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
                      ? `${selectedChord.explanation.melodyRelationships[0].noteName} = ${selectedChord.explanation.melodyRelationships[0].relationship}`
                      : t("inspector.noNote")}
                  </strong>
                </div>
              </div>
              <p>{selectedChord.explanation.fitReason}</p>
              <p>{selectedChord.explanation.functionReason}</p>
              {selectedChord.explanation.warnings.length > 0 ? (
                <p className="warning-copy">{selectedChord.explanation.warnings.join(" ")}</p>
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
                  <strong>{hasMelody ? `${state.melody.length} notes` : t("inspector.empty")}</strong>
                </div>
                <div>
                  <span>{t("inspector.generate")}</span>
                  <strong>{hasMelody ? t("inspector.available") : t("inspector.disabled")}</strong>
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;
