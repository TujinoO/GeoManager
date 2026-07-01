export type AboutSectionKey =
  | "system"
  | "team"
  | "members"
  | "knowledge"
  | "docs";

export type AboutSection = {
  key: AboutSectionKey;
  title: string;
  badge: string;
  path: string;
  eyebrow: string;
  summary: string;
  highlights: string[];
  blocks: Array<{
    title: string;
    description: string;
    items: string[];
  }>;
};

export const aboutSections: AboutSection[] = [
  {
    key: "system",
    title: "系统简介",
    badge: "平台定位",
    path: "/about/system",
    eyebrow: "CAPFED 平台概览",
    summary:
      "中亚胡杨林生态系统保护数据共享平台面向胡杨林生态保护、空间数据管理、数据查询和专题展示，提供统一的数据底座与可视化工作台。",
    highlights: ["多源数据共享", "三维地理可视化", "专题组织", "权限与审计"],
    blocks: [
      {
        title: "建设目标",
        description:
          "围绕胡杨林生态系统保护业务，形成覆盖遥感、野外调查、长期监测、种质和分子数据的共享体系。",
        items: ["统一数据目录", "空间与非空间数据协同", "可持续扩展的业务入口"],
      },
      {
        title: "核心能力",
        description:
          "当前阶段以数据浏览、资源管理、图层展示和基础分析为核心，后续可逐步接入专题模型和知识服务。",
        items: ["数据检索", "图层加载", "属性查看", "专题工作区"],
      },
    ],
  },
  {
    key: "team",
    title: "团队介绍",
    badge: "组织协作",
    path: "/about/team",
    eyebrow: "项目组织",
    summary:
      "本栏目预留项目团队、合作单位、科研支撑、数据治理和平台研发等组织信息，便于集中展示平台建设力量。",
    highlights: ["项目统筹", "科研支撑", "数据治理", "研发运维"],
    blocks: [
      {
        title: "团队构成",
        description:
          "后续可按项目负责、生态研究、遥感监测、数据管理、平台研发等方向补充团队介绍。",
        items: ["项目负责人", "生态与遥感团队", "数据与平台团队"],
      },
      {
        title: "协作机制",
        description:
          "预留合作单位、数据提供单位和技术支持单位说明，支撑长期共建与成果共享。",
        items: ["合作单位", "数据移交", "成果共建"],
      },
    ],
  },
  {
    key: "members",
    title: "团队成员",
    badge: "成员名录",
    path: "/about/members",
    eyebrow: "成员信息",
    summary:
      "本栏目用于展示团队成员、研究方向、职责分工和联系方式等信息，当前以占位信息呈现。",
    highlights: ["负责人", "科研人员", "数据管理员", "研发支持"],
    blocks: [
      {
        title: "成员分类",
        description:
          "后续可按负责人、研究骨干、数据管理员、系统管理员、开发与运维人员分组展示。",
        items: ["项目负责人", "科研骨干", "系统研发", "运维支持"],
      },
      {
        title: "展示字段",
        description:
          "预留姓名、单位、角色、研究方向、负责模块和联系方式字段，支持后续后台维护。",
        items: ["姓名与单位", "角色职责", "研究方向", "联系信息"],
      },
    ],
  },
  {
    key: "knowledge",
    title: "胡杨知识",
    badge: "科普知识",
    path: "/about/knowledge",
    eyebrow: "Populus euphratica",
    summary:
      "本栏目预留胡杨物种知识、生态特征、分布格局、保护监测指标和典型案例，为数据平台补充知识背景。",
    highlights: ["物种特征", "分布区概览", "生态价值", "保护监测"],
    blocks: [
      {
        title: "基础知识",
        description:
          "后续可整理胡杨生物学特征、耐旱耐盐机制、群落组成和生境条件等内容。",
        items: ["形态特征", "生态适应", "群落结构"],
      },
      {
        title: "保护主题",
        description:
          "围绕退化监测、种质保护、遥感识别和流域生态修复等主题形成知识条目。",
        items: ["退化监测", "种质资源", "遥感识别", "生态修复"],
      },
    ],
  },
  {
    key: "docs",
    title: "帮助文档",
    badge: "使用支持",
    path: "/about/docs",
    eyebrow: "用户支持",
    summary:
      "本栏目预留用户手册、数据上传规范、常见问题、版本说明和运维指南，为平台使用提供统一入口。",
    highlights: ["快速入门", "数据导入", "常见问题", "版本说明"],
    blocks: [
      {
        title: "使用文档",
        description:
          "后续可放置登录、地图浏览、数据检索、资源导入、专题管理等操作说明。",
        items: ["登录与权限", "地图工作台", "非地理数据", "后台管理"],
      },
      {
        title: "数据规范",
        description:
          "预留数据模板、字段说明、空间坐标要求、质量检查规则和导入报错说明。",
        items: ["模板下载", "字段规范", "坐标要求", "质量检查"],
      },
    ],
  },
];

export function aboutSectionByKey(key: string | undefined) {
  return aboutSections.find((section) => section.key === key) ?? aboutSections[0]!;
}
