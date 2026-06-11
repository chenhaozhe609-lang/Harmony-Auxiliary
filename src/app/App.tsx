import { useEffect, useMemo, useReducer, useState } from "react";
import { appReducer, createInitialState } from "./appState";
import { loadPreferences, savePreferences } from "./preferencesRepository";
import { generateHarmonyCandidates } from "../music/harmony/generateCandidates";
import type { HarmonyCandidate, NoteEvent, PitchClass, PlacedChord } from "../music/types";
import {
  createNoteEventId,
  midiToNoteName,
  noteNameToPitchClass,
  pitchClassToName,
} from "../music/theory/pitches";
import "./App.css";

const NOTE_BUTTONS = ["C", "D", "E", "F", "G", "A", "B"] as const;

const DURATION_OPTIONS = [
  { label: "Whole", value: 4 },
  { label: "Half", value: 2 },
  { label: "Quarter", value: 1 },
  { label: "Eighth", value: 0.5 },
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
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    createInitialState(loadPreferences()),
  );
  const [durationBeats, setDurationBeats] = useState<(typeof DURATION_OPTIONS)[number]["value"]>(1);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    savePreferences(state.settings);
  }, [state.settings]);

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

  const handleLoadDemo = () => {
    dispatch({ type: "load-melody", melody: demoMelody });
  };

  const handleGenerate = () => {
    if (!hasMelody || isGenerating) return;

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

  return (
    <main className="app-shell">
      <header className="command-bar" aria-label="Main controls">
        <div className="brand-lockup">
          <span className="brand-mark">H</span>
          <div>
            <h1>Harmony Auxiliary</h1>
            <p>Local-first harmony workspace</p>
          </div>
        </div>

        <nav className="control-group" aria-label="Project settings">
          <div className="segmented-control" aria-label="Input mode">
            <button
              type="button"
              aria-pressed={state.settings.inputMode === "midi"}
              onClick={() => dispatch({ type: "set-input-mode", inputMode: "midi" })}
            >
              MIDI
            </button>
            <button
              type="button"
              aria-pressed={state.settings.inputMode === "manual"}
              onClick={() => dispatch({ type: "set-input-mode", inputMode: "manual" })}
            >
              Manual
            </button>
          </div>
          <button type="button" className="secondary-button">
            Import MIDI
          </button>
          <label>
            Key
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
            Mode
            <select
              value={state.settings.mode}
              onChange={(event) =>
                dispatch({ type: "set-mode", mode: event.target.value === "minor" ? "minor" : "major" })
              }
            >
              <option value="major">Major</option>
              <option value="minor" disabled>
                Minor later
              </option>
            </select>
          </label>
          <label>
            Tempo
            <input
              type="number"
              value={state.settings.tempo}
              min={40}
              max={220}
              onChange={(event) => dispatch({ type: "set-tempo", tempo: Number(event.target.value) })}
            />
          </label>
          <label>
            Density
            <select
              value={state.settings.harmonyDensity}
              onChange={(event) =>
                dispatch({
                  type: "set-density",
                  harmonyDensity: event.target.value === "half-bar" ? "half-bar" : "bar",
                })
              }
            >
              <option value="bar">1 / bar</option>
              <option value="half-bar">1 / half-bar</option>
            </select>
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!hasMelody || isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? "Generating" : "Generate"}
          </button>
        </nav>
      </header>

      <section className="workspace-grid">
        <section className="timeline-panel" aria-label="Music timeline">
          <div className="timeline-header">
            <div>
              <span className="eyebrow">Timeline</span>
              <h2>{hasMelody ? "Active melody sketch" : "Start with a melody"}</h2>
            </div>
            <div className="transport" aria-label="Playback controls">
              <button type="button" aria-label="Restart demo playback" disabled={!showCandidates}>
                Restart
              </button>
              <button
                type="button"
                className="play-button"
                aria-label="Play selected candidate"
                disabled={!showCandidates}
              >
                Play
              </button>
            </div>
          </div>

          <div className="input-dock" aria-label="Input actions">
            <div>
              <strong>
                {state.settings.inputMode === "midi" ? "MIDI import path" : "Manual note input"}
              </strong>
              <span>
                {state.settings.inputMode === "midi"
                  ? "MIDI parsing arrives in M4. For now, load the demo or switch to manual input."
                  : "Click note names to append a melody. Generation uses the current key and density."}
              </span>
            </div>
            <div className="input-actions">
              {state.settings.inputMode === "manual" ? (
                <label className="duration-select">
                  Duration
                  <select
                    value={durationBeats}
                    onChange={(event) =>
                      setDurationBeats(Number(event.target.value) as typeof durationBeats)
                    }
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <button type="button" className="secondary-button">
                  Choose File
                </button>
              )}
              <button type="button" className="secondary-button" onClick={handleLoadDemo}>
                Load Demo Melody
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
                Undo
              </button>
              <button
                type="button"
                className="text-tool-button"
                disabled={!hasMelody}
                onClick={() => dispatch({ type: "clear-melody" })}
              >
                Clear
              </button>
            </div>
          ) : null}

          <div className="timeline-canvas" data-empty={!hasMelody}>
            <div className="bar-ruler" aria-hidden="true">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
            </div>
            {showCandidates ? <div className="playhead" aria-hidden="true" /> : null}

            {!hasMelody ? (
              <div className="empty-state">
                <span className="empty-kicker">No melody loaded</span>
                <h3>Import MIDI later, or start from manual notes now.</h3>
                <p>
                  M2 adds note entry and deterministic harmony generation while keeping all data
                  local in your browser.
                </p>
                <button type="button" className="primary-button" onClick={handleLoadDemo}>
                  Load Demo Melody
                </button>
              </div>
            ) : (
              <>
                <div className="lane melody-lane">
                  <span className="lane-label">Melody</span>
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
                  <span className="lane-label">Harmony</span>
                  {selectedCandidate && selectedChord ? (
                    selectedCandidate.chords.map((placedChord) => (
                      <button
                        type="button"
                        className={`chord-block${
                          selectedChord.id === placedChord.id ? " is-selected" : ""
                        }`}
                        key={placedChord.id}
                        onClick={() => dispatch({ type: "select-chord", chordId: placedChord.id })}
                      >
                        <strong>{placedChord.chord.symbol}</strong>
                        <span>{placedChord.chord.roman}</span>
                      </button>
                    ))
                  ) : (
                    <div className="harmony-placeholder">
                      {isGenerating ? "Scoring harmonic options" : "Generate to fill harmony lane"}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="candidate-strip" aria-label="Harmony candidates">
            {isGenerating
              ? ["Stable Classical", "Pop / Songwriting", "Color / Tension"].map((title) => (
                  <div className="candidate candidate-loading" key={title}>
                    <span>{title}</span>
                    <strong>Preparing candidate</strong>
                    <small>Scoring melody fit</small>
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
                      onClick={() =>
                        dispatch({ type: "select-candidate", candidateId: candidate.id })
                      }
                    >
                      <span>{candidate.title}</span>
                      <strong>
                        {candidate.chords.map((placedChord) => placedChord.chord.symbol).join(" / ")}
                      </strong>
                      <small>{candidate.subtitle}</small>
                    </button>
                  ))
                : ["Stable Classical", "Pop / Songwriting", "Color / Tension"].map((title) => (
                    <button type="button" className="candidate" disabled key={title}>
                      <span>{title}</span>
                      <strong>Waiting for generation</strong>
                      <small>{hasMelody ? "Ready" : "Needs melody"}</small>
                    </button>
                  ))}
          </div>
        </section>

        <aside className="inspector" aria-label="Selected harmony details">
          <span className="eyebrow">Inspector</span>
          {selectedCandidate && selectedChord ? (
            <>
              <h2>{selectedChord.chord.symbol}</h2>
              <p className="candidate-summary">{selectedCandidate.summary}</p>
              <div className="inspector-rows">
                <div>
                  <span>Roman</span>
                  <strong>{selectedChord.chord.roman}</strong>
                </div>
                <div>
                  <span>Function</span>
                  <strong>{selectedChord.chord.functionLabel}</strong>
                </div>
                <div>
                  <span>Melody</span>
                  <strong>
                    {selectedChord.explanation.melodyRelationships[0]
                      ? `${selectedChord.explanation.melodyRelationships[0].noteName} = ${selectedChord.explanation.melodyRelationships[0].relationship}`
                      : "No note"}
                  </strong>
                </div>
              </div>
              <p>{selectedChord.explanation.fitReason}</p>
              <p>{selectedChord.explanation.functionReason}</p>
              {selectedChord.explanation.warnings.length > 0 ? (
                <p className="warning-copy">{selectedChord.explanation.warnings.join(" ")}</p>
              ) : null}
              <div className="export-actions">
                <button type="button" className="secondary-button">
                  Copy Progression
                </button>
                <button type="button" className="secondary-button">
                  Export MIDI
                </button>
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <h2>No chord selected</h2>
              <p>
                Add a melody and generate candidates. Selecting a candidate or chord will update
                this inspector.
              </p>
              <div className="inspector-rows">
                <div>
                  <span>Melody</span>
                  <strong>{hasMelody ? `${state.melody.length} notes` : "Empty"}</strong>
                </div>
                <div>
                  <span>Generate</span>
                  <strong>{hasMelody ? "Available" : "Disabled"}</strong>
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
