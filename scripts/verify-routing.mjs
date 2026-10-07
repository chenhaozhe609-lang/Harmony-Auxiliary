import { chromium } from "playwright";

const BASE_URL = process.env.VERIFY_URL ?? "http://127.0.0.1:5181";

const browser = await chromium.launch({
  ...(process.env.VERIFY_BROWSER_PATH ? { executablePath: process.env.VERIFY_BROWSER_PATH } : {}),
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
  const workspaceVisible = (await page.locator(".workspace-grid").count()) > 0;

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const landingUrl = new URL(page.url());
  const landingHasHero = (await page.locator(".landing-v2").count()) > 0;

  const result = {
    demo: {
      pathname: demoUrl.pathname,
      hasWorkspace: demoHasWorkspace,
      hasNotes: demoHasNotes,
    },
    workspace: {
      requested: "/workspace",
      finalPathname: workspaceUrl.pathname,
      hasWorkspace: workspaceVisible,
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
  if (result.workspace.finalPathname !== "/workspace" || !workspaceVisible) {
    throw new Error("/workspace did not open directly.");
  }
  if (result.landing.pathname !== "/" || !landingHasHero) {
    throw new Error("/ did not render the landing page.");
  }
} finally {
  await browser.close();
}
