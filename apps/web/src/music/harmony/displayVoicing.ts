import type { PlacedChord } from "../types";
import { midiToNoteName } from "../theory/pitches";

export type HarmonyVoiceName = "Bass" | "Lower" | "Middle" | "Upper";

export type DisplayHarmonyVoice = {
  voice: HarmonyVoiceName;
  midi: number;
  noteName: string;
};

const VOICE_ORDER: HarmonyVoiceName[] = ["Bass", "Lower", "Middle", "Upper"];

function chordToneToMidi(rootMidi: number, pitchClass: number): number {
  let midi = rootMidi + ((pitchClass - (rootMidi % 12) + 12) % 12);
  while (midi < rootMidi) midi += 12;
  return midi;
}

function makeUpperVoicing(placedChord: PlacedChord): number[] {
  const upperRoot = 48 + placedChord.chord.root;
  return placedChord.chord.tones
    .slice(0, 4)
    .map((pitchClass) => chordToneToMidi(upperRoot, pitchClass))
    .filter((midi, index, notes) => notes.indexOf(midi) === index)
    .sort((a, b) => a - b);
}

export function makeDisplayVoicing(placedChord: PlacedChord): DisplayHarmonyVoice[] {
  const bassPitch = placedChord.chord.bass ?? placedChord.chord.root;
  const bass = 36 + bassPitch;
  const upperVoicing = makeUpperVoicing(placedChord);
  const midiVoicing = [bass, ...upperVoicing].slice(0, VOICE_ORDER.length);

  return midiVoicing.map((midi, index) => ({
    voice: VOICE_ORDER[index],
    midi,
    noteName: midiToNoteName(midi),
  }));
}

export function getHarmonyVoiceRows(): HarmonyVoiceName[] {
  return VOICE_ORDER;
}

