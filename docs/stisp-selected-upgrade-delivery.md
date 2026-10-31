# 所选42项优化交付检查

日期：2026-10-31。当前源码基线：995450e（V3.27）。对照参考：E:/Code/STISP-GeoManager-main。

42项均已在当前工作区实施。001—035覆盖列表、加载、工作台和出图；091—097覆盖科普内容维护、附件、账号说明和会话同步。015、094、095、097按当前数据平台边界适配，未引入在线计算、智能体或知识库服务。此次未发布、未部署、未迁移生产数据库。

## 简明方案与结果

| 方向 | 实施结果 |
| --- | --- |
| 刷新与加载 | 工程摘要分页、详情按需读取、15秒焦点刷新节流、在途合并、旧响应隔离、远程搜索与资源去重。 |
| 地图工作台 | 已加载矢量查询、卸载状态清理、多资源直达与重试、范围定位、工程底图恢复、栅格面板就地设置。 |
| 专题出图 | 可编辑画布、多选/对齐/吸附/锁定/叠放/文字/历史、4秒草稿保存、关闭保护、预览缓存、真实比例尺和一致的导出范围。 |
| 内容与账号 | 科普/动态维护、暂存附件和并发版本、账号能力说明、多标签会话同步、安全Markdown与公式。 |

## 逐项对照

下表“证据”关联后文的代码和验收记录。“源码核对”表示该具体分支经静态核对并纳入所在模块回归，并不表示已有独立端到端用例。

