import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent } from "react";
import type { NoteEvent } from "../music/types";
import type { AppState } from "./sessionTypes";
import type { AppAction } from "./appState";
import { PITCH_ROWS, createManualGridNote, midiForDraggedPitch, updateNotePitch, updateNoteTiming } from "./pianoRollLayout";
import { MIN_NOTE_DURATION_BEATS, pixelDeltaToSnappedBeats, pixelToSnappedBeat, type createTimelineGridMetrics } from "./timelineGrid";
type NoteDragState = {
  noteId: string;
  mode: "move" | "resize";
  originClientX: number;
  originClientY: number;
  originalNote: NoteEvent;
};

export function useMelodyEditing(state: AppState, dispatch: Dispatch<AppAction>,
  timelineMetrics: ReturnType<typeof createTimelineGridMetrics>, durationBeats: number, pausePlayback: () => void) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const noteDragRef = useRef<NoteDragState | null>(null);
  useEffect(() => {
    if (selectedNoteId && !state.melody.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId, state.melody]);

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

  const handleDeleteSelectedNote = () => {
    if (!selectedNoteId) return;
    pausePlayback();
    dispatch({ type: "delete-note", noteId: selectedNoteId });
    setSelectedNoteId(null);
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
    pausePlayback();
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

  return { selectedNoteId, setSelectedNoteId, handleDeleteSelectedNote, handleMelodyLanePointerDown,
    handleNotePointerDown, handleNotePointerMove, handleNotePointerUp };
}
