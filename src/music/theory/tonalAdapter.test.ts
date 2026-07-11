import { describe, expect, it } from "vitest";
import {
  getBorrowedChords,
  getDiatonicChords,
  getSecondaryDominants,
  getStylePalette,
} from "./tonalAdapter";

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

  it("builds a Dorian palette without forcing a classical dominant", () => {
    const chords = getDiatonicChords(0, "dorian");

    expect(chords.map((c) => c.root)).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(chords.map((c) => c.roman)).toEqual(["i", "ii", "III", "IV", "v", "vi°", "VII"]);
    expect(chords[4].quality).toBe("minor");
    expect(chords[5].quality).toBe("diminished");
  });

  it("builds a Mixolydian palette with a flat-seven modal anchor", () => {
    const chords = getDiatonicChords(0, "mixolydian", { sevenths: true });

    expect(chords.map((c) => c.root)).toEqual([0, 2, 4, 5, 7, 9, 10]);
    expect(chords[0].roman).toBe("I7");
    expect(chords[4].roman).toBe("v7");
    expect(chords[6].roman).toBe("♭VIImaj7");
  });
});

describe("tonalAdapter chromatic vocabulary (Task 7 P2)", () => {
  it("builds secondary dominants a 5th above each tonicizable degree in C major", () => {
    const triads = getDiatonicChords(0, "major", { sevenths: false, dominantSeventh: false });
    const secondary = getSecondaryDominants(triads);

    // ii, iii, IV, V, vi take a V7/x; the tonic and vii° (diminished) do not.
    expect(secondary.map((c) => c.roman)).toEqual([
      "V7/ii",
      "V7/iii",
      "V7/IV",
      "V7/V",
      "V7/vi",
    ]);
    expect(secondary.every((c) => c.role === "secondary-dominant")).toBe(true);
    expect(secondary.every((c) => c.quality === "dominant7")).toBe(true);

    // V7/vi in C is E7 (root E=4), resolving to vi (A=9).
    const vSlashVi = secondary.find((c) => c.roman === "V7/vi")!;
    expect(vSlashVi.root).toBe(4);
    expect(vSlashVi.appliedToRoot).toBe(9);
    expect(vSlashVi.appliedToRoman).toBe("vi");
  });

  it("borrows iv / bVI / bVII from the parallel minor in a major key", () => {
    const borrowed = getBorrowedChords(0, "major");
    expect(borrowed.map((c) => c.roman)).toEqual(["iv", "♭VI", "♭VII"]);
    expect(borrowed.every((c) => c.role === "borrowed" && c.borrowedFrom === "minor")).toBe(true);
    // iv is F minor (root F=5), the borrowed predominant colour.
    const iv = borrowed[0];
    expect(iv.root).toBe(5);
    expect(iv.quality).toBe("minor");
    expect(iv.functionLabel).toBe("PD");
  });

  it("only adds the chromatic vocabulary when a pass opts in (extended)", () => {
    const plain = getStylePalette(0, "major");
    const extended = getStylePalette(0, "major", { extended: true });
    expect(plain).toHaveLength(7);
    expect(extended.length).toBeGreaterThan(7);
    expect(extended.some((c) => c.role === "secondary-dominant")).toBe(true);
    expect(extended.some((c) => c.role === "borrowed")).toBe(true);
  });
});
