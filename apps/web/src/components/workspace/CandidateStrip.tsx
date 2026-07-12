import { candidateProgression } from "../../app/pianoRollLayout";
import type { AppState, HarmonyCandidate } from "../../music/types";

type CandidateStripProps = {
  t: (key: string) => string;
  isGenerating: boolean;
  candidates: HarmonyCandidate[];
  selectedCandidate: HarmonyCandidate | null;
  harmonyFlow: "compare" | "deep-dive";
  playbackStatus: AppState["playback"]["status"];
  auditioningCandidateId: string | null;
  harmonyIsOutdated: boolean;
  hasMelody: boolean;
  onPreviewCandidate: (candidateId: string) => void;
  onDeepDiveCandidate: (candidateId: string) => void;
};

// Harmony candidate A/B/C flow (TASK7 E2): three preview lanes stay comparable,
// each can be auditioned, and a deliberate "deep dive" action commits the style.
export function CandidateStrip({
  t,
  isGenerating,
  candidates,
  selectedCandidate,
  harmonyFlow,
  playbackStatus,
  auditioningCandidateId,
  harmonyIsOutdated,
  hasMelody,
  onPreviewCandidate,
  onDeepDiveCandidate,
}: CandidateStripProps) {
  return (
    <div className="candidate-strip" aria-label="Harmony candidates">
      {isGenerating
        ? ["stable-classical", "pop-songwriting", "color-tension"].map((mode) => (
            <div className="candidate candidate-loading" key={mode}>
              <span>{t(`candidate.${mode}.title`)}</span>
              <strong>{t("candidate.loading")}</strong>
              <small>{t("candidate.scoring")}</small>
            </div>
          ))
        : candidates.length > 0
          ? candidates.map((candidate) => (
              <article
                className={`candidate${
                  selectedCandidate?.id === candidate.id ? " is-selected" : ""
                }${harmonyIsOutdated ? " is-outdated" : ""}`}
                key={candidate.id}
                title={candidateProgression(candidate)}
              >
                <span>{t(`candidate.${candidate.mode}.title`)}</span>
                <strong title={candidateProgression(candidate)}>
                  {candidateProgression(candidate)}
                </strong>
                <small>
                  {harmonyIsOutdated
                    ? t("candidate.outdated")
                    : selectedCandidate?.id === candidate.id && harmonyFlow === "deep-dive"
                      ? t("candidate.deepDiveActive")
                      : t(`candidate.${candidate.mode}.subtitle`)}
                </small>
                <div className="candidate-actions">
                  <button
                    type="button"
                    className="candidate-preview-button"
                    onClick={() => onPreviewCandidate(candidate.id)}
                  >
                    {auditioningCandidateId === candidate.id && playbackStatus === "playing"
                      ? t("candidate.pause")
                      : t("candidate.audition")}
                  </button>
                  <button
                    type="button"
                    className="candidate-deep-button"
                    aria-pressed={selectedCandidate?.id === candidate.id && harmonyFlow === "deep-dive"}
                    onClick={() => onDeepDiveCandidate(candidate.id)}
                  >
                    {t("candidate.deepDive")}
                  </button>
                </div>
              </article>
            ))
          : ["stable-classical", "pop-songwriting", "color-tension"].map((mode) => (
              <button type="button" className="candidate" disabled key={mode}>
                <span>{t(`candidate.${mode}.title`)}</span>
                <strong>{t("candidate.waiting")}</strong>
                <small>{hasMelody ? t("candidate.ready") : t("candidate.needsMelody")}</small>
              </button>
            ))}
    </div>
  );
}

export default CandidateStrip;
