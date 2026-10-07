import { chromium } from "playwright";

const BASE_URL = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";

const browser = await chromium.launch({
  ...(process.env.VERIFY_BROWSER_PATH ? { executablePath: process.env.VERIFY_BROWSER_PATH } : {}),
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

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  // Open a prefilled workspace directly from the landing page.
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();

  // Generate harmony so both windows have content (demo melody is preloaded).
  await page.waitForSelector(".melody-window .note");

  // TASK7 §11.2: the edit phase is a clean melody editor — no harmony UI yet,
  // but the melody-playback transport is available at the panel bottom.
  const editPhase = await page.evaluate(() => ({
    harmonyDrawer: Boolean(document.querySelector(".harmony-drawer")),
    candidateStrip: Boolean(document.querySelector(".candidate-strip")),
    melodyTransport: Boolean(document.querySelector(".melody-transport")),
  }));

  await page.getByRole("button", { name: /^生成$|^Generate$/ }).click();
  await page.waitForSelector(".harmony-window .chord-block", { timeout: 5000 });

  // Harmony phase: candidate strip + harmony drawer come forward; the standalone
  // melody transport gives way to the drawer-header transport.
  const harmonyPhase = await page.evaluate(() => ({
    harmonyDrawer: Boolean(document.querySelector(".harmony-drawer")),
    candidateStrip: Boolean(document.querySelector(".candidate-strip")),
    melodyTransport: Boolean(document.querySelector(".melody-transport")),
  }));

  // TASK7 E2: the harmony phase is now a style flow. Three preview lanes expose
  // audition and deep-dive controls; the command bar mirrors style selection.
  const styleFlowInitial = await page.evaluate(() => ({
    candidateCount: document.querySelectorAll(".candidate-strip .candidate").length,
    auditionButtons: document.querySelectorAll(".candidate-preview-button").length,
    deepDiveButtons: document.querySelectorAll(".candidate-deep-button").length,
    styleButtons: document.querySelectorAll(".harmony-style-control button").length,
    activeDeepDiveButtons: document.querySelectorAll('.candidate-deep-button[aria-pressed="true"]').length,
  }));

  await page.locator(".candidate-deep-button").nth(2).click();
  const styleFlowAfterCardDeepDive = await page.evaluate(() => ({
    selectedIndex: [...document.querySelectorAll(".candidate-strip .candidate")].findIndex((node) =>
      node.classList.contains("is-selected"),
    ),
    activeDeepDiveIndex: [...document.querySelectorAll(".candidate-deep-button")].findIndex(
      (node) => node.getAttribute("aria-pressed") === "true",
    ),
  }));

  await page.locator(".harmony-style-control button").nth(1).click();
  const styleFlowAfterCommandStyle = await page.evaluate(() => ({
    selectedIndex: [...document.querySelectorAll(".candidate-strip .candidate")].findIndex((node) =>
      node.classList.contains("is-selected"),
    ),
    activeStyleIndex: [...document.querySelectorAll(".harmony-style-control button")].findIndex(
      (node) => node.getAttribute("aria-pressed") === "true",
    ),
    activeDeepDiveIndex: [...document.querySelectorAll(".candidate-deep-button")].findIndex(
      (node) => node.getAttribute("aria-pressed") === "true",
    ),
    deepDiveMounted: Boolean(document.querySelector(".deep-dive-panel")),
    deepDiveClass: Boolean(document.querySelector(".workspace-grid.is-deep-dive")),
    timelineCanvasHeight: Math.round(document.querySelector(".timeline-canvas")?.getBoundingClientRect().height ?? 0),
    melodyWindowHeight: Math.round(document.querySelector(".melody-window")?.getBoundingClientRect().height ?? 0),
  }));

  const deepDiveOrder = await page.evaluate(() => {
    const panel = document.querySelector(".timeline-panel");
    const candidate = document.querySelector(".candidate-strip");
    const deep = document.querySelector(".deep-dive-panel");
    const canvas = document.querySelector(".timeline-canvas");
    const drawer = document.querySelector(".harmony-drawer");
    const inspector = document.querySelector(".inspector");
    const children = [...(panel?.children ?? [])];
    return {
      candidateBeforeCanvas: children.indexOf(candidate) > -1 && children.indexOf(candidate) < children.indexOf(canvas),
      deepBeforeCanvas: children.indexOf(deep) > -1 && children.indexOf(deep) < children.indexOf(canvas),
      canvasBeforeDrawer: children.indexOf(canvas) > -1 && children.indexOf(canvas) < children.indexOf(drawer),
      inspectorAfterPanel:
        Boolean(inspector) &&
        Boolean(panel) &&
        inspector.getBoundingClientRect().top >= panel.getBoundingClientRect().top - 2,
    };
  });

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

  await page.screenshot({
    path: `D:\\Trae_Projects\\Harmony-auxiliary\\dist\\t4-${viewport.name}-verify.png`,
    fullPage: true,
  });

  // Return to edit for the note-drag regression. Deep dive intentionally hides
  // editing controls and leaves that work to the clean melody phase.
  await page.getByRole("button", { name: /^编辑旋律$|^Edit melody$/ }).click();
  await page.waitForSelector(".melody-transport");

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

  await page.close();

  return {
    viewport: viewport.name,
    tonePreset,
    editPhase,
    harmonyPhase,
    styleFlowInitial,
    styleFlowAfterCardDeepDive,
    styleFlowAfterCommandStyle,
    deepDiveOrder,
    pianoRoll,
    windows,
    sync,
    pitchDrag,
    overflow,
  };
}

const results = [];
for (const viewport of viewports) {
  results.push(await inspectViewport(viewport));
}

await browser.close();

const errors = [];
for (const result of results) {
  const {
    viewport,
    tonePreset,
    editPhase,
    harmonyPhase,
    styleFlowInitial,
    styleFlowAfterCardDeepDive,
    styleFlowAfterCommandStyle,
    deepDiveOrder,
    pianoRoll,
    windows,
    sync,
    pitchDrag,
    overflow,
  } = result;

  if (tonePreset !== "acoustic-grand") {
    errors.push(`${viewport}: default tone preset is ${tonePreset}, expected acoustic-grand.`);
  }
  // TASK7 §11.2 phase split: edit phase hides harmony UI; harmony phase shows it.
  if (editPhase.harmonyDrawer || editPhase.candidateStrip) {
    errors.push(`${viewport}: edit phase should not show harmony UI (drawer=${editPhase.harmonyDrawer}, strip=${editPhase.candidateStrip}).`);
  }
  if (!editPhase.melodyTransport) {
    errors.push(`${viewport}: edit phase is missing the melody transport bar.`);
  }
  if (!harmonyPhase.harmonyDrawer || !harmonyPhase.candidateStrip) {
    errors.push(`${viewport}: harmony phase should show harmony UI (drawer=${harmonyPhase.harmonyDrawer}, strip=${harmonyPhase.candidateStrip}).`);
  }
  if (harmonyPhase.melodyTransport) {
    errors.push(`${viewport}: harmony phase should not also show the standalone melody transport.`);
  }
  if (styleFlowInitial.candidateCount !== 3) {
    errors.push(`${viewport}: expected three harmony preview candidates, got ${styleFlowInitial.candidateCount}.`);
  }
  if (styleFlowInitial.auditionButtons !== 3 || styleFlowInitial.deepDiveButtons !== 3) {
    errors.push(
      `${viewport}: style flow controls incomplete (audition=${styleFlowInitial.auditionButtons}, deep=${styleFlowInitial.deepDiveButtons}).`,
    );
  }
  if (styleFlowInitial.styleButtons !== 3) {
    errors.push(`${viewport}: command bar style control should expose three styles.`);
  }
  if (styleFlowInitial.activeDeepDiveButtons !== 0) {
    errors.push(`${viewport}: generation should open in compare mode, not deep dive.`);
  }
  if (styleFlowAfterCardDeepDive.selectedIndex !== 2 || styleFlowAfterCardDeepDive.activeDeepDiveIndex !== 2) {
    errors.push(
      `${viewport}: card deep dive did not select the color candidate (${JSON.stringify(styleFlowAfterCardDeepDive)}).`,
    );
  }
  if (
    styleFlowAfterCommandStyle.selectedIndex !== 1 ||
    styleFlowAfterCommandStyle.activeStyleIndex !== 1 ||
    styleFlowAfterCommandStyle.activeDeepDiveIndex !== 1
  ) {
    errors.push(
      `${viewport}: command-bar style selector did not select the pop candidate (${JSON.stringify(styleFlowAfterCommandStyle)}).`,
    );
  }
  if (!styleFlowAfterCommandStyle.deepDiveMounted || !styleFlowAfterCommandStyle.deepDiveClass) {
    errors.push(`${viewport}: deep-dive panel/class did not mount after choosing a style.`);
  }
  if (styleFlowAfterCommandStyle.timelineCanvasHeight > 280 || styleFlowAfterCommandStyle.melodyWindowHeight > 230) {
    errors.push(
      `${viewport}: deep-dive score strip stayed too tall (${JSON.stringify({
        timelineCanvasHeight: styleFlowAfterCommandStyle.timelineCanvasHeight,
        melodyWindowHeight: styleFlowAfterCommandStyle.melodyWindowHeight,
      })}).`,
    );
  }
  if (!deepDiveOrder.candidateBeforeCanvas || !deepDiveOrder.deepBeforeCanvas || !deepDiveOrder.canvasBeforeDrawer) {
    errors.push(`${viewport}: deep-dive order should be preview -> controls -> score -> harmony (${JSON.stringify(deepDiveOrder)}).`);
  }
  // DAW-scale range C2..C7 (TASK6 §11 Phase A2): a 61-key, 5-octave roll so the
  // melody editor always scrolls vertically inside the fixed-height stage.
  if (pianoRoll.keyCount !== 61) {
    errors.push(`${viewport}: expected 61 chromatic keys, got ${pianoRoll.keyCount}.`);
  }
  if (pianoRoll.blackKeyCount !== 25) {
    errors.push(`${viewport}: expected 25 black keys across 5 octaves, got ${pianoRoll.blackKeyCount}.`);
  }
  if (pianoRoll.firstKey !== "C7" || pianoRoll.lastKey !== "C2") {
    errors.push(
      `${viewport}: piano roll range is ${pianoRoll.firstKey}..${pianoRoll.lastKey}, expected C7..C2.`,
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
