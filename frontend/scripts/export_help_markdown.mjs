import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync("src/about/aboutSections.ts", "utf8");
const parsed = ts.createSourceFile(
  "aboutSections.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
let articles;
let faq;
for (const statement of parsed.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const d of statement.declarationList.declarations) {
    if (d.name.getText(parsed) === "helpArticles") {
      articles = vm.runInNewContext("(" + d.initializer.getText(parsed) + ")");
    }
    if (d.name.getText(parsed) === "helpFaq") {
      faq = vm.runInNewContext("(" + d.initializer.getText(parsed) + ")");
    }
  }
}
let markdown =
  "# 全球胡杨林生态系统保护数据共享平台帮助文档\n\n| 项目 | 内容 |\n| --- | --- |\n| 文档版本 | v3.1 |\n| 更新日期 | 2026-10-30 |\n| 适用平台 | GPEDSP 本地最新开发版 |\n| 适用对象 | 普通用户、科研用户、数据管理员、系统管理员 |\n\n";
const categories = ["入门指南", "空间分析", "数据分析", "数据管理", "后台管理"];
articles.sort(
  (a, b) => categories.indexOf(a.category) - categories.indexOf(b.category),
);
for (const article of articles) {
  markdown += `## ${article.title}\n\n${article.summary}\n\n`;
  for (const block of article.blocks) {
    markdown += `### ${block.title}\n\n`;
    if (block.type === "table") {
      markdown +=
        "| " +
        block.columns.join(" | ") +
        " |\n| " +
        block.columns.map(() => "---").join(" | ") +
        " |\n";
      for (const row of block.rows) markdown += "| " + row.join(" | ") + " |\n";
    } else if (block.type === "steps") {
      block.items.forEach(
        (item, i) =>
          (markdown += `${i + 1}. ${item.title}：${item.description}\n`),
      );
    } else if (block.items) {
      for (const item of block.items) markdown += "- " + item + "\n";
    } else markdown += block.body + "\n";
    markdown += "\n";
  }
}
markdown += "## 常见问题\n\n";
for (const item of faq)
  markdown += `### ${item.question}\n\n${item.answer}\n\n`;
fs.writeFileSync("../docs/platform-user-guide.md", markdown);
console.log("Exported", articles.length, "articles");
