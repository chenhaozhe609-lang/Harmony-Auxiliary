// A/B listening-compare for the Task 7 engine: prints the three style passes'
// progressions for each demo melody so the styles can be compared by ear/eye.
// Run with:  pnpm vite-node scripts/ab-styles-t7.ts
import { generateHarmonyCandidates } from "../src/music/harmony/generateCandidates";
import { demoMelody, longDemoMelody } from "../src/music/fixtures/demoMelodies";
import type { HarmonyCandidate, Mode, NoteEvent, ProjectSettings } from "../src/music/types";

const base: ProjectSettings = {
  keyTonic: 0,
  mode: "major",
  tempo: 92,
  timeSignature: { numerator: 4, denominator: 4 },
  harmonyRhythm: "bar",
  inputMode: "manual",
  playbackTone: "mellow-keys",
};

function line(candidate: HarmonyCandidate): string {
  const romans = candidate.chords.map((pc) => pc.chord.roman).join(" ");
  const symbols = candidate.chords.map((pc) => pc.chord.symbol).join(" ");
  return `  ${candidate.mode.padEnd(16)} ${romans}\n  ${"".padEnd(16)} ${symbols}`;
}

function report(label: string, melody: NoteEvent[], mode: Mode = "major") {
  const settings = { ...base, mode };
  console.log(`\n=== ${label} (${mode}) ===`);
  for (const candidate of generateHarmonyCandidates(melody, settings)) {
    console.log(line(candidate));
  }
}

report("demoMelody", demoMelody);
report("longDemoMelody", longDemoMelody);
report("longDemoMelody", longDemoMelody, "minor");
