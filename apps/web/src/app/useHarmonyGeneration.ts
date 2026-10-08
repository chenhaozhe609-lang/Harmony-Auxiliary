import { useEffect, useRef, useState, type Dispatch } from "react";
import type { AppState } from "./sessionTypes";
import type { AppAction } from "./appState";
import { createHarmonyGenerationTask } from "./harmonyGenerationTask";

export function useHarmonyGeneration(state: AppState, dispatch: Dispatch<AppAction>, onComplete: () => void, active = true) {
  const [isGenerating, setIsGenerating] = useState(false);
  const taskRef = useRef<ReturnType<typeof createHarmonyGenerationTask> | null>(null);
  useEffect(() => {
    return () => { taskRef.current?.cancel(); taskRef.current = null; };
  }, []);
  useEffect(() => {
    taskRef.current?.cancel();
    taskRef.current = null;
    setIsGenerating(false);
  }, [state.melody, state.settings, active]);

  const generate = async (failureMessage: string) => {
    taskRef.current?.cancel();
    taskRef.current = null;
    dispatch({ type: "clear-error", id: "generate" });
    setIsGenerating(true);
    let task: ReturnType<typeof createHarmonyGenerationTask> | null = null;
    try {
      task = createHarmonyGenerationTask(state.melody, state.settings);
      taskRef.current = task;
      const result = await task.result;
      if (taskRef.current !== task) return;
      dispatch({ type: "set-generated-candidates", candidates: result.candidates, melody: state.melody, settings: state.settings });
      onComplete();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (taskRef.current === task) dispatch({ type: "set-error", id: "generate", message: failureMessage });
    } finally {
      if (taskRef.current === task) { taskRef.current = null; setIsGenerating(false); }
    }
  };
  return { isGenerating, generate };
}
