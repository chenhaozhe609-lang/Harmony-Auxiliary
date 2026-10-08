export const SAMPLE_CACHE_NAME = "harmony-audio-samples-v1";

/** One decoded buffer per URL, shared by both voices and by preset switches.
 * Cache Storage is best-effort; failed fetches are evicted so retry is possible.
 */
export class SampleCache {
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private requests = new Set<AbortController>();
  private disposed = false;

  constructor(private decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>) {}

  private load(url: string): Promise<AudioBuffer> {
    const existing = this.buffers.get(url);
    if (existing) return existing;
    const controller = new AbortController();
    this.requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const pending = (async () => {
      const cache = typeof caches === "undefined" ? null : await caches.open(SAMPLE_CACHE_NAME).catch(() => null);
      let response = await cache?.match(url).catch(() => undefined);
      if (!response) {
        response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Sample download failed: ${response.status}`);
        // Persist only after successful decode; corrupt responses must not poison retries.
      }
      if (this.disposed || controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const copy = response.clone();
      let buffer: AudioBuffer;
      try {
        buffer = await this.decode(await response.arrayBuffer());
      } catch (error) {
        await cache?.delete(url).catch(() => false);
        throw error;
      }
      if (this.disposed || controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      await cache?.put(url, copy).catch(() => undefined);
      return buffer;
    })().catch((error: unknown) => { this.buffers.delete(url); throw error; })
      .finally(() => { clearTimeout(timeout); this.requests.delete(controller); });
    this.buffers.set(url, pending);
    return pending;
  }

  async loadBank(baseUrl: string, urls: Record<string, string>): Promise<Record<string, AudioBuffer>> {
    if (this.disposed) throw new Error("Sample cache disposed");
    return Object.fromEntries(await Promise.all(Object.entries(urls).map(async ([pitch, file]) =>
      [pitch, await this.load(new URL(file, baseUrl).href)] as const)));
  }

  dispose() {
    this.disposed = true;
    this.requests.forEach((request) => request.abort());
    this.requests.clear();
    this.buffers.clear();
  }
}

export async function clearSampleCache(): Promise<void> {
  if (typeof caches !== "undefined") await caches.delete(SAMPLE_CACHE_NAME);
}
