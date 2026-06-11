import { Midi } from "@tonejs/midi";
import type { MidiImportResult, MidiTrackSummary, NoteEvent, PitchClass } from "../types";
import { createNoteEventId, midiToNoteName, normalizePitchClass } from "../theory/pitches";

type MidiLikeTrack = Midi["tracks"][number];

function summarizeTrack(track: MidiLikeTrack, index: number): MidiTrackSummary {
  return {
    index,
    name: track.name || `Track ${index + 1}`,
    instrumentName: track.instrument.name,
    noteCount: track.notes.length,
    channel: track.channel,
    percussion: track.instrument.percussion,
  };
}

function selectDefaultTrack(tracks: MidiTrackSummary[]): number {
  const pitchedTracks = tracks
    .filter((track) => !track.percussion && track.noteCount > 0)
    .sort((a, b) => b.noteCount - a.noteCount);

  return (pitchedTracks[0] ?? tracks.find((track) => track.noteCount > 0))?.index ?? -1;
}

function normalizeTrackNotes(track: MidiLikeTrack, ppq: number, prefix: string): NoteEvent[] {
  const firstTick = Math.min(...track.notes.map((note) => note.ticks));

  return track.notes
    .slice()
    .sort((a, b) => a.ticks - b.ticks)
    .map((note, index) => ({
      id: createNoteEventId(prefix, index),
      midi: note.midi,
      pitchClass: normalizePitchClass(note.midi) as PitchClass,
      name: note.name || midiToNoteName(note.midi),
      startBeat: (note.ticks - firstTick) / ppq,
      durationBeats: Math.max(0.125, note.durationTicks / ppq),
      velocity: note.velocity,
      source: "midi",
    }));
}

export function parseMidiArrayBuffer(
  arrayBuffer: ArrayBuffer,
  selectedTrackIndex?: number | null,
): MidiImportResult {
  const midi = new Midi(arrayBuffer);
  const tracks = midi.tracks.map(summarizeTrack).filter((track) => track.noteCount > 0);

  if (tracks.length === 0) {
    throw new Error("This MIDI file has no note tracks.");
  }

  const defaultTrackIndex = selectDefaultTrack(tracks);
  const trackIndex =
    selectedTrackIndex !== undefined &&
    selectedTrackIndex !== null &&
    tracks.some((track) => track.index === selectedTrackIndex)
      ? selectedTrackIndex
      : defaultTrackIndex;

  if (trackIndex < 0) {
    throw new Error("This MIDI file has no usable melody track.");
  }

  const track = midi.tracks[trackIndex];
  const tempo = midi.header.tempos[0]?.bpm
    ? Math.round(midi.header.tempos[0].bpm)
    : undefined;
  const timeSignatureEvent = midi.header.timeSignatures[0]?.timeSignature;

  return {
    melody: normalizeTrackNotes(track, midi.header.ppq, `midi-track-${trackIndex}`),
    tracks,
    selectedTrackIndex: trackIndex,
    tempo,
    timeSignature: timeSignatureEvent
      ? {
          numerator: timeSignatureEvent[0],
          denominator: timeSignatureEvent[1],
        }
      : undefined,
  };
}

