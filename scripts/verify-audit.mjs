import assert from "node:assert/strict";
import { mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";
const browser = await chromium.launch({
  ...(process.env.VERIFY_BROWSER_PATH ? { executablePath: process.env.VERIFY_BROWSER_PATH } : {}),
  headless: true,
});
const results = {};
const artifactDir = process.env.VERIFY_ARTIFACT_DIR ?? join(tmpdir(), "harmony-audit");
await mkdir(artifactDir, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin
    ? route.continue() : route.abort());
  await context.addInitScript(() => {
    window.auditRenders = { workspace: 0, editor: 0, indicators: 0 };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      inject: () => 1,
      onCommitFiberRoot(_id, root) {
        const visit = (fiber) => {
          if (!fiber) return;
          const props = fiber.memoizedProps;
          if (typeof fiber.type === "function" && (fiber.flags & 1) && props) {
            if ("navigateApp" in props) window.auditRenders.workspace++;
            if ("onNotePointerDown" in props) window.auditRenders.editor++;
            if ("progress" in props && ("metrics" in props || "label" in props)) window.auditRenders.indicators++;
          }
          visit(fiber.child); visit(fiber.sibling);
        };
        visit(root.current);
      },
      onCommitFiberUnmount() {},
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${baseUrl}/demo`);
  await page.locator(".melody-window .note").first().waitFor();
  assert(!requests.some((url) => /\/(three|Landing|FloatingLines)-/.test(url)), "Workspace loaded landing WebGL");
  await page.getByRole("button", { name: "生成", exact: true }).click();
  await page.locator("article.candidate").first().waitFor();
  await page.waitForTimeout(1400); // Autosave/status effects settle before measuring frames.
  assert((await page.evaluate(() => window.auditRenders.editor)) > 0, "Render instrumentation inactive");
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector(".beat-readout")?.firstChild?.textContent) > 0.2);
  await page.evaluate(() => { window.auditRenders = { workspace: 0, editor: 0, indicators: 0 }; });
  await page.waitForTimeout(700);
  results.playbackRenders = await page.evaluate(() => window.auditRenders);
  assert.equal(results.playbackRenders.workspace, 0, "Workspace rendered during playback frames");
  assert.equal(results.playbackRenders.editor, 0, "Editor rendered during playback frames");
  assert(results.playbackRenders.indicators > 10, "Playhead/readout did not update");
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  const pausedBeat = Number(await page.locator(".beat-readout").first().evaluate((node) => node.firstChild.textContent));
  await page.locator(".settings-tray summary").click();
  await page.locator('.settings-tray input[type="number"]').fill("110");
  assert.equal(Number(await page.locator(".beat-readout").first().evaluate((node) => node.firstChild.textContent)), pausedBeat);
  await page.locator(".settings-tray summary").click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await page.waitForFunction((beat) => Number(document.querySelector(".beat-readout")?.firstChild?.textContent) > beat + 0.2, pausedBeat);
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  results.pauseAndResume = "passed";
  await page.screenshot({ path: join(artifactDir, "workspace.png"), fullPage: true });

  // Keep the session in memory when browser history temporarily shows the landing.
  await page.evaluate(() => { history.pushState(null, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await page.locator(".landing-v2").waitFor();
  await page.goBack();
  await page.locator(".workspace-grid").waitFor({ state: "visible" });
  assert.equal(await page.locator("article.candidate").count(), 3);
  results.historyPreservesSession = "passed";

  const landing = await context.newPage();
  const landingRequests = [];
  landing.on("request", (request) => landingRequests.push(request.url()));
  await landing.goto(baseUrl);
  await landing.locator(".hero-title").waitFor();
  await landing.waitForTimeout(400);
  assert(!landingRequests.some((url) => /\/(Workspace|audioEngine)-/.test(url)), "Landing eagerly loaded workspace/audio");
  results.routeChunks = "passed";

  // Delay delivery after computation so an input edit can exercise stale-result handling.
  const cancelled = await context.newPage();
  await cancelled.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      set onmessage(handler) { super.onmessage = (event) => setTimeout(() => handler?.call(this, event), 600); }
    };
  });
  await cancelled.goto(`${baseUrl}/demo`);
  await cancelled.locator(".melody-window .note").first().waitFor();
  await cancelled.locator(".settings-tray summary").click();
  await cancelled.getByRole("button", { name: "生成", exact: true }).click();
  const tempoInput = cancelled.locator('.settings-tray input[type="number"]');
  const previousTempo = Number(await tempoInput.inputValue());
  await tempoInput.fill(String(previousTempo + 1));
  await cancelled.waitForTimeout(900);
  assert.equal(await cancelled.locator("article.candidate").count(), 0);
  await cancelled.getByRole("button", { name: "生成", exact: true }).click();
  await cancelled.locator("article.candidate").first().waitFor();
  assert.equal(await cancelled.locator("article.candidate").count(), 3);
  results.cancelAndRegenerate = "passed";

  const workerFile = (await readdir(new URL("../apps/web/dist/assets/", import.meta.url))).find((name) => /^generationWorker-.*\.js$/.test(name));
  assert(workerFile, "Run pnpm build before this production regression");
  await page.bringToFront();
  results.longGeneration = await page.evaluate(async (workerUrl) => {
    const melody = Array.from({ length: 1024 }, (_, index) => ({ id: `n${index}`, midi: [60, 64, 67, 62][index % 4],
      pitchClass: [0, 4, 7, 2][index % 4], name: ["C4", "E4", "G4", "D4"][index % 4],
      startBeat: index, durationBeats: 1, velocity: 0.8, source: "manual" }));
    let frames = 0;
    let running = true;
    const tick = () => { if (running) { frames++; requestAnimationFrame(tick); } };
    requestAnimationFrame(tick);
    const worker = new Worker(workerUrl, { type: "module" });
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error("Benchmark timeout")); }, 30_000);
      worker.onmessage = (event) => { clearTimeout(timeout); resolve(event.data); };
      worker.onerror = (event) => { clearTimeout(timeout); reject(new Error(event.message)); };
      worker.postMessage({ melody, settings: { keyTonic: 0, mode: "major", tempo: 100,
        timeSignature: { numerator: 4, denominator: 4 }, harmonyRhythm: "every-beat", inputMode: "manual", playbackTone: "glass-bell" } });
    });
    worker.terminate(); running = false;
    if (result.error) throw new Error(result.error);
    return { notes: melody.length, computeMs: Math.round(result.elapsedMs), mainThreadFrames: frames,
      candidates: result.candidates.length, chordsPerCandidate: result.candidates[0].chords.length };
  }, `${baseUrl}/assets/${workerFile}`);
  assert.equal(results.longGeneration.candidates, 3);
  assert.equal(results.longGeneration.chordsPerCandidate, 1024);
  assert(results.longGeneration.mainThreadFrames > 2, "Worker blocked the main thread");
  assert.deepEqual(errors, []);

  // A short valid WAV exercises real decoding, sampler setup and browser Cache Storage.
  const samples = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const wav = Buffer.alloc(44 + 4410 * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let index = 0; index < 4410; index++) wav.writeInt16LE(Math.round(Math.sin(index * 440 * 2 * Math.PI / 44100) * 3000), 44 + index * 2);
  let sampleRequests = 0;
  await samples.route("**/*.mp3", (route) => {
    sampleRequests++;
    return route.fulfill({ status: 200, contentType: "audio/wav", headers: { "access-control-allow-origin": "*" }, body: wav });
  });
  const samplePage = await samples.newPage();
  const sampleErrors = [];
  samplePage.on("pageerror", (error) => sampleErrors.push(error.message));
  await samplePage.goto(`${baseUrl}/demo`);
  await samplePage.locator(".melody-window .note").first().waitFor();
  const cachedCount = () => samplePage.evaluate(async () => (await (await caches.open("harmony-audio-samples-v1")).keys()).length);
  await samplePage.waitForFunction(async () => (await (await caches.open("harmony-audio-samples-v1")).keys()).length === 18);
  await samplePage.locator('.tone-status[data-tone="loading"]').waitFor({ state: "hidden" });
  assert.equal(await samplePage.locator('.tone-status[data-tone="fallback"]').count(), 0);
  assert.equal(sampleRequests, 18, "Both voices downloaded the same bank twice");
  await samplePage.getByRole("button", { name: "Play timeline", exact: true }).click();
  await samplePage.waitForFunction(() => Number(document.querySelector(".beat-readout")?.firstChild?.textContent) > 0);
  await samplePage.getByRole("button", { name: "Play timeline", exact: true }).click();
  await samplePage.reload();
  await samplePage.locator(".melody-window .note").first().waitFor();
  await samplePage.locator('.tone-status[data-tone="loading"]').waitFor({ state: "hidden" });
  assert.equal(sampleRequests, 18, "Reload failed to reuse persistent samples");
  await samplePage.locator(".overflow-menu summary").click();
  samplePage.once("dialog", (dialog) => dialog.accept());
  await samplePage.getByRole("button", { name: "清空本地数据", exact: true }).click();
  await samplePage.locator(".melody-window .note").waitFor({ state: "hidden" });
  assert.equal(await cachedCount(), 0);
  assert.deepEqual(sampleErrors, []);
  results.sampleCacheAndClear = "passed";
  await samples.close();
  console.log(JSON.stringify(results, null, 2));
  await context.close();
} finally {
  await browser.close();
}
