import {
  describeFit,
  describeFunction,
  describeWarnings,
  relationshipLabel,
} from "../../app/explain";
import type { Language } from "../../app/i18n";
import type { HarmonyCandidate, PlacedChord, ScoredChord } from "../../music/types";

type InspectorProps = {
  t: (key: string) => string;
  language: Language;
  inspectorOpen: boolean;
  onClose: () => void;
  selectedCandidate: HarmonyCandidate | null;
  selectedChord: PlacedChord | null;
  hasMelody: boolean;
  melodyCount: number;
  chordAlternatives: ScoredChord[];
  onReplaceChord: (alternativeIndex: number) => void;
  onCopyProgression: () => void;
  onExportMidi: () => void;
};

// Selected-harmony detail sheet (TASK6 §10.2): an on-demand side-sheet that
// slides in when the user clicks a chord/voice, so the roll owns the full width.
export function Inspector({
  t,
  language,
  inspectorOpen,
  onClose,
  selectedCandidate,
  selectedChord,
  hasMelody,
  melodyCount,
  chordAlternatives,
  onReplaceChord,
  onCopyProgression,
  onExportMidi,
}: InspectorProps) {
  return (
    <aside
      className={`inspector inspector-sheet${inspectorOpen ? " is-open" : ""}`}
      aria-label="Selected harmony details"
      aria-hidden={!inspectorOpen ? true : undefined}
    >
      <button
        type="button"
        className="inspector-close"
        aria-label={t("auth.close")}
        onClick={onClose}
      >
        ×
      </button>
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
          <h2>{t("inspector.noChord")}</h2>
          <p>{t("inspector.emptyCopy")}</p>
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
