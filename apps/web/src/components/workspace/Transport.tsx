import type { PlaybackProgress } from "../../app/playbackProgress";
import { BeatReadout } from "./PlaybackIndicators";
import type { AppState } from "../../app/sessionTypes";


type TransportProps = {
  t: (key: string) => string;
  canPlayTimeline: boolean;
  playbackStatus: AppState["playback"]["status"];
  melodyMuted: boolean;
  harmonyMuted: boolean;
  harmonyIsReady: boolean;
  progress: PlaybackProgress;
  onPlayFromStart: () => void;
  onPlayFromCurrentMeasure: () => void;
  onPlayPause: () => void;
  onToggleMelodyMute: () => void;
  onToggleHarmonyMute: () => void;
};

// Transport controls: rendered in the harmony drawer header (TASK6 §11). One
// source, one instance at a time so playback state stays unambiguous.
export function Transport({
  t,
  canPlayTimeline,
  playbackStatus,
  melodyMuted,
  harmonyMuted,
  harmonyIsReady,
  progress,
  onPlayFromStart,
  onPlayFromCurrentMeasure,
  onPlayPause,
  onToggleMelodyMute,
  onToggleHarmonyMute,
}: TransportProps) {
  return (
    <div className="toolbar-transport" aria-label="Playback controls">
      <div className="jump-group" role="group" aria-label="Playback start">
        <button
          type="button"
          disabled={!canPlayTimeline || playbackStatus === "starting"}
          onClick={onPlayFromStart}
        >
          {t("action.playFromStart")}
        </button>
        <button
          type="button"
          disabled={!canPlayTimeline || playbackStatus === "starting"}
          onClick={onPlayFromCurrentMeasure}
        >
          {t("action.playFromCurrentBar")}
        </button>
      </div>
      <button
        type="button"
        className="play-button"
        aria-label="Play timeline"
        disabled={!canPlayTimeline}
        onClick={onPlayPause}
      >
        {playbackStatus === "playing" ? t("action.pause") : t("action.play")}
      </button>
      <div className="mute-group" role="group" aria-label="Mute tracks">
        <button
          type="button"
          className="mute-chip"
          aria-pressed={melodyMuted}
          disabled={!canPlayTimeline}
          onClick={onToggleMelodyMute}
        >
          {t("transport.melody")}
        </button>
        <button
          type="button"
          className="mute-chip"
          aria-pressed={harmonyMuted}
          disabled={!harmonyIsReady}
          onClick={onToggleHarmonyMute}
        >
          {t("transport.harmony")}
        </button>
      </div>
      <BeatReadout progress={progress} label={t("timeline.beat")} />
    </div>
  );
}

export default Transport;
