import { useSyncExternalStore } from "react";
import type { PlaybackProgress } from "../../app/playbackProgress";
import { beatToPixel, type createTimelineGridMetrics } from "../../app/timelineGrid";

export function Playhead({ progress, metrics }: {
  progress: PlaybackProgress;
  metrics: ReturnType<typeof createTimelineGridMetrics>;
}) {
  const beat = useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
  return <div className="playhead" aria-hidden="true" style={{ left: `${beatToPixel(beat, metrics)}px` }} />;
}

export function BeatReadout({ progress, label }: { progress: PlaybackProgress; label: string }) {
  const beat = useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
  return <span className="beat-readout" aria-live="off">{beat.toFixed(1)}<small>{label}</small></span>;
}