| 编号 | 原优化条目 | 本次落地 | 验证依据 |
| --- | --- | --- | --- |
| 001 | 工程列表分页 | 默认24项，limit/offset/total；删除末页条目后自动退回有效页。 | A、B |
| 002 | 列表剔除完整工程快照 | 列表返回摘要，ORM defer(snapshot)，不传输图层完整快照。 | A |
| 003 | 打开工程时再取详情 | 点击工程时读取单项详情，再恢复快照。 | B、H |
| 004 | 页面切回刷新节流 | 窗口切回/可见时15秒节流。 | 源码核对、B回归 |
| 005 | 焦点刷新防并发 | 同参数在途列表请求共用Promise，焦点刷新避开在途请求。 | B |
| 006 | 旧列表响应不得覆盖新搜索 | 请求序号隔离旧搜索和旧分页响应。 | B |
| 007 | 覆盖保存目标远程搜索 | 覆盖目标200ms防抖、远程检索、滚动分页和在途保护；全局搜索同步支持页外工程。 | B、H、源码核对 |
| 008 | 同资源加载合并在途请求 | 统一加载钩子合并同资源同查询的在途操作。 | C |
| 009 | 完整图层与查询结果分别去重 | 完整资源与派生查询采用不同身份，查询对象键排序规范化。 | C、源码核对 |
| 010 | 缓存和恢复结果统一去重 | 缓存水合、缓存写入及工程恢复去重；样式差异保留；不在每次UI移动操作时删减状态。 | B、C、源码核对 |
| 011 | 重复加载定位已有图层 | 重复加载恢复显隐、选中和定位已有图层；单个新矢量也自动定位。 | C、H |
| 012 | 空间查询仅选择已加载矢量 | 查询目标从已加载且可查询的矢量图层产生。 | 源码核对、全量浏览器回归 |
| 013 | 卸载图层同步清理查询状态 | 目标卸载后清空查询目标、字段及结果状态。 | 源码核对、全量浏览器回归 |
| 014 | 空间查询过期响应隔离 | 换目标/清空时推进查询序号，迟到结果不重新填入。 | 源码核对、全量浏览器回归 |
| 015 | 链接携带多资源直达地图 | 支持resources逗号列表及resourceId；去重、合法ID检查、最多12项；不引入projectTagId业务项目体系。 | D、H |
| 016 | 多成果自动缩放至共同范围 | 合并矢量/栅格外包范围，全部目标完成后定位。 | D |
| 017 | 链接加载部分失败可重试 | 保留成功项，仅重试失败项，显示不可访问/加载失败提示。 | D |
| 018 | 保存并还原工程底图 | 快照保存实际basemapId，工程打开时请求恢复；旧快照继续使用现有底图。 | B、H、源码核对 |
| 019 | 还原后校正选中图层 | 恢复过滤和去重后检查selectedLayerId，无效时改为首个有效图层或空。 | B |
| 020 | 栅格信息面板就地调渲染 | 栅格信息面板调整波段、色带、透明度、NoData/拉伸，显式应用并调用现有后端渲染。 | E |
| 021 | 可直接拖动和缩放版式要素 | 纸面拖动、缩放主图/图例/文字等要素，拖动取消不落盘。 | F、H |
| 022 | 多选要素整体移动 | Shift多选、整体移动和纸张边界约束；清理撤销后的失效选择。 | F |
| 023 | 要素对齐及等距分布 | 左/顶对齐、水平居中、横纵等距分布。 | F、源码核对 |
| 024 | 网格吸附和键盘微调 | 2mm吸附、方向键1mm微调，Shift加速。 | F |
| 025 | 锁定关键版式要素 | 锁定要素后阻止拖动和批量位置调整。 | F |
| 026 | 控制要素前后遮挡顺序 | editor.order统一画布与导出叠放顺序，支持置顶/置底。 | F、源码核对 |
| 027 | 任意补充文字与复制文字 | 添加/复制自由文字，支持位置、大小和文本编辑。 | F、H |
| 028 | 版式撤销与重做 | 最多50步历史，支持撤销/重做及快捷键。 | F、源码核对 |
| 029 | 草稿自动保存及状态提示 | 停止编辑4秒自动保存，显示未保存/已保存/失败；失败停止自动保存并保留草稿；保存期间的新编辑不会误标已保存。 | F、H |
| 030 | 关闭或刷新前提示未保存 | 脏草稿关闭前提供保存/继续编辑，刷新/离开页面触发浏览器保护；导出期间阻止关闭。 | F |
| 031 | 调整文字复用地图预览缓存 | 按范围、尺寸、样式、底图缓存最多4张地图预览，文字变动复用地图图像。 | 源码核对、F预览回归 |
| 032 | 比例尺按真实地图框计算 | 比例尺使用实际地图框像素宽度及墨卡托中心纬度，不再由比例尺自身宽度决定地图尺度。 | G |
| 033 | 导出保持所选底图与注记 | 导出保留所选底图；天地图底图与注记分别请求；按提供商使用最大层级。 | A、G、H |
| 034 | 正式出图拒绝缺图占位 | purpose=export缺少真实瓦片时503，前端导出失败；普通缩略图保留原有降级。 | A、G |
| 035 | 主图范围、网格、鹰眼一致 | 使用实际导出计划的补边范围绘制主图、格网和鹰眼范围。 | G、H |
| 091 | 科普及动态后台维护 | 新增登录后科普更新/团队动态维护：草稿、发布、下架、置顶、检索和详情；保留原科普页。 | A、I、H |
| 092 | 内容附件暂存与正式提交 | 附件按编辑者暂存24小时，正文保存时原子提交；取消撤销暂存；校验归属、类型和30MiB上限。过期文件保留待人工检查。 | A、I |
| 093 | 内容编辑并发版本检查 | revision条件更新，旧编辑返回409；附件变更与正文同一事务。 | A、I |
| 094 | 账号实际能力集中说明 | 个人设置集中展示现有权限的开通/未授权能力和申请说明；沿用既有角色申请入口，不增加智能体能力。 | H、源码核对 |
| 095 | 多标签与关闭页面后的登录策略 | 保留Django会话和记住登录；用storage事件同步标签页会话并从服务端恢复。未采用短租约和心跳。 | J、A认证回归 |
| 096 | 防止旧鉴权响应恢复已退出用户 | authGeneration隔离迟到的启动/me/403鉴权结果，防止已退出用户反跳。 | J |
| 097 | 模型内容安全渲染 | 有限Markdown、表格、代码和KaTeX公式显示；HTML按文本处理，公式trust=false；用于普通科普内容。 | I、H |

