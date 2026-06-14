import { describe, expect, it } from "vitest";
import { midiForDraggedPitch } from "./App";

describe("piano roll pitch dragging", () => {
  it("maps vertical drag distance to chromatic semitone rows", () => {
    // Rows are now chromatic, so one row equals one semitone.
    expect(midiForDraggedPitch(64, -22, 22)).toBe(65);
    expect(midiForDraggedPitch(64, -44, 22)).toBe(66);
    expect(midiForDraggedPitch(64, 22, 22)).toBe(63);
  });

  it("clamps dragged notes to the C3–B5 piano roll range", () => {
    // Top of range is B5 (83); a large upward drag clamps there.
    expect(midiForDraggedPitch(81, -660, 22)).toBe(83);
    // Bottom of range is C3 (48); a large downward drag clamps there.
    expect(midiForDraggedPitch(50, 660, 22)).toBe(48);
  });
});
