import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const BASE_URL = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => window.localStorage.clear());
await page.goto(BASE_URL, { waitUntil: "networkidle" });

const results = {};

// The landing auth prompt explains what signing in stores.
await page.waitForSelector(".auth-overlay");
results.authHasPrivacyNote = await page.evaluate(() => {
  const el = document.querySelector(".auth-privacy");
  return Boolean(el && el.textContent && el.textContent.length > 10);
});

// Enter the demo, open the guide wizard, and walk to the export step; it must
// state demo work is not saved. (Guide is a popup now — TASK6 §11 Phase B.)
await page.locator(".auth-demo-link").click();
await page.waitForSelector(".workspace-grid.is-expert .melody-window .note", { timeout: 5000 });
await page.locator('button[aria-haspopup="dialog"]').click();
await page.waitForSelector(".guide-overlay .guide-rail", { timeout: 5000 });
const next = () => page.locator(".guide-coach-nav .primary-button").click();
await next(); // settings
await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "settings");
await next(); // generate
await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "generate");
await page.locator(".guide-generate button").click();
await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "audition", { timeout: 5000 });
await next(); // select
await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "select");
await next(); // export
await page.waitForFunction(() => document.querySelector(".guide-coach")?.dataset.step === "export");

results.exportHasPrivacyNote = await page.evaluate(() => {
  const el = document.querySelector(".guide-privacy-note");
  return Boolean(el && el.textContent && el.textContent.length > 10);
});
results.exportHasSignIn = await page.evaluate(() =>
  [...document.querySelectorAll(".guide-export-actions button")].some((b) => b.textContent?.includes("登录")),
);

await page.screenshot({ path: "dist/t5-5-demo-export.png", fullPage: true });
await browser.close();

const errors = [];
if (!results.authHasPrivacyNote) errors.push("auth panel missing privacy note");
if (!results.exportHasPrivacyNote) errors.push("demo export step missing privacy note");
if (!results.exportHasSignIn) errors.push("demo export step missing sign-in to save");

console.log(JSON.stringify(results, null, 2));
if (errors.length) {
  console.error("Failed: " + errors.join("; "));
  process.exit(1);
}
console.log("T5.5 privacy copy OK");
