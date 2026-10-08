import { describe, expect, it, vi } from "vitest";
import { createHarmonyGenerationTask } from "./harmonyGenerationTask";
import { defaultPreferences } from "./preferencesRepository";
import { appReducer, createInitialState } from "./appState";
import { demoMelody } from "../music/fixtures/demoMelodies";

function mockWorker() {
  return { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null, onmessageerror: null } as unknown as Worker;
}
describe("harmony generation lifecycle", () => {
  it("terminates computation on cancellation", async () => {
    const worker = mockWorker();
    const task = createHarmonyGenerationTask(demoMelody, defaultPreferences, () => worker);
    task.cancel();
    await expect(task.result).rejects.toHaveProperty("name", "AbortError");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("returns worker results and releases the worker", async () => {
    const worker = mockWorker();
    const task = createHarmonyGenerationTask(demoMelody, defaultPreferences, () => worker);
    worker.onmessage!(new MessageEvent("message", { data: { candidates: [], elapsedMs: 50 } }));
    expect(await task.result).toEqual({ candidates: [], elapsedMs: 50 });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("releases a worker if posting the input snapshot fails", async () => {
    const worker = mockWorker();
    vi.mocked(worker.postMessage).mockImplementation(() => { throw new Error("Cannot clone"); });
    const task = createHarmonyGenerationTask(demoMelody, defaultPreferences, () => worker);
    await expect(task.result).rejects.toThrow("Cannot clone");
    task.cancel();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("rejects stale results after melody or settings change", () => {
    const original = appReducer(createInitialState(), { type: "load-melody", melody: demoMelody });
    const action = { type: "set-generated-candidates" as const, candidates: [], melody: original.melody, settings: original.settings };
    const edited = appReducer(original, { type: "delete-note", noteId: demoMelody[0].id });
    const transposed = appReducer(original, { type: "set-key", keyTonic: 2 });
    expect(appReducer(edited, action)).toBe(edited);
    expect(appReducer(transposed, action)).toBe(transposed);
  });
});
