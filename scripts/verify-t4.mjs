import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const viewports = [
  { name: "desktop", width: 1440, height: 980 },
  { name: "mobile", width: 390, height: 900 },
];

async function inspectViewport(viewport) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.indexedDB.deleteDatabase("harmony-auxiliary/projects");
  });

  await page.goto("http://127.0.0.1:5181", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open Workspace" }).click();

  // Load the demo melody, then generate harmony so both windows have content.
  await page.getByRole("button", { name: /载入示例旋律|Load Demo Melody/ }).click();
  await page.waitForSelector(".melody-window .note");
  await page.getByRole("button", { name: /^生成$|^Generate$/ }).click();
  await page.waitForSelector(".harmony-window .chord-block", { timeout: 5000 });

  // Default tone preset should be the sampled grand piano.
  const tonePreset = await page.evaluate(() => {
    const select = [...document.querySelectorAll(".settings-grid select")].find((node) =>
      [...node.options].some((option) => option.value === "acoustic-grand"),
    );
    return select?.value ?? null;
  });

  const pianoRoll = await page.evaluate(() => {
    const keys = [...document.querySelectorAll(".piano-keys .piano-key")];
    const blackKeys = keys.filter((key) => key.dataset.black === "true");
    const rootKeys = keys.filter((key) => key.dataset.root === "true");
    return {
      keyCount: keys.length,
      blackKeyCount: blackKeys.length,
      rootKeyCount: rootKeys.length,
      firstKey: keys[0]?.textContent?.trim() ?? null,
      lastKey: keys[keys.length - 1]?.textContent?.trim() ?? null,
    };
  });

  const windows = await page.evaluate(() => {
    const melody = document.querySelector(".melody-window");
    const harmony = document.querySelector(".harmony-window");
    const ruler = document.querySelector(".ruler-window");
    return {
      hasMelodyWindow: Boolean(melody),
      hasHarmonyWindow: Boolean(harmony),
      separateWindows: Boolean(melody) && Boolean(harmony) && melody !== harmony,
      melodyVerticallyScrollable: melody ? melody.scrollHeight > melody.clientHeight + 4 : false,
      melodyHorizontallyScrollable: melody ? melody.scrollWidth > melody.clientWidth + 4 : false,
      hasRuler: Boolean(ruler),
    };
  });

  // Verify horizontal scroll syncing + alignment: scroll melody, the others follow.
  const sync = await page.evaluate(async () => {
    const melody = document.querySelector(".melody-window");
    const harmony = document.querySelector(".harmony-window");
    const ruler = document.querySelector(".ruler-window");
    melody.scrollLeft = 160;
    melody.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    const melodyGrid = document.querySelector(".melody-grid");
    const harmonyGrid = document.querySelector(".harmony-grid");
    return {
      melodyScrollLeft: Math.round(melody.scrollLeft),
      harmonyScrollLeft: Math.round(harmony.scrollLeft),
      rulerScrollLeft: Math.round(ruler.scrollLeft),
      gridLeftDelta: Math.round(
        Math.abs(melodyGrid.getBoundingClientRect().left - harmonyGrid.getBoundingClientRect().left),
      ),
    };
  });

  // Reset horizontal scroll so the dragged note is clear of the sticky keyboard gutter.
  await page.evaluate(() => {
    const melody = document.querySelector(".melody-window");
    melody.scrollLeft = 0;
    melody.dispatchEvent(new Event("scroll"));
  });

  // Switch to manual so notes are draggable, then drag one note down across chromatic rows.
  await page.getByRole("button", { name: /手动|Manual/ }).click();
  await page.waitForTimeout(120);

  let pitchDrag = { ok: false };
  const noteHandle = page.locator(".melody-window .note").first();
  if (await noteHandle.count()) {
    await noteHandle.scrollIntoViewIfNeeded();
    const before = await noteHandle.getAttribute("aria-label");
    const box = await noteHandle.boundingBox();
    const winBox = await page.locator(".melody-window").boundingBox();
    if (box && winBox) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      // Drag toward whichever vertical edge has the most room, clamped inside the window.
      const roomAbove = cy - winBox.y;
      const roomBelow = winBox.y + winBox.height - cy;
      const direction = roomAbove > roomBelow ? -1 : 1;
      const targetY = Math.max(
        winBox.y + 14,
        Math.min(winBox.y + winBox.height - 14, cy + direction * 66),
      );
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx, targetY, { steps: 10 });
      await page.mouse.up();
      const after = await noteHandle.getAttribute("aria-label");
      pitchDrag = { ok: before !== after, before, after };
    }
  }

  const overflow = await page.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    toneStatus: document.querySelector(".tone-status")?.dataset.tone ?? "none",
  }));

  await page.screenshot({
    path: `D:\\Trae_Projects\\Harmony-auxiliary\\dist\\t4-${viewport.name}-verify.png`,
    fullPage: true,
  });

  await page.close();

  return { viewport: viewport.name, tonePreset, pianoRoll, windows, sync, pitchDrag, overflow };
}

const results = [];
for (const viewport of viewports) {
  results.push(await inspectViewport(viewport));
}

await browser.close();

const errors = [];
for (const result of results) {
  const { viewport, tonePreset, pianoRoll, windows, sync, pitchDrag, overflow } = result;

  if (tonePreset !== "acoustic-grand") {
    errors.push(`${viewport}: default tone preset is ${tonePreset}, expected acoustic-grand.`);
  }
  if (pianoRoll.keyCount !== 36) {
    errors.push(`${viewport}: expected 36 chromatic keys, got ${pianoRoll.keyCount}.`);
  }
  if (pianoRoll.blackKeyCount !== 15) {
    errors.push(`${viewport}: expected 15 black keys across 3 octaves, got ${pianoRoll.blackKeyCount}.`);
  }
  if (pianoRoll.firstKey !== "B5" || pianoRoll.lastKey !== "C3") {
    errors.push(
      `${viewport}: piano roll range is ${pianoRoll.firstKey}..${pianoRoll.lastKey}, expected B5..C3.`,
    );
  }
  if (!windows.separateWindows) {
    errors.push(`${viewport}: melody and harmony are not separate windows.`);
  }
  if (!windows.melodyVerticallyScrollable) {
    errors.push(`${viewport}: melody window is not vertically scrollable across 3 octaves.`);
  }
  if (Math.abs(sync.harmonyScrollLeft - sync.melodyScrollLeft) > 2) {
    errors.push(
      `${viewport}: harmony window did not follow melody horizontal scroll (${sync.harmonyScrollLeft} vs ${sync.melodyScrollLeft}).`,
    );
  }
  if (Math.abs(sync.rulerScrollLeft - sync.melodyScrollLeft) > 2) {
    errors.push(`${viewport}: ruler did not follow melody horizontal scroll.`);
  }
  if (sync.gridLeftDelta > 2) {
    errors.push(`${viewport}: melody and harmony grids are misaligned by ${sync.gridLeftDelta}px.`);
  }
  if (!pitchDrag.ok) {
    errors.push(`${viewport}: vertical note drag did not change pitch (${pitchDrag.before} -> ${pitchDrag.after}).`);
  }
  if (overflow.bodyOverflow) {
    errors.push(`${viewport}: workspace has horizontal overflow.`);
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ results, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ results }, null, 2));
