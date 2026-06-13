import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

async function collectMetrics(viewport, screenshotPath) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
  });

  await page.goto("http://127.0.0.1:5181", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open Workspace" }).click();
  await page
    .getByLabel("Input actions")
    .getByRole("button", { name: /Load Demo|加载|示例/i })
    .click();
  await page.getByRole("button", { name: /^(Generate|生成)$/i }).click();
  await page.waitForSelector(".chord-block");
  await page.waitForTimeout(200);

  const metrics = await page.evaluate(() => {
  const canvas = document.querySelector(".timeline-canvas");
  const scroll = document.querySelector(".timeline-scroll");
  const grid = document.querySelector(".timeline-grid");
  const bars = [...document.querySelectorAll(".bar-ruler span")].map(
    (node) => node.textContent,
  );
  const notes = [...document.querySelectorAll(".note")].map((node) => ({
    text: node.textContent,
    gridColumn: `${getComputedStyle(node).gridColumnStart} / ${getComputedStyle(node).gridColumnEnd}`,
  }));
  const chords = [...document.querySelectorAll(".chord-block")].map((node) => ({
    text: node.textContent,
    gridColumn: `${getComputedStyle(node).gridColumnStart} / ${getComputedStyle(node).gridColumnEnd}`,
  }));

  return {
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    canvasWidth: canvas?.getBoundingClientRect().width,
    scrollClientWidth: scroll?.clientWidth,
    scrollWidth: scroll?.scrollWidth,
    gridWidth: grid?.getBoundingClientRect().width,
    bars,
    notes,
    chords,
  };
  });

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  await page.close();
  return metrics;
}

const desktop = await collectMetrics(
  { width: 1440, height: 980 },
  "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-1-verify.png",
);

const mobile = await collectMetrics(
  { width: 390, height: 900 },
  "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-1-mobile-verify.png",
);

await browser.close();

console.log(JSON.stringify({ desktop, mobile }, null, 2));
