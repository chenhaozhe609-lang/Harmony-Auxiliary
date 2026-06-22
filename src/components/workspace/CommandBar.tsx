import type { Dispatch, Ref } from "react";
import type { AppAction } from "../../app/appState";
import type { AuthStatus } from "../../app/auth/AuthProvider";
import type { Language } from "../../app/i18n";
import type { AppState, ProjectSettings } from "../../music/types";
import { SettingsFields } from "./SettingsFields";

type CommandBarProps = {
  t: (key: string) => string;
  fileInputRef: Ref<HTMLInputElement>;
  onFileSelected: (file: File | null) => void;
  language: Language;
  onSetLanguage: (language: Language) => void;
  isDemo: boolean;
  authStatus: AuthStatus;
  userEmail: string | null;
  onRequestSignIn: () => void;
  onOpenProjects: () => void;
  onSignOut: () => void;
  guideOpen: boolean;
  onOpenGuide: () => void;
  settings: ProjectSettings;
  dispatch: Dispatch<AppAction>;
  playbackStatus: AppState["playback"]["status"];
  onPausePlayback: () => void;
  hasMelody: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
};

// The top command bar (TASK6 §10.2): brand lockup, language toggle, account /
// demo cluster, the on-demand guide trigger, project-settings tray, and Generate.
export function CommandBar({
  t,
  fileInputRef,
  onFileSelected,
  language,
  onSetLanguage,
  isDemo,
  authStatus,
  userEmail,
  onRequestSignIn,
  onOpenProjects,
  onSignOut,
  guideOpen,
  onOpenGuide,
  settings,
  dispatch,
  playbackStatus,
  onPausePlayback,
  hasMelody,
  isGenerating,
  onGenerate,
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
        {isDemo ? (
          <div className="account-cluster" aria-label={t("auth.account")}>
            <span className="demo-badge">{t("auth.demoBadge")}</span>
            {authStatus !== "unconfigured" ? (
              <button type="button" className="secondary-button" onClick={onRequestSignIn}>
                {t("auth.signIn")}
              </button>
            ) : null}
          </div>
        ) : authStatus === "authenticated" && userEmail ? (
          <div className="account-cluster" aria-label={t("auth.account")}>
            <button type="button" className="secondary-button" onClick={onOpenProjects}>
              {t("action.projects")}
            </button>
            <span className="account-email" title={userEmail}>
              {userEmail}
            </span>
            <button type="button" className="secondary-button" onClick={onSignOut}>
              {t("auth.signOut")}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          aria-haspopup="dialog"
          aria-expanded={guideOpen}
          onClick={onOpenGuide}
        >
          {t("view.guided")}
        </button>
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
