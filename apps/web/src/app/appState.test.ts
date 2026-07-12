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

  it("pauses playback without losing the current beat", () => {
    const playing = appReducer(createInitialState(), { type: "set-playback-status", status: "playing" });
    const withBeat = appReducer(playing, { type: "set-current-beat", currentBeat: 2.5 });
    const paused = appReducer(withBeat, { type: "pause-playback" });

    expect(paused.playback.status).toBe("paused");
    expect(paused.playback.currentBeat).toBe(2.5);
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

  it("updates a melody note and marks generated harmony as outdated", () => {
    const candidates = generateHarmonyCandidates(melody, defaultPreferences);
    const generated = appReducer(
      appReducer(createInitialState(), { type: "load-melody", melody }),
      { type: "set-candidates", candidates },
    );
    const editedNote = { ...melody[0], startBeat: 1.5, durationBeats: 0.5 };

    const updated = appReducer(generated, {
      type: "update-note",
      noteId: melody[0].id,
      note: editedNote,
    });

    expect(updated.melody[0].startBeat).toBe(1.5);
    expect(updated.melody[0].durationBeats).toBe(0.5);
    expect(updated.candidates).toEqual(candidates);
    expect(updated.selectedCandidateId).toBe(candidates[0].id);
    expect(updated.harmonyStatus).toBe("outdated");
  });

  it("changes harmony rhythm and marks generated harmony as outdated", () => {
    const candidates = generateHarmonyCandidates(melody, defaultPreferences);
    const generated = appReducer(
      appReducer(createInitialState(), { type: "load-melody", melody }),
      { type: "set-candidates", candidates },
    );

    const updated = appReducer(generated, {
      type: "set-harmony-rhythm",
      harmonyRhythm: "strong-beats",
    });

    expect(updated.settings.harmonyRhythm).toBe("strong-beats");
    expect(updated.settings.harmonyDensity).toBe("half-bar");
    expect(updated.candidates).toEqual(candidates);
    expect(updated.harmonyStatus).toBe("outdated");
  });

  it("changes playback tone without invalidating generated candidates", () => {
    const candidates = generateHarmonyCandidates(melody, defaultPreferences);
    const generated = appReducer(
      appReducer(createInitialState(), { type: "load-melody", melody }),
      { type: "set-candidates", candidates },
    );

    const updated = appReducer(generated, {
      type: "set-playback-tone",
      playbackTone: "glass-bell",
    });

    expect(updated.settings.playbackTone).toBe("glass-bell");
    expect(updated.candidates).toEqual(candidates);
    expect(updated.selectedCandidateId).toBe(candidates[0].id);
    expect(updated.harmonyStatus).toBe("ready");
  });

  it("deletes a melody note and clears stale candidates", () => {
    const candidates = generateHarmonyCandidates(melody, defaultPreferences);
    const generated = appReducer(
      appReducer(createInitialState(), { type: "load-melody", melody }),
      { type: "set-candidates", candidates },
    );

    const updated = appReducer(generated, { type: "delete-note", noteId: melody[0].id });

    expect(updated.melody).toEqual([]);
    expect(updated.candidates).toEqual([]);
    expect(updated.selectedChordId).toBeNull();
    expect(updated.harmonyStatus).toBe("empty");
  });

  it("resets the app with provided settings", () => {
    const state = appReducer(createInitialState(), { type: "load-melody", melody });
    const reset = appReducer(state, { type: "reset-app", settings: defaultPreferences });

    expect(reset.melody).toEqual([]);
    expect(reset.settings).toEqual(defaultPreferences);
  });
});
