import { generateHarmonyCandidates } from "./generateCandidates";
import type { NoteEvent, ProjectSettings } from "../types";

globalThis.onmessage = (event: MessageEvent<{ melody: NoteEvent[]; settings: ProjectSettings }>) => {
  try {
    const started = performance.now();
    const candidates = generateHarmonyCandidates(event.data.melody, event.data.settings);
    globalThis.postMessage({ candidates, elapsedMs: performance.now() - started });
  } catch (error) {
    globalThis.postMessage({ error: error instanceof Error ? error.message : "Generation failed" });
  }
};
