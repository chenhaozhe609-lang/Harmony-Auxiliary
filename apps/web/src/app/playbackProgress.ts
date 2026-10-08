/** Only the playhead/readout subscribe per frame; the editor reads on actions. */
export function createPlaybackProgress() {
  let beat = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => beat,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set(next: number) {
      const value = Math.max(0, next);
      if (value === beat) return;
      beat = value;
      listeners.forEach((listener) => listener());
    },
  };
}

export type PlaybackProgress = ReturnType<typeof createPlaybackProgress>;
