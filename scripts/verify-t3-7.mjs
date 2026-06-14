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

  const landing = await page.evaluate(() => {
    const workflowSections = [...document.querySelectorAll(".workflow-section")];
    const titleRects = workflowSections.map((section) => {
      const heading = section.querySelector(".workflow-copy h4");
      const rect = heading?.getBoundingClientRect();
      return rect ? { left: Math.round(rect.left), top: Math.round(rect.top) } : null;
    });

    return {
      workflowTitles: workflowSections.map((section) =>
        section.querySelector(".workflow-copy h4")?.textContent?.trim(),
      ),
      workflowCopyParagraphs: document.querySelectorAll(".workflow-copy p").length,
      workflowTitleLefts: titleRects.map((rect) => rect?.left ?? null),
      bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  await page.getByRole("button", { name: "Open Workspace" }).click();
  await page.getByRole("button", { name: /手动|Manual/ }).click();
  await page.waitForSelector(".command-bar");

  const workspaceClosed = await page.evaluate(() => ({
    visibleCommandButtons: [...document.querySelectorAll(".command-bar button")].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length,
    hiddenSettingFields: [...document.querySelectorAll(".settings-grid select, .settings-grid input")].every(
      (node) => {
        const rect = node.getBoundingClientRect();
        return rect.width === 0 || rect.height === 0;
      },
    ),
    hiddenDraftButtons: [...document.querySelectorAll(".dock-menu button")].every((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width === 0 || rect.height === 0;
    }),
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  await page.locator(".settings-tray summary").click();
  await page.locator(".dock-menu summary").click();
  await page.waitForTimeout(150);

  const workspaceOpen = await page.evaluate(() => ({
    settingFieldsVisible: [...document.querySelectorAll(".settings-grid select, .settings-grid input")].filter(
      (node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
    ).length,
    draftButtonsVisible: [...document.querySelectorAll(".dock-menu button")].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length,
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  await page.screenshot({
    path: `D:\\Trae_Projects\\Harmony-auxiliary\\dist\\t3-7-${viewport.name}-verify.png`,
    fullPage: true,
  });

  await page.close();

  return { viewport: viewport.name, landing, workspaceClosed, workspaceOpen };
}

const results = [];
for (const viewport of viewports) {
  results.push(await inspectViewport(viewport));
}

await browser.close();

const errors = [];
const expectedTitles = ["Import or sketch", "Generate and listen", "Inspect and keep"];

for (const result of results) {
  const { landing, workspaceClosed, workspaceOpen, viewport } = result;
  if (landing.workflowTitles.join("|") !== expectedTitles.join("|")) {
    errors.push(`${viewport}: unexpected workflow titles ${landing.workflowTitles.join("|")}.`);
  }
  if (landing.workflowCopyParagraphs !== 0) {
    errors.push(`${viewport}: workflow copy still contains ${landing.workflowCopyParagraphs} paragraph(s).`);
  }
  if (landing.bodyOverflow) {
    errors.push(`${viewport}: landing page has horizontal overflow.`);
  }
  if (new Set(landing.workflowTitleLefts).size !== 1) {
    errors.push(`${viewport}: workflow titles are not aligned to one reading column.`);
  }
  if (workspaceClosed.visibleCommandButtons > 6) {
    errors.push(`${viewport}: command bar has too many visible buttons.`);
  }
  if (!workspaceClosed.hiddenSettingFields) {
    errors.push(`${viewport}: settings fields are visible while Settings is closed.`);
  }
  if (!workspaceClosed.hiddenDraftButtons) {
    errors.push(`${viewport}: draft buttons are visible while Draft is closed.`);
  }
  if (workspaceClosed.bodyOverflow || workspaceOpen.bodyOverflow) {
    errors.push(`${viewport}: workspace has horizontal overflow.`);
  }
  if (workspaceOpen.settingFieldsVisible !== 5) {
    errors.push(`${viewport}: expected 5 visible settings fields, got ${workspaceOpen.settingFieldsVisible}.`);
  }
  if (workspaceOpen.draftButtonsVisible !== 3) {
    errors.push(`${viewport}: expected 3 visible draft buttons, got ${workspaceOpen.draftButtonsVisible}.`);
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ results, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ results }, null, 2));
