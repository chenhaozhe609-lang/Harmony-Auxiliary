import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  Ref,
  UIEvent as ReactUIEvent,
} from "react";
import { PITCH_ROWS, noteGridColumn, noteGridRow } from "../../app/pianoRollLayout";
import {
  beatToGridColumn,
  createTimelineGridMetrics,
  durationToGridSpan,
} from "../../app/timelineGrid";
import type { InputMode, NoteEvent } from "../../music/types";

type TimelineMetrics = ReturnType<typeof createTimelineGridMetrics>;

type PianoRollProps = {
  t: (key: string) => string;
  timelineGridStyle: CSSProperties;
  timelineMetrics: TimelineMetrics;
  rulerScrollRef: Ref<HTMLDivElement>;
  melodyScrollRef: Ref<HTMLDivElement>;
  onSyncScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
  inputMode: InputMode;
  melody: NoteEvent[];
  selectedNoteId: string | null;
  hasMelody: boolean;
  showEditableGrid: boolean;
  playheadLeft: number;
  onMelodyLanePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onNotePointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onNotePointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onAuditionPitch: (midi: number) => void;
  onSelectNote: (noteId: string) => void;
  onNotePointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    note: NoteEvent,
    mode: "move" | "resize",
  ) => void;
  onLoadDemo: () => void;
  onLoadLongDemo: () => void;
};

// The melody piano roll canvas (TASK6 §10/§11): empty stage prompt when there is
// nothing to edit, otherwise the FL-Studio-style chromatic roll with a sticky
// ruler and key column. Shares horizontal scroll with the harmony lane.
export function PianoRoll({
  t,
  timelineGridStyle,
  timelineMetrics,
  rulerScrollRef,
  melodyScrollRef,
  onSyncScroll,
  inputMode,
  melody,
  selectedNoteId,
  hasMelody,
  showEditableGrid,
  playheadLeft,
  onMelodyLanePointerDown,
  onNotePointerMove,
  onNotePointerUp,
  onAuditionPitch,
  onSelectNote,
  onNotePointerDown,
  onLoadDemo,
  onLoadLongDemo,
}: PianoRollProps) {
  return (
    <div className="timeline-canvas" data-empty={!hasMelody}>
      {!showEditableGrid ? (
        <div className="empty-state">
          <span className="empty-kicker">{t("empty.kicker")}</span>
          <h3>{t("empty.title")}</h3>
          <p>{t("empty.copy")}</p>
          <button type="button" className="primary-button" onClick={onLoadDemo}>
            {t("action.loadDemo")}
          </button>
          <button type="button" className="secondary-button" onClick={onLoadLongDemo}>
            {t("action.loadLongDemo")}
          </button>
        </div>
      ) : (
        <div className="timeline-stack" style={timelineGridStyle}>
          <div
            className="timeline-window ruler-window"
            ref={rulerScrollRef}
            onScroll={onSyncScroll}
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
            onScroll={onSyncScroll}
            aria-label="Melody piano roll"
          >
            <div
              className="melody-grid"
              data-editable={inputMode === "manual"}
              onPointerDown={onMelodyLanePointerDown}
              onPointerMove={onNotePointerMove}
              onPointerUp={onNotePointerUp}
              onPointerLeave={onNotePointerUp}
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
                    onClick={() => onAuditionPitch(row.midi)}
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
              {melody.map((note) => (
                <button
                  type="button"
                  className={`note${selectedNoteId === note.id ? " is-selected" : ""}`}
                  key={note.id}
                  data-editable={inputMode === "manual"}
                  style={{
                    gridColumn: noteGridColumn(note),
                    gridRow: noteGridRow(note),
                  }}
                  aria-label={`${note.name}, ${note.durationBeats} beat(s)`}
                  title={`${note.name}, ${note.durationBeats} beat(s)`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectNote(note.id);
                  }}
                  onPointerDown={(event) => onNotePointerDown(event, note, "move")}
                >
                  <span>{note.name}</span>
                  {inputMode === "manual" ? (
                    <span
                      className="note-resize-handle"
                      aria-hidden="true"
                      onPointerDown={(event) => onNotePointerDown(event, note, "resize")}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PianoRoll;
