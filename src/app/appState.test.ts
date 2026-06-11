import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState";

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

