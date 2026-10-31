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
const checks = [];
for (const width of [1600, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const [name, path, ready] of [
    ["science", "/science-updates/1", ".editorial-detail"],
    ["news", "/news/2", ".editorial-detail"],
    ["account", "/admin/profile", ".admin-profile-shell"],
    ["map", "/map?resources=1", ".mapboxgl-canvas"],
  ]) {
    await page.goto(`http://127.0.0.1:5178${path}`);
    await page.locator(ready).first().waitFor({ timeout: 30000 });
    if (name === "map") {
      await page.waitForTimeout(8000);
      console.log(
        "MAP_TEXT",
        width,
        (await page.locator("body").innerText()).slice(-6500),
      );
    }
    await page.screenshot({
      path: resolve(out, `${name}-${width}.png`),
      fullPage: true,
    });
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    checks.push({
      name,
      width,
      ...sizes,
      overflow: sizes.scroll > sizes.viewport + 1,
    });
  }
}
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto("http://127.0.0.1:5178/science-updates/1");
await page.getByRole("button", { name: "编辑内容", exact: true }).click();
await page.getByRole("dialog").waitFor();
await page.waitForTimeout(400);
await page.screenshot({
  path: resolve(out, "editorial-editor-1600.png"),
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 1000 });
await page.waitForTimeout(400);
await page.screenshot({
  path: resolve(out, "editorial-editor-390.png"),
  fullPage: true,
});
checks.push({
  name: "editor-modal",
  width: 390,
  rect: await page.getByRole("dialog").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, right: r.right, width: r.width, scroll: el.scrollWidth };
  }),
});
await writeFile(
  resolve(out, "ui-checks.json"),
  JSON.stringify({ checks, errors, network }, null, 2),
);
console.log(JSON.stringify({ checks, errors, out }, null, 2));
await browser.close();
