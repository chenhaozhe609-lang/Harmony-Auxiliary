import { describe, expect, it } from "vitest";
import { getDiatonicChords } from "./tonalAdapter";

describe("tonalAdapter diatonic palettes", () => {
  it("builds the C major diatonic palette with a dominant-7th V", () => {
    const chords = getDiatonicChords(0, "major");
    expect(chords).toHaveLength(7);
    expect(chords.map((c) => c.root)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(chords.map((c) => c.roman)).toEqual(["I", "ii", "iii", "IV", "V7", "vi", "vii°"]);
    expect(chords.map((c) => c.functionLabel)).toEqual(["T", "PD", "T", "PD", "D", "T", "D"]);

    const five = chords[4];
    expect(five.quality).toBe("dominant7");
    // G7 = G B D F → pitch classes 7, 11, 2, 5
    expect(five.tones).toEqual([7, 11, 2, 5]);
    expect(five.symbol).toBe("G7");
  });

  it("builds the A minor diatonic palette with a functional (major) dominant", () => {
    const chords = getDiatonicChords(9, "minor");
    expect(chords).toHaveLength(7);
    expect(chords.map((c) => c.roman)).toEqual(["i", "ii°", "III", "iv", "V7", "VI", "vii°"]);
    expect(chords.map((c) => c.functionLabel)).toEqual(["T", "PD", "T", "PD", "D", "T", "D"]);

    const i = chords[0];
    expect(i.quality).toBe("minor");
    expect(i.root).toBe(9); // A

    const five = chords[4];
    expect(five.quality).toBe("dominant7"); // E7 from harmonic minor
    expect(five.root).toBe(4); // E
    expect(five.tones).toEqual([4, 8, 11, 2]); // E G# B D
  });

  it("can use diatonic seventh chords for richer palettes", () => {
    const chords = getDiatonicChords(0, "major", { sevenths: true });
    expect(chords[0].quality).toBe("major7"); // Cmaj7
    expect(chords[0].roman).toBe("Imaj7");
    expect(chords[1].quality).toBe("minor7"); // Dm7
    expect(chords[1].roman).toBe("ii7");
  });
});
