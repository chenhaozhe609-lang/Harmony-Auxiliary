import type { Ref, UIEvent as ReactUIEvent } from "react";
import {
  HARMONY_VOICE_ROWS,
  harmonyVoiceGridRow,
  makeDisplayVoicing,
  placedChordGridColumn,
} from "../../app/pianoRollLayout";
import type { HarmonyCandidate, PlacedChord } from "../../music/types";

type HarmonyLaneProps = {
  t: (key: string) => string;
  harmonyScrollRef: Ref<HTMLDivElement>;
  onScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
  harmonyIsOutdated: boolean;
  hasMelody: boolean;
  playheadLeft: number;
  selectedCandidate: HarmonyCandidate | null;
  selectedChord: PlacedChord | null;
  activePlaybackChordId: string | null;
  isGenerating: boolean;
  onOpenInspectorOnChord: (chordId: string) => void;
};

// The harmony piano roll (TASK6 §11 Phase A). Rendered inside the bottom drawer;
// carries timelineGridStyle from its parent so columns align with the melody.
export function HarmonyLane({
  t,
  harmonyScrollRef,
  onScroll,
  harmonyIsOutdated,
  hasMelody,
  playheadLeft,
  selectedCandidate,
  selectedChord,
  activePlaybackChordId,
  isGenerating,
  onOpenInspectorOnChord,
}: HarmonyLaneProps) {
  return (
    <div
      className="timeline-window harmony-window"
      ref={harmonyScrollRef}
      onScroll={onScroll}
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
                  onClick={() => onOpenInspectorOnChord(placedChord.id)}
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
                onClick={() => onOpenInspectorOnChord(placedChord.id)}
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
}

export default HarmonyLane;
