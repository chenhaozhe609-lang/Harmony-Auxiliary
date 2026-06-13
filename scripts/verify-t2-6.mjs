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
await page.getByLabel("Rhythm").selectOption("bar");

const labelWidth = 68;
const beatWidth = 88;
const rows = {
  C5: 0,
  B4: 1,
  F4: 4,
  E4: 5,
};

async function clickGrid(rowIndex, beat) {
  const scrollLeft = Math.max(0, beat * beatWidth - 520);
  await page.locator(".timeline-scroll").evaluate((node, value) => {
    node.scrollLeft = value;
  }, scrollLeft);
  await page.waitForTimeout(50);
  const lane = page.locator(".melody-lane");
  const laneBox = await lane.boundingBox();
  if (!laneBox) throw new Error("Missing melody lane");
  const rowHeight = laneBox.height / 8;
  await page.mouse.click(
    laneBox.x + labelWidth + beat * beatWidth + 2,
    laneBox.y + rowIndex * rowHeight + rowHeight / 2,
  );
}

await clickGrid(rows.E4, 0);
await clickGrid(rows.F4, 4);
await clickGrid(rows.B4, 8);
await clickGrid(rows.C5, 12);

await page.getByRole("button", { name: /^Generate$/ }).click();
await page.waitForSelector(".chord-block");
await page.waitForTimeout(150);
await page.locator(".chord-block").last().click();
await page.waitForTimeout(50);

const result = await page.evaluate(() => {
  const chords = [...document.querySelectorAll(".candidate.is-selected strong")][0]?.textContent;
  const labels = [...document.querySelectorAll(".chord-block")].map((node) => node.textContent);
  const notes = [...document.querySelectorAll(".note")].map((node) => {
    const style = getComputedStyle(node);
    return {
      text: node.textContent,
      gridColumn: `${style.gridColumnStart} / ${style.gridColumnEnd}`,
      gridRow: style.gridRowStart,
    };
  });
  const functionReason = [...document.querySelectorAll(".inspector p")]
    .map((node) => node.textContent)
    .find((text) => text?.includes("Classical motion"));
  const inspectorTitle = document.querySelector(".inspector h2")?.textContent;
  return {
    chords,
    labels,
    notes,
    inspectorTitle,
    functionReason,
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

await page.screenshot({
  path: "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-6-verify.png",
  fullPage: true,
});

await browser.close();

console.log(JSON.stringify(result, null, 2));
