import { makeChordVoicing } from "../harmony/voicing";
import { Midi } from "@tonejs/midi";
import type { HarmonyCandidate, NoteEvent, ProjectSettings } from "../types";

const PPQ = 480;

function beatToTicks(beat: number): number {
  return Math.max(0, Math.round(beat * PPQ));
}

export function exportCandidateToMidi(
  melody: NoteEvent[],
  candidate: HarmonyCandidate,
  settings: ProjectSettings,
): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(settings.tempo);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [settings.timeSignature.numerator, settings.timeSignature.denominator],
    measures: 0,
  });

  const melodyTrack = midi.addTrack();
  melodyTrack.name = "Melody";
  melodyTrack.channel = 0;
  for (const note of melody) {
    melodyTrack.addNote({
      midi: note.midi,
      ticks: beatToTicks(note.startBeat),
      durationTicks: Math.max(1, beatToTicks(note.durationBeats)),
      velocity: Math.max(0.1, Math.min(1, note.velocity)),
    });
  }

  const harmonyTrack = midi.addTrack();
  harmonyTrack.name = "Harmony";
  harmonyTrack.channel = 1;
  for (const placedChord of candidate.chords) {
    for (const midiNote of makeChordVoicing(placedChord.chord)) {
      harmonyTrack.addNote({
        midi: midiNote,
        ticks: beatToTicks(placedChord.startBeat),
        durationTicks: Math.max(1, beatToTicks(placedChord.durationBeats)),
        velocity: 0.62,
      });
    }
  }

  return midi.toArray();
}

export function createMidiFileName(sourceName?: string | null): string {
  const base = sourceName?.replace(/\.(mid|midi)$/i, "") || "harmony-auxiliary";
  return `${base}-harmony.mid`;
}
