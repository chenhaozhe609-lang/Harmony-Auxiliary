import { describe, expect, it } from "vitest";
import { longDemoMelody } from "../music/fixtures/demoMelodies";
import type { HarmonyCandidate, NoteEvent } from "../music/types";
import {
  beatToGridColumn,
  beatToPixel,
  beatRangeToGridColumn,
  createTimelineGridMetrics,
  durationToGridSpan,
  getTimelineEndBeat,
  pixelDeltaToSnappedBeats,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_SUBDIVISION_WIDTH,
  TIMELINE_SUBDIVISIONS_PER_BEAT,
} from "./timelineGrid";

function note(startBeat: number, durationBeats: number): NoteEvent {
  return {
    id: `note-${startBeat}-${durationBeats}`,
    midi: 60,
    pitchClass: 0,
    name: "C4",
    startBeat,
    durationBeats,
    velocity: 0.8,
    source: "manual",
  };
}

describe("timeline grid metrics", () => {
  it("keeps a four-measure minimum for short sketches", () => {
    const metrics = createTimelineGridMetrics(3.5, 4);

    expect(metrics.measureCount).toBe(4);
    expect(metrics.totalBeats).toBe(16);
    expect(metrics.columnCount).toBe(16 * TIMELINE_SUBDIVISIONS_PER_BEAT);
  });

  it("expands to fit longer melodies and harmony", () => {
    const candidate = {
      chords: [
        {
          startBeat: 0,
          durationBeats: 4,
        },
        {
          startBeat: 44,
          durationBeats: 4,
        },
      ],
    } as HarmonyCandidate;

    const endBeat = getTimelineEndBeat([note(0, 1), note(36, 2)], candidate);
    const metrics = createTimelineGridMetrics(endBeat, 4);

    expect(endBeat).toBe(48);
    expect(metrics.measureCount).toBe(12);
    expect(metrics.totalBeats).toBe(48);
  });

  it("maps beats and durations to half-beat grid columns", () => {
    expect(beatToGridColumn(0)).toBe(2);
    expect(beatToGridColumn(0.5)).toBe(3);
    expect(beatToGridColumn(2)).toBe(6);
    expect(durationToGridSpan(0.5)).toBe(1);
    expect(durationToGridSpan(1.5)).toBe(3);
  });

  it("uses the same grid range mapping for weak-beat and cross-bar events", () => {
    expect(beatRangeToGridColumn(0, 0.5)).toBe("2 / span 1");
    expect(beatRangeToGridColumn(1.5, 0.5)).toBe("5 / span 1");
    expect(beatRangeToGridColumn(3.5, 2)).toBe("9 / span 4");
  });

  it("maps playback beats to pixels and clamps at the timeline end", () => {
    const metrics = createTimelineGridMetrics(4, 4);

    expect(beatToPixel(0, metrics)).toBe(TIMELINE_LABEL_WIDTH);
    expect(beatToPixel(1, metrics)).toBe(
      TIMELINE_LABEL_WIDTH + TIMELINE_SUBDIVISION_WIDTH * TIMELINE_SUBDIVISIONS_PER_BEAT,
    );
    expect(beatToPixel(99, metrics)).toBe(
      TIMELINE_LABEL_WIDTH + metrics.totalBeats * metrics.beatWidth,
    );
  });

  it("maps pointer movement deltas to signed snapped beats", () => {
    const metrics = createTimelineGridMetrics(4, 4);

    expect(pixelDeltaToSnappedBeats(metrics.beatWidth, metrics)).toBe(1);
    expect(pixelDeltaToSnappedBeats(-metrics.beatWidth, metrics)).toBe(-1);
    expect(pixelDeltaToSnappedBeats(metrics.subdivisionWidth, metrics)).toBe(0.5);
  });

  it("keeps long timelines on exact measure boundaries", () => {
    const metrics = createTimelineGridMetrics(33.5, 4);

    expect(metrics.measureCount).toBe(9);
    expect(metrics.totalBeats).toBe(36);
    expect(beatRangeToGridColumn(32, 1.5)).toBe("66 / span 3");
  });

  it("maps the long melody fixture through the same timeline grid", () => {
    const endBeat = getTimelineEndBeat(longDemoMelody, null);
    const metrics = createTimelineGridMetrics(endBeat, 4);
    const lastNote = longDemoMelody.at(-1);

    expect(endBeat).toBe(48);
    expect(metrics.measureCount).toBe(12);
    expect(metrics.totalBeats).toBe(48);
    expect(lastNote).toBeDefined();
    expect(beatRangeToGridColumn(lastNote!.startBeat, lastNote!.durationBeats)).toBe("94 / span 4");
    expect(beatToPixel(48, metrics)).toBe(metrics.contentWidth);
  });
});
