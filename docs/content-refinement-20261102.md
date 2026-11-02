# 导航、胡杨科普合并与新闻补录（2026-11-02）

## 交付状态

仍在 `codex/platform-loading-content-optimization` 分支，沿用并保留上一轮未提交改动。页面代码已在本机5173端口的实际系统验收。服务器本轮只补录新闻及其图片，没有发布新应用镜像或更新前端静态文件，生产仍显示旧版导航、布局和新闻分类。

## 页面调整

- 点击“胡杨科普”直接进入 `/knowledge`；点击“关于我们”直接进入 `/about/system`，关于我们子菜单仍可悬停访问。
- 科普阅读和编辑合并到一页：物种档案→保护管理→胡杨知识图谱→其他科普知识。保留原有知识内容；页尾支持分类、检索、分页、正文、来源、图注及内容维护。
- 有权限用户可点击“更新科普知识”，复用草稿→待审核→发布→下架流程和附件处理。普通读者不显示维护入口。后端权限机制没有扩展。
- `/science-updates` 及旧文章链接重定向至合并页，保留文章ID、查询参数并定位页尾；中英文页面同步调整。
- 置顶新闻海报保留原图，桌面高度320px、宽度由原比例决定，手机高度300px；去掉额外红色背景和宽侧边。实页测得约157×320px。

## 空列表原因与数据补录

上轮样例只导入隔离验收库。本轮确认用户使用的本机实际库和生产实际库中，Article记录均为0。因此空列表来自尚未导入内容，不能以验收库截图代替真实环境。

| 环境 | 本轮新增 | 当前发布情况 |
| --- | --- | --- |
| 本机实际库 | 13条：8科普、5新闻 | 科普4发布、2待审核、2草稿；新闻5发布、1置顶 |
| 服务器实际库 | 5条新闻 | 5发布、1置顶；旧生产模型没有review状态，本轮只导入新闻 |

七个用户提供新闻链接均保留在五篇导读的来源中；同一获奖事件合并展示。六张样例图片及哈希来源沿用 `backend/apps/content/seed_data/provenance.json`。导入使用已有且具备内容管理权限的账号，未创建账号、调整权限或覆盖文章。图片文件存在性验证通过。

管理命令新增 `--kind`，可只补入一个栏目：

```powershell
pixi run python manage.py seed_platform_content --owner <已有内容管理员> --kind news --dry-run
pixi run python manage.py seed_platform_content --owner <已有内容管理员> --kind news --publish
```

服务器当前通过临时导入包调用同一Command，不修改运行应用源码；此命令随正式代码发布后才在镜像中可直接使用。按seed_key跳过已有内容，重复执行不覆盖人工修改。省略publish则导入草稿，省略kind则导入全部13条。

## 导入前备份

使用SQLite backup API在线备份，检查 `PRAGMA integrity_check=ok` 后再写入。

| 环境 | 备份路径 | SHA256 |
| --- | --- | --- |
| 本机 | `D:/GeoManagerData/geomanager-main260619/appdata/backups/before-content-import-20261102T062042Z.sqlite3` | `4e25d7e6b4c9538b50a9a24c6ba6c3aaa47d4c175b587d8c12e45879fcffbaf0` |
| 服务器容器持久卷 | `/data/app/backups/before-content-import-20261102T062123Z.sqlite3` | `ea0b2edb7e0fd5b70c32b76f3aa6360eac349b91ae4398ade8e205dbbd72fd9a` |

如需撤回样例，优先按seed_key逐条下架；直接恢复整库会覆盖备份后新增的业务操作，应另行核对。未清理任何原始数据、过程目录或服务器缓存。

## 验证

- 本机实页：默认导航跳转、页面只有一份页头、原有三个科普章节之后为其他科普知识、同页新建表单、五条新闻和完整图片。
- 服务器实页：已登录会话下五条图文新闻可见，获奖新闻置顶；旧版排序及导航仍由现有生产版本控制。
- 后端内容集成6项通过，覆盖栏目过滤、发布和幂等导入；Ruff通过。
- 前端单元45文件413项通过；导航和编辑定向浏览器2文件33项通过。
- 浏览器串行全量36文件269项通过（58.39秒，`pnpm run test:browser --no-file-parallelism`）。
- API生成一致性检查、类型检查和生产构建通过。此轮没有新增API参数/端点或改动权限、数据目录和栅格渲染。

证据和日志目录：`output/content-refinement-20261102/`。本轮人工验收为桌面实页；手机CSS已同步，但未将桌面结果记作手机实测通过。服务器DOM中5张新闻封面均已加载；本机DOM确认主内容顺序为hero、species-archive、protection-management、knowledge-graph、other-knowledge，且仅一份页头。

## 后续修正：团队动态统一侧边栏

- 关于我们左栏顺序统一为：系统简介、团队介绍、团队动态、团队成员、联系我们、帮助文档。顶部下拉复用同一列表，避免入口重复或遗漏。
- 新增共享 `AboutSidebar`，中文/英文关于我们、机构详情以及团队动态列表和正文共用样式与导航；机构上下文保留。直接打开 `/news/:articleId` 也会高亮团队动态，返回列表后仍在相同布局内。
- 新闻页复用 `workspace-body-about` 与主内容面板，桌面左栏保持独立，390px窄屏使用统一的顶部双列菜单，正文区域可滚动。
- 仅前端与文档变更，没有改动API契约、权限、数据路径或栅格渲染；没有重新导入内容或修改生产环境。本次代码尚未部署。

验证：`pnpm run test:browser src/pages/AboutNavigation.browser.test.tsx src/pages/EditorialPage.browser.test.tsx src/components/WorkspaceHeader.browser.test.tsx src/pages/HelpDownloads.browser.test.tsx --no-file-parallelism`，4文件37项全部通过；`pnpm run typecheck`、`pnpm run build`、改动文件oxlint/oxfmt、`git diff --check`通过。新增测试覆盖侧栏在动态列表/详情/返回时的连续性、关于我们各栏目往返、英文直达详情、桌面和390px布局无横向溢出。截图为真实浏览器中的测试数据页面，已检查导航位置与文字展示，位于 `frontend/output/content-refinement-20261102/news-sidebar-desktop.png` 和 `news-sidebar-mobile.png`。本节不代表服务器已更新。
