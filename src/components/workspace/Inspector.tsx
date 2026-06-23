import {
  describeFit,
  describeFunction,
  describeWarnings,
  relationshipLabel,
} from "../../app/explain";
import type { Language } from "../../app/i18n";
import { makeDisplayVoicing } from "../../app/pianoRollLayout";
import type { HarmonyCandidate, PlacedChord, ScoredChord } from "../../music/types";

type InspectorProps = {
  t: (key: string) => string;
  language: Language;
  selectedCandidate: HarmonyCandidate | null;
  selectedChord: PlacedChord | null;
  hasMelody: boolean;
  melodyCount: number;
  isGenerating: boolean;
  chordAlternatives: ScoredChord[];
  onReplaceChord: (alternativeIndex: number) => void;
  onCopyProgression: () => void;
  onExportMidi: () => void;
};

// "Why this chord" panel (TASK7 §13 E3): a harmony-phase-resident column that
// surfaces the explanation P1 already produces — function, roman, cadence /
// progression reason, voicing, melody fit, and alternatives. It updates as the
// user clicks chords; it is only mounted in the harmony phase, so the edit phase
// stays a clean melody editor (no chord to explain there).
export function Inspector({
  t,
  language,
  selectedCandidate,
  selectedChord,
  hasMelody,
  melodyCount,
  isGenerating,
  chordAlternatives,
  onReplaceChord,
  onCopyProgression,
  onExportMidi,
}: InspectorProps) {
  return (
    <aside className="inspector inspector-panel" aria-label="Selected harmony details">
      <span className="eyebrow">{t("inspector.label")}</span>
      {selectedCandidate && selectedChord ? (
        <>
          <h2>{selectedChord.chord.symbol}</h2>
          <p className="candidate-summary">
            {t(`candidate.${selectedCandidate.mode}.summary`)}
          </p>
          <div className="inspector-rows">
            <div>
              <span>{t("inspector.roman")}</span>
              <strong>{selectedChord.chord.roman}</strong>
            </div>
            <div>
              <span>{t("inspector.function")}</span>
              <strong>{selectedChord.chord.functionLabel}</strong>
            </div>
            <div>
              <span>{t("inspector.voicing")}</span>
              <strong>
                {makeDisplayVoicing(selectedChord)
                  .map((voice) => voice.noteName)
                  .join(" · ")}
              </strong>
            </div>
            <div>
              <span>{t("inspector.melody")}</span>
              <strong>
                {selectedChord.explanation.melodyRelationships[0]
                  ? `${selectedChord.explanation.melodyRelationships[0].noteName} = ${relationshipLabel(
                      language,
                      selectedChord.explanation.melodyRelationships[0].relationship,
                    )}`
                  : t("inspector.noNote")}
              </strong>
            </div>
          </div>
          <p>
            {describeFit(
              language,
              selectedChord.chord,
              selectedChord.explanation.fit,
              selectedChord.explanation.fitReason,
            )}
          </p>
          <p>
            {describeFunction(
              language,
              selectedChord.chord,
              selectedChord.explanation.functionInfo,
              selectedChord.explanation.functionReason,
            )}
          </p>
          {selectedChord.explanation.warnings.length > 0 ? (
            <p className="warning-copy">
              {describeWarnings(
                language,
                selectedChord.chord,
                selectedChord.explanation.warningNotes,
                selectedChord.explanation.warnings,
              )}
            </p>
          ) : null}
          <div className="alternative-chords" aria-label="Alternative chords">
            <span>{t("inspector.alternatives")}</span>
            <div>
              {chordAlternatives.slice(0, 4).map((alternative, index) => (
                <button
                  type="button"
                  key={`${alternative.chord.id}-${index}`}
                  onClick={() => onReplaceChord(index)}
                >
                  <strong>{alternative.chord.symbol}</strong>
                  <small>{alternative.chord.roman}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="export-actions">
            <button type="button" className="secondary-button" onClick={onCopyProgression}>
              {t("action.copyProgression")}
            </button>
            <button type="button" className="secondary-button" onClick={onExportMidi}>
              {t("action.exportMidi")}
            </button>
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <h2>{isGenerating ? t("lane.scoring") : t("inspector.noChord")}</h2>
          <p>{isGenerating ? t("inspector.scoringCopy") : t("inspector.emptyCopy")}</p>
          <div className="inspector-rows">
            <div>
              <span>{t("inspector.melody")}</span>
              <strong>
                {hasMelody ? `${melodyCount} ${t("inspector.notes")}` : t("inspector.empty")}
              </strong>
            </div>
            <div>
              <span>{t("inspector.generate")}</span>
              <strong>{hasMelody ? t("inspector.available") : t("inspector.disabled")}</strong>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Inspector;
