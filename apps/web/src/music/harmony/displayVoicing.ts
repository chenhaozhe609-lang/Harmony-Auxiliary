import { makeChordVoicing } from "./voicing";
import type { PlacedChord } from "../types";
import { midiToNoteName } from "../theory/pitches";

export type HarmonyVoiceName = "Bass" | "Lower" | "Middle" | "Upper";

export type DisplayHarmonyVoice = {
  voice: HarmonyVoiceName;
  midi: number;
  noteName: string;
};

const VOICE_ORDER: HarmonyVoiceName[] = ["Bass", "Lower", "Middle", "Upper"];

export function makeDisplayVoicing(placedChord: PlacedChord): DisplayHarmonyVoice[] {
  const midiVoicing = makeChordVoicing(placedChord.chord);

  return midiVoicing.map((midi, index) => ({
    voice: VOICE_ORDER[index],
    midi,
    noteName: midiToNoteName(midi),
  }));
}

export function getHarmonyVoiceRows(): HarmonyVoiceName[] {
  return VOICE_ORDER;
}

