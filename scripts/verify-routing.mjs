import { chromium } from "file:///C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs";

const BASE_URL = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  await page.goto(`${BASE_URL}/demo`, { waitUntil: "networkidle" });
  const demoUrl = new URL(page.url());
  const demoHasWorkspace = (await page.locator(".workspace-grid").count()) > 0;
  const demoHasNotes = (await page.locator(".melody-window .note").count()) > 0;

  await page.goto(`${BASE_URL}/workspace`, { waitUntil: "networkidle" });
  const workspaceUrl = new URL(page.url());
  const workspaceHasLanding = (await page.locator(".landing-v2").count()) > 0;

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const landingUrl = new URL(page.url());
  const landingHasHero = (await page.locator(".landing-v2").count()) > 0;

  const result = {
    demo: {
      pathname: demoUrl.pathname,
      hasWorkspace: demoHasWorkspace,
      hasNotes: demoHasNotes,
    },
    workspaceAnonymousRedirect: {
      requested: "/workspace",
      finalPathname: workspaceUrl.pathname,
      hasLanding: workspaceHasLanding,
    },
    landing: {
      pathname: landingUrl.pathname,
      hasHero: landingHasHero,
    },
  };

  console.log(JSON.stringify(result, null, 2));

  if (result.demo.pathname !== "/demo" || !demoHasWorkspace || !demoHasNotes) {
    throw new Error("/demo did not open the demo workspace with notes.");
  }
  if (result.workspaceAnonymousRedirect.finalPathname !== "/" || !workspaceHasLanding) {
    throw new Error("Anonymous /workspace did not redirect back to landing.");
  }
  if (result.landing.pathname !== "/" || !landingHasHero) {
    throw new Error("/ did not render the landing page.");
  }
} finally {
  await browser.close();
}
