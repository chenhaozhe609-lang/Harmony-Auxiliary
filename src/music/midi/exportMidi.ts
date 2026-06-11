import { Midi } from "@tonejs/midi";
import type { HarmonyCandidate, NoteEvent, PlacedChord, ProjectSettings } from "../types";

const PPQ = 480;

function beatToTicks(beat: number): number {
  return Math.max(0, Math.round(beat * PPQ));
}

function chordToneToMidi(rootMidi: number, pitchClass: number): number {
  let midi = rootMidi + ((pitchClass - (rootMidi % 12) + 12) % 12);
  while (midi < rootMidi) midi += 12;
  return midi;
}

function chordVoicing(chord: PlacedChord): number[] {
  const bassPitch = chord.chord.bass ?? chord.chord.root;
  const bass = 36 + bassPitch;
  const upperRoot = 48 + chord.chord.root;
  const upperTones = chord.chord.tones
    .slice(0, 4)
    .map((pitchClass) => chordToneToMidi(upperRoot, pitchClass));

  return [bass, ...upperTones].filter((midi, index, notes) => notes.indexOf(midi) === index);
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
    for (const midiNote of chordVoicing(placedChord)) {
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
