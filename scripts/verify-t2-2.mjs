import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
});

await page.goto("http://127.0.0.1:5181", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open Workspace" }).click();
await page.getByRole("button", { name: "EN" }).click();
await page.getByRole("button", { name: "Manual" }).click();
await page.waitForSelector(".melody-lane");

const before = await page.evaluate(() => document.querySelectorAll(".note").length);
const laneBox = await page.locator(".melody-lane").boundingBox();
if (!laneBox) throw new Error("Missing melody lane");

const clickX = laneBox.x + 68 + 88 * 2;
const clickY = laneBox.y + 28 * 3 + 14;
await page.mouse.click(clickX, clickY);
await page.waitForSelector(".note");

const afterCreate = await page.evaluate(() => {
  const note = document.querySelector(".note");
  if (!note) return null;
  const style = getComputedStyle(note);
  return {
    count: document.querySelectorAll(".note").length,
    text: note.textContent,
    gridColumn: `${style.gridColumnStart} / ${style.gridColumnEnd}`,
    gridRow: style.gridRowStart,
    selected: note.classList.contains("is-selected"),
  };
});

const noteBox = await page.locator(".note").boundingBox();
if (!noteBox) throw new Error("Missing created note");
await page.mouse.move(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
await page.mouse.down();
await page.mouse.move(noteBox.x + noteBox.width / 2 + 88, noteBox.y + noteBox.height / 2);
await page.mouse.up();

const afterMove = await page.evaluate(() => {
  const note = document.querySelector(".note");
  if (!note) return null;
  const style = getComputedStyle(note);
  return {
    gridColumn: `${style.gridColumnStart} / ${style.gridColumnEnd}`,
    selected: note.classList.contains("is-selected"),
  };
});

const resizeBox = await page.locator(".note-resize-handle").boundingBox();
if (!resizeBox) throw new Error("Missing resize handle");
await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
await page.mouse.down();
await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 88, resizeBox.y + resizeBox.height / 2);
await page.mouse.up();

const afterResize = await page.evaluate(() => {
  const note = document.querySelector(".note");
  if (!note) return null;
  const style = getComputedStyle(note);
  return {
    gridColumn: `${style.gridColumnStart} / ${style.gridColumnEnd}`,
    title: note.getAttribute("title"),
  };
});

await page.getByRole("button", { name: "Delete Note" }).click();
const afterDelete = await page.evaluate(() => document.querySelectorAll(".note").length);
const bodyOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
);

await page.screenshot({
  path: "D:\\Trae_Projects\\Harmony-auxiliary\\dist\\timeline-t2-2-verify.png",
  fullPage: true,
});

await browser.close();

console.log(
  JSON.stringify(
    {
      before,
      afterCreate,
      afterMove,
      afterResize,
      afterDelete,
      bodyOverflow,
    },
    null,
    2,
  ),
);
