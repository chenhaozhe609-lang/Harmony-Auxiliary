import { describe, expect, it } from "vitest";
import { getKeyLabel, getScalePitchClasses } from "./keys";
import { noteNameToPitchClass, pitchClassToName } from "./pitches";

describe("pitch utilities", () => {
  it("converts note names and pitch classes", () => {
    expect(noteNameToPitchClass("C")).toBe(0);
    expect(noteNameToPitchClass("Bb")).toBe(10);
    expect(pitchClassToName(7)).toBe("G");
  });
});

describe("key utilities", () => {
  it("builds C major", () => {
    expect(getScalePitchClasses(0, "major")).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(getKeyLabel(0, "major")).toBe("C major");
  });

  it("builds transposed major keys", () => {
    expect(getScalePitchClasses(7, "major")).toEqual([7, 9, 11, 0, 2, 4, 6]);
    expect(getScalePitchClasses(2, "major")).toEqual([2, 4, 6, 7, 9, 11, 1]);
  });
});

