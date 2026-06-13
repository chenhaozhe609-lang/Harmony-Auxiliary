import { describe, expect, it } from "vitest";
import { demoMelody, longDemoMelody } from "./demoMelodies";

function melodyEndBeat() {
  return Math.max(...longDemoMelody.map((note) => note.startBeat + note.durationBeats));
}

describe("demo melody fixtures", () => {
  it("keeps the short demo compact for first-run loading", () => {
    expect(demoMelody).toHaveLength(5);
    expect(Math.max(...demoMelody.map((note) => note.startBeat + note.durationBeats))).toBeLessThan(16);
  });

  it("provides a 12-bar long melody fixture with sorted note timings", () => {
    expect(longDemoMelody).toHaveLength(44);
    expect(melodyEndBeat()).toBe(48);
    expect(longDemoMelody.every((note) => note.source === "demo")).toBe(true);
    expect(longDemoMelody.map((note) => note.id)).toHaveLength(new Set(longDemoMelody.map((note) => note.id)).size);

    for (let index = 1; index < longDemoMelody.length; index += 1) {
      expect(longDemoMelody[index].startBeat).toBeGreaterThanOrEqual(
        longDemoMelody[index - 1].startBeat,
      );
    }
  });
});