## 代码与证据索引

- A：[ 后端工程/内容/出图API ](D:/Code/GeoManager-main260619/GeoManager-main/backend/tests/integration/test_selected_upgrades.py)。
- B：[ 工程状态与分页、详情、旧响应测试 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/hooks/useWorkspaceScenes.browser.test.tsx)。
- C：[ 资源在途合并与重复加载测试 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/hooks/useUniqueLayerLoad.browser.test.tsx)。
- D：[ 多资源链接、范围和重试测试 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/pages/MapUrlResources.browser.test.tsx)。
- E：[ 栅格就地渲染权限、显式应用与忙状态测试 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/components/RasterRenderingControls.browser.test.tsx)。
- F：[ 制图画布与编辑器 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/components/map-composition/MapCompositionEditor.browser.test.tsx)。
- G：[ 比例尺、墨卡托控制点和底图导出测试 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/map-composition/georeferencing.test.ts)。
- I：[ 内容编辑及附件界面测试 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/pages/EditorialPage.browser.test.tsx)。
- J：[ 多标签会话和旧鉴权响应测试 ](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/AppAuth.browser.test.tsx)。
- H：真实浏览器本地联调记录：[界面检查](D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/ui-checks.json)、[出图链路](D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/workflow-checks.json)。

补充代码位置：

- [工程列表服务](D:/Code/GeoManager-main260619/GeoManager-main/backend/apps/catalog/views.py)
- [工程状态与还原](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/hooks/useWorkspaceScenes.ts)
- [跨页全局检索](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/components/WorkspaceHeader.tsx)
- [覆盖工程搜索](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/components/LayerPanel.tsx)
- [图层身份与样式去重](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/utils/uniqueLoadedLayers.ts)
- [地图查询与链接](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/pages/MapPage.tsx)
- [画布操作](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/components/map-composition/CompositionCanvas.tsx)
- [渲染与缓存](D:/Code/GeoManager-main260619/GeoManager-main/frontend/src/map-composition/render.ts)
- [严格瓦片导出](D:/Code/GeoManager-main260619/GeoManager-main/backend/apps/core/map_thumbnail.py)
- [内容事务与权限](D:/Code/GeoManager-main260619/GeoManager-main/backend/apps/content/views.py)

## 实际检查结果

| 检查 | 结果 |
| --- | --- |
| 后端 core API、catalog API、专题图、所选优化集成测试 | 246通过，另43个子测试通过。 |
| 前端单元测试 | 45个文件，409项通过。 |
| 全量浏览器组件回归 | 35个文件，252项通过，含关闭/刷新保护、保存失败和保存期间继续编辑。 |
| TypeScript | pnpm run typecheck 通过。 |
| 生产构建 | pnpm run build 通过。 |
| OpenAPI校验及生成一致性 | pnpm run check:api 通过，16个生成文件一致；保留6个已有未引用schema警告。 |
| API变更登记、文档及Mock生成 | 48条登记校验通过，API文档生成成功，86个Mock操作示例生成成功。 |
| 国际化资源对齐 | 902个键、799个静态引用校验通过。 |
| 本次前端文件 lint/格式 | oxlint、oxfmt检查通过；57个修改/新增源文件及验收脚本完成格式检查。 |
| 全仓前端 check | 未全绿：164个既有文件格式问题；与本次修改文件交集为0，详见format-baseline-proof.json；保留原文件。 |
| Django检查与迁移一致性 | check无问题；makemigrations --check --dry-run 无待生成迁移。 |
| 后端改动文件 ruff | 通过。 |

