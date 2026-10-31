import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const out = resolve("../_work/stisp-upgrade-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
const network = [];
page.on("response", async (response) => {
  if (response.url().includes("/api/"))
    network.push({
      url: response.url(),
      status: response.status(),
      body:
        response.status() >= 400
          ? await response.text().catch(() => "")
          : undefined,
    });
});
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:5178/login");
await page.waitForSelector("input");
await context.request.get("http://127.0.0.1:5178/api/auth/csrf/");
const csrf = (await context.cookies()).find(
  (c) => c.name === "csrftoken",
).value;
const login = await context.request.post(
  "http://127.0.0.1:5178/api/auth/login/",
  {
    headers: { "X-CSRFToken": csrf, Origin: "http://127.0.0.1:5178" },
    data: {
      username: "qa-upgrade",
      password: "Local-QA-Only-20261031",
      remember: true,
    },
  },
);
if (!login.ok())
  throw new Error(
    `Local fixture login failed: ${login.status()} ${await login.text()}`,
  );
const steps = [];
try {
  await page.goto("http://127.0.0.1:5178/map?resources=1");
  await page.getByRole("button", { name: /保存为工程/ }).waitFor();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("保存为工程"),
    );
    return b && !b.disabled;
  });
  await page.waitForTimeout(5000);
  await page.getByRole("button", { name: /保存为工程/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("工程名称", { exact: true })
    .fill("出图链路验收" + Date.now());
  const createdWait = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/catalog/workspaces/") &&
      r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: /保.*存|确.*定/ }).click();
  const createdResponse = await createdWait;
  if (!createdResponse.ok()) throw new Error(await createdResponse.text());
  const project = await createdResponse.json();
  steps.push({
    step: "save-project",
    id: project.id,
    snapshotLayers: project.snapshot.groups.length,
  });
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: /工程/ }).click();
  const row = page
    .locator(".topic-scenario-row")
    .filter({ hasText: project.name });
  await row.getByRole("button", { name: /新建出图/ }).click();
  dialog = page.getByRole("dialog").filter({ hasText: "专题制图：" });
  await dialog.waitFor();
  await page
    .getByRole("img", { name: "专题图预览", exact: true })
    .waitFor({ timeout: 60000 });
  steps.push({ step: "composition-preview", ready: true });
  await dialog.getByRole("button", { name: "添加文字", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "选中要素文字" })
    .fill("胡杨监测样地分布");
  await dialog.getByText("已保存", { exact: true }).waitFor({ timeout: 15000 });
  steps.push({ step: "canvas-autosave", saved: true });
  await page.screenshot({
    path: resolve(out, "composition-1600.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: resolve(out, "composition-390.png"),
    fullPage: true,
  });
  steps.push({
    step: "composition-mobile",
    rect: await dialog.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, right: r.right, width: r.width, scroll: e.scrollWidth };
    }),
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const downloadWait = page.waitForEvent("download", { timeout: 120000 });
  await dialog.getByRole("button", { name: "生成并下载 PDF" }).click();
  const download = await downloadWait;
  const target = resolve(out, download.suggestedFilename());
  await download.saveAs(target);
  steps.push({
    step: "export",
    file: target,
    failure: await download.failure(),
  });
} catch (e) {
  steps.push({
    step: "failure",
    message: e.message,
    body: (await page.locator("body").innerText()).slice(-7000),
  });
  await page.screenshot({
    path: resolve(out, "workflow-failure.png"),
    fullPage: true,
  });
  process.exitCode = 1;
}
await writeFile(
  resolve(out, "workflow-checks.json"),
  JSON.stringify({ steps, errors, network }, null, 2),
);
console.log(JSON.stringify({ steps, errors }, null, 2));
await browser.close();
