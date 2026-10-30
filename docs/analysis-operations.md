# 数据分析运行与数据接入

更新：2026-10-30。本轮完成本机开发和验证，未提交、推送或部署。代码根D:/Code/GeoManager-main260619/GeoManager-main。

## 启动

仓库规定Pixi；本机未安装Pixi，当前已验证的后端运行环境为现有Conda，不修改全局Python。分别启动两个终端：

```powershell
Set-Location 'D:\Code\GeoManager-main260619\GeoManager-main\backend'
& 'D:\Users\anaconda\envs\geomanager\python.exe' manage.py runserver 127.0.0.1:8000 --noreload
```

```powershell
Set-Location 'D:\Code\GeoManager-main260619\GeoManager-main\frontend'
pnpm run dev --port 5173 --strictPort
```

入口http://127.0.0.1:5173/nongeo。使用已有账号，沿用Django功能权限、资源访问控制、用户视图隔离和下载审计。

## 目录与恢复

配置指针.runtime/config-path及TOML保持原位；当前业务根D:/GeoManagerData/geomanager-main260619/appdata，科研根D:/GeoManagerData/geomanager-main260619/research。专业索引及上传副本位于科研根gene/analysis；应用代码未写死这些根目录。

迁移前备份：业务根backups/analysis-before-20261029-231232.sqlite和backups/analysis-before-migrate-20261030-184535.sqlite3。本机已应用omics迁移0003及catalog迁移0015/0016（报告审核、分类适配）。不要用旧备份覆盖当前数据库，以免丢失新增资料。旧合成展示资源47–52、55–61已逐项停用，文件未删除。

## 正常导入

统一地址/resources/data/import?target=analysis，落在“导入数据资源 → 非地理数据”；同页切换地理数据。导入页顶层只有导入数据资源/导入成果。按“选择数据 → 核查校验 → 确认入库”推进；文件或参数修改后必须重新校验。字段规范及模板集中到帮助页。导入记录保存来源，不创建分析页专用旁路。

表格支持CSV/XLS/XLSX/TSV/分隔TXT，以及CSV.gz、TSV.gz、TXT.gz；Excel可指定sheetName，留空读取第一张工作表。表达/功能/变异的历史API保留，当前页面不提供其分析和导入入口。单次16MiB、最多200000行，文本解压64MiB。编号保留文本含义；不把空值变0。原始模板别名在ecology_contracts.py明确映射，不猜测缺失物种、材料或核心归属。

原生文件按genome、GFF、protein、RNA、CDS角色上传，前两项必选。支持FASTA/FNA/FAA/GFF/GFF3及gzip；总上传512MiB、解压读入4GiB。原始ID必须匹配；索引失败不发布资源。更大文件可用现有manage.py import_analysis_genome管理员命令，先明确新组装编号及来源，不重复覆盖现有组装。

预检查通过POST /api/omics/import/ validateOnly=true复用完整解析器，不创建业务记录。检查文件保存在配置科研根gene/checks，上传暂存位于系统临时目录；按本次禁止批量删除要求保留，不自动递归清理。正式入库重新检查并建立gene/analysis索引。

帮助页下载包为frontend/public/downloads/data-resource-templates.zip：7类空白/填写示例CSV、基因组配套清单空白/填写示例CSV，共16表加1份说明。清单不是基因序列上传文件。E盘数据模板/非地理数据CSV模板目录存放同一组文件，邻接ZIP供服务器迁移。

## 本次资料

交付根：D:/Code/GeoManager-main260619/deliverables/analysis-refinement-20261030。

- 展示数据18份已从正式权限校验接口导入：资源62–79，逐份源文件和记录数见导入结果.json。
- 空白模板7类，每类CSV与含字段字典的XLSX；FG/MG局部原生文件各5种角色。
- 官方完整FG/MG原件保留在deliverables/nongeo-design-20261029/genome_data；参考组装1/2已索引。
- 网页实际导入的FG局部序列为组装3、资源80，100000bp/9基因。它是chr01局部，不是完整参考基因组。
- 历史包analysis-reference-data.zip保留；当前页面改为下载frontend/public/downloads/nongeo-reference-data.zip，按生态观测、种质、分子和基因四目录组织。后续发布需将该静态包与前端构建一起包含。

没有真实表达/功能/变异源时不制造组学结论。已有旧合成样例和过程目录保留作历史开发证据，不作为当前业务展示资料。

## 维护

本轮增加资源81–86：个体23、种群156、群落516、种质663、分子模拟72、完整性状2411条。四份甲方原表通过正式分析导入API逐份校验及导入；证据tmp/original-template-api-verification.json。原始文件保持原位。种质资源84在有SQLite备份后纠正了未提供核心归属时的空值，未改甲方源文件。

分子交付文件直接放在E:/GRP Docs/2026.05 胡杨智能提取与监测分析平台原型系统开发/数据模板：分子数据模板.csv、分子数据示例_模拟.csv、分子数据上传说明.txt。

分析报告复用ResultArtifact。新增POST /api/analysis/reports/及GET/POST /api/analysis/reports/{id}/；PDF和编辑内容分开保存，文件位于配置业务根exports/results。草稿→待审核→发布；退回修改保留意见。外部PDF导入必须审核，不能从草稿直接发布。报告生成需要数据查询/导出、成果查看/导入权限；发布仍用原成果发布权限及访问角色。

合同docs/openapi.yaml，变更说明docs/api-change-requests.md，生成类型frontend/src/api/generated。AGENTS中schema.d.ts为旧路径，实际按生成配置校验。普通分析位于/api/analysis，基因索引位于/api/omics。在线帮助与docs/platform-user-guide.md、public/docs/CAPFED-help-center.pdf同步；修改帮助源后运行scripts/export_help_markdown.mjs和scripts/generate_help_pdf.py，并重新渲染检查。
