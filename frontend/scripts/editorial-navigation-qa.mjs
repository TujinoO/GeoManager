import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// Run only against tmp/stisp_qa_server.py, which uses an isolated temporary database.
const origin = "http://127.0.0.1:5178";
const out = resolve("output/playwright/editorial-navigation");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const checks = [],
  errors = [],
  apiFailures = [];
const admin = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
});
async function post(context, path, data, multipart) {
  const token = (await context.cookies()).find(
    (c) => c.name === "csrftoken",
  )?.value;
  const response = await context.request.post(origin + path, {
    headers: { "X-CSRFToken": token, Origin: origin },
    ...(multipart ? { multipart } : { data }),
  });
  assert.ok(
    response.ok(),
    `${path}: ${response.status()} ${await response.text()}`,
  );
  return response.json();
}
async function login(context, username, password) {
  await context.request.get(origin + "/api/auth/csrf/");
  await post(context, "/api/auth/login/", {
    username,
    password,
    remember: true,
  });
}
function observe(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400)
      apiFailures.push({ url: r.url(), status: r.status() });
  });
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth,
    scroll: document.documentElement.scrollWidth,
    headerClass: document.querySelector(".workspace-header")?.className,
    nav: {
      client: document.querySelector(".header-primary-actions")?.clientWidth,
      scroll: document.querySelector(".header-primary-actions")?.scrollWidth,
    },
    modal: document
      .querySelector('[role="dialog"]')
      ?.getBoundingClientRect()
      .toJSON(),
  }));
  checks.push({ name, ...geometry });
  if (name === "science-list-1600") console.log(JSON.stringify(geometry));
  assert.ok(
    geometry.scroll <= geometry.viewport + 1,
    `${name}: horizontal overflow`,
  );
  if (name.includes("editor"))
    assert.ok(
      geometry.modal.x >= 0 && geometry.modal.right <= geometry.viewport + 1,
      `${name}: modal outside viewport`,
    );
  await page.screenshot({ path: resolve(out, name + ".png"), fullPage: true });
}
try {
  await login(admin, "qa-upgrade", "Local-QA-Only-20261031");
  // Add local preview records through the real API; never use production services.
  for (const [id, image] of [
    [1, "knowledge-populus-forest.png"],
    [2, "team-greenhouse.png"],
  ]) {
    const old = await (
      await admin.request.get(origin + `/api/content/articles/${id}/`)
    ).json();
    const asset = await post(
      admin,
      `/api/content/articles/${id}/assets/`,
      null,
      {
        file: {
          name: image,
          mimeType: "image/png",
          buffer: await readFile(resolve("src/assets/about", image)),
        },
      },
    );
    await post(admin, `/api/content/articles/${id}/`, {
      ...old,
      coverAssetId: asset.id,
      commitAssetIds: asset.pending ? [asset.id] : [],
      assetCaptions: [
        { id: asset.id, caption: "平台现有图片，仅用于本地界面验收" },
      ],
    });
  }
  for (const [kind, category, title] of [
    ["knowledge", "物种与生态", "认识胡杨的生境与生态价值"],
    ["knowledge", "保护管理", "从生态观测走向保护实践"],
    ["news", "学术交流", "生态观测资料交流与整理"],
    ["news", "团队活动", "野外调查记录与团队协作"],
  ]) {
    const existing = await (
      await admin.request.get(
        origin +
          `/api/content/articles/?kind=${kind}&q=${encodeURIComponent(title)}`,
      )
    ).json();
    if (!existing.total)
      await post(admin, "/api/content/articles/", {
        kind,
        category,
        title,
        summary: "本地界面验收示例，用于检查卡片、分类和正文排版。",
        body: "## 本地验收\n\n仅用于本地功能与界面检查。",
        status: "published",
        pinned: false,
        links: [],
      });
  }
  const groups = await (
    await admin.request.get(origin + "/api/groups/")
  ).json();
  const readerGroup = groups.items.find((g) => g.name === "普通用户");
  assert.ok(readerGroup, "Reader fixture group exists");
  const users = await (await admin.request.get(origin + "/api/users/")).json();
  const existingReader = users.items.find(
    (u) => u.username === "qa-editorial-reader",
  );
  const reader = existingReader
    ? {
        ...existingReader,
        ...(await post(
          admin,
          `/api/users/${existingReader.id}/password/reset/`,
          {},
        )),
      }
    : await post(admin, "/api/users/", {
        username: "qa-editorial-reader",
        displayName: "普通读者",
        email: "editorial-reader@example.local",
        groupIds: [readerGroup.id],
      });
  const page = await admin.newPage();
  observe(page);
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, base, id, publish] of [
      ["science", "/science-updates", 1, "发布科普"],
      ["news", "/news", 2, "发布团队动态"],
    ]) {
      await page.goto(origin + base);
      await page.locator(".editorial-card").first().waitFor();
      await page.getByRole("button", { name: publish, exact: true }).waitFor();
      await capture(page, `${name}-list-${width}`);
      await page.getByRole("button", { name: publish, exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await capture(page, `${name}-editor-${width}`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /取\s*消/ })
        .click();
      await page.getByRole("searchbox").fill("没有匹配的验收内容");
      await page.getByRole("searchbox").press("Enter");
      await page.getByText("没有找到匹配内容", { exact: true }).waitFor();
      await capture(page, `${name}-empty-${width}`);
      await page.goto(origin + base + "/" + id);
      await page.locator(".editorial-detail").waitFor();
      await capture(page, `${name}-detail-${width}`);
    }
    await page.goto(origin + "/science-updates");
    await page.locator(".editorial-card").first().waitFor();
    await page.getByRole("button", { name: "胡杨科普", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "科普更新", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("menu")
        .getByText("团队动态", { exact: true })
        .count(),
      0,
    );
    await capture(page, `science-menu-${width}`);
    await page.getByRole("menuitem", { name: "科普更新", exact: true }).click();
    await page.getByRole("button", { name: "监测与数据", exact: true }).click();
    await page.getByRole("button", { name: "关于我们", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "团队动态", exact: true })
      .waitFor();
    await capture(page, `about-menu-${width}`);
    await page.getByRole("menuitem", { name: "团队动态", exact: true }).click();
    await page.waitForURL("**/news");
    await page.waitForFunction(
      () => document.querySelectorAll(".editorial-card").length === 3,
    );
    assert.equal(
      await page.locator(".editorial-card").count(),
      3,
      "Page switch resets category filters",
    );
    assert.ok(
      await page
        .getByRole("button", { name: "关于我们", exact: true })
        .evaluate((el) => el.className.includes("active")),
      "Team news activates About us",
    );
  }
  const readerContext = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  await login(readerContext, reader.username, reader.generatedPassword);
  const readerPage = await readerContext.newPage();
  observe(readerPage);
  for (const [name, base] of [
    ["science", "/science-updates"],
    ["news", "/news"],
  ]) {
    await readerPage.goto(origin + base);
    await readerPage.locator(".editorial-card").first().waitFor();
    assert.equal(
      await readerPage
        .getByRole("button", { name: /发布科普|发布团队动态|编辑内容/ })
        .count(),
      0,
    );
    assert.equal(
      await readerPage.getByRole("switch", { name: "管理内容" }).count(),
      0,
    );
    await capture(readerPage, `${name}-reader-1600`);
  }
  await readerPage
    .getByRole("button", { name: "胡杨科普", exact: true })
    .click();
  await readerPage
    .getByRole("menuitem", { name: "胡杨科普", exact: true })
    .waitFor();
  assert.equal(
    await readerPage
      .getByRole("menuitem", { name: "科普更新", exact: true })
      .count(),
    0,
  );
  await readerPage
    .getByRole("menuitem", { name: "胡杨科普", exact: true })
    .click();
  await readerPage.waitForURL("**/knowledge");
  assert.equal(
    await readerPage.locator(".about-page-panel-head a").count(),
    0,
    "Science sidebar no longer contains maintenance links",
  );
  await capture(readerPage, "knowledge-sidebar-1600");
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  await writeFile(
    resolve(out, "checks.json"),
    JSON.stringify({ checks, errors, apiFailures }, null, 2),
  );
  console.log(
    JSON.stringify({
      screenshots: checks.length,
      errors,
      apiFailures,
      output: out,
    }),
  );
} finally {
  await writeFile(
    resolve(out, "checks.json"),
    JSON.stringify({ checks, errors, apiFailures }, null, 2),
  );
  await browser.close();
}
