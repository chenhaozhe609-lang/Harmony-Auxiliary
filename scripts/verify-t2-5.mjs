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
await page.getByRole("button", { name: "Manual" }).click();

const cButton = page.getByLabel("Manual note input").getByRole("button", {
  name: "C",
  exact: true,
});
for (let index = 0; index < 34; index += 1) {
  await cButton.click();
}

await page.getByLabel("Rhythm").selectOption("strong-beats");
await page.getByRole("button", { name: /^Generate$/ }).click();
await page.waitForSelector(".chord-block");
await page.waitForTimeout(150);

const metrics = await page.evaluate(() => {
  const scroll = document.querySelector(".timeline-scroll");
  const bars = [...document.querySelectorAll(".bar-ruler span")].map((node) => node.textContent);
  const notes = [...document.querySelectorAll(".note")].map((node) => {
    const style = getComputedStyle(node);
    return `${style.gridColumnStart} / ${style.gridColumnEnd}`;
  });
  const chords = [...document.querySelectorAll(".chord-block")].map((node) => {
    const style = getComputedStyle(node);
    return `${style.gridColumnStart} / ${style.gridColumnEnd}`;
  });
  return {
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollClientWidth: scroll?.clientWidth,
    scrollWidth: scroll?.scrollWidth,
    barCount: bars.length,
    lastBar: bars.at(-1),
    noteCount: notes.length,
    firstNote: notes[0],
    lastNote: notes.at(-1),
    chordCount: chords.length,
    firstChord: chords[0],
    lastChord: chords.at(-1),
  };
});

await page.screenshot({
  path: "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-5-verify.png",
  fullPage: true,
});

await browser.close();

console.log(JSON.stringify(metrics, null, 2));
