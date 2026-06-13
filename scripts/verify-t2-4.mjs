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
await page
  .getByLabel("Input actions")
  .getByRole("button", { name: /Load Demo/i })
  .click();
await page.getByRole("button", { name: /^Generate$/ }).click();
await page.waitForSelector(".harmony-note");
await page.waitForTimeout(150);

const beforeClick = await page.evaluate(() => {
  const notes = [...document.querySelectorAll(".harmony-note")].map((node) => {
    const style = getComputedStyle(node);
    return {
      text: node.textContent,
      gridColumn: `${style.gridColumnStart} / ${style.gridColumnEnd}`,
      gridRow: style.gridRowStart,
      selected: node.classList.contains("is-selected"),
    };
  });
  const labels = [...document.querySelectorAll(".chord-block")].map((node) => {
    const style = getComputedStyle(node);
    return {
      text: node.textContent,
      gridColumn: `${style.gridColumnStart} / ${style.gridColumnEnd}`,
      gridRow: style.gridRowStart,
      selected: node.classList.contains("is-selected"),
    };
  });
  const voiceLabels = [...document.querySelectorAll(".voice-labels span")].map(
    (node) => node.textContent,
  );
  return {
    harmonyNoteCount: notes.length,
    chordLabelCount: labels.length,
    firstChordVoiceNotes: notes.slice(0, 4),
    firstChordLabel: labels[0],
    voiceLabels,
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

await page.locator(".harmony-note").nth(4).click();

const afterClick = await page.evaluate(() => {
  const selectedNotes = [...document.querySelectorAll(".harmony-note.is-selected")].map(
    (node) => node.textContent,
  );
  const selectedLabel = document.querySelector(".chord-block.is-selected")?.textContent;
  const inspectorTitle = document.querySelector(".inspector h2")?.textContent;
  return {
    selectedNotes,
    selectedLabel,
    inspectorTitle,
  };
});

await page.screenshot({
  path: "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-4-verify.png",
  fullPage: true,
});

await browser.close();

console.log(JSON.stringify({ beforeClick, afterClick }, null, 2));

