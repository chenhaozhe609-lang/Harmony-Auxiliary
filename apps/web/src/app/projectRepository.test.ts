import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { createInitialState } from "./appState";
import {
  clearActiveAutosave,
  clearAllProjectData,
  createProject,
  createProjectSnapshot,
  deleteAllProjects,
  deleteProject,
  listProjects,
  loadActiveAutosave,
  renameProject,
  saveActiveAutosave,
  updateProject,
} from "./projectRepository";
import { demoMelody } from "../music/fixtures/demoMelodies";
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

describe("local project storage", () => {
  const snapshot = () => createProjectSnapshot({ ...createInitialState(), melody: demoMelody });

  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("saves independent project copies and lists them by last update", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
      const first = await createProject(" First ", snapshot());
      vi.setSystemTime(new Date("2026-10-07T11:00:00Z"));
      const second = await createProject("Second", snapshot());
      expect(first.id).not.toBe(second.id);
      expect(first.title).toBe("First");
      expect(first.snapshot.id).toBe(first.id);
      expect(first.snapshot.title).toBe(first.title);
      expect(await listProjects()).toEqual([second, first]);
      const changed = { ...snapshot(), melody: [] };
      vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
      const updated = await updateProject(first.id, changed);
      expect(updated.createdAt).toBe(first.createdAt);
      expect(updated.snapshot.createdAt).toBe(first.createdAt);
      expect(updated.title).toBe("First");
      expect(updated.snapshot.melody).toEqual([]);
      expect((await listProjects()).map((project) => project.id)).toEqual([first.id, second.id]);
      expect((await listProjects())[1].snapshot.melody).toEqual(demoMelody);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renames both project and snapshot without losing music", async () => {
    const project = await createProject("Original", snapshot());
    const renamed = await renameProject(project.id, " Renamed ");
    expect(renamed.title).toBe("Renamed");
    expect(renamed.snapshot.title).toBe("Renamed");
    expect(renamed.snapshot.melody).toEqual(demoMelody);
    expect(await listProjects()).toEqual([renamed]);
  });

  it("rejects blank titles and updates to missing projects", async () => {
    await expect(createProject(" ", snapshot())).rejects.toThrow("title");
    await expect(updateProject("missing", snapshot())).rejects.toThrow("not found");
    await expect(renameProject("missing", "name")).rejects.toThrow("not found");
    expect(await listProjects()).toEqual([]);
  });

  it("deletes one project and keeps other projects and the draft", async () => {
    const first = await createProject("First", snapshot());
    const second = await createProject("Second", snapshot());
    await saveActiveAutosave(snapshot());
    await deleteProject(first.id);
    expect(await listProjects()).toEqual([second]);
    expect((await loadActiveAutosave())?.melody).toEqual(demoMelody);
  });

  it("deletes saved projects without discarding the active draft", async () => {
    await createProject("Project", snapshot());
    await saveActiveAutosave(snapshot());
    await deleteAllProjects();
    expect(await listProjects()).toEqual([]);
    expect(await loadActiveAutosave()).not.toBeNull();
    await clearActiveAutosave();
    expect(await loadActiveAutosave()).toBeNull();
  });

  it("clears all project data even with another tab's database connection open", async () => {
    await createProject("Project", snapshot());
    await saveActiveAutosave(snapshot());
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("harmony-auxiliary-db", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await clearAllProjectData();
      expect(await listProjects()).toEqual([]);
      expect(await loadActiveAutosave()).toBeNull();
    } finally {
      connection.close();
    }
  });

  it("reports transaction aborts instead of reporting a successful autosave", async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      const request = put.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    });
    await expect(saveActiveAutosave(snapshot())).rejects.toThrow("aborted");
    expect(await loadActiveAutosave()).toBeNull();
  });
});
