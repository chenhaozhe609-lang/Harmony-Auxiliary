import { candidateProgression } from "../../app/pianoRollLayout";
import type { HarmonyCandidate, PlacedChord, ScoredChord } from "../../music/types";

type DeepDivePanelProps = {
  t: (key: string) => string;
  selectedCandidate: HarmonyCandidate | null;
  selectedChord: PlacedChord | null;
  chordAlternatives: ScoredChord[];
  onReplaceChord: (alternativeIndex: number) => void;
};

function countColorChords(candidate: HarmonyCandidate): number {
  return candidate.chords.filter(
    (placedChord) =>
      placedChord.chord.functionLabel === "Color" ||
      placedChord.chord.role === "secondary-dominant" ||
      placedChord.chord.role === "borrowed",
  ).length;
}

export function DeepDivePanel({
  t,
  selectedCandidate,
  selectedChord,
  chordAlternatives,
  onReplaceChord,
}: DeepDivePanelProps) {
  if (!selectedCandidate) return null;

  const colorCount = countColorChords(selectedCandidate);

  return (
    <section className="deep-dive-panel" aria-label={t("deepDive.panelLabel")}>
      <div className="deep-dive-copy">
        <span className="eyebrow">{t("deepDive.eyebrow")}</span>
        <h3>{t(`candidate.${selectedCandidate.mode}.title`)}</h3>
        <p>{t(`candidate.${selectedCandidate.mode}.summary`)}</p>
      </div>

      <div className="deep-dive-metrics" aria-label={t("deepDive.metrics")}>
        <div>
          <span>{t("deepDive.chords")}</span>
          <strong>{selectedCandidate.chords.length}</strong>
        </div>
        <div>
          <span>{t("deepDive.color")}</span>
          <strong>{colorCount}</strong>
        </div>
        <div>
          <span>{t("deepDive.current")}</span>
          <strong>{selectedChord?.chord.symbol ?? t("inspector.noChord")}</strong>
        </div>
      </div>

      <div className="deep-dive-progression">
        <span>{t("guide.progression")}</span>
        <strong title={candidateProgression(selectedCandidate)}>
          {candidateProgression(selectedCandidate)}
        </strong>
      </div>

      <div className="deep-dive-variants" aria-label={t("deepDive.variants")}>
        <span>{t("deepDive.variants")}</span>
        <div>
          {chordAlternatives.slice(0, 3).map((alternative, index) => (
            <button
              type="button"
              key={`${alternative.chord.id}-${index}`}
              onClick={() => onReplaceChord(index)}
            >
              <strong>{alternative.chord.symbol}</strong>
              <small>{alternative.chord.roman}</small>
            </button>
          ))}
          {chordAlternatives.length === 0 ? (
            <small className="deep-dive-empty">{t("deepDive.noVariants")}</small>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default DeepDivePanel;
