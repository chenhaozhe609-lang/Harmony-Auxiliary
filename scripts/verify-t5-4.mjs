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

const stepOf = (page) => page.evaluate(() => document.querySelector(".guide-coach")?.dataset.step ?? null);
const present = (page, selector) => page.evaluate((s) => Boolean(document.querySelector(s)), selector);

// TASK6 §11 Phase B: the workspace is one unified expert stage; guidance is an
// on-demand popup wizard (no separate guided view, no view toggle). The wizard's
// controls dispatch to the same AppState, so the workspace behind it updates.
async function inspectViewport(viewport) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // Enter the demo sandbox — it lands directly in the unified expert workspace.
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await page.waitForSelector(".app-shell .workspace-grid.is-expert", { timeout: 5000 });
  await page.waitForSelector(".melody-window .note", { timeout: 5000 });

  const r = { viewport };
  r.isExpertWorkspace = await present(page, ".workspace-grid.is-expert");
  r.hasMelody = (await page.locator(".melody-window .note").count()) > 0;
  r.hasSourceTools = await present(page, ".toolbar-source");
  r.hasSettingsTray = await present(page, ".settings-tray");
  // TASK7 §11.2: on entry we are in the edit phase — no harmony drawer yet, but
  // the melody-playback transport is present. (Harmony appears via the guide's
  // generate step below: step3HasHarmony.)
  r.editPhaseNoHarmonyDrawer = !(await present(page, ".harmony-drawer"));
  r.hasMelodyTransport = await present(page, ".melody-transport");
  r.noViewToggle =
    !(await present(page, '.segmented-control[aria-label="视图"]')) &&
    !(await present(page, '.segmented-control[aria-label="View"]'));
  r.guideClosedInitially = !(await present(page, ".guide-overlay"));

  // Open the guide wizard popup.
  await page.locator('button[aria-haspopup="dialog"]').click();
  await page.waitForSelector(".guide-overlay .guide-rail", { timeout: 5000 });
  r.railSteps = await page.locator(".guide-overlay .guide-rail-step").count();
  r.step0 = await stepOf(page);

  const next = () => page.locator(".guide-coach-nav .primary-button").click();

  // Step 2: settings — settings fields inside the coach.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "settings");
  r.step1HasSettings = await present(page, ".guide-overlay .settings-grid");

  // Step 3: generate.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "generate");
  r.step2HasGenerate = await present(page, ".guide-generate button");

  // Generating advances to audition and updates the workspace behind the popup.
  await page.locator(".guide-generate button").click();
  await page.waitForFunction(
    () => document.querySelector(".guide-coach")?.dataset.step === "audition",
    { timeout: 5000 },
  );
  r.step3 = await stepOf(page);
  r.step3HasCandidate = await present(page, ".candidate-strip .candidate.is-selected");
  r.step3HasHarmony = await present(page, ".harmony-window .chord-block");

  // Step 5: select.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "select");
  r.step4 = await stepOf(page);

  // Step 6: export — export actions in the coach.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "export");
  r.step5HasExport = await present(page, ".guide-export-actions");

  // Close the wizard; the workspace (and its generated harmony) persists.
  await page.locator(".guide-overlay .dialog-close").click();
  await page.waitForTimeout(150);
  r.guideClosedAfter = !(await present(page, ".guide-overlay"));
  r.workspacePersists = await present(page, ".harmony-window .chord-block");

  r.overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  await page.screenshot({
    path: `D:\\Trae_Projects\\Harmony-auxiliary\\dist\\t5-4-${viewport.name}-verify.png`,
    fullPage: true,
  });
  await page.close();
  return r;
}

const results = [];
for (const viewport of viewports) {
  results.push(await inspectViewport(viewport));
}
await browser.close();

const errors = [];
for (const r of results) {
  const v = r.viewport.name;
  if (!r.isExpertWorkspace) errors.push(`${v}: unified expert workspace not present.`);
  if (!r.hasMelody) errors.push(`${v}: demo melody not loaded.`);
  if (!r.hasSourceTools) errors.push(`${v}: source tools missing.`);
  if (!r.hasSettingsTray) errors.push(`${v}: settings tray missing from the command bar.`);
  if (!r.editPhaseNoHarmonyDrawer) errors.push(`${v}: edit phase should not show the harmony drawer.`);
  if (!r.hasMelodyTransport) errors.push(`${v}: edit-phase melody transport missing.`);
  if (!r.noViewToggle) errors.push(`${v}: legacy guided/expert view toggle still present.`);
  if (!r.guideClosedInitially) errors.push(`${v}: guide popup open before requested.`);
  if (r.railSteps !== 6) errors.push(`${v}: expected 6 guide steps, got ${r.railSteps}.`);
  if (r.step0 !== "input") errors.push(`${v}: first guide step is ${r.step0}, expected input.`);
  if (!r.step1HasSettings) errors.push(`${v}: settings fields not shown on settings step.`);
  if (!r.step2HasGenerate) errors.push(`${v}: generate button not shown on generate step.`);
  if (r.step3 !== "audition") errors.push(`${v}: did not auto-advance to audition (${r.step3}).`);
  if (!r.step3HasCandidate) errors.push(`${v}: no selected candidate after generate.`);
  if (!r.step3HasHarmony) errors.push(`${v}: harmony chords not rendered after generate.`);
  if (r.step4 !== "select") errors.push(`${v}: did not reach the select step (${r.step4}).`);
  if (!r.step5HasExport) errors.push(`${v}: export actions missing on export step.`);
  if (!r.guideClosedAfter) errors.push(`${v}: guide popup did not close.`);
  if (!r.workspacePersists) errors.push(`${v}: workspace harmony lost after closing the guide.`);
  if (r.overflow) errors.push(`${v}: horizontal overflow.`);
}

console.log(JSON.stringify(results, null, 2));
if (errors.length > 0) {
  console.error("Failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("T5.4 unified workspace + guide popup OK");
