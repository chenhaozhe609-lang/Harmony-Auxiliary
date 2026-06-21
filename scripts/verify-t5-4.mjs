import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const BASE_URL = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const viewports = [
  { name: "desktop", width: 1440, height: 980 },
  { name: "mobile", width: 390, height: 900 },
];

const stepOf = (page) => page.evaluate(() => document.querySelector(".guide-coach")?.dataset.step ?? null);
const present = (page, selector) => page.evaluate((s) => Boolean(document.querySelector(s)), selector);

async function inspectViewport(viewport) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // Enter the demo sandbox (guided mode is the default view).
  await page.waitForSelector(".auth-overlay", { timeout: 6000 });
  await page.locator(".auth-demo-link").click();
  await page.waitForSelector(".app-shell .guide-rail", { timeout: 5000 });

  const r = { viewport };
  r.railSteps = await page.locator(".guide-rail-step").count();

  // Step 1: input — source tools shown, no candidates / inspector yet.
  r.step0 = await stepOf(page);
  r.step0HasSource = await present(page, ".toolbar-source");
  r.step0NoCandidates = !(await present(page, ".candidate-strip"));
  r.step0NoInspector = !(await present(page, ".inspector"));
  r.step0HasMelody = (await page.locator(".melody-window .note").count()) > 0;

  const next = () => page.locator(".guide-coach-nav .primary-button").click();

  // Step 2: settings — settings fields surface inside the coach card.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "settings");
  r.step1HasSettings = await present(page, ".guide-coach .settings-grid");

  // Step 3: generate — hero generate button in the coach.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "generate");
  r.step2HasGenerate = await present(page, ".guide-generate button");

  // Generating advances to the audition step automatically.
  await page.locator(".guide-generate button").click();
  await page.waitForFunction(
    () => document.querySelector(".guide-coach")?.dataset.step === "audition",
    { timeout: 5000 },
  );
  r.step3 = await stepOf(page);
  r.step3HasTransport = await present(page, ".toolbar-transport");
  r.step3HasCandidates = await present(page, ".candidate-strip");

  // Step 5: select — inspector appears.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "select");
  r.step4HasInspector = await present(page, ".inspector");

  // Step 6: export — export actions in the coach.
  await next();
  await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "export");
  r.step5HasExport = await present(page, ".guide-export-actions");

  // Switch to expert view: the full workspace shows everything at once.
  await page.getByRole("button", { name: "专家" }).click();
  await page.waitForTimeout(150);
  r.expertNoRail = !(await present(page, ".guide-rail"));
  r.expertHasSettingsTray = await present(page, ".settings-tray");
  r.expertHasBothToolbars =
    (await present(page, ".toolbar-source")) && (await present(page, ".toolbar-transport"));
  r.expertHasInspector = await present(page, ".inspector");

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
  if (r.railSteps !== 6) errors.push(`${v}: expected 6 rail steps, got ${r.railSteps}.`);
  if (r.step0 !== "input") errors.push(`${v}: first step is ${r.step0}, expected input.`);
  if (!r.step0HasSource) errors.push(`${v}: input step missing source tools.`);
  if (!r.step0NoCandidates) errors.push(`${v}: candidate strip visible on input step.`);
  if (!r.step0NoInspector) errors.push(`${v}: inspector visible on input step.`);
  if (!r.step0HasMelody) errors.push(`${v}: demo melody not loaded.`);
  if (!r.step1HasSettings) errors.push(`${v}: settings fields not shown on settings step.`);
  if (!r.step2HasGenerate) errors.push(`${v}: generate button not shown on generate step.`);
  if (r.step3 !== "audition") errors.push(`${v}: did not auto-advance to audition (${r.step3}).`);
  if (!r.step3HasTransport) errors.push(`${v}: transport missing on audition step.`);
  if (!r.step3HasCandidates) errors.push(`${v}: candidate strip missing on audition step.`);
  if (!r.step4HasInspector) errors.push(`${v}: inspector missing on select step.`);
  if (!r.step5HasExport) errors.push(`${v}: export actions missing on export step.`);
  if (!r.expertNoRail) errors.push(`${v}: guide rail still present in expert view.`);
  if (!r.expertHasSettingsTray) errors.push(`${v}: settings tray missing in expert view.`);
  if (!r.expertHasBothToolbars) errors.push(`${v}: expert view missing a toolbar.`);
  if (!r.expertHasInspector) errors.push(`${v}: inspector missing in expert view.`);
  if (r.overflow) errors.push(`${v}: horizontal overflow.`);
}

console.log(JSON.stringify(results, null, 2));
if (errors.length > 0) {
  console.error("Failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("T5.4 guided flow OK");
