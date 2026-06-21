import { describe, expect, it } from "vitest";
import { midiForDraggedPitch } from "./App";

describe("piano roll pitch dragging", () => {
  it("maps vertical drag distance to chromatic semitone rows", () => {
    // Rows are now chromatic, so one row equals one semitone.
    expect(midiForDraggedPitch(64, -22, 22)).toBe(65);
    expect(midiForDraggedPitch(64, -44, 22)).toBe(66);
    expect(midiForDraggedPitch(64, 22, 22)).toBe(63);
  });

  it("clamps dragged notes to the C2–C7 piano roll range", () => {
    // Top of range is C7 (96); a large upward drag clamps there.
    expect(midiForDraggedPitch(90, -660, 22)).toBe(96);
    // Bottom of range is C2 (36); a large downward drag clamps there.
    expect(midiForDraggedPitch(42, 660, 22)).toBe(36);
  });
});
