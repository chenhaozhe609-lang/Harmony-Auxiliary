import "./App.css";

const candidates = [
  {
    id: "stable",
    title: "Stable Classical",
    chords: ["C", "F", "G", "C"],
    tone: "T - PD - D - T",
  },
  {
    id: "pop",
    title: "Pop / Songwriting",
    chords: ["C", "G/B", "Am", "F"],
    tone: "I - V6 - vi - IV",
  },
  {
    id: "color",
    title: "Color / Tension",
    chords: ["Cmaj7", "E7", "Am9", "Fm6"],
    tone: "Imaj7 - V/vi - vi9 - iv6",
  },
];

function App() {
  return (
    <main className="app-shell">
      <header className="command-bar" aria-label="Main controls">
        <div className="brand-lockup">
          <span className="brand-mark">H</span>
          <div>
            <h1>Harmony Auxiliary</h1>
            <p>Minimal music workbench</p>
          </div>
        </div>
        <nav className="control-group" aria-label="Project settings">
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
            Tempo
            <input type="number" defaultValue={92} min={40} max={220} />
          </label>
          <button type="button" className="primary-button">
            Generate
          </button>
        </nav>
      </header>

      <section className="workspace-grid">
        <section className="timeline-panel" aria-label="Music timeline">
          <div className="timeline-header">
            <div>
              <span className="eyebrow">Timeline</span>
              <h2>Untitled MIDI sketch</h2>
            </div>
            <div className="transport">
              <button type="button" aria-label="Restart">
                Restart
              </button>
              <button type="button" className="play-button" aria-label="Play">
                Play
              </button>
            </div>
          </div>

          <div className="timeline-canvas">
            <div className="bar-ruler" aria-hidden="true">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
            </div>
            <div className="playhead" aria-hidden="true" />
            <div className="lane">
              <span className="lane-label">Melody</span>
              <div className="note note-a" />
              <div className="note note-b" />
              <div className="note note-c" />
              <div className="note note-d" />
            </div>
            <div className="lane chord-lane">
              <span className="lane-label">Harmony</span>
              {["Cmaj7", "G/B", "Am", "F"].map((chord) => (
                <button type="button" className="chord-block" key={chord}>
                  <strong>{chord}</strong>
                  <span>I</span>
                </button>
              ))}
            </div>
          </div>

          <div className="candidate-strip" aria-label="Harmony candidates">
            {candidates.map((candidate) => (
              <button type="button" className="candidate" key={candidate.id}>
                <span>{candidate.title}</span>
                <strong>{candidate.chords.join(" · ")}</strong>
                <small>{candidate.tone}</small>
              </button>
            ))}
          </div>
        </section>

        <aside className="inspector" aria-label="Selected harmony details">
          <span className="eyebrow">Inspector</span>
          <h2>Cmaj7</h2>
          <div className="inspector-rows">
            <div>
              <span>Roman</span>
              <strong>Imaj7</strong>
            </div>
            <div>
              <span>Function</span>
              <strong>Tonic</strong>
            </div>
            <div>
              <span>Melody</span>
              <strong>E = third</strong>
            </div>
          </div>
          <p>
            旋律音 E 是 Cmaj7 的三音，因此这个和弦听起来稳定，并且清楚地指向主功能。
          </p>
          <div className="export-actions">
            <button type="button" className="secondary-button">
              Copy Progression
            </button>
            <button type="button" className="secondary-button">
              Export MIDI
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;

