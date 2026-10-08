import type { AudioEngine, PlaybackOptions } from "./audioEngine";
import type { HarmonyCandidate, NoteEvent, PlaybackTonePreset } from "../types";

/** Load Tone separately so workspace editing doesn't wait for its module graph. */
export class LazyAudioEngine {
  private engine: AudioEngine | null = null;
  private pending: Promise<AudioEngine> | null = null;
  private disposed = false;
  private request = 0;

  private getEngine() {
    if (this.disposed) return Promise.reject(new Error("Audio engine disposed"));
    return this.pending ??= import("./audioEngine").then(({ AudioEngine }) => {
      if (this.disposed) throw new Error("Audio engine disposed");
      return this.engine = new AudioEngine();
    }).catch((error: unknown) => { this.pending = null; throw error; });
  }

  async loadTone(preset: PlaybackTonePreset) { return (await this.getEngine()).loadTone(preset); }
  async previewNote(midi: number, preset: PlaybackTonePreset) {
    const request = this.request;
    const engine = await this.getEngine();
    if (request === this.request && !this.disposed) await engine.previewNote(midi, preset);
  }
  async playCandidate(melody: NoteEvent[], candidate: HarmonyCandidate | null, tempo: number,
    options: PlaybackOptions, onBeat: (beat: number) => void, onEnded: () => void) {
    const request = ++this.request;
    const engine = await this.getEngine();
    if (request !== this.request || this.disposed) return false;
    return engine.playCandidate(melody, candidate, tempo, options, onBeat, onEnded);
  }
  stop() { ++this.request; this.engine?.stop(); }
  dispose() { this.disposed = true; ++this.request; this.engine?.dispose(); this.engine = null; }
}
