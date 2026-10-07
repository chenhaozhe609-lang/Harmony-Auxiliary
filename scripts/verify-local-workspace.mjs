import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { Midi } = requireWeb("@tonejs/midi");
const baseUrl = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";
const browser = await chromium.launch({
  ...(process.env.VERIFY_BROWSER_PATH ? { executablePath: process.env.VERIFY_BROWSER_PATH } : {}),
  headless: true,
});

async function stored(page, storeName) {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const request = indexedDB.open("harmony-auxiliary-db", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(name, "readonly");
      const data = transaction.objectStore(name).getAll();
      data.onerror = () => reject(data.error);
      transaction.oncomplete = () => { db.close(); resolve(data.result); };
    };
  }), storeName);
}

async function openProjects(page) {
  await page.getByRole("button", { name: "项目", exact: true }).click();
  await page.getByRole("dialog", { name: "本地项目", exact: true }).waitFor();
  await page.locator('.projects-list[aria-busy="false"]').waitFor();
}

const results = [];
try {
  for (const viewport of [{ width: 1440, height: 980 }, { width: 390, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Core editing and persistence must work without any external service.
    await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue() : route.abort());

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open workspace", exact: true }).click();
    await page.locator(".workspace-grid").waitFor();
    assert.equal(new URL(page.url()).pathname, "/workspace");
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    await openProjects(page);
    assert.equal(await page.locator(".project-item").count(), 0);
    assert.equal(await page.getByRole("button", { name: "另存为新项目", exact: true }).isDisabled(), true);
    await page.locator(".projects-drawer .dialog-close").click();

    const midi = new Midi();
    midi.header.setTempo(100);
    const track = midi.addTrack();
    track.name = "Audit melody";
    [60, 64, 67, 60].forEach((pitch, index) => track.addNote({ midi: pitch, ticks: index * 480, durationTicks: 480, velocity: 0.8 }));
    await page.locator('input[type="file"]').setInputFiles({
      name: "audit.mid", mimeType: "audio/midi", buffer: Buffer.from(midi.toArray()),
    });
    await page.locator(".melody-window .note").first().waitFor();
    assert.equal(await page.locator(".melody-window .note").count(), 4);
    await page.getByRole("button", { name: "生成", exact: true }).click();
    await page.locator(".candidate-strip article.candidate").first().waitFor();
    assert.equal(await page.locator(".candidate-strip article.candidate").count(), 3);

    await openProjects(page);
    await page.getByRole("button", { name: "另存为新项目", exact: true }).click();
    await page.locator(".project-item").waitFor();
    await page.getByRole("button", { name: "重命名", exact: true }).click();
    await page.locator(".project-rename-input").fill("本地审计项目");
    await page.locator(".project-rename-input").press("Enter");
    await page.getByRole("button", { name: /^本地审计项目/ }).waitFor();
    await page.getByRole("button", { name: "更新当前项目", exact: true }).click();
    await page.getByRole("button", { name: "另存为新项目", exact: true }).waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector(".projects-save-actions button")?.disabled);
    const saved = await stored(page, "projects");
    assert.equal(saved.length, 1);
    assert.equal(saved[0].snapshot.title, "本地审计项目");
    assert.equal(saved[0].snapshot.candidates.length, 3);
    await page.locator(".projects-drawer .dialog-close").click();

    await page.locator(".candidate-deep-button").first().click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出 MIDI", exact: true }).click();
    assert.match((await download).suggestedFilename(), /-harmony\.mid$/);
    await page.waitForTimeout(1200); // Let the one-second autosave debounce commit.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".recovery-banner").waitFor();
    await page.getByRole("button", { name: "恢复", exact: true }).click();
    await page.locator(".candidate-strip article.candidate").first().waitFor();
    assert.equal(await page.locator(".melody-window .note").count(), 4);
    await openProjects(page);
    await page.getByRole("button", { name: /^本地审计项目/ }).click();
    await page.locator(".projects-overlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".melody-window .note").count(), 4);
    await openProjects(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.locator(".project-item").waitFor({ state: "hidden" });
    assert.equal((await stored(page, "projects")).length, 0);
    await page.locator(".projects-drawer .dialog-close").click();

    await page.goto(`${baseUrl}/demo`, { waitUntil: "domcontentloaded" });
    await page.locator(".melody-window .note").first().waitFor();
    // Recovery must remain intact until the user chooses whether to restore it.
    await page.locator(".recovery-banner").waitFor();
    await page.waitForTimeout(1200);
    assert.equal((await stored(page, "autosaves"))[0].snapshot.melody.length, 4);
    await page.getByRole("button", { name: "丢弃", exact: true }).click();
    await page.locator(".overflow-menu summary").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "清空本地数据", exact: true }).click();
    await page.locator(".melody-window .note").waitFor({ state: "hidden" });
    await page.waitForTimeout(1200);
    assert.equal((await stored(page, "autosaves")).length, 0);
    assert.equal(new URL(page.url()).pathname, "/workspace");
    assert.deepEqual(errors, []);
    results.push({ viewport, importGenerateExport: "passed", localProjects: "passed", recoveryAndClear: "passed" });
    await context.close();
  }

  const slowContext = await browser.newContext();
  // Leave remote sample downloads pending to reproduce a slow or unreachable CDN.
  await slowContext.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin
    ? route.continue() : undefined);
  const slowPage = await slowContext.newPage();
  await slowPage.goto(`${baseUrl}/demo`, { waitUntil: "domcontentloaded" });
  await slowPage.locator(".melody-window .note").first().waitFor();
  await slowPage.getByRole("button", { name: "Play timeline", exact: true }).click();
  await slowPage.waitForFunction(() => Number(document.querySelector(".beat-readout")?.firstChild?.textContent) > 0, null, { timeout: 3000 });
  results.push({ firstPlaybackWithPendingSamples: "passed" });
  await slowContext.close();

  const failureContext = await browser.newContext();
  await failureContext.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
    IDBFactory.prototype.open = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  const failurePage = await failureContext.newPage();
  const failures = [];
  failurePage.on("pageerror", (error) => failures.push(error.message));
  await failurePage.goto(`${baseUrl}/demo`, { waitUntil: "domcontentloaded" });
  await failurePage.locator(".melody-window .note").first().waitFor();
  await openProjects(failurePage);
  await failurePage.getByRole("button", { name: "另存为新项目", exact: true }).click();
  await failurePage.getByRole("dialog").getByRole("alert").waitFor();
  assert.deepEqual(failures, []);
  results.push({ blockedStorageKeepsWorkspaceUsable: "passed" });
  await failureContext.close();
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
