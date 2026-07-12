import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredProjectSnapshot } from "../music/types";

const authGetUser = vi.fn();
const from = vi.fn();

vi.mock("./supabaseClient", () => ({
  requireSupabase: () => ({ auth: { getUser: authGetUser }, from }),
}));

import {
  createProject,
  deleteAllProjects,
  deleteProject,
  listProjects,
  renameProject,
  updateProject,
} from "./projectsRepository";

const snapshot: StoredProjectSnapshot = {
  schemaVersion: 1,
  id: "active",
  title: "Sketch",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  settings: {
    keyTonic: 0,
    mode: "major",
    tempo: 92,
    timeSignature: { numerator: 4, denominator: 4 },
    harmonyRhythm: "bar",
    inputMode: "manual",
    playbackTone: "acoustic-grand",
  },
  melody: [],
  candidates: [],
  selectedCandidateId: null,
  selectedChordId: null,
  harmonyStatus: "empty",
};

const row = {
  id: "project-1",
  title: "My Project",
  snapshot,
  created_at: "2026-02-01T10:00:00.000Z",
  updated_at: "2026-02-02T11:00:00.000Z",
};

beforeEach(() => {
  authGetUser.mockReset();
  from.mockReset();
});

describe("projectsRepository", () => {
  it("lists projects newest-first and maps snake_case columns", async () => {
    const order = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    const select = vi.fn(() => ({ order }));
    from.mockReturnValue({ select });

    const projects = await listProjects();

    expect(from).toHaveBeenCalledWith("projects");
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(projects).toEqual([
      {
        id: "project-1",
        title: "My Project",
        snapshot,
        createdAt: "2026-02-01T10:00:00.000Z",
        updatedAt: "2026-02-02T11:00:00.000Z",
      },
    ]);
  });

  it("creates a project tagged with the current user id", async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const single = vi.fn(() => Promise.resolve({ data: row, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    from.mockReturnValue({ insert });

    const project = await createProject("My Project", snapshot);

    expect(insert).toHaveBeenCalledWith({ user_id: "user-1", title: "My Project", snapshot });
    expect(project.id).toBe("project-1");
  });

  it("throws when creating a project while signed out", async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createProject("x", snapshot)).rejects.toThrow("Not authenticated.");
  });

  it("updates snapshot without touching the title by default", async () => {
    const single = vi.fn(() => Promise.resolve({ data: row, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await updateProject("project-1", snapshot);

    expect(update).toHaveBeenCalledWith({ snapshot });
    expect(eq).toHaveBeenCalledWith("id", "project-1");
  });

  it("renames a project by title only", async () => {
    const single = vi.fn(() => Promise.resolve({ data: row, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await renameProject("project-1", "Renamed");

    expect(update).toHaveBeenCalledWith({ title: "Renamed" });
  });

  it("deletes a project by id", async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const del = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: del });

    await deleteProject("project-1");

    expect(eq).toHaveBeenCalledWith("id", "project-1");
  });

  it("deletes every project for the current user", async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const del = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: del });

    await deleteAllProjects();

    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("surfaces query errors", async () => {
    const order = vi.fn(() => Promise.resolve({ data: null, error: new Error("rls denied") }));
    from.mockReturnValue({ select: () => ({ order }) });
    await expect(listProjects()).rejects.toThrow("rls denied");
  });
});
