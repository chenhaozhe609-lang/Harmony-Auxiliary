import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";
import { generateHarmonyCandidates } from "../music/harmony/generateCandidates";
import { defaultPreferences } from "./preferencesRepository";
import type { NoteEvent, PitchClass } from "../music/types";

const melody: NoteEvent[] = [
  {
    id: "n1",
    midi: 60,
    pitchClass: 0 as PitchClass,
    name: "C4",
    startBeat: 0,
    durationBeats: 1,
    velocity: 0.8,
    source: "manual",
  },
];

describe("app playback state", () => {
  it("toggles melody and harmony mute independently", () => {
    const state = createInitialState();
    const melodyMuted = appReducer(state, { type: "toggle-melody-muted" });
    const bothMuted = appReducer(melodyMuted, { type: "toggle-harmony-muted" });

    expect(bothMuted.playback.melodyMuted).toBe(true);
    expect(bothMuted.playback.harmonyMuted).toBe(true);
  });

  it("resets playback without changing mute choices", () => {
    const state = appReducer(createInitialState(), { type: "toggle-melody-muted" });
    const playing = appReducer(state, { type: "set-playback-status", status: "playing" });
    const withBeat = appReducer(playing, { type: "set-current-beat", currentBeat: 2.5 });
    const reset = appReducer(withBeat, { type: "reset-playback" });

    expect(reset.playback.status).toBe("stopped");
    expect(reset.playback.currentBeat).toBe(0);
    expect(reset.playback.melodyMuted).toBe(true);
  });
});

describe("app project editing state", () => {
  it("replaces a selected chord in the active candidate", () => {
    const candidates = generateHarmonyCandidates(melody, defaultPreferences);
    const state = appReducer(createInitialState(), { type: "set-candidates", candidates });
    const selectedCandidate = candidates[0];
    const selectedChord = selectedCandidate.chords[0];
    const replacement = {
      ...selectedChord,
      id: "replacement",
      chord: candidates[1].chords[0].chord,
    };

    const updated = appReducer(state, {
      type: "replace-chord",
      candidateId: selectedCandidate.id,
      chordId: selectedChord.id,
      replacement,
    });

    expect(updated.selectedChordId).toBe("replacement");
    expect(updated.candidates[0].chords[0].id).toBe("replacement");
  });

  it("resets the app with provided settings", () => {
    const state = appReducer(createInitialState(), { type: "load-melody", melody });
    const reset = appReducer(state, { type: "reset-app", settings: defaultPreferences });

    expect(reset.melody).toEqual([]);
    expect(reset.settings).toBe(defaultPreferences);
  });
});
