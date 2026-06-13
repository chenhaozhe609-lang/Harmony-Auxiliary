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

async function generateForRhythm(value) {
  await page.getByLabel("Rhythm").selectOption(value);
  await page.getByRole("button", { name: /^Generate$/ }).click();
  await page.waitForSelector(".chord-block");
  await page.waitForTimeout(100);

  const result = await page.evaluate(() => {
    const chords = [...document.querySelectorAll(".chord-block")].map((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent,
        gridColumn: `${style.gridColumnStart} / ${style.gridColumnEnd}`,
      };
    });
    return {
      chordCount: chords.length,
      chords,
      bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  return result;
}

const results = {
  bar: await generateForRhythm("bar"),
  strongBeats: await generateForRhythm("strong-beats"),
  everyBeat: await generateForRhythm("every-beat"),
  cadenceAware: await generateForRhythm("cadence-aware"),
  sparse: await generateForRhythm("sparse"),
};

await page.screenshot({
  path: "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-3-verify.png",
  fullPage: true,
});

await browser.close();

console.log(JSON.stringify(results, null, 2));

