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

迁移前备份：业务根backups/analysis-before-20261029-231232.sqlite。本机已应用omics迁移0003。不要用旧备份覆盖当前数据库，以免丢失新增资料。旧合成展示资源47–52、55–61已逐项停用，文件未删除；状态记录在交付包旧展示资源状态备份.json，可在存量管理恢复。

## 正常导入

统一地址/resources/data/import?target=analysis。先下载空模板，填写后“仅校验”，通过后“校验并导入”。导入记录保存来源，不创建分析页专用旁路。

表格支持CSV/XLSX/TSV/TXT；VCF/VCF.gz要求参考组装和样本GT，当前拒绝多等位、符号和结构变异。单次16MiB、最多200000行，文本解压64MiB。编号保留文本含义；不把空值变0。

原生文件按genome、GFF、protein、RNA、CDS角色上传，前两项必选。支持FASTA/FNA/FAA/GFF/GFF3及gzip；总上传512MiB、解压读入4GiB。原始ID必须匹配；索引失败不发布资源。更大文件可用现有manage.py import_analysis_genome管理员命令，先明确新组装编号及来源，不重复覆盖现有组装。

## 本次资料

交付根：D:/Code/GeoManager-main260619/deliverables/analysis-refinement-20261030。

- 展示数据18份已从正式权限校验接口导入：资源62–79，逐份源文件和记录数见导入结果.json。
- 空白模板7类，每类CSV与含字段字典的XLSX；FG/MG局部原生文件各5种角色。
- 官方完整FG/MG原件保留在deliverables/nongeo-design-20261029/genome_data；参考组装1/2已索引。
- 网页实际导入的FG局部序列为组装3、资源80，100000bp/9基因。它是chr01局部，不是完整参考基因组。
- 下载包frontend/public/downloads/analysis-reference-data.zip与交付展示数据与模板.zip一致。

没有真实表达/功能/变异源时不制造组学结论。已有旧合成样例和过程目录保留作历史开发证据，不作为当前业务展示资料。

## 维护

合同docs/openapi.yaml，变更说明docs/api-change-requests.md，生成类型frontend/src/api/generated。AGENTS中schema.d.ts为旧路径，实际按生成配置校验。普通分析位于/api/analysis，基因索引位于/api/omics。在线帮助与docs/platform-user-guide.md、public/docs/CAPFED-help-center.pdf同步；修改帮助源后运行scripts/export_help_markdown.mjs和scripts/generate_help_pdf.py，并重新渲染检查。
