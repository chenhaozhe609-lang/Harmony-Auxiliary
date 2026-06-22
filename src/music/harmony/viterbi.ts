// A small, generic Viterbi decoder: given per-step candidate states with
// emission scores and pairwise transition scores, find the highest-scoring path
// through the whole sequence. This replaces the old per-segment greedy with a
// globally optimal chord path. Deterministic: ties break on a stable state key.
// (Task 7 P1)

export type ViterbiModel<S> = {
  /** Number of steps (e.g. harmony segments). */
  length: number;
  /** Candidate states available at a step. */
  statesAt: (step: number) => S[];
  /** Emission score of a state at a step — higher is better. */
  emission: (step: number, state: S) => number;
  /** Transition score from the previous state into the current one. */
  transition: (step: number, prev: S, cur: S) => number;
  /** Stable key for deterministic tie-breaking. */
  keyOf: (state: S) => string;
};

type Cell<S> = { state: S; score: number; prev: number };

// Returns the optimal state per step (length items), or [] when length is 0.
export function viterbi<S>(model: ViterbiModel<S>): S[] {
  const { length, statesAt, emission, transition, keyOf } = model;
  if (length <= 0) return [];

  const table: Cell<S>[][] = [];

  // Step 0: emission only.
  const first = statesAt(0).map<Cell<S>>((state) => ({
    state,
    score: emission(0, state),
    prev: -1,
  }));
  table.push(first);

  // Steps 1..n-1: best previous + transition + emission.
  for (let step = 1; step < length; step += 1) {
    const prevCells = table[step - 1];
    const cells = statesAt(step).map<Cell<S>>((state) => {
      let bestPrev = 0;
      let bestPrevScore = -Infinity;
      for (let p = 0; p < prevCells.length; p += 1) {
        const candidate = prevCells[p].score + transition(step, prevCells[p].state, state);
        if (
          candidate > bestPrevScore ||
          (candidate === bestPrevScore &&
            keyOf(prevCells[p].state) < keyOf(prevCells[bestPrev].state))
        ) {
          bestPrevScore = candidate;
          bestPrev = p;
        }
      }
      return { state, score: emission(step, state) + bestPrevScore, prev: bestPrev };
    });
    table.push(cells);
  }

  // Pick the best final cell (stable tie-break), then backtrack.
  const last = table[length - 1];
  let bestIndex = 0;
  for (let i = 1; i < last.length; i += 1) {
    if (
      last[i].score > last[bestIndex].score ||
      (last[i].score === last[bestIndex].score && keyOf(last[i].state) < keyOf(last[bestIndex].state))
    ) {
      bestIndex = i;
    }
  }

  const path: S[] = new Array(length);
  let index = bestIndex;
  for (let step = length - 1; step >= 0; step -= 1) {
    const cell = table[step][index];
    path[step] = cell.state;
    index = cell.prev;
  }
  return path;
}
