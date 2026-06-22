import { candidateProgression } from "../../app/pianoRollLayout";
import type { HarmonyCandidate } from "../../music/types";

type CandidateStripProps = {
  t: (key: string) => string;
  isGenerating: boolean;
  candidates: HarmonyCandidate[];
  selectedCandidate: HarmonyCandidate | null;
  harmonyIsOutdated: boolean;
  hasMelody: boolean;
  onSelectCandidate: (candidateId: string) => void;
};

// Harmony candidate A/B/C switcher (TASK6 §10.2). Shows loading placeholders
// while scoring, the real candidates once generated, and disabled prompts before.
export function CandidateStrip({
  t,
  isGenerating,
  candidates,
  selectedCandidate,
  harmonyIsOutdated,
  hasMelody,
  onSelectCandidate,
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
              <button
                type="button"
                className={`candidate${
                  selectedCandidate?.id === candidate.id ? " is-selected" : ""
                }${harmonyIsOutdated ? " is-outdated" : ""}`}
                key={candidate.id}
                title={candidateProgression(candidate)}
                onClick={() => onSelectCandidate(candidate.id)}
              >
                <span>{t(`candidate.${candidate.mode}.title`)}</span>
                <strong title={candidateProgression(candidate)}>
                  {candidateProgression(candidate)}
                </strong>
                <small>
                  {harmonyIsOutdated
                    ? t("candidate.outdated")
                    : t(`candidate.${candidate.mode}.subtitle`)}
                </small>
              </button>
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
