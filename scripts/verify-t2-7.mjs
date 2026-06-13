import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], {
  origin: "http://127.0.0.1:5181",
});

const page = await context.newPage();

await page.addInitScript(() => {
  window.localStorage.clear();
  window.indexedDB.deleteDatabase("harmony-auxiliary/projects");
});

await page.goto("http://127.0.0.1:5181", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open Workspace" }).click();
await page.getByRole("button", { name: "EN" }).click();
await page.getByRole("button", { name: "Load Long Demo" }).first().click();
await page.getByLabel("Rhythm").selectOption("bar");
await page.getByRole("button", { name: /^Generate$/ }).click();
await page.waitForSelector(".chord-block");
await page.waitForTimeout(150);

await page.locator(".timeline-scroll").evaluate((node) => {
  node.scrollLeft = node.scrollWidth;
});
await page.waitForTimeout(50);
await page.locator(".chord-block").last().click();

await page.getByRole("button", { name: "Copy Progression" }).click();
const copiedProgression = await page.evaluate(() => navigator.clipboard.readText());

const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Export MIDI" }).click();
const download = await downloadPromise;

const result = await page.evaluate(() => {
  const selectedCandidateProgression = document.querySelector(".candidate.is-selected strong");
  const selectedCandidateButton = document.querySelector(".candidate.is-selected");
  const selectedCandidateBox = selectedCandidateProgression?.getBoundingClientRect();
  const chords = [...document.querySelectorAll(".chord-block")];
  const notes = [...document.querySelectorAll(".note")];
  const bars = [...document.querySelectorAll(".bar-ruler span")].map((node) => node.textContent);
  const timelineScroll = document.querySelector(".timeline-scroll");
  const inspectorTitle = document.querySelector(".inspector h2")?.textContent;
  const progressionText = selectedCandidateProgression?.textContent ?? "";
  const progressionTitle = selectedCandidateProgression?.getAttribute("title") ?? "";

  return {
    noteCount: notes.length,
    chordCount: chords.length,
    lastBar: Number(bars.at(-1)),
    timelineScrolls: timelineScroll
      ? timelineScroll.scrollWidth > timelineScroll.clientWidth
      : false,
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    inspectorTitle,
    progressionText,
    progressionTitle,
    candidateButtonTitle: selectedCandidateButton?.getAttribute("title") ?? "",
    progressionBoxHeight: selectedCandidateBox?.height ?? 0,
  };
});

await page.screenshot({
  path: "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-7-verify.png",
  fullPage: true,
});

await browser.close();

const copiedChordCount = copiedProgression.split(" / ").filter(Boolean).length;
const errors = [];
if (result.noteCount < 40) errors.push(`Expected at least 40 notes, got ${result.noteCount}.`);
if (result.chordCount < 12) errors.push(`Expected at least 12 chords, got ${result.chordCount}.`);
if (result.lastBar < 12) errors.push(`Expected at least 12 visible bars, got ${result.lastBar}.`);
if (!result.timelineScrolls) errors.push("Timeline did not become horizontally scrollable.");
if (result.bodyOverflow) errors.push("Page body has horizontal overflow.");
if (!result.inspectorTitle) errors.push("Inspector did not show the selected last chord.");
if (result.progressionTitle !== result.progressionText) {
  errors.push("Candidate title does not preserve the full progression text.");
}
if (result.candidateButtonTitle !== result.progressionText) {
  errors.push("Candidate button title does not preserve the full progression text.");
}
if (result.progressionBoxHeight > 48) {
  errors.push(`Candidate progression line clamp is too tall: ${result.progressionBoxHeight}px.`);
}
if (copiedChordCount !== result.chordCount) {
  errors.push(`Copied progression lost chords: copied ${copiedChordCount}, UI has ${result.chordCount}.`);
}
if (!download.suggestedFilename().endsWith(".mid")) {
  errors.push(`Expected MIDI download, got ${download.suggestedFilename()}.`);
}

if (errors.length > 0) {
  console.error(JSON.stringify({ ...result, copiedChordCount, download: download.suggestedFilename(), errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ...result, copiedChordCount, download: download.suggestedFilename() }, null, 2));
