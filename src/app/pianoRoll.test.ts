import { describe, expect, it } from "vitest";
import { midiForDraggedPitch } from "./App";

describe("piano roll pitch dragging", () => {
  it("maps vertical drag distance to visible pitch rows", () => {
    expect(midiForDraggedPitch(64, -28, 28)).toBe(65);
    expect(midiForDraggedPitch(64, -56, 28)).toBe(67);
    expect(midiForDraggedPitch(64, 28, 28)).toBe(62);
  });

  it("clamps dragged notes to the visible piano roll range", () => {
    expect(midiForDraggedPitch(72, -280, 28)).toBe(72);
    expect(midiForDraggedPitch(60, 280, 28)).toBe(60);
  });
});