后端环境没有Pixi可执行程序，本次使用已有 D:/Users/anaconda/envs/geomanager/python.exe（Python 3.14、Django 6及GIS依赖）完成检查，未声称通过Pixi环境验收。前端全部使用pnpm。OpenAPI工具的npm版本探测有找不到npm的提示，但相关命令退出成功，未使用npm执行任务。

日志保存在：D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/。早期失败日志保留，最终结果以 backend-tests-final.log、unit-tests-final.log、browser-tests-final.log、typecheck-final.log、build-final.log、format-check.log、lint-changed.log 和结构化检查记录为准；editor-tests-final.log 是中间追加用例时的历史记录。

## 界面与出图检查

采用独立临时测试数据库、27个初始工程和2个真实GeoPackage样地点，在本机Chrome检查1600px桌面及390px窄屏。测试服务指向临时目录，不使用生产数据库或真实业务数据。

- 科普详情、动态详情、个人设置、地图共8个页面/尺寸组合，未记录页面JavaScript异常，页面根元素无横向溢出。
- 修复了已发布内容无发布时间时误显示草稿，以及移动端内容编辑窗口溢出。
- 出图操作实际跑通：链接加载样地 → 保存工程 → 新建出图 → 添加文字 → 等待自动保存 → PDF生成下载。
- 修复制图编辑器窄屏双栏溢出，改成画布、设置、输出纵向布局；390px窗口范围12—378px，内部无横向溢出。
- 实际PDF为单页A4横向，含真实卫星底图、两个样地点、图例、区位图、指北针、比例尺及自由文字；已渲染核查。

- [桌面制图界面](D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/composition-1600.png)
- [移动端制图界面](D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/composition-390.png)
- [移动端内容编辑](D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/editorial-editor-390.png)
- [导出图件预览](D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/export-preview.png)

## 接口、权限与数据边界

- docs/openapi.yaml、docs/developer-guide.md、API变更登记和Mock已同步。此仓库当前生成目录为 frontend/src/api/generated/，替代AGENTS里早期的schema.d.ts位置；未手写修改生成类型。
- 工程列表变为摘要接口，完整snapshot仅在详情返回；调用方已适配。工程/版式更新支持expectedUpdatedAt冲突检查。
- 沿用Django认证、角色和数据访问组。内容维护复用core.manage_auth，普通登录用户仅阅读已发布内容；内部素材备注不向普通读者返回。
- 不迁入参考平台业务项目权限、匿名项目、短租约心跳；保留remember登录逻辑。
- 新增附件使用TOML配置业务数据根目录内media/content/；科研数据根目录不变。暂存24小时后不可读，不批量删除过期文件。
- 栅格仍由后端统一服务渲染，面板只提交显示参数；普通缩略图可降级，正式出图缺真实瓦片时明确报错。

## 启用与验证边界

1. 正式环境启用前，需要在相同配置与业务数据备份条件下执行Django迁移，应用新增content.0001_initial。此次只在临时测试库应用迁移。
2. 前端新增KaTeX依赖，使用pnpm install --frozen-lockfile安装，再构建。科普更新从顶部“胡杨科普 → 科普更新”进入（具有内容维护权限的账号可见）；团队动态从顶部“关于我们 → 团队动态”进入，页面发布/编辑按钮按内容维护权限显示。原科普页侧栏不再提供维护链接；账号能力在个人设置；出图从“地图工作台 → 工程 → 新建出图”进入。
3. 已完成本地组件回归和真实样例联调，未进行生产发布、生产数据全量迁移演练、所有底图提供商的在线实测或大规模并发压测。
4. 本次属于结构性性能优化，未开展同条件旧版/新版耗时比较，不给出未经测量的加速倍数。
5. 正式导出依赖所选底图服务和网络可用；缺图时失败是预期保护。上述检查不能承诺所有浏览器和任意历史数据下绝无缺陷。

- [真实下载的专题PDF样例](D:/Code/GeoManager-main260619/GeoManager-main/_work/stisp-upgrade-qa/专题出图验收样例.pdf)
