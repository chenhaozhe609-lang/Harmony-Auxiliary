import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { appReducer, createInitialState } from "./appState";
import { clearPreferences, defaultPreferences, loadPreferences, savePreferences } from "./preferencesRepository";
import { translate, type Language } from "./i18n";
import { AudioEngine, getPlaybackEndBeat } from "../music/audio/audioEngine";
import { getChordAlternatives, makeReplacementPlacedChord } from "../music/harmony/chordAlternatives";
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
  MidiImportResult,
  NoteEvent,
  PitchClass,
  PlacedChord,
  StoredProjectSnapshot,
} from "../music/types";
import {
  createNoteEventId,
  midiToNoteName,
  noteNameToPitchClass,
  pitchClassToName,
} from "../music/theory/pitches";
import "./App.css";

const NOTE_BUTTONS = ["C", "D", "E", "F", "G", "A", "B"] as const;

const DURATION_OPTIONS = [
  { labelKey: "duration.whole", value: 4 },
  { labelKey: "duration.half", value: 2 },
  { labelKey: "duration.quarter", value: 1 },
  { labelKey: "duration.eighth", value: 0.5 },
] as const;

const KEY_OPTIONS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

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

  return {
    id: createNoteEventId("manual", index),
    midi,
    pitchClass,
    name: midiToNoteName(midi),
    startBeat: getNextStartBeat(melody),
    durationBeats,
    velocity: 0.8,
    source: "manual",
  };
}

function noteGridColumn(note: NoteEvent): string {
  const start = Math.max(2, Math.round(note.startBeat * 2) + 2);
  const span = Math.max(1, Math.round(note.durationBeats * 2));
  return `${start} / span ${span}`;
}

function noteVerticalOffset(note: NoteEvent): number {
  return Math.max(-58, Math.min(8, (64 - note.midi) * 4));
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
  const [recoveredSnapshot, setRecoveredSnapshot] = useState<StoredProjectSnapshot | null>(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);
  const [currentMidiFile, setCurrentMidiFile] = useState<{
    file: File;
    arrayBuffer: ArrayBuffer;
  } | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const hasMelody = state.melody.length > 0;
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
  const playbackEndBeat = useMemo(
    () => getPlaybackEndBeat(state.melody, selectedCandidate),
    [state.melody, selectedCandidate],
  );
  const playbackProgress = Math.min(1, state.playback.currentBeat / playbackEndBeat);
  const activePlaybackChordId =
    selectedCandidate?.chords.find(
      (placedChord) =>
        state.playback.currentBeat >= placedChord.startBeat &&
        state.playback.currentBeat < placedChord.startBeat + placedChord.durationBeats,
    )?.id ?? null;

  const handleLoadDemo = () => {
    stopPlayback();
    setCurrentMidiFile(null);
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
    dispatch({
      type: "add-note",
      note: createManualNote(noteName, durationBeats, state.melody),
    });
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

  const restoreAutosave = () => {
    if (!recoveredSnapshot) return;
    stopPlayback();
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
            <h2>Compose harmony you can hear, question, and keep.</h2>
            <button type="button" className="primary-button" onClick={() => setScreen("workspace")}>
              Start Harmonizing
            </button>
          </div>
          <div className="landing-notation" aria-hidden="true">
            <span>Ⅰ</span>
            <span>Ⅳ</span>
            <span>Ⅴ7</span>
            <span>Ⅰ</span>
          </div>
        </section>

        <section className="landing-workflow" aria-label="Workflow introduction">
          <div className="workflow-copy">
            <span className="eyebrow">A compact music workflow</span>
            <h3>Bring in a melody, compare harmonic paths, export the one that feels right.</h3>
            <ol>
              <li>
                <strong>Import or sketch</strong>
                <span>Use a MIDI melody or click note names for a short idea.</span>
              </li>
              <li>
                <strong>Generate and listen</strong>
                <span>Compare stable, songwriting, and color-rich candidates with playback.</span>
              </li>
              <li>
                <strong>Inspect and keep</strong>
                <span>Read the chord logic, replace a chord, copy the progression, or export MIDI.</span>
              </li>
            </ol>
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
              value={state.settings.harmonyDensity}
              onChange={(event) =>
                dispatch({
                  type: "set-density",
                  harmonyDensity: event.target.value === "half-bar" ? "half-bar" : "bar",
                })
              }
            >
              <option value="bar">{t("settings.bar")}</option>
              <option value="half-bar">{t("settings.halfBar")}</option>
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
                disabled={!hasMelody}
                onClick={() => dispatch({ type: "undo-note" })}
              >
                {t("action.undo")}
              </button>
              <button
                type="button"
                className="text-tool-button"
                disabled={!hasMelody}
                onClick={() => dispatch({ type: "clear-melody" })}
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
            <div className="bar-ruler" aria-hidden="true">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
            </div>
            {showCandidates ? (
              <div
                className="playhead"
                aria-hidden="true"
                style={{ left: `${Math.max(8, Math.min(96, playbackProgress * 100))}%` }}
              />
            ) : null}

            {!hasMelody ? (
              <div className="empty-state">
                <span className="empty-kicker">{t("empty.kicker")}</span>
                <h3>{t("empty.title")}</h3>
                <p>{t("empty.copy")}</p>
                <button type="button" className="primary-button" onClick={handleLoadDemo}>
                  {t("action.loadDemo")}
                </button>
              </div>
            ) : (
              <>
                <div className="lane melody-lane">
                  <span className="lane-label">{t("lane.melody")}</span>
                  {state.melody.map((note) => (
                    <button
                      type="button"
                      className="note"
                      key={note.id}
                      style={{
                        gridColumn: noteGridColumn(note),
                        transform: `translateY(${noteVerticalOffset(note)}px)`,
                      }}
                      title={`${note.name}, ${note.durationBeats} beat(s)`}
                    >
                      {note.name}
                    </button>
                  ))}
                </div>

                <div
                  className="lane chord-lane"
                  style={
                    selectedCandidate
                      ? {
                          gridTemplateColumns: `68px repeat(${selectedCandidate.chords.length}, minmax(120px, 1fr))`,
                        }
                      : undefined
                  }
                >
                  <span className="lane-label">{t("lane.harmony")}</span>
                  {selectedCandidate && selectedChord ? (
                    selectedCandidate.chords.map((placedChord) => (
                      <button
                        type="button"
                        className={`chord-block${
                          selectedChord.id === placedChord.id ? " is-selected" : ""
                        }${activePlaybackChordId === placedChord.id ? " is-active" : ""}`}
                        key={placedChord.id}
                        onClick={() => dispatch({ type: "select-chord", chordId: placedChord.id })}
                      >
                        <strong>{placedChord.chord.symbol}</strong>
                        <span>{placedChord.chord.roman}</span>
                      </button>
                    ))
                  ) : (
                    <div className="harmony-placeholder">
                      {isGenerating ? t("lane.scoring") : t("lane.placeholder")}
                    </div>
                  )}
                </div>
              </>
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
