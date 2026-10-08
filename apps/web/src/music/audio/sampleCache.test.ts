import { afterEach, describe, expect, it, vi } from "vitest";
import { SampleCache } from "./sampleCache";

afterEach(() => vi.unstubAllGlobals());
describe("sample cache", () => {
  it("shares in-flight downloads and decoded buffers between voices", async () => {
    const fetchSample = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2])));
    vi.stubGlobal("fetch", fetchSample);
    const buffer = {} as AudioBuffer;
    const decode = vi.fn().mockResolvedValue(buffer);
    const cache = new SampleCache(decode);
    const [melody, harmony] = await Promise.all([
      cache.loadBank("https://example.test/", { C4: "C4.mp3" }),
      cache.loadBank("https://example.test/", { C4: "C4.mp3" }),
    ]);
    expect(fetchSample).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(melody.C4).toBe(harmony.C4);
    await cache.loadBank("https://example.test/", { C4: "C4.mp3" });
    expect(fetchSample).toHaveBeenCalledTimes(1);
    cache.dispose();
  });
  it("retries failed downloads instead of retaining rejected promises", async () => {
    const fetchSample = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(new Uint8Array([1])));
    vi.stubGlobal("fetch", fetchSample);
    const cache = new SampleCache(async () => ({} as AudioBuffer));
    await expect(cache.loadBank("https://example.test/", { C4: "C4.mp3" })).rejects.toThrow("offline");
    await cache.loadBank("https://example.test/", { C4: "C4.mp3" });
    expect(fetchSample).toHaveBeenCalledTimes(2);
    cache.dispose();
  });
  it("aborts pending requests on disposal", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal;
      signal!.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")));
    })));
    const cache = new SampleCache(async () => ({} as AudioBuffer));
    const pending = cache.loadBank("https://example.test/", { C4: "C4.mp3" });
    await Promise.resolve(); await Promise.resolve();
    cache.dispose();
    await expect(pending).rejects.toHaveProperty("name", "AbortError");
    expect(signal?.aborted).toBe(true);
  });
  it("loads cached samples without fetching and survives denied cache access", async () => {
    const fetchSample = vi.fn().mockResolvedValue(new Response(new Uint8Array([1])));
    vi.stubGlobal("fetch", fetchSample);
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({
      match: vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))), put: vi.fn().mockRejectedValue(new Error("quota")),
    }) });
    const cache = new SampleCache(async () => ({} as AudioBuffer));
    await cache.loadBank("https://example.test/", { C4: "C4.mp3" });
    expect(fetchSample).not.toHaveBeenCalled();
    cache.dispose();
    vi.stubGlobal("caches", { open: vi.fn().mockRejectedValue(new Error("disabled")) });
    const denied = new SampleCache(async () => ({} as AudioBuffer));
    await denied.loadBank("https://example.test/", { C4: "C4.mp3" });
    expect(fetchSample).toHaveBeenCalledOnce();
    denied.dispose();
  });
});
