import { useRef, type Dispatch } from "react";
import type { AppAction } from "../../app/appState";
import { useDialog } from "../../app/useDialog";
import type { AuthStatus } from "../../app/auth/AuthProvider";
import { candidateProgression } from "../../app/pianoRollLayout";
import { GUIDE_STEPS } from "../../app/workspaceConstants";
import type { AppState, HarmonyCandidate, ProjectSettings } from "../../music/types";
import { SettingsFields } from "./SettingsFields";

type GuideOverlayProps = {
  t: (key: string) => string;
  onClose: () => void;
  guideStep: number;
  furthestReachable: number;
  canAdvanceStep: boolean;
  goToStep: (index: number) => void;
  settings: ProjectSettings;
  dispatch: Dispatch<AppAction>;
  playbackStatus: AppState["playback"]["status"];
  onPausePlayback: () => void;
  hasMelody: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  selectedCandidate: HarmonyCandidate | null;
  isDemo: boolean;
  authStatus: AuthStatus;
  projectsBusy: boolean;
  onCopyProgression: () => void;
  onExportMidi: () => void;
  onRequestSignIn: () => void;
  onSaveNewProject: () => void;
};

// The on-demand guidance wizard (TASK6 §11 Phase B): the former resident rail +
// coach, now a glass popup whose controls dispatch into the same AppState.
export function GuideOverlay({
  t,
  onClose,
  guideStep,
  furthestReachable,
  canAdvanceStep,
  goToStep,
  settings,
  dispatch,
  playbackStatus,
  onPausePlayback,
  hasMelody,
  isGenerating,
  onGenerate,
  selectedCandidate,
  isDemo,
  authStatus,
  projectsBusy,
  onCopyProgression,
  onExportMidi,
  onRequestSignIn,
  onSaveNewProject,
}: GuideOverlayProps) {
  const guideStepKey = GUIDE_STEPS[guideStep];
  const overlayRef = useRef<HTMLDivElement>(null);
  useDialog(true, onClose, overlayRef);

  return (
    <div
      className="guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("view.guided")}
      onClick={onClose}
      ref={overlayRef}
    >
      <div className="guide-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-close" aria-label={t("auth.close")} onClick={onClose}>
          ×
        </button>

        <nav className="guide-rail" aria-label={t("view.guided")}>
          {GUIDE_STEPS.map((key, index) => {
            const reachable = index <= furthestReachable;
            const isCurrent = index === guideStep;
            return (
              <button
                type="button"
                key={key}
                className={`guide-rail-step${isCurrent ? " is-current" : ""}${
                  index < guideStep ? " is-done" : ""
                }`}
                aria-current={isCurrent ? "step" : undefined}
                disabled={!reachable}
                onClick={() => goToStep(index)}
              >
                <span className="guide-rail-num">{index + 1}</span>
                <span className="guide-rail-label">{t(`guide.${key}.title`)}</span>
              </button>
            );
          })}
        </nav>

        <div className="guide-coach" data-step={guideStepKey}>
          <div className="guide-coach-head">
            <span className="guide-coach-index">
              {t("guide.step")} {guideStep + 1} {t("guide.of")} {GUIDE_STEPS.length}
            </span>
            <h3>{t(`guide.${guideStepKey}.title`)}</h3>
            <p>{t(`guide.${guideStepKey}.tip`)}</p>
          </div>

          {guideStepKey === "settings" ? (
            <div className="guide-coach-body">
              <SettingsFields
                settings={settings}
                dispatch={dispatch}
                t={t}
                playbackStatus={playbackStatus}
                onPausePlayback={onPausePlayback}
              />
            </div>
          ) : null}

          {guideStepKey === "generate" ? (
            <div className="guide-coach-body guide-generate">
              <button
                type="button"
                className="primary-button"
                disabled={!hasMelody || isGenerating}
                onClick={onGenerate}
              >
                {isGenerating ? t("action.generating") : t("action.generate")}
              </button>
            </div>
          ) : null}

          {guideStepKey === "export" ? (
            <div className="guide-coach-body guide-export">
              {selectedCandidate ? (
                <p className="guide-progression">
                  <span>{t("guide.progression")}</span>
                  <strong>{candidateProgression(selectedCandidate)}</strong>
                </p>
              ) : null}
              <p className="guide-privacy-note">
                {isDemo
                  ? t("privacy.demoNote")
                  : authStatus === "authenticated"
                    ? t("privacy.accountNote")
                    : t("privacy.localNote")}
              </p>
              <div className="guide-export-actions">
                <button type="button" className="secondary-button" onClick={onCopyProgression}>
                  {t("action.copyProgression")}
                </button>
                <button type="button" className="secondary-button" onClick={onExportMidi}>
                  {t("action.exportMidi")}
                </button>
                {isDemo ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={authStatus === "unconfigured"}
                    onClick={onRequestSignIn}
                  >
                    {t("auth.signIn")}
                  </button>
                ) : authStatus === "authenticated" ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!hasMelody || projectsBusy}
                    onClick={onSaveNewProject}
                  >
                    {projectsBusy ? t("projects.saving") : t("projects.saveNew")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="guide-coach-nav">
            <button
              type="button"
              className="secondary-button"
              disabled={guideStep === 0}
              onClick={() => goToStep(guideStep - 1)}
            >
              {t("guide.back")}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!canAdvanceStep}
              onClick={() => goToStep(guideStep + 1)}
            >
              {t("guide.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuideOverlay;
