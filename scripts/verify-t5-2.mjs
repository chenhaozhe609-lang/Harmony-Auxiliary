import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs";

const BASE_URL = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";

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

  // Start signed-out: clear any persisted Supabase session.
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // The soft gate prompts anonymous visitors once on the landing page.
  await page.waitForSelector(".auth-overlay", { timeout: 6000 });
  const promptShown = await page.locator(".auth-overlay").count();

  // The prompt is dismissible.
  await page.locator(".auth-close").click();
  await page.waitForSelector(".auth-overlay", { state: "detached", timeout: 4000 });
  const dismissed = (await page.locator(".auth-overlay").count()) === 0;

  // Clicking the main CTA while signed out re-opens the gate (does NOT enter).
  await page.getByRole("button", { name: "Start Harmonizing" }).click();
  await page.waitForSelector(".auth-overlay", { timeout: 4000 });
  const gateOnEnter = (await page.locator(".auth-overlay").count()) > 0;
  const stillOnLanding = (await page.locator(".landing-shell").count()) > 0;

  // The demo path enters the workspace without auth and preloads a melody.
  await page.locator(".auth-demo-link").click();
  await page.waitForSelector(".app-shell", { timeout: 5000 });
  await page.waitForSelector(".melody-window .note", { timeout: 5000 });
  const demo = await page.evaluate(() => ({
    inWorkspace: Boolean(document.querySelector(".app-shell")),
    hasDemoBadge: Boolean(document.querySelector(".demo-badge")),
    noteCount: document.querySelectorAll(".melody-window .note").length,
    overlayGone: !document.querySelector(".auth-overlay"),
  }));

  // The demo workspace exposes a sign-in entry (cluster) but no account email.
  const demoCluster = await page.evaluate(() => ({
    hasCluster: Boolean(document.querySelector(".account-cluster")),
    hasEmail: Boolean(document.querySelector(".account-email")),
  }));

  const overflow = await page.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  await page.screenshot({
    path: `D:\\Trae_Projects\\Harmony-auxiliary\\dist\\t5-2-${viewport.name}-verify.png`,
    fullPage: true,
  });

  await page.close();

  return {
    viewport: viewport.name,
    promptShown,
    dismissed,
    gateOnEnter,
    stillOnLanding,
    demo,
    demoCluster,
    overflow,
  };
}

const results = [];
for (const viewport of viewports) {
  results.push(await inspectViewport(viewport));
}

await browser.close();

const errors = [];
for (const r of results) {
  if (!r.promptShown) errors.push(`${r.viewport}: landing did not show the sign-in prompt.`);
  if (!r.dismissed) errors.push(`${r.viewport}: sign-in prompt could not be dismissed.`);
  if (!r.gateOnEnter) errors.push(`${r.viewport}: main CTA did not gate an anonymous visitor.`);
  if (!r.stillOnLanding) errors.push(`${r.viewport}: gate let an anonymous visitor into the workspace.`);
  if (!r.demo.inWorkspace) errors.push(`${r.viewport}: demo path did not reach the workspace.`);
  if (!r.demo.overlayGone) errors.push(`${r.viewport}: auth overlay lingered after entering demo.`);
  if (!r.demo.hasDemoBadge) errors.push(`${r.viewport}: demo mode did not show the demo badge.`);
  if (r.demo.noteCount === 0) errors.push(`${r.viewport}: demo did not preload a melody.`);
  if (!r.demoCluster.hasCluster) errors.push(`${r.viewport}: demo workspace missing the account cluster.`);
  if (r.demoCluster.hasEmail) errors.push(`${r.viewport}: demo workspace showed an account email.`);
  if (r.overflow.bodyOverflow) errors.push(`${r.viewport}: page has horizontal overflow.`);
}

if (errors.length > 0) {
  console.error(JSON.stringify({ results, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ results }, null, 2));
