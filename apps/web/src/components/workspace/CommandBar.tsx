import type { Dispatch, Ref } from "react";
import type { AppAction } from "../../app/appState";
import type { Language } from "../../app/i18n";
import type { HarmonyCandidate, ProjectSettings } from "../../music/types";
import type { AppState } from "../../app/sessionTypes";

import { SettingsFields } from "./SettingsFields";

type CommandBarProps = {
  t: (key: string) => string;
  fileInputRef: Ref<HTMLInputElement>;
  onFileSelected: (file: File | null) => void;
  language: Language;
  onSetLanguage: (language: Language) => void;
  isDemo: boolean;
  onOpenProjects: () => void;
  guideOpen: boolean;
  onOpenGuide: () => void;
  settings: ProjectSettings;
  dispatch: Dispatch<AppAction>;
  playbackStatus: AppState["playback"]["status"];
  onPausePlayback: () => void;
  hasMelody: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  inHarmonyPhase: boolean;
  harmonyCandidates: HarmonyCandidate[];
  selectedCandidateId: string | null;
  harmonyFlow: "compare" | "deep-dive";
  onSelectHarmonyStyle: (candidateId: string) => void;
};

// Main controls: language, local projects, guidance, settings, and generation.
export function CommandBar({
  t,
  fileInputRef,
  onFileSelected,
  language,
  onSetLanguage,
  isDemo,
  onOpenProjects,
  guideOpen,
  onOpenGuide,
  settings,
  dispatch,
  playbackStatus,
  onPausePlayback,
  hasMelody,
  isGenerating,
  onGenerate,
  inHarmonyPhase,
  harmonyCandidates,
  selectedCandidateId,
  harmonyFlow,
  onSelectHarmonyStyle,
}: CommandBarProps) {
  return (
    <header className="command-bar" aria-label="Main controls">
      <div className="brand-lockup">
        <span className="brand-mark">H</span>
        <div>
          <h1>Harmony Auxiliary</h1>
          <p>{t("brand.subtitle")}</p>
        </div>
      </div>

      <nav className="command-actions" aria-label="Project settings">
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept=".mid,.midi,audio/midi"
          onChange={(event) => onFileSelected(event.currentTarget.files?.[0] ?? null)}
        />
        <div className="segmented-control" aria-label="Workspace language">
          <button type="button" aria-pressed={language === "zh"} onClick={() => onSetLanguage("zh")}>
            中文
          </button>
          <button type="button" aria-pressed={language === "en"} onClick={() => onSetLanguage("en")}>
            EN
          </button>
        </div>
        {isDemo ? <span className="demo-badge">{t("workspace.demoBadge")}</span> : null}
        <button type="button" className="secondary-button" onClick={onOpenProjects}>
          {t("action.projects")}
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-haspopup="dialog"
          aria-expanded={guideOpen}
          onClick={onOpenGuide}
        >
          {t("view.guided")}
        </button>
        {inHarmonyPhase && harmonyCandidates.length > 0 ? (
          <div className="segmented-control harmony-style-control" aria-label={t("candidate.styleControl")}>
            {harmonyCandidates.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                aria-pressed={selectedCandidateId === candidate.id && harmonyFlow === "deep-dive"}
                onClick={() => onSelectHarmonyStyle(candidate.id)}
              >
                {t(`candidate.${candidate.mode}.short`)}
              </button>
            ))}
          </div>
        ) : null}
        <details className="settings-tray">
          <summary>{t("settings.projectSettings")}</summary>
          <SettingsFields
            settings={settings}
            dispatch={dispatch}
            t={t}
            playbackStatus={playbackStatus}
            onPausePlayback={onPausePlayback}
          />
        </details>
        <button
          type="button"
          className="primary-button"
          disabled={!hasMelody || isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? t("action.generating") : t("action.generate")}
        </button>
      </nav>
    </header>
  );
}

export default CommandBar;
