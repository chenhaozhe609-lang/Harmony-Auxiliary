import type { HarmonyCandidate, NoteEvent, ProjectSettings } from "../music/types";

export type GenerationResult = { candidates: HarmonyCandidate[]; elapsedMs: number };

/** Each job owns its worker: terminate cancels computation as well as delivery. */
export function createHarmonyGenerationTask(melody: NoteEvent[], settings: ProjectSettings,
  createWorker = () => new Worker(new URL("../music/harmony/generationWorker.ts", import.meta.url), { type: "module" }),
) {
  const worker = createWorker();
  let cancel = () => {};
  const result = new Promise<GenerationResult>((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      clearTimeout(timeout);
      worker.terminate();
      return true;
    };
    const timeout = setTimeout(() => { finish(); reject(new Error("Generation timed out")); }, 60_000);
    cancel = () => {
      if (finish()) reject(new DOMException("Generation cancelled", "AbortError"));
    };
    worker.onmessage = (event: MessageEvent<GenerationResult & { error?: string }>) => {
      if (!finish()) return;
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.onerror = (event) => { finish(); reject(new Error(event.message)); };
    worker.onmessageerror = () => { finish(); reject(new Error("Invalid generation result")); };
    try {
      worker.postMessage({ melody, settings });
    } catch (error) {
      finish();
      reject(error);
    }
  });
  return { result, cancel };
}
