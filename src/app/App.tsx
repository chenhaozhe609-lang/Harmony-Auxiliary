import { useMemo, useState } from "react";
import "./App.css";

type ChordBlock = {
  id: string;
  symbol: string;
  roman: string;
  functionLabel: string;
  melody: string;
  explanation: string;
};

type Candidate = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  chords: ChordBlock[];
  summary: string;
};

const demoNotes = [
  { id: "n1", label: "E4", start: 2, span: 2, y: -18 },
  { id: "n2", label: "G4", start: 5, span: 1, y: -34 },
  { id: "n3", label: "C5", start: 7, span: 3, y: -52 },
  { id: "n4", label: "B4", start: 12, span: 2, y: -42 },
  { id: "n5", label: "A4", start: 15, span: 2, y: -30 },
];

const candidates: Candidate[] = [
  {
    id: "stable",
    title: "Stable Classical",
    subtitle: "Clear function, plain cadence",
    status: "Ready",
    summary:
      "A conservative pass that keeps the melody supported by tonic, predominant, and dominant movement.",
    chords: [
      {
        id: "stable-c",
        symbol: "Cmaj7",
        roman: "Imaj7",
        functionLabel: "Tonic",
        melody: "E = third",
        explanation:
          "The melody note E is the third of Cmaj7, so the chord sounds stable and clearly establishes the key.",
      },
      {
        id: "stable-f",
        symbol: "F",
        roman: "IV",
        functionLabel: "Predominant",
        melody: "C = fifth",
        explanation:
          "F supports C as a chord tone and gently moves the phrase away from tonic without adding sharp tension.",
      },
      {
        id: "stable-g",
        symbol: "G7",
        roman: "V7",
        functionLabel: "Dominant",
        melody: "B = third",
        explanation:
          "G7 gives the phrase dominant pull. The B in the melody acts as the leading tone toward C.",
      },
      {
        id: "stable-c2",
        symbol: "C",
        roman: "I",
        functionLabel: "Tonic",
        melody: "C = root",
        explanation:
          "The final C lands on the root of the tonic chord, giving the phrase a settled ending.",
      },
    ],
  },
  {
    id: "pop",
    title: "Pop / Songwriting",
    subtitle: "Loop-friendly, smoother bass",
    status: "Ready",
    summary:
      "A familiar songwriting loop with a stepwise bass color and softer harmonic pressure.",
    chords: [
      {
        id: "pop-c",
        symbol: "C",
        roman: "I",
        functionLabel: "Tonic",
        melody: "E = third",
        explanation:
          "C gives the opening a direct tonic sound while keeping the melody note E inside the chord.",
      },
      {
        id: "pop-gb",
        symbol: "G/B",
        roman: "V6",
        functionLabel: "Dominant",
        melody: "G = root",
        explanation:
          "G/B keeps dominant function but places B in the bass, creating a smoother descent into Am.",
      },
      {
        id: "pop-am",
        symbol: "Am",
        roman: "vi",
        functionLabel: "Tonic substitute",
        melody: "C = third",
        explanation:
          "Am lets C become the third of the chord, changing the same melodic color into a softer tonic substitute.",
      },
      {
        id: "pop-f",
        symbol: "F",
        roman: "IV",
        functionLabel: "Predominant",
        melody: "A = third",
        explanation:
          "F keeps the phrase open-ended and works naturally if the progression loops back to C.",
      },
    ],
  },
  {
    id: "color",
    title: "Color / Tension",
    subtitle: "Borrowed color, brighter edges",
    status: "Exploratory",
    summary:
      "A more expressive option that uses secondary dominant motion and a borrowed minor color.",
    chords: [
      {
        id: "color-c",
        symbol: "Cmaj9",
        roman: "Imaj9",
        functionLabel: "Tonic color",
        melody: "E = third",
        explanation:
          "Cmaj9 keeps tonic stability while adding a more open color above the basic triad.",
      },
      {
        id: "color-e7",
        symbol: "E7",
        roman: "V7/vi",
        functionLabel: "Secondary dominant",
        melody: "G# = third",
        explanation:
          "E7 points toward Am as a secondary dominant. This is a color choice rather than a plain diatonic step.",
      },
      {
        id: "color-am9",
        symbol: "Am9",
        roman: "vi9",
        functionLabel: "Tonic substitute",
        melody: "C = third",
        explanation:
          "Am9 resolves the E7 pull while keeping the phrase warm and less final than returning directly to C.",
      },
      {
        id: "color-fm6",
        symbol: "Fm6",
        roman: "iv6",
        functionLabel: "Borrowed color",
        melody: "Ab = third",
        explanation:
          "Fm6 is borrowed from the parallel minor, adding a darker color before the phrase returns home.",
      },
    ],
  },
];

