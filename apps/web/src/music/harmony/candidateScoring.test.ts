import { describe, expect, it } from "vitest";
import { demoMelody } from "../fixtures/demoMelodies";
import { defaultPreferences } from "../../app/preferencesRepository";
import { generateHarmonyCandidates } from "./generateCandidates";
import { getChordAlternatives, makeReplacementPlacedChord } from "./chordAlternatives";
import { notesForPlacedChord } from "./candidateScoring";
import { scoreChordForSegment } from "./scoreChords";
import { STYLE_PROFILES, cadenceEmission, colorEmission, loopAnchorEmission, transitionScore } from "./transitions";
import { appReducer, createInitialState } from "../../app/appState";
import { createProjectSnapshot } from "../../app/projectRepository";

describe("complete progression scores", () => {
  it("reports melody, position, color, loop and transition terms for each voiced candidate", () => {
    for (const candidate of generateHarmonyCandidates(demoMelody, defaultPreferences)) {
      const profile = STYLE_PROFILES[candidate.mode];
      let expected = 0;
      let melodyOnly = 0;
      candidate.chords.forEach((placed, step) => {
        const fit = scoreChordForSegment(placed.chord, notesForPlacedChord(demoMelody, placed), placed.startBeat).score;
        melodyOnly += fit;
        expected += fit + cadenceEmission(step, candidate.chords.length, placed.chord, defaultPreferences.keyTonic, profile)
          + colorEmission(placed.chord, profile)
          + loopAnchorEmission(placed.chord, defaultPreferences.keyTonic, defaultPreferences.mode, profile)
          + (step ? transitionScore(candidate.chords[step - 1].chord, placed.chord, profile) : 0);
      });
      expect(candidate.score).toBeCloseTo(expected, 8);
      expect(candidate.score).not.toBeCloseTo(melodyOnly, 3);
    }
  });
  it("ranks alternatives by incoming and outgoing transitions and positional terms", () => {
    const candidate = generateHarmonyCandidates(demoMelody, defaultPreferences)[1];
    const selected = candidate.chords[1];
    const profile = STYLE_PROFILES[candidate.mode];
    const alternatives = getChordAlternatives(demoMelody, defaultPreferences, selected, 30, candidate);
    for (const alternative of alternatives) {
      const chord = alternative.chord;
      const expected = scoreChordForSegment(chord, notesForPlacedChord(demoMelody, selected), selected.startBeat).score
        + cadenceEmission(1, candidate.chords.length, chord, defaultPreferences.keyTonic, profile)
        + colorEmission(chord, profile)
        + loopAnchorEmission(chord, defaultPreferences.keyTonic, defaultPreferences.mode, profile)
        + transitionScore(candidate.chords[0].chord, chord, profile)
        + transitionScore(chord, candidate.chords[2].chord, profile);
      expect(alternative.score).toBeCloseTo(expected, 8);
    }
  });
  it("updates the successor explanation and total score after a manual replacement", () => {
    const candidates = generateHarmonyCandidates(demoMelody, defaultPreferences);
    const candidate = candidates[0];
    const alternatives = getChordAlternatives(demoMelody, defaultPreferences, candidate.chords[0], 30, candidate);
    const replacementChoice = alternatives.find((item) => item.chord.role === "secondary-dominant"
      && item.chord.appliedToRoot === candidate.chords[1].chord.root)!;
    expect(replacementChoice).toBeDefined();
    const initial = appReducer(appReducer(createInitialState(), { type: "load-melody", melody: demoMelody }), { type: "set-candidates", candidates });
    const updated = appReducer(initial, { type: "replace-chord", candidateId: candidate.id, chordId: candidate.chords[0].id,
      replacement: makeReplacementPlacedChord(candidate.chords[0], replacementChoice) });
    expect(updated.candidates[0].score).not.toBe(candidate.score);
    expect(updated.candidates[0].chords[1].explanation.functionInfo?.motion?.kind).toBe("tonicization");
    expect(updated.candidates[1]).toBe(candidates[1]);
  });
  it("refreshes legacy saved scores when restoring a ready project", () => {
    const candidates = generateHarmonyCandidates(demoMelody, defaultPreferences);
    const initial = appReducer(appReducer(createInitialState(), { type: "load-melody", melody: demoMelody }), { type: "set-candidates", candidates });
    const snapshot = createProjectSnapshot(initial);
    snapshot.candidates = candidates.map((candidate) => ({ ...candidate, score: -999 }));
    const restored = appReducer(createInitialState(), { type: "restore-snapshot", snapshot });
    expect(restored.candidates.map((candidate) => candidate.score)).toEqual(candidates.map((candidate) => candidate.score));
    expect(restored.selectedChordId).toBe(snapshot.selectedChordId);
  });
});
