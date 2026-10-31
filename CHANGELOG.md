# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added role-scoped thematic publishing with immutable published versions, audience groups, object-level capabilities and restore-to-project workflow
- Added workspace snapshots, resource manifests and SHA-256 checksums to thematic output versions for reproducible project restoration
- Added project-to-thematic-map composition workflow with persisted layouts, immutable versions, PNG/JPG/PDF artifacts, preview, publish and archive actions
- Added A4/A3 layouts, overview maps, geographic/Web Mercator grids, automatic legends, north arrows, scale bars, data sources and cartographic notes
- Version management system with bump scripts for frontend and backend
- Makefile for unified version management commands
- CHANGELOG.md to track project changes

### Fixed

- Route thematic map basemaps through the platform tile proxy/cache, wait for complete tiles, retry transient failures and cancel stale auto-preview renders instead of exporting partial black maps
- Unified thematic inventory around `MapComposition`; removed the duplicate legacy `WorkspaceScene(topic)` creation and display flow
- Kept draft and unpublished thematic maps private to their owners, platform administrators and super administrators
- Preserve unsaved map-composition edits when the live map view or source summary changes
- Recommend usable geographic and Web Mercator grid intervals for both local and regional extents

## [V3.28] - 2026-10-31

- 新增科普更新与团队动态栏目，支持草稿、发布、置顶、附件及安全图文/公式展示，维护入口按现有权限显示。
- 优化地图工程摘要分页、按需读取、搜索及图层加载去重，支持多资源链接、范围定位和底图恢复。
- 新增可编辑制图画布，支持拖动缩放、多选对齐、吸附锁定、文字、撤销重做及草稿自动保存；改进比例尺、底图和导出范围一致性，正式出图缺少真实瓦片时明确报错。
- 增加账号能力说明、多标签会话同步和旧鉴权响应隔离，优化栏目导航与窄屏布局。
- 升级说明：启动时执行新增 `content.0001_initial`；附件使用既有业务数据根目录下 `media/content/`，科研根目录不变，栅格仍由后端渲染。本地验收数据不自动导入生产。

## [V3.27] - 2026-10-30

- 修复群落、种群、种质及分子模板被默认按个体类型校验的问题，支持按原始表头识别及明确选错类型的中文提示。
- 导入类型按生态观测、种质、分子、基因四类简化；生态观测保留个体、种群、群落和功能性状选择。
- 基因组可一次多选或拖拽整组2–5个文件，自动匹配基因组、GFF、蛋白、RNA和CDS，检查重复用途、混组与配套内容。
- 修复未完成导入无法确认离开的问题，增加清空和取消入口，校验上传期间防止误清空。
- 更新在线帮助、18页帮助PDF、API合同和生成客户端；无需数据库迁移，权限、数据根目录及栅格渲染保持原设计。

## [V3.26] - 2026-10-30

- 非地理数据导入改为选择数据、核查校验、确认入库三步，支持原始生态模板、Excel 工作表及基因配套预检查。
- 新增分析报告图文编辑、高清 PDF 保存与草稿审核发布，成果页和管理页使用本地 PDF 逐页预览。
- 整理生态、种质、分子和基因分析入口，优化页面布局与固定导航，统一全球胡杨林保护主题文案。
- 更新在线/离线帮助、字段字典、填写示例和参考数据下载包。
- 升级说明：启动时执行 `catalog.0015/0016`，增加报告字段并对齐分析分类；迁移前备份数据库。数据根目录与栅格渲染方式不变，本地业务数据不自动上传。

## [V3.25] - 2026-10-30

- 修复公网 HTTP 访问生态观测等表格分析页面时，数据返回后因 `crypto.randomUUID()` 不可用而白屏的问题。
- 修正全量统计加载提示被挤成竖排的布局，补充不提供 `randomUUID` 时的数据展示、重复记录唯一行标识与重渲染稳定性回归测试。
- 无 API、权限、数据路径或数据库迁移变更。

## [V3.24] - 2026-10-30

- 新增生态观测、种质样本、分子实验及基因组数据分析工作台，支持筛选统计、图表、CSV/报告导出和个人视图保存。
- 统一分析数据导入入口，提供表格模板、参考数据包及原生基因组文件校验与索引。
- 改进目录查询排队和临时繁忙重试，优化地图侧栏及窄屏布局。
- 恢复 GPEDSP 平台品牌，更新帮助中心、离线 PDF 和操作指南。
- 升级说明：新增 `omics.0003` 数据表迁移，由容器启动时执行；本地业务数据和研究数据不随代码发布自动导入生产。

## [0.1.0] - 2026-05-28

### Added
- Initial project setup with frontend (React + Vite + Ant Design + Mapbox GL JS) and backend (Python + Django)
- Unified feature permissions system
- Layer export functionality
- Workspace panel layout for map interface
- User authentication and authorization system
- Data management capabilities
- Raster data processing and visualization
- Vector data display with GeoPackage support
- Configuration management via TOML files
- Docker deployment support

### Changed
- Refactored codebase for better organization
- Renamed files and directories for consistency
- Adjusted workspace panel layout for improved user experience
- Formatted code according to project standards

### Fixed
- UI fixes for better visual consistency
- Resolved issues with raster image loading
- Fixed various bugs and minor issues

### Removed
- Removed full raster image loading for performance optimization