function App() {
  const [hasMelody, setHasMelody] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(candidates[0].id);
  const [selectedChordId, setSelectedChordId] = useState(candidates[0].chords[0].id);
  const [inputMode, setInputMode] = useState<"midi" | "manual">("midi");

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0],
    [selectedCandidateId],
  );

  const selectedChord = useMemo(
    () =>
      selectedCandidate.chords.find((chord) => chord.id === selectedChordId) ??
      selectedCandidate.chords[0],
    [selectedCandidate, selectedChordId],
  );

  const handleLoadDemo = () => {
    setHasMelody(true);
    setShowCandidates(false);
    setIsGenerating(false);
    setSelectedCandidateId(candidates[0].id);
    setSelectedChordId(candidates[0].chords[0].id);
  };

  const handleGenerate = () => {
    if (!hasMelody || isGenerating) return;
    setIsGenerating(true);
    window.setTimeout(() => {
      setShowCandidates(true);
      setIsGenerating(false);
      setSelectedCandidateId(candidates[0].id);
      setSelectedChordId(candidates[0].chords[0].id);
    }, 650);
  };

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidateId(candidate.id);
    setSelectedChordId(candidate.chords[0].id);
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
              aria-pressed={inputMode === "midi"}
              onClick={() => setInputMode("midi")}
            >
              MIDI
            </button>
            <button
              type="button"
              aria-pressed={inputMode === "manual"}
              onClick={() => setInputMode("manual")}
            >
              Manual
            </button>
          </div>
          <button type="button" className="secondary-button">
            Import MIDI
          </button>
          <label>
            Key
            <select defaultValue="C">
              <option>C</option>
              <option>D</option>
              <option>E</option>
              <option>F</option>
              <option>G</option>
              <option>A</option>
              <option>B</option>
            </select>
          </label>
          <label>
            Mode
            <select defaultValue="major">
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </label>
          <label>
            Tempo
            <input type="number" defaultValue={92} min={40} max={220} />
          </label>
          <label>
            Density
            <select defaultValue="bar">
              <option value="bar">1 / bar</option>
              <option value="half">1 / half-bar</option>
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
              <h2>{hasMelody ? "Demo melody in C major" : "Start with a melody"}</h2>
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
              <strong>{inputMode === "midi" ? "MIDI import path" : "Manual note path"}</strong>
              <span>
                {inputMode === "midi"
                  ? "Drop a sketch here later. For M1, load a demo melody to inspect the workspace."
                  : "Manual note buttons arrive in M2. The workspace state is ready for them."}
              </span>
            </div>
            <div className="input-actions">
              <button type="button" className="secondary-button">
                {inputMode === "midi" ? "Choose File" : "Enter Notes"}
              </button>
              <button type="button" className="secondary-button" onClick={handleLoadDemo}>
                Load Demo Melody
              </button>
            </div>
          </div>

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
                <h3>Import MIDI or start from the demo phrase.</h3>
                <p>
                  M1 keeps the workspace static, but the layout already supports the full
                  melody-to-harmony flow.
                </p>
                <button type="button" className="primary-button" onClick={handleLoadDemo}>
                  Load Demo Melody
                </button>
              </div>
            ) : (
              <>
                <div className="lane melody-lane">
                  <span className="lane-label">Melody</span>
                  {demoNotes.map((note) => (
                    <button
                      type="button"
                      className="note"
                      key={note.id}
                      style={{
                        gridColumn: `${note.start} / span ${note.span}`,
                        transform: `translateY(${note.y}px)`,
                      }}
                    >
                      {note.label}
                    </button>
                  ))}
                </div>

                <div className="lane chord-lane">
                  <span className="lane-label">Harmony</span>
                  {showCandidates ? (
                    selectedCandidate.chords.map((chord) => (
                      <button
                        type="button"
                        className="chord-block"
                        data-selected={selectedChord.id === chord.id}
                        key={chord.id}
                        onClick={() => setSelectedChordId(chord.id)}
                      >
                        <strong>{chord.symbol}</strong>
                        <span>{chord.roman}</span>
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
              ? candidates.map((candidate) => (
                  <div className="candidate candidate-loading" key={candidate.id}>
                    <span>{candidate.title}</span>
                    <strong>Preparing candidate</strong>
                    <small>Scoring melody fit</small>
                  </div>
                ))
              : candidates.map((candidate) => (
                  <button
                    type="button"
                    className="candidate"
                    data-selected={showCandidates && selectedCandidate.id === candidate.id}
                    disabled={!showCandidates}
                    key={candidate.id}
                    onClick={() => handleSelectCandidate(candidate)}
                  >
                    <span>{candidate.title}</span>
                    <strong>
                      {showCandidates
                        ? candidate.chords.map((chord) => chord.symbol).join(" / ")
                        : "Waiting for generation"}
                    </strong>
                    <small>{showCandidates ? candidate.subtitle : candidate.status}</small>
                  </button>
                ))}
          </div>
        </section>

        <aside className="inspector" aria-label="Selected harmony details">
          <span className="eyebrow">Inspector</span>
          {showCandidates ? (
            <>
              <h2>{selectedChord.symbol}</h2>
              <p className="candidate-summary">{selectedCandidate.summary}</p>
              <div className="inspector-rows">
                <div>
                  <span>Roman</span>
                  <strong>{selectedChord.roman}</strong>
                </div>
                <div>
                  <span>Function</span>
                  <strong>{selectedChord.functionLabel}</strong>
                </div>
                <div>
                  <span>Melody</span>
                  <strong>{selectedChord.melody}</strong>
                </div>
              </div>
              <p>{selectedChord.explanation}</p>
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
                Load a melody and generate candidates. Selecting a candidate or chord will update
                this inspector.
              </p>
              <div className="inspector-rows">
                <div>
                  <span>Melody</span>
                  <strong>{hasMelody ? "Ready" : "Empty"}</strong>
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
