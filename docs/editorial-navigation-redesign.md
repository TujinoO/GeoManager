# 科普更新与团队动态界面调整

## 已实施方案

1. 顶部“胡杨科普”下拉包含原“胡杨科普”与独立的“科普更新”，后者按现有内容维护权限显示。移除原科普页侧栏中的两个维护链接。
2. “团队动态”放入顶部“关于我们”下拉，位于“共建团队”之后；页面高亮“关于我们”。两个菜单支持悬停和点击展开。
3. 两个栏目统一使用平台原有墨绿、浅绿、白色卡片和现有图片，优化页头、面包屑、分类、搜索、空态、卡片、正文与附件区域，适配桌面和窄屏。
4. 维护账号在页头看到“发布科普”或“发布团队动态”。表单说明先存草稿、核对后设为已发布。保留编辑、预览、草稿、下架、置顶、附件暂存及版本校验。
5. 普通登录用户继续可阅读已发布内容，发布/编辑按钮与草稿开关不显示。菜单可见性不改变服务端已有阅读规则。
6. 两栏目切换时重置筛选条件。修复页头遮挡面包屑、无图占位对齐，以及 StrictMode 效果清理后导航测量未重新调度的问题。

## 入口与权限

| 页面 | 顶部入口 | 地址 | 维护权限 |
| --- | --- | --- | --- |
| 原胡杨科普 | 胡杨科普 → 胡杨科普 | `/knowledge` | 原有内容保持 |
| 科普更新 | 胡杨科普 → 科普更新，维护账号可见 | `/science-updates` | 现有 `core.manage_auth` |
| 团队动态 | 关于我们 → 团队动态 | `/news` | 现有 `core.manage_auth` |

本次仅调整前端与说明文档；API 契约、服务端授权、数据库结构、业务及科研数据路径、栅格渲染均未修改。无需为本次界面调整增加数据库迁移。未部署或操作服务器。

## 验证记录

- `pnpm test`：45 文件、409 项通过。
- `pnpm run test:browser`：35 文件、261 项通过；覆盖新增菜单归属、权限、发布、空态和 StrictMode 导航测量回归。仅有既有 Ant Design Notification 弃用提示。
- `pnpm run typecheck`、本次文件 `oxlint`/`oxfmt`、`pnpm run build`：通过。
- `pnpm run check:api`：16 个生成文件与契约一致；契约保留既有 6 条规范警告。
- `pnpm run check`：品牌及 lint 通过，全仓格式检查仍有既有文件不合格；本次改动文件全部格式通过，未格式化无关文件。对照旧基线的结果见 `_work/editorial-format-baseline-proof.json`。
- `node scripts/editorial-navigation-qa.mjs`：使用 `tmp/stisp_qa_server.py` 的隔离临时数据库及本地接口。1600px、390px 下检查两栏目列表、详情、空态、编辑弹窗、顶部菜单；另核对真实普通账号的只读入口及原科普侧栏。23 组截图，无页面横向溢出、页面 JavaScript 异常或 API 错误响应。

截图与几何/异常记录：`frontend/output/playwright/editorial-navigation/`。图片内容为本地验收数据，未写入正式数据。脚本会在隔离库中新建测试文章、上传现有图片及创建/重设测试读者账号，仅用于上述测试服务器。

全量日志：`_work/editorial-browser-full.log`、`_work/editorial-unit-tests.log`、`_work/editorial-api-check.log`、`_work/editorial-check.log`。页面机器记录：`frontend/output/playwright/editorial-navigation/checks.json`。
