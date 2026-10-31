import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const english: Record<string, string> = {
  科普更新: "Science updates",
  团队动态: "Team news",
  胡杨科普: "Poplar knowledge",
  关于我们: "About us",
  发布科普: "Publish science article",
  发布团队动态: "Publish team news",
  当前位置: "Current location",
  正文: "Article",
  内容列表与阅读: "Articles and reading",
  科普文章: "Science articles",
  最新动态: "Latest news",
  内容分类: "Categories",
  显示草稿与已下架内容: "Include drafts and archived content",
  搜索科普文章: "Search science articles",
  搜索团队动态: "Search team news",
  没有找到匹配内容: "No matching content",
  "请尝试其他关键词或分类。": "Try another keyword or category.",
  "新的分享将在这里呈现，欢迎持续关注。":
    "New stories will appear here. Stay tuned.",
  "从物种生态到保护实践，分享胡杨研究中的知识与发现。":
    "Explore knowledge and discoveries in poplar research, from species ecology to conservation.",
  "记录科研进展与交流现场，分享团队成长的每一步。":
    "Follow our research, academic exchanges and life as a team.",
  "认识胡杨 · 理解生态 · 共同守护":
    "Discover poplars · Understand ecology · Protect together",
  "学术交流 · 科研协作 · 团队足迹":
    "Academic exchange · Research collaboration · Team stories",
  "可先保存草稿；确认内容后，将发布状态设为“已发布”并保存。":
    "Save a draft first. When ready, set the status to Published and save.",
  全部: "All",
  编辑内容: "Edit content",
  新建内容: "New content",
  标题: "Title",
  分类: "Category",
  保存: "Save",
  取消: "Cancel",
  科普: "Science",
  新闻: "News",
  摘要: "Summary",
  置顶: "Pinned",
  "上传图片或 PDF": "Upload image or PDF",
  移除附件: "Remove attachment",
  返回列表: "Back to list",
  管理内容: "Manage content",
  发布视图: "Published view",
  重新加载: "Reload",
  草稿: "Draft",
  已发布: "Published",
  已下架: "Archived",
  发布状态: "Status",
  活动日期: "Event date",
  预览正文: "Preview body",
  内容预览: "Content preview",
  "正文（段落以空行分隔，## 表示小标题）": "Body (Markdown and math supported)",
  "学习链接，每行：资料名称 | https://地址":
    "Reading links, one per line: Title | https://url",
  "编辑备注（仅内部保存）": "Internal editorial notes",
  图片或附件说明: "Image or attachment caption",
  设为封面: "Set as cover",
  会议现场: "Event gallery",
  相关资料: "Related resources",
  图文资料: "Illustrated article",
  继续学习: "Further reading",
  "访问资料 ↗": "Visit resource ↗",
  "阅读全文 →": "Read more →",
  团队整理: "Editorial team",
  搜索科普或动态: "Search articles or news",
  暂无已发布内容: "No published content",
  "暂无内容，可新建条目": "No content yet; create an article",
  内容已保存: "Content saved",
  请检查表单内容: "Check the form",
  内容类型不匹配: "Article type mismatch",
  "先保存草稿，再添加图片或 PDF 附件。":
    "Save a draft before adding images or PDF files.",
  "附件已暂存，保存内容后生效":
    "Attachment staged; save the article to commit it",
  "已选择封面，保存内容后生效": "Cover selected; save the article to apply it",
  "学习链接请按“资料名称 | https://地址”填写":
    "Use Title | https://url for each reading link",
  胡杨科普更新: "Poplar science updates",
  团队新闻动态: "Team news",
  "生态保护、监测资料与研究进展。":
    "Ecological conservation, monitoring data and research updates.",
  学术会议: "Conferences",
  学术交流: "Academic exchange",
  科研进展: "Research progress",
  团队活动: "Team activities",
  物种与生态: "Species and ecology",
  保护管理: "Conservation",
  监测与数据: "Monitoring and data",
  研究方法: "Research methods",
};

export function useContentText() {
  const { i18n } = useTranslation();
  const en = i18n.resolvedLanguage?.startsWith("en") ?? false;
  return useCallback(
    (text: string) => (en ? (english[text] ?? text) : text),
    [en],
  );
}
