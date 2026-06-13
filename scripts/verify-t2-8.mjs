import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
});

await page.addInitScript(() => {
  window.localStorage.clear();
  window.indexedDB.deleteDatabase("harmony-auxiliary/projects");
});

await page.goto("http://127.0.0.1:5181", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open Workspace" }).click();
await page.getByRole("button", { name: "EN" }).click();
await page.getByRole("button", { name: "Load Long Demo" }).first().click();

async function generateForRhythm(value) {
  await page.getByLabel("Rhythm").selectOption(value);
  await page.getByRole("button", { name: /^Generate$/ }).click();
  await page.waitForSelector(".chord-block");
  await page.waitForTimeout(100);

  return page.evaluate(() => {
    const chords = [...document.querySelectorAll(".chord-block")];
    const melodyNotes = [...document.querySelectorAll(".melody-lane .note")];
    const harmonyNotes = [...document.querySelectorAll(".harmony-note")];
    const voiceLabels = [...document.querySelectorAll(".voice-labels span")].map((node) =>
      node.textContent?.trim(),
    );
    const candidateText = document.querySelector(".candidate.is-selected strong")?.textContent ?? "";
    const candidateTitle = document.querySelector(".candidate.is-selected strong")?.getAttribute("title") ?? "";
    const timelineScroll = document.querySelector(".timeline-scroll");
    const firstChord = chords[0];
    const lastChord = chords.at(-1);
    const firstChordStyle = firstChord ? getComputedStyle(firstChord) : null;
    const lastChordStyle = lastChord ? getComputedStyle(lastChord) : null;

    return {
      chordCount: chords.length,
      melodyNoteCount: melodyNotes.length,
      harmonyNoteCount: harmonyNotes.length,
      voiceLabels,
      candidateText,
      candidateTitle,
      firstChordGridColumn: firstChordStyle
        ? `${firstChordStyle.gridColumnStart} / ${firstChordStyle.gridColumnEnd}`
        : "",
      lastChordGridColumn: lastChordStyle
        ? `${lastChordStyle.gridColumnStart} / ${lastChordStyle.gridColumnEnd}`
        : "",
      timelineScrolls: timelineScroll
        ? timelineScroll.scrollWidth > timelineScroll.clientWidth
        : false,
      bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

const bar = await generateForRhythm("bar");
const strongBeats = await generateForRhythm("strong-beats");
const sparse = await generateForRhythm("sparse");

await page.locator(".timeline-scroll").evaluate((node) => {
  node.scrollLeft = node.scrollWidth;
});
await page.waitForTimeout(50);
await page.locator(".chord-block").last().click();

const inspector = await page.evaluate(() => ({
  title: document.querySelector(".inspector h2")?.textContent ?? "",
  roman: document.querySelector(".inspector-rows strong")?.textContent ?? "",
}));

await page.screenshot({
  path: "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-8-verify.png",
  fullPage: true,
});

await browser.close();

const errors = [];
if (bar.melodyNoteCount !== 44) errors.push(`Expected 44 long-demo notes, got ${bar.melodyNoteCount}.`);
if (bar.chordCount !== 12) errors.push(`Expected bar rhythm to create 12 chords, got ${bar.chordCount}.`);
if (strongBeats.chordCount !== 24) {
  errors.push(`Expected strong-beats rhythm to create 24 chords, got ${strongBeats.chordCount}.`);
}
if (sparse.chordCount !== 6) errors.push(`Expected sparse rhythm to create 6 chords, got ${sparse.chordCount}.`);
if (bar.candidateText !== bar.candidateTitle) errors.push("Candidate title lost full progression text.");
if (bar.firstChordGridColumn !== "2 / span 8") {
  errors.push(`Expected first bar chord at grid 2 / span 8, got ${bar.firstChordGridColumn}.`);
}
if (bar.lastChordGridColumn !== "90 / span 8") {
  errors.push(`Expected last bar chord at grid 90 / span 8, got ${bar.lastChordGridColumn}.`);
}
if (strongBeats.lastChordGridColumn !== "94 / span 4") {
  errors.push(`Expected last strong-beats chord at grid 94 / span 4, got ${strongBeats.lastChordGridColumn}.`);
}
if (sparse.lastChordGridColumn !== "82 / span 16") {
  errors.push(`Expected last sparse chord at grid 82 / span 16, got ${sparse.lastChordGridColumn}.`);
}
if (!bar.timelineScrolls || !strongBeats.timelineScrolls || !sparse.timelineScrolls) {
  errors.push("Timeline was not scrollable in every rhythm mode.");
}
if (bar.bodyOverflow || strongBeats.bodyOverflow || sparse.bodyOverflow) {
  errors.push("Page body overflowed horizontally in at least one rhythm mode.");
}
if (bar.harmonyNoteCount < bar.chordCount * 3) errors.push("Harmony voice lane did not render enough notes.");
if (bar.voiceLabels.join(",") !== "Bass,Lower,Middle,Upper,Chord") {
  errors.push(`Unexpected harmony voice labels: ${bar.voiceLabels.join(",")}.`);
}
if (!inspector.title || !inspector.roman) errors.push("Inspector did not show the selected final chord.");

const result = { bar, strongBeats, sparse, inspector };
if (errors.length > 0) {
  console.error(JSON.stringify({ ...result, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
