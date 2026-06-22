import type { Dispatch } from "react";
import type { AppAction } from "../../app/appState";
import { KEY_OPTIONS, PLAYBACK_TONE_OPTIONS } from "../../app/workspaceConstants";
import { pitchClassToName } from "../../music/theory/pitches";
import type {
  AppState,
  HarmonyRhythmPattern,
  PitchClass,
  PlaybackTonePreset,
  ProjectSettings,
} from "../../music/types";

type SettingsFieldsProps = {
  settings: ProjectSettings;
  dispatch: Dispatch<AppAction>;
  t: (key: string) => string;
  playbackStatus: AppState["playback"]["status"];
  onPausePlayback: () => void;
};

// Shared project-settings fields, used by both the expert command-bar tray and
// the guided "settings" step so there is one source of truth for the controls.
export function SettingsFields({
  settings,
  dispatch,
  t,
  playbackStatus,
  onPausePlayback,
}: SettingsFieldsProps) {
  return (
    <div className="settings-grid">
      <label>
        {t("settings.key")}
        <select
          value={settings.keyTonic}
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
          value={settings.mode}
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
          value={settings.tempo}
          min={40}
          max={220}
          onChange={(event) => dispatch({ type: "set-tempo", tempo: Number(event.target.value) })}
        />
      </label>
      <label>
        {t("settings.density")}
        <select
          value={settings.harmonyRhythm}
          onChange={(event) =>
            dispatch({
              type: "set-harmony-rhythm",
              harmonyRhythm: event.target.value as HarmonyRhythmPattern,
            })
          }
        >
          <option value="bar">{t("settings.bar")}</option>
          <option value="strong-beats">{t("settings.strongBeats")}</option>
          <option value="every-beat">{t("settings.everyBeat")}</option>
          <option value="cadence-aware">{t("settings.cadenceAware")}</option>
          <option value="sparse">{t("settings.sparse")}</option>
        </select>
      </label>
      <label>
        {t("settings.tone")}
        <select
          value={settings.playbackTone}
          onChange={(event) => {
            if (playbackStatus === "playing") onPausePlayback();
            dispatch({
              type: "set-playback-tone",
              playbackTone: event.target.value as PlaybackTonePreset,
            });
          }}
        >
          {PLAYBACK_TONE_OPTIONS.map((tone) => (
            <option value={tone} key={tone}>
              {t(`tone.${tone}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default SettingsFields;
