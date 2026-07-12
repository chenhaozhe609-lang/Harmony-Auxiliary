import { describe, expect, it } from "vitest";
import { createInitialState } from "./appState";
import { createProjectSnapshot } from "./projectRepository";
import type { AppState } from "../music/types";

describe("createProjectSnapshot", () => {
  it("stores parsed project data and MIDI metadata without the original file blob", () => {
    const state: AppState = {
      ...createInitialState(),
      melody: [
        {
          id: "midi-0",
          midi: 60,
          pitchClass: 0,
          name: "C4",
          startBeat: 0,
          durationBeats: 1,
          velocity: 0.8,
          source: "midi",
        },
      ],
      importState: {
        status: "ready",
        fileName: "melody.mid",
        fileSize: 1280,
        lastModified: 1781190000000,
        selectedTrackIndex: 2,
      },
    };

    const snapshot = createProjectSnapshot(state);

    expect(snapshot.melody).toHaveLength(1);
    expect(snapshot.sourceImport).toEqual({
      fileName: "melody.mid",
      fileSize: 1280,
      lastModified: 1781190000000,
      selectedTrackIndex: 2,
    });
    expect(snapshot.sourceImport).not.toHaveProperty("storedBlobId");
    expect(JSON.stringify(snapshot)).not.toContain("ArrayBuffer");
  });
});
