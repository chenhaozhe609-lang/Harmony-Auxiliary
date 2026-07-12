// "Let me try it" — a lightweight slice of the real product on the landing page:
// a fixed demo melody, the *actual* generateHarmonyCandidates engine, and real
// audition through the AudioEngine. Not the whole workbench — just one taste.
// (TASK6 §9.2)
import { useEffect, useRef, useState } from "react";
import { FiPlay, FiSquare } from "react-icons/fi";
import { AudioEngine } from "../../music/audio/audioEngine";
import { demoMelody } from "../../music/fixtures/demoMelodies";
import type { FunctionLabel, HarmonyCandidate, ProjectSettings } from "../../music/types";

// The demo melody is a short phrase in C major; harmonise it a chord per bar.
const DEMO_SETTINGS: ProjectSettings = {
  keyTonic: 0,
  mode: "major",
  tempo: 88,
  timeSignature: { numerator: 4, denominator: 4 },
  harmonyRhythm: "bar",
  inputMode: "midi",
  playbackTone: "acoustic-grand",
};

const FUNCTION_LABEL: Record<FunctionLabel, string> = {
  T: "Tonic",
  PD: "Predominant",
  D: "Dominant",
  Color: "Color",
};

const STYLE_LABELS = ["Classical", "Pop", "Color"];

export default function HarmonyDemo({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const [candidates, setCandidates] = useState<HarmonyCandidate[] | null>(null);
  const [styleIndex, setStyleIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  const candidate = candidates ? candidates[styleIndex] : null;

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const { generateHarmonyCandidates } = await import("../../music/harmony/generateCandidates");
      const next = generateHarmonyCandidates(demoMelody, DEMO_SETTINGS);
      setCandidates(next);
      setStyleIndex(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    engineRef.current?.stop();
    setIsPlaying(false);
    setActiveBeat(null);
  };

  const handlePlay = async () => {
    if (!candidate) return;
    if (isPlaying) {
      handleStop();
      return;
    }
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    setIsPlaying(true);
    try {
      await engineRef.current.playCandidate(
        demoMelody,
        candidate,
        DEMO_SETTINGS.tempo,
        {
          melodyMuted: false,
          harmonyMuted: false,
          tonePreset: DEMO_SETTINGS.playbackTone,
        },
        (beat) => setActiveBeat(beat),
        () => {
          setIsPlaying(false);
          setActiveBeat(null);
        },
      );
    } catch {
      setIsPlaying(false);
      setActiveBeat(null);
    }
  };

  const activeChordIndex =
    activeBeat == null || !candidate
      ? -1
      : candidate.chords.findIndex(
          (chord) => activeBeat >= chord.startBeat && activeBeat < chord.startBeat + chord.durationBeats,
        );

  return (
    <div className="harmony-demo">
      <div className="harmony-demo-melody" aria-hidden="true">
        {demoMelody.map((note) => (
          <span
            key={note.id}
            className="harmony-demo-note"
            style={{
              left: `${(note.startBeat / 10) * 100}%`,
              width: `${(note.durationBeats / 10) * 100}%`,
              bottom: `${((note.midi - 60) / 14) * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="harmony-demo-controls">
        <button
          type="button"
          className="primary-button"
          disabled={isGenerating}
          onClick={() => void handleGenerate()}
        >
          {isGenerating ? "Generating..." : candidates ? "Regenerate" : "Generate harmony"}
        </button>
        {candidates ? (
          <div className="harmony-demo-styles" role="tablist" aria-label="Harmony style">
            {candidates.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={styleIndex === index}
                className={styleIndex === index ? "is-active" : ""}
                onClick={() => setStyleIndex(index)}
              >
                {STYLE_LABELS[index] ?? item.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {candidate ? (
        <>
          <div className="harmony-demo-chords">
            {candidate.chords.map((chord, index) => (
              <div
                key={chord.id}
                className={`harmony-demo-chip ${index === activeChordIndex ? "is-playing" : ""}`}
              >
                <span className="harmony-demo-symbol">{chord.chord.symbol}</span>
                <span className="harmony-demo-roman">{chord.chord.roman}</span>
                <span className="harmony-demo-fn">{FUNCTION_LABEL[chord.chord.functionLabel]}</span>
              </div>
            ))}
          </div>
          <div className="harmony-demo-audition">
            <button type="button" className="ghost-button" onClick={() => void handlePlay()}>
              {isPlaying ? <FiSquare aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
              {isPlaying ? "Stop" : "Audition"}
            </button>
            <p>{candidate.summary}</p>
          </div>
        </>
      ) : (
        <p className="harmony-demo-hint">
          {prefersReducedMotion
            ? "Press generate to harmonise the demo melody with real theory."
            : "Press generate — the same engine the workspace uses harmonises this melody, with the theory shown for every chord."}
        </p>
      )}
    </div>
  );
}
