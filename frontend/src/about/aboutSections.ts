import helpGuidePreview from "../assets/about/help-guide-preview.png";
import labLeavesImage from "../assets/about/lab-leaves.jpeg";
import knowledgePopulusForestImage from "../assets/about/knowledge-populus-forest.png";
import liZhijunPortrait from "../assets/about/lizhijun-portrait.jpeg";
import memberResearchSeedlingsImage from "../assets/about/member-research-seedlings.png";
import populusForestImage from "../assets/about/populus-forest.png";
import researchSeedlingsImage from "../assets/about/research-seedlings.jpeg";
import tarimUniversitySeal from "../assets/about/tarim-university-seal.jpeg";
import teamGreenhouseImage from "../assets/about/team-greenhouse.png";

export type AboutSectionKey =
  | "system"
  | "team"
  | "members"
  | "knowledge"
  | "docs";

export type AboutSource = {
  label: string;
  url?: string;
  note?: string;
};

export type AboutSection = {
  key: AboutSectionKey;
  title: string;
  badge: string;
  path: string;
  eyebrow: string;
  summary: string;
  navSummary: string;
  tags: string[];
  sources: AboutSource[];
};

export const aboutAssets = {
  helpGuidePreview,
  knowledgePopulusForestImage,
  labLeavesImage,
  liZhijunPortrait,
  memberResearchSeedlingsImage,
  populusForestImage,
  researchSeedlingsImage,
  tarimUniversitySeal,
  teamGreenhouseImage,
};

export const platformDisplayName = {
  zh: "中亚胡杨林生态系统保护数据共享平台",
  en: "Central Asia Poplar Forest Ecosystem Protection Data Sharing Platform",
};

export const aboutSections: AboutSection[] = [
  {
    key: "system",
    title: "系统简介",
    badge: "平台定位",
    path: "/about/system",
    eyebrow: "平台概览",
    summary:
      "平台面向胡杨林生态系统保护、空间数据管理、数据查询和专题展示，提供统一的数据底座与可视化工作台，服务遥感影像、野外调查、长期监测和科研成果沉淀。",
    navSummary: "平台定位",
    tags: ["多源数据汇聚", "三维地理可视化", "专题组织", "智能检索"],
    sources: [
      {
        label: "软件设计文档",
        note: "本地项目设计边界与建设目标",
      },
    ],
  },
  {
    key: "team",
    title: "团队介绍",
    badge: "组织协作",
    path: "/about/team",
    eyebrow: "科研团队",
    summary:
      "团队扎根塔里木大学，长期围绕胡杨保护生物学、种质资源保育、生态修复、科普培训与科研数据平台建设开展系统研究，形成从基础研究、技术研发到示范应用的协同工作体系。",
    navSummary: "组织协作",
    tags: ["项目统筹", "科研支撑", "数据治理", "创新推进"],
    sources: [
      {
        label: "李志军教授团队事迹",
        url: "https://www.taru.edu.cn/info/1044/20997.htm",
        note: "李志军教授团队相关介绍",
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
      "本栏目围绕首席科学家、核心成员、合作网络与学术成果组织团队信息，呈现李志军教授团队在胡杨保护生物学、种质资源保育、生态修复和人才培养方面的长期积累。",
    navSummary: "成员名录",
    tags: ["首席科学家", "核心成员", "合作网络", "学术成果"],
    sources: [
      {
        label: "李志军教授团队事迹",
        url: "https://www.taru.edu.cn/info/1044/20997.htm",
        note: "李志军教授团队相关介绍",
      },
    ],
  },
  {
    key: "knowledge",
    title: "胡杨知识",
    badge: "科研知识",
    path: "/about/knowledge",
    eyebrow: "Populus euphratica",
    summary:
      "本栏目聚合胡杨物种知识、代表论文、分子机制和保护监测主题，把平台的数据资源与科研背景连接起来。",
    navSummary: "科研知识",
    tags: ["雌雄基因组", "性别决定", "灰杨适应演化", "生态保护"],
    sources: [
      {
        label: "Communications Biology 论文",
        url: "https://www.nature.com/articles/s42003-022-04145-7",
        note: "胡杨雌雄基因组与性别决定机制",
      },
      {
        label: "Horticulture Research 论文",
        url: "https://academic.oup.com/hr/article/11/3/uhae034/7601711",
        note: "灰杨染色体级基因组与荒漠化适应演化",
      },
    ],
  },
  {
    key: "docs",
    title: "帮助文档",
    badge: "使用支持",
    path: "/about/docs",
    eyebrow: "Help Center",
    summary:
      "帮助中心面向普通用户、科研用户、数据管理员和系统管理员，集中提供平台导览、空间查询、数据导入、专题管理和后台管理说明。",
    navSummary: "使用支持",
    tags: ["快速入门", "空间查询", "数据导入", "常见问题"],
    sources: [
      {
        label: "开发者指南",
        note: "接口与功能说明",
      },
      {
        label: "软件设计文档",
        note: "平台功能边界",
      },
    ],
  },
];

export const systemIntroduction = {
  lead: "平台由塔里木大学李志军教授课题组牵头建设，定位为面向胡杨林生态保护与科研协同的一站式科研服务平台。",
  body: "中亚胡杨林生态系统保护数据共享平台面向胡杨林生态保护、长期监测与科研协同，提供从数据汇聚、空间浏览、专题组织到检索共享的一体化服务。平台围绕西北五省及中亚干旱区胡杨林资源，持续沉淀遥感解译、野外调查、样地监测、表型记录与分子研究等多源资料，形成可查询、可追溯、可展示的数字化档案。系统以多源数据汇聚、三维地理可视化、专题组织与智能检索为核心能力，连接宏观生态格局、地面观测记录和微观样本信息，为干旱区生态保护、气候变化响应、种质资源保育与胡杨抗逆机制研究提供稳定的数据底座和可视化支撑，让每一份观测记录都能转化为可复用的科研资产。",
  highlights: ["科研数据底座", "胡杨林数字档案", "开放共享服务"],
};

export const systemCapabilities = [
  {
    title: "多源数据汇聚",
    description:
      "统一组织遥感影像、矢量图层、野外调查、长期监测、表格和科研成果数据。",
    meta: "目录、元数据、权限",
  },
  {
    title: "三维地理可视化",
    description:
      "在三维地球工作台中加载图层、查看属性、叠加专题并开展空间浏览。",
    meta: "图层、范围、属性",
  },
  {
    title: "专题组织",
    description:
      "围绕胡杨分布、河流廊道、样地监测、种质资源等业务场景沉淀专题入口。",
    meta: "场景、资源、成果",
  },
  {
    title: "智能检索",
    description:
      "支持按关键词、分类、格式、时空范围和资源类型进行统一查询与快速定位。",
    meta: "检索、筛选、追溯",
  },
];

export const systemRoadmap = [
  {
    phase: "目标一",
    title: "建设统一可信的数据底座",
    description:
      "规范汇聚遥感、样地、调查、表型、分子与成果资料，形成可检索、可追溯、可持续维护的资源目录。",
  },
  {
    phase: "目标二",
    title: "支撑生态保护与科研分析",
    description:
      "以三维地理可视化、空间查询和专题组织串联数据浏览、结果比对、样地研判与科研成果复用。",
  },
  {
    phase: "目标三",
    title: "形成开放共享的协同平台",
    description:
      "面向项目团队、数据管理员与科研用户提供清晰入口，推动胡杨保护知识、数据资产和平台经验沉淀共享。",
  },
];

export const teamFocusAreas = [
  {
    title: "胡杨种质资源收集与保育",
    description:
      "面向天然林、核心种质和保护材料开展资源调查、收集整理、评价利用与长期保存。",
  },
  {
    title: "胡杨抗逆分子机制",
    description:
      "围绕耐旱、耐盐碱、性别决定、基因编辑和合成生物学等方向开展机制研究。",
  },
  {
    title: "胡杨林生态修复与水分管理",
    description:
      "聚焦塔里木河流域等干旱区河岸林生态恢复、水分过程调控和保护技术应用。",
  },
  {
    title: "胡杨林大数据平台构建",
    description:
      "将野外调查、遥感监测、种质资源和分子数据纳入统一的数据共享与可视化体系。",
  },
];

export const teamIntro = {
  title: "扎根南疆的胡杨保护科研团队",
  position:
    "团队以塔里木大学生命科学与技术学院为依托，面向西北五省及中亚干旱区胡杨林分布区，长期开展胡杨、灰杨保护生物学与生态修复研究。团队工作贯通基因、种质、苗木、群落、流域和数据平台多个层级：在微观层面解析胡杨抗逆、性别决定和适应演化机制，在资源层面推进种质收集、保存、评价和利用，在生态层面服务退化河岸林恢复、水分管理和精准造林，在平台层面推动野外调查、遥感监测和科研成果的数字化沉淀。团队同时重视科普培训和技术推广，持续服务塔里木盆地生态环境建设、区域资源保护和干旱区生态安全屏障建设。",
  sourceUrl: "https://www.taru.edu.cn/info/1044/20997.htm",
  sourceLabel: "了解李志军教授团队事迹",
};

export const teamEvidence = [
  {
    label: "长期扎根",
    value: "长期深入胡杨林分布区开展野外调查、样地监测和保护实践",
  },
  {
    label: "野外调查",
    value: "调查足迹覆盖中国 63 个县（市）的胡杨林分布区",
  },
  {
    label: "成果转化",
    value: "保护理论、育苗技术和科普培训成果服务于胡杨林恢复与区域生态建设",
  },
];

export const teamLeaderCard = {
  name: "李志军",
  title: "教授、博士研究生导师",
  role: "团队负责人 / 胡杨保护生物学研究带头人",
  description:
    "李志军教授长期从事胡杨保护生物学研究，是团队科研方向、人才培养和平台数据建设的重要组织者。她带领团队围绕胡杨、灰杨保护研究、技术推广和生态修复持续攻关，为新疆干旱区生态保护和胡杨林恢复提供科研支撑。",
  profileUrl: "https://www.taru.edu.cn/info/1044/20997.htm",
};

export const teamNewsItems = [
  {
    date: "2025-10-22",
    label: "重磅突破",
    title: "国内首次实现胡杨苗雌雄鉴定，助力精准造林",
    description:
      "李志军团队围绕胡杨苗性别鉴定开展分子标记技术攻关，为精准造林、种质资源配置和后续管护提供关键技术支撑。",
    source: "科研突破",
    url: "https://news.cnr.cn/native/gd/20251022/t20251022_527404239.shtml",
  },
  {
    date: "2025-10",
    label: "技术革新",
    title: "胡杨“速生苗”规模移栽成功",
    description:
      "团队快速育苗技术显著缩短育苗周期，并在泽普县等地开展规模化移栽应用，推动科研成果走向生态修复现场。",
    source: "技术应用",
    url: "https://mp.weixin.qq.com/s?__biz=MzAwNDQ4OTIzMQ==&mid=2653993356&idx=4&sn=a6260d5589a800bc163930ddc1cac5fa&chksm=817a304080b8aed26ab3c9f02ebf83ea8874598026f547eddf6945ff1468b8c94bafced5acd7#rd",
  },
  {
    date: "2025-03-10",
    label: "荣誉表彰",
    title: "李志军教授受邀做客兵团卫视《兵团视点》",
    description:
      "李志军教授做客兵团卫视《兵团视点》，分享她与胡杨结缘、扎根边疆、长期投身胡杨研究和人才培养的经历。",
    source: "人物访谈",
    url: "https://sky.taru.edu.cn/info/14127/3555.htm",
  },
  {
    date: "2025-10-02",
    label: "科研进展",
    title: "依托前沿生物技术培育抗逆新种质",
    description:
      "团队围绕胡杨抗盐碱、抗旱等关键性状开展定向改良研究，探索以基因编辑等前沿技术服务干旱区生态恢复。",
    source: "科研进展",
    url: "https://xj.people.com.cn/n2/2025/1002/c186332-41371557.html",
  },
];

export const contactRows = [
  [
    "数据使用咨询 / 权限申请",
    "请发送邮件至 wanghaoyu191@mails.ucas.ac.cn，说明姓名、单位、数据用途与所需权限。",
  ],
  [
    "数据资料提交",
    "请按平台数据模板整理数据文件、元数据说明和联系人信息，由数据管理员统一受理。",
  ],
  [
    "平台故障报修",
    "请通过 wanghaoyu191@mails.ucas.ac.cn 反馈问题描述、截图、浏览器环境和复现步骤。",
  ],
  ["通信地址", "新疆阿拉尔市塔里木大学生命科学与技术学院，843300"],
];

export const principalScientist = {
  name: "李志军",
  role: "教授、博士研究生导师、二级岗位教授",
  affiliation: "塔里木大学生命科学与技术学院",
  description:
    "李志军教授，女，1963 年生，中共党员，塔里木大学生命科学与技术学院教授、博士研究生导师、二级岗位教授，是塔里木大学植物学科带头人、自治区天山英才科技创新团队负责人。她长期扎根南疆，主要从事胡杨保护生物学研究，围绕胡杨、灰杨保护生物学、种质资源保育、繁殖更新机制、抗逆分子调控和生态修复技术开展系统研究。",
  story:
    "从野外调查、种质采集到实验室分析、技术推广和人才培养，李志军教授带领团队建立了贯通基础研究、应用技术、科普培训和数据沉淀的工作体系。团队长期深入胡杨林分布区，围绕天然胡杨林保护恢复、区域植物资源保护、干旱区生态安全屏障建设和塔里木盆地生态环境治理持续攻关，推动科研成果走向保护实践。",
  honorHighlights: [
    "国务院政府特殊津贴专家",
    "全国三八红旗手",
    "新疆维吾尔自治区突出贡献专家",
    "新疆维吾尔自治区第九届高等学校教学名师",
    "新疆维吾尔自治区优秀教师",
    "新疆生产建设兵团三八红旗手标兵",
    "兵团屯垦戍边劳动奖章获得者",
  ],
  highlights: [
    "自治区天山英才一层次培养人选",
    "新疆生产建设兵团兵团英才一层次培养人选",
    "自治区天山英才科技创新团队负责人",
    "塔里木大学植物学科带头人",
    "新疆植物学会第十一届理事会副理事长",
    "塔里木大学校学术委员会委员",
  ],
  stats: [
    {
      value: "30+",
      label: "国家及省部级科研项目",
      detail: "长期主持胡杨保护与干旱区植物资源研究",
    },
    {
      value: "100+",
      label: "学术论文",
      detail: "涵盖基因组、群体遗传、生态修复与抗逆机制",
    },
    {
      value: "32",
      label: "SCI 收录论文",
      detail: "成果发表在 Plant Physiology 等期刊",
    },
    {
      value: "62",
      label: "中文核心论文",
      detail: "服务区域生态保护和资源利用研究",
    },
    {
      value: "6",
      label: "授权发明专利",
      detail: "支撑胡杨保护技术体系与应用转化",
    },
    {
      value: "12",
      label: "学术专著",
      detail: "沉淀塔里木盆地植物资源与胡杨研究成果",
    },
  ],
  source: "https://www.taru.edu.cn/info/1044/20997.htm",
};

export const principalWorkThemes = [
  {
    title: "保护生物学与种质资源",
    description:
      "围绕胡杨、灰杨等干旱区关键树种开展种质资源调查、收集保存、遗传多样性评价与核心保护单元构建。",
  },
  {
    title: "繁殖更新与生态修复",
    description:
      "研究胡杨林天然更新、克隆繁殖、水分调控和围栏封育等关键过程，推动保护理论转化为恢复技术。",
  },
  {
    title: "分子机制与前沿育种",
    description:
      "聚焦性别决定、抗旱耐盐、异形叶适应和基因组演化等方向，支撑胡杨精准保护与抗逆新种质培育。",
  },
  {
    title: "科普培训与人才培养",
    description:
      "长期面向地方管理部门、科研人员和学生开展培训与科普，持续培养服务干旱区生态保护的科研后备力量。",
  },
];

export const principalPublicationHighlights = [
  {
    year: "2026",
    journal: "International Journal of Molecular Sciences",
    title:
      "Genome-Wide Identification of the WOX Gene Family in Three Populus Species and Expression Profiling of Populus euphratica and Populus pruinosa Under Abiotic Stresses",
    authors:
      "Chen Qiu, Xinyue Long, Zhongshuai Gai, Xiaoli Han, Jia Song, Yuqi Yang, Jianhao Sun, Zhijun Li",
    doi: "10.3390/ijms27135999",
    url: "https://doi.org/10.3390/ijms27135999",
    summary:
      "围绕胡杨与灰杨抗逆相关 WOX 基因家族开展系统鉴定与表达分析，为理解干旱区杨属植物逆境响应提供分子线索。",
  },
  {
    year: "2026",
    journal: "Plants",
    title:
      "Sex-Specific Adaptive Strategies of Populus euphratica Along Developmental and Canopy Gradients Based on Leaf Trait Networks",
    authors:
      "Xiaoli Han, Jie Wang, Xiu Li, Jinlong Zhang, Juntuan Zhai, Zhijun Li",
    doi: "10.3390/plants15121770",
    url: "https://doi.org/10.3390/plants15121770",
    summary:
      "从叶片性状网络视角解析胡杨不同性别在发育阶段与冠层梯度中的适应策略，延展团队对胡杨性别差异和生态适应的研究。",
  },
  {
    year: "2024",
    journal: "Horticulture Research",
    title:
      "The chromosome-scale genome and population genomics reveal the adaptative evolution of Populus pruinosa to desertification environment",
    authors:
      "Jianhao Sun, Jindong Xu, Chen Qiu, Juntuan Zhai, Shanhe Zhang, Xiao Zhang, Zhihua Wu, Zhijun Li",
    doi: "10.1093/hr/uhae034",
    url: "https://doi.org/10.1093/hr/uhae034",
    summary:
      "构建灰杨染色体级基因组并结合群体基因组分析，揭示灰杨适应荒漠化环境的演化基础。",
  },
  {
    year: "2022",
    journal: "Communications Biology",
    title:
      "Chromosome-scale assemblies of the male and female Populus euphratica genomes reveal the molecular basis of sex determination and sexual dimorphism",
    authors:
      "Shanhe Zhang, Zhihua Wu, De Ma, Juntuan Zhai, Xiaoli Han, Zhenbo Jiang, Shuo Liu, Jindong Xu, Peipei Jiao, Zhijun Li",
    doi: "10.1038/s42003-022-04145-7",
    url: "https://doi.org/10.1038/s42003-022-04145-7",
    summary:
      "完成胡杨雌雄染色体级基因组组装，解析性别决定与性二态分子基础，为胡杨性别鉴定和保护利用提供关键支撑。",
  },
];

export const coreMembers = [
  {
    name: "焦培培",
    role: "科研骨干",
    focus: "胡杨遗传多样性、种质资源评价与分子机制研究",
  },
  {
    name: "格明古丽·木哈台",
    role: "科研骨干",
    focus: "胡杨资源保护、区域植物资源调查与合作交流",
  },
  {
    name: "盖中帅",
    role: "青年研究人员",
    focus: "群体遗传、核心保护单元与胡杨异形叶研究",
  },
  {
    name: "翟军团",
    role: "科研骨干",
    focus: "克隆繁殖、群体结构、生态遗传与种群适应",
  },
  {
    name: "张山河",
    role: "科研成员",
    focus: "胡杨基因组、保护生物学与学院科研协同支撑",
  },
];

export const cooperationNodes = [
  { name: "塔里木大学", type: "核心团队", x: 48, y: 50 },
  { name: "浙江师范大学", type: "合作单位", x: 20, y: 24 },
  { name: "中南民族大学", type: "合作单位", x: 78, y: 26 },
  { name: "西北五省样地", type: "野外调查", x: 16, y: 76 },
  { name: "硕博研究生", type: "人才培养", x: 50, y: 82 },
  { name: "数据平台团队", type: "平台研发", x: 82, y: 72 },
];

export const knowledgePapers = [
  {
    journal: "Communications Biology",
    mark: "Comms Bio",
    volume: "2022",
    impact: "Nature Portfolio",
    title:
      "Chromosome-scale assemblies of the male and female Populus euphratica genomes reveal the molecular basis of sex determination and sexual dimorphism",
    authors:
      "Shanhe Zhang, Zhihua Wu, De Ma, Juntuan Zhai, Xiaoli Han, Peipei Jiao, Zhijun Li",
    year: "2022",
    doi: "10.1038/s42003-022-04145-7",
    url: "https://www.nature.com/articles/s42003-022-04145-7",
    theme: "性别决定",
    group: "雌雄基因组",
    summary:
      "完成胡杨雌雄染色体级基因组组装，揭示性别决定与性二态分子基础，为性别鉴定分子标记开发奠定基础。",
  },
  {
    journal: "Horticulture Research",
    mark: "Hortic Res",
    volume: "2024",
    impact: "Genome",
    title:
      "The chromosome-scale genome and population genomics reveal the adaptative evolution of Populus pruinosa to desertification environment",
    authors:
      "Jianhao Sun, Jindong Xu, Chen Qiu, Juntuan Zhai, Shanhe Zhang, Zhihua Wu, Zhijun Li",
    year: "2024",
    doi: "10.1093/hr/uhae034",
    url: "https://academic.oup.com/hr/article/11/3/uhae034/7601711",
    theme: "适应演化",
    group: "灰杨抗逆",
    summary:
      "构建灰杨染色体级基因组并结合群体基因组分析，解释灰杨适应荒漠化环境的遗传基础。",
  },
  {
    journal: "Industrial Crops and Products",
    mark: "Ind Crops",
    volume: "2024",
    impact: "Epigenetics",
    title:
      "DNA methylation profile revealed the dynamically epigenetic regulation of the distinct heteromorphic leaf development in Populus euphratica",
    authors:
      "Chen Qiu, Shuo Liu, Jianhao Sun, Zhongshuai Gai, Xiaoli Han, Peipei Jiao, Juntuan Zhai, Zhijun Li",
    year: "2024",
    doi: "10.1016/j.indcrop.2024.118688",
    url: "https://doi.org/10.1016/j.indcrop.2024.118688",
    theme: "异形叶发育",
    group: "表观遗传",
    summary:
      "从 DNA 甲基化视角解析胡杨异形叶发育的动态表观调控，为理解叶片形态适应提供证据链。",
  },
  {
    journal: "International Journal of Molecular Sciences",
    mark: "IJMS",
    volume: "2026",
    impact: "Gene Family",
    title:
      "Genome-Wide Identification of the WOX Gene Family in Three Populus Species and Expression Profiling of Populus euphratica and Populus pruinosa Under Abiotic Stresses",
    authors:
      "Chen Qiu, Xinyue Long, Zhongshuai Gai, Xiaoli Han, Jia Song, Yuqi Yang, Jianhao Sun, Zhijun Li",
    year: "2026",
    doi: "10.3390/ijms27135999",
    url: "https://doi.org/10.3390/ijms27135999",
    theme: "抗逆机制",
    group: "WOX 基因家族",
    summary:
      "系统鉴定胡杨、灰杨等杨属植物 WOX 基因家族，分析其在非生物胁迫下的表达响应。",
  },
  {
    journal: "Journal of Forestry Research",
    mark: "J Forestry",
    volume: "2020",
    impact: "Transcriptome",
    title:
      "Short-term transcriptomic responses of Populus euphratica roots and leaves to drought stress",
    authors:
      "Peipei Jiao, Zhihua Wu, Xu Wang, Zhenbo Jiang, Yanqin Wang, Hong Liu, Rui Qin, Zhijun Li",
    year: "2020",
    doi: "10.1007/s11676-020-01123-9",
    url: "https://doi.org/10.1007/s11676-020-01123-9",
    theme: "干旱响应",
    group: "转录组",
    summary:
      "比较胡杨根和叶在短期干旱胁迫下的转录响应，为抗旱机制研究和保护育种提供分子线索。",
  },
  {
    journal: "Frontiers in Genetics",
    mark: "Frontiers",
    volume: "2019",
    impact: "Salt Stress",
    title:
      "Transcriptomic Analysis of Seed Germination Under Salt Stress in Two Desert Sister Species (Populus euphratica and P. pruinosa)",
    authors:
      "Caihua Zhang, Wenchun Luo, Yanda Li, Xu Zhang, Xiaotao Bai, Zhimin Niu, Xiao Zhang, Zhijun Li",
    year: "2019",
    doi: "10.3389/fgene.2019.00231",
    url: "https://doi.org/10.3389/fgene.2019.00231",
    theme: "盐胁迫",
    group: "种子萌发",
    summary:
      "比较胡杨和灰杨种子萌发阶段对盐胁迫的转录组响应，支撑干旱区姐妹种抗逆差异研究。",
  },
];

export const knowledgeThemes = [
  {
    title: "异形叶发育",
    description:
      "围绕窄叶、阔叶及不同冠层叶片形态，串联转录组、表观遗传和生态功能证据，解释胡杨如何在强光、干旱、盐碱和水分梯度中形成兼顾抗逆与光合效率的叶形策略。",
  },
  {
    title: "雌雄基因组",
    description:
      "以胡杨雌雄染色体级基因组为基础，聚焦 Y 染色体性别连锁区、ARR17 相关调控线索和性别鉴定分子标记，呈现从基础研究到精准造林应用的转化路径。",
  },
  {
    title: "群体遗传",
    description:
      "连接种质资源采集、核心保护单元、区域群体分化和遗传多样性评估，支撑天然胡杨林保护、退化群落修复与优异种质筛选。",
  },
  {
    title: "灰杨抗逆",
    description:
      "从灰杨基因组、盐旱胁迫响应和种间比较入手，补充胡杨林生态系统中近缘种荒漠适应研究，为抗逆机制解析提供参照。",
  },
];

export const knowledgeValueCards = [
  {
    value: "61%",
    label: "我国胡杨林面积约占全球比例",
    detail: "胡杨是全球干旱区河岸林生态系统中极具代表性的建群树种。",
  },
  {
    value: "89%",
    label: "新疆塔里木河流域分布占比",
    detail: "塔里木河流域是我国胡杨林集中分布和保护修复的关键区域。",
  },
  {
    value: "4000+",
    label: "胡杨种质资源积累",
    detail:
      "长期野外调查、样本采集和资源保存工作为种质资源保护和精准利用提供基础。",
  },
  {
    value: "43",
    label: "遗传多样性保护单元",
    detail: "保护单元划定有助于支撑天然胡杨林资源的精细化保育。",
  },
];

export const knowledgeGraphLegend = [
  { group: "hub", label: "知识枢纽" },
  { group: "genome", label: "基因组与性别决定" },
  { group: "stress", label: "抗逆与适应演化" },
  { group: "leaf", label: "异形叶与表观调控" },
  { group: "conservation", label: "保护利用与监测" },
];

export const knowledgeGraphClusters = [
  { group: "genome", label: "基因组机制" },
  { group: "leaf", label: "异形叶调控" },
  { group: "stress", label: "抗逆适应" },
  { group: "conservation", label: "保护应用" },
];

export const knowledgeGraphNodes = [
  {
    id: "hub",
    label: "胡杨知识体系",
    group: "hub",
    x: 50,
    y: 50,
    detail:
      "以科研论文和平台数据为入口，汇聚基因组机制、异形叶调控、抗逆适应和保护应用四类知识。",
  },
  {
    id: "genome",
    label: "胡杨雌雄基因组",
    group: "genome",
    x: 50,
    y: 13,
    detail: "染色体级组装连接性别决定和性二态研究。",
  },
  {
    id: "slr",
    label: "性别连锁区 SLR",
    group: "genome",
    x: 31,
    y: 24,
    detail: "定位 Y 染色体关键区域，支撑性别鉴定标记开发。",
  },
  {
    id: "arr17",
    label: "ARR17 相关机制",
    group: "genome",
    x: 69,
    y: 24,
    detail: "关注甲基化与性别表达调控线索。",
  },
  {
    id: "marker",
    label: "性别鉴定标记",
    group: "genome",
    x: 50,
    y: 36,
    detail: "服务苗期雌雄识别和精准造林配置。",
  },
  {
    id: "leaf",
    label: "异形叶发育",
    group: "leaf",
    x: 18,
    y: 38,
    detail: "解释下层窄叶和上层阔叶的功能分化。",
  },
  {
    id: "methyl",
    label: "DNA 甲基化",
    group: "leaf",
    x: 30,
    y: 53,
    detail: "表观调控连接叶形变化与逆境适应。",
  },
  {
    id: "transcriptome",
    label: "转录组响应",
    group: "leaf",
    x: 18,
    y: 68,
    detail: "连接叶片形态变化、根叶响应和逆境下的表达调控。",
  },
  {
    id: "stress",
    label: "盐旱胁迫响应",
    group: "stress",
    x: 82,
    y: 38,
    detail: "组织转录组、基因家族和生理响应证据。",
  },
  {
    id: "wox",
    label: "WOX 基因家族",
    group: "stress",
    x: 70,
    y: 53,
    detail: "补充胡杨和灰杨在非生物胁迫下的基因家族表达线索。",
  },
  {
    id: "pruinosa",
    label: "灰杨荒漠适应",
    group: "stress",
    x: 82,
    y: 68,
    detail: "通过灰杨基因组补充姐妹种荒漠适应研究。",
  },
  {
    id: "germplasm",
    label: "种质资源保育",
    group: "conservation",
    x: 50,
    y: 84,
    detail: "连接样本采集、保护单元和资源评价。",
  },
  {
    id: "monitoring",
    label: "遥感与样地监测",
    group: "conservation",
    x: 31,
    y: 82,
    detail: "支撑宏观分布、退化识别和恢复成效跟踪。",
  },
  {
    id: "restoration",
    label: "生态修复应用",
    group: "conservation",
    x: 69,
    y: 82,
    detail: "将性别鉴定、种质选择和监测评估转化为恢复配置策略。",
  },
];

export const knowledgeGraphEdges = [
  { from: "genome", to: "slr", tone: "genome", label: "定位", bend: -2 },
  { from: "genome", to: "arr17", tone: "genome", label: "调控", bend: 2 },
  { from: "slr", to: "marker", tone: "genome", label: "标记", bend: 1 },
  { from: "arr17", to: "marker", tone: "genome", label: "表达", bend: -1 },
  { from: "marker", to: "hub", tone: "genome", label: "转化", bend: 0 },
  { from: "leaf", to: "methyl", tone: "leaf", label: "表观调控", bend: -1 },
  {
    from: "methyl",
    to: "transcriptome",
    tone: "leaf",
    label: "表达响应",
    bend: 1,
  },
  { from: "methyl", to: "hub", tone: "leaf", label: "叶形机制", bend: 3 },
  { from: "hub", to: "wox", tone: "stress", label: "抗逆机制", bend: -3 },
  { from: "stress", to: "wox", tone: "stress", label: "基因响应", bend: 1 },
  { from: "wox", to: "pruinosa", tone: "stress", label: "适应演化", bend: -1 },
  {
    from: "hub",
    to: "germplasm",
    tone: "conservation",
    label: "资源沉淀",
    bend: 0,
  },
  {
    from: "monitoring",
    to: "germplasm",
    tone: "conservation",
    label: "监测评估",
    bend: -2,
  },
  {
    from: "germplasm",
    to: "restoration",
    tone: "conservation",
    label: "修复应用",
    bend: 2,
  },
];

export const knowledgeMechanisms = [
  {
    title: "胡杨性别决定机制图解",
    description:
      "基于雌雄染色体级基因组研究，页面将性别决定过程拆解为基因组组装、Y 染色体性别连锁区定位、ARR17 相关甲基化线索和性别鉴定分子标记四个层级，帮助用户理解科研成果如何转化为苗期识别能力。",
    source: "Communications Biology, 2022",
    tone: "genome",
    tags: ["Y 染色体", "SLR", "ARR17", "DNA 分子标记"],
    steps: [
      "雌雄基因组组装",
      "定位性别连锁区",
      "解析甲基化线索",
      "开发鉴定标记",
    ],
  },
  {
    title: "异形叶发育调控网络",
    description:
      "围绕胡杨下层窄叶、上层阔叶以及不同冠层梯度下的形态分化，页面以转录组、DNA 甲基化和生态功能为线索，说明异形叶如何在抗逆、防失水和光合效率之间形成适应性平衡。",
    source: "Industrial Crops and Products, 2024",
    tone: "leaf",
    tags: ["异形叶", "转录组", "DNA 甲基化", "冠层梯度"],
    steps: ["环境梯度", "叶形分化", "多组学调控", "生态适应"],
  },
  {
    title: "灰杨荒漠适应与抗逆响应",
    description:
      "灰杨作为胡杨林生态系统中的重要近缘种，其基因组和群体遗传研究揭示了荒漠化环境适应路径；结合盐旱胁迫响应研究，可为抗逆新种质培育和区域生态修复提供比较视角。",
    source: "Horticulture Research, 2024 / IJMS, 2026",
    tone: "stress",
    tags: ["灰杨基因组", "WOX 基因", "盐旱胁迫", "荒漠适应"],
    steps: ["灰杨基因组", "群体分化", "胁迫表达", "抗逆利用"],
  },
];

export type HelpArticleBlock =
  | {
      type: "steps";
      title: string;
      items: { title: string; description: string }[];
    }
  | {
      type: "bullets" | "checklist";
      title: string;
      items: string[];
    }
  | {
      type: "note";
      title: string;
      body: string;
    }
  | {
      type: "table";
      title: string;
      columns: string[];
      rows: string[][];
    };

export type HelpArticle = {
  id: string;
  category: string;
  title: string;
  summary: string;
  audiences: string[];
  tags: string[];
  blocks: HelpArticleBlock[];
};

export const helpDocumentDownload = {
  label: "下载 PDF 帮助文档",
  href: `${import.meta.env.BASE_URL}docs/CAPFED-help-center.pdf`,
  filename: "中亚胡杨林生态系统保护数据共享平台帮助文档.pdf",
  meta: "v1.1 / 2026-07-17 / 适用于培训、验收和离线阅读",
};

export const helpQuickLinks = [
  { label: "快速入门", articleId: "quick-start" },
  { label: "空间查询", articleId: "spatial-query" },
  { label: "数据导入", articleId: "data-import" },
  { label: "权限日志", articleId: "permission-audit" },
];

export const helpAudienceCards = [
  {
    title: "普通用户",
    description: "浏览授权数据、加载图层、查看属性、执行基础查询。",
  },
  {
    title: "科研用户",
    description: "提交数据、导出结果、保存工程和沉淀专题成果。",
  },
  {
    title: "数据管理员",
    description: "维护存量数据、默认样式、分组、访问范围和专题。",
  },
  {
    title: "系统管理员",
    description: "管理账号、角色、日志、系统设置和数据备份。",
  },
];

export const helpCategories = [
  {
    title: "入门指南",
    items: [
      { label: "平台导览", articleId: "platform-guide" },
      { label: "快速入门", articleId: "quick-start" },
      { label: "账号、角色与权限", articleId: "account-roles" },
    ],
  },
  {
    title: "空间分析",
    items: [
      { label: "地理数据工作台", articleId: "map-workbench" },
      { label: "空间查询工作台", articleId: "spatial-query" },
      { label: "属性查询与图层", articleId: "attribute-layer" },
    ],
  },
  {
    title: "数据管理",
    items: [
      { label: "数据导入", articleId: "data-import" },
      { label: "数据准备规范", articleId: "data-standards" },
      { label: "存量数据维护", articleId: "data-inventory" },
      { label: "工程与专题管理", articleId: "project-topic" },
    ],
  },
  {
    title: "后台管理",
    items: [
      { label: "后台运行概览", articleId: "admin-management" },
      { label: "权限与日志", articleId: "permission-audit" },
      { label: "备份与安全", articleId: "backup-security" },
    ],
  },
];

export const helpArticles: HelpArticle[] = [
  {
    id: "platform-guide",
    category: "入门指南",
    title: "平台导览",
    summary:
      "说明平台的整体结构、顶部导航和常用入口，帮助新用户先建立完整的使用地图。",
    audiences: ["普通用户", "科研用户", "数据管理员", "系统管理员"],
    tags: ["导航", "模块入口", "全局搜索"],
    blocks: [
      {
        type: "table",
        title: "主要入口",
        columns: ["入口", "用途"],
        rows: [
          [
            "地理数据",
            "进入地图工作台，完成空间数据浏览、图层加载、属性查询和空间查询。",
          ],
          ["非地理数据", "查看表格、基因组、分子实验和统计指标等非空间数据。"],
          ["数据管理", "维护数据概览、存量数据、工程、专题和数据导入任务。"],
          ["后台管理", "管理用户权限、运行概览、日志、系统设置和数据备份。"],
          ["关于我们", "查看系统简介、团队资料、胡杨知识和帮助文档。"],
        ],
      },
      {
        type: "bullets",
        title: "使用顺序",
        items: [
          "首次使用先确认账号角色和可见菜单。",
          "浏览数据时优先使用全局搜索和地理数据工作台。",
          "需要提交数据时进入数据管理中的数据导入页面。",
          "需要共享成果时先保存工程，再按业务场景发布专题。",
        ],
      },
      {
        type: "note",
        title: "当前实现说明",
        body: "智能解译为后续模型服务预留入口；非地理数据页已经提供分析框架，正式使用时应接入真实业务数据。",
      },
    ],
  },
  {
    id: "quick-start",
    category: "入门指南",
    title: "快速入门",
    summary:
      "用最短路径完成登录、数据浏览、空间查询和结果处理，适合普通用户和科研用户首次上手。",
    audiences: ["普通用户", "科研用户"],
    tags: ["首次登录", "数据浏览", "查询结果"],
    blocks: [
      {
        type: "steps",
        title: "首次使用流程",
        items: [
          {
            title: "登录平台",
            description:
              "打开系统地址，输入账号和密码。若平台开放注册，可按页面入口创建普通账号。",
          },
          {
            title: "进入地理数据",
            description:
              "通过顶部导航进入地图工作台，在左侧数据面板检索资源并查看元数据。",
          },
          {
            title: "加载图层",
            description:
              "选择可渲染或可查询资源，点击快速加载或查询并加载，资源会进入图层树。",
          },
          {
            title: "查看结果",
            description:
              "在右侧信息面板查看资源、图层、地图视角和选中要素属性，按权限进行导出。",
          },
        ],
      },
      {
        type: "checklist",
        title: "首次使用检查",
        items: [
          "确认当前账号角色和可访问菜单。",
          "确认需要查看的数据资源是否在可见范围内。",
          "保存常用工程或专题，方便后续恢复工作场景。",
        ],
      },
    ],
  },
  {
    id: "account-roles",
    category: "入门指南",
    title: "账号、角色与权限",
    summary:
      "说明平台面向普通用户、科研用户、数据管理员和系统管理员的使用边界，以及系统内置角色与权限关系。",
    audiences: ["普通用户", "科研用户", "数据管理员", "系统管理员"],
    tags: ["角色", "权限", "账号安全"],
    blocks: [
      {
        type: "table",
        title: "角色分工",
        columns: ["角色", "主要任务"],
        rows: [
          ["游客", "查看明确公开共享的数据或专题。"],
          ["普通用户", "浏览授权数据、加载图层、查看属性和执行基础查询。"],
          ["科研用户", "提交数据、导出结果、保存工程、整理专题成果。"],
          ["平台管理员", "维护数据资源、工程专题、日志和日常运行配置。"],
          ["超级管理员", "维护系统根权限、认证授权、系统设置和备份。"],
        ],
      },
      {
        type: "note",
        title: "权限口径",
        body: "平台采用功能权限和数据可见范围双重控制。按钮隐藏只是体验优化，最终权限以后端校验和账号实际授权为准。",
      },
    ],
  },
  {
    id: "map-workbench",
    category: "空间分析",
    title: "地理数据工作台",
    summary: "介绍地图主视图、左侧数据面板、右侧信息面板和图层树的协作方式。",
    audiences: ["普通用户", "科研用户", "数据管理员"],
    tags: ["地图", "图层", "资源目录"],
    blocks: [
      {
        type: "bullets",
        title: "工作台组成",
        items: [
          "地图主视图：承载地图浏览、要素点击、范围绘制和图层渲染。",
          "左侧数据面板：支持关键字、业务类型、数据类型、来源和日期范围筛选。",
          "图层页签：管理已加载图层和图层组，支持显示隐藏、定位、数据表、符号化、导出和移除。",
          "右侧信息面板：展示选中资源、图层、要素和地图视角信息。",
        ],
      },
      {
        type: "note",
        title: "栅格渲染边界",
        body: "栅格文件的符号化和瓦片生成由后端完成，前端只加载后端输出的影像或瓦片服务。",
      },
    ],
  },
  {
    id: "spatial-query",
    category: "空间分析",
    title: "空间查询工作台",
    summary: "说明如何定义空间范围、选择查询对象、执行查询并处理空间查询结果。",
    audiences: ["普通用户", "科研用户", "数据管理员"],
    tags: ["空间范围", "GeoJSON", "查询结果"],
    blocks: [
      {
        type: "steps",
        title: "查询流程",
        items: [
          {
            title: "定义查询范围",
            description:
              "使用矩形、圆形、椭圆、多边形、当前视图、图层范围或导入 GeoJSON 定义空间区域。",
          },
          {
            title: "选择查询对象",
            description:
              "从资源目录选择可查询矢量资源，或从已加载矢量图层中选择当前工作对象。",
          },
          {
            title: "执行查询",
            description:
              "点击执行查询后查看命中数量、返回数量、耗时、结果边界和数据质量警告。",
          },
          {
            title: "处理结果",
            description:
              "将结果加载为图层、定位到结果范围、打开属性表、导出数据或清空当前查询。",
          },
        ],
      },
      {
        type: "checklist",
        title: "无结果排查",
        items: [
          "确认查询对象是可查询矢量资源，栅格图层不能作为空间查询对象。",
          "确认绘制范围与目标资源的空间范围存在交集。",
          "确认资源处于启用状态，且当前账号有访问和查询权限。",
          "若结果被截断，可缩小范围或叠加属性条件后再次查询。",
        ],
      },
    ],
  },
  {
    id: "attribute-layer",
    category: "空间分析",
    title: "属性查询与图层管理",
    summary: "说明属性条件筛选、结果加载、图层排序、符号化和导出等常用工作流。",
    audiences: ["普通用户", "科研用户"],
    tags: ["属性筛选", "图层树", "导出"],
    blocks: [
      {
        type: "steps",
        title: "属性查询",
        items: [
          {
            title: "选择可查询资源",
            description: "在数据面板中选择矢量资源并查看字段列表。",
          },
          {
            title: "添加字段条件",
            description:
              "选择字段、运算符和值，支持包含、等于、不等于、大于、小于和介于等条件。",
          },
          {
            title: "查询并加载",
            description:
              "执行查询后将结果加入图层树，并在属性表中继续查看或导出。",
          },
        ],
      },
      {
        type: "bullets",
        title: "图层常用操作",
        items: [
          "保存为工程：保存当前图层组合、视角和状态。",
          "保存为专题：围绕特定业务场景共享图层组合和展示状态。",
          "符号化：调整矢量或栅格图层样式；栅格重新符号化会触发后端渲染。",
          "移除图层：只从当前工作台移除，不删除原始数据资源。",
        ],
      },
    ],
  },
  {
    id: "data-import",
    category: "数据管理",
    title: "数据导入",
    summary:
      "说明表格数据、空间点表和栅格数据导入流程，以及导入前的数据准备建议。",
    audiences: ["科研用户", "数据管理员"],
    tags: ["CSV", "Excel", "栅格", "字段映射"],
    blocks: [
      {
        type: "table",
        title: "支持类型",
        columns: ["类型", "格式", "处理方式"],
        rows: [
          ["表格", "CSV、XLS、XLSX", "导入为空间点表或普通属性表。"],
          [
            "栅格",
            "TIF、TIFF、IMG、VRT、DAT、BSQ、BIL、BIP",
            "预检后上传，后台预处理为可切片渲染的数据集。",
          ],
          [
            "矢量",
            "GeoJSON、JSON、GPKG、KML、KMZ、SHP、ZIP",
            "执行图层、编码、坐标系和几何质量预检后入库。",
          ],
        ],
      },
      {
        type: "steps",
        title: "通用流程",
        items: [
          {
            title: "选择文件",
            description: "拖拽或选择文件，系统会根据扩展名进入对应导入流程。",
          },
          {
            title: "填写资源信息",
            description:
              "补充名称、来源、提供单位、业务类型、数据日期、访问范围和说明。",
          },
          {
            title: "确认结构与质量",
            description:
              "表格确认字段和坐标，栅格确认波段和规则，矢量确认坐标系和几何质量。",
          },
          {
            title: "提交导入",
            description:
              "完成校验、入库或预处理后，到存量数据中继续维护默认样式和权限。",
          },
        ],
      },
    ],
  },
  {
    id: "data-standards",
    category: "数据管理",
    title: "数据准备规范",
    summary:
      "说明导入前应整理的数据名称、字段、坐标、元数据和敏感信息，减少后续返工。",
    audiences: ["科研用户", "数据管理员"],
    tags: ["命名", "字段", "坐标", "元数据"],
    blocks: [
      {
        type: "bullets",
        title: "命名与字段",
        items: [
          "推荐使用“区域 + 对象 + 指标/主题 + 时间/批次”的命名方式。",
          "一列只表达一种含义，数值字段不要混入单位、备注或中文说明。",
          "日期字段统一为 YYYY-MM-DD，样地、样本、个体和监测点编号应长期稳定。",
        ],
      },
      {
        type: "checklist",
        title: "导入前检查",
        items: [
          "经纬度是否为十进制度，坐标精度是否一致。",
          "来源单位、采集日期、调查人员和质量说明是否完整。",
          "敏感样地、内部资料和未公开成果是否设置了合适的访问范围。",
        ],
      },
    ],
  },
  {
    id: "data-inventory",
    category: "数据管理",
    title: "存量数据维护",
    summary:
      "帮助数据管理员理解数据资源列表、启停状态、访问角色、默认可视化和导出能力。",
    audiences: ["数据管理员", "系统管理员"],
    tags: ["资源清单", "访问范围", "默认可视化"],
    blocks: [
      {
        type: "bullets",
        title: "维护事项",
        items: [
          "按关键字、数据类型、业务分类、来源和启用状态筛选存量资源。",
          "创建自定义组别，拖拽资源到组别中；删除组别不会删除数据。",
          "维护资源名称、摘要、来源、提供单位、数据日期、访问角色和启停状态。",
          "配置默认可视化 JSON，便于用户快速加载统一样式。",
          "导出 CSV 或 XLSX 清单，用于数据盘点和项目验收材料。",
        ],
      },
      {
        type: "note",
        title: "删除确认",
        body: "删除资源会移除资源登记和关联图层；用户导入的表或矢量图层会同步清理。删除前应确认备份与业务影响。",
      },
    ],
  },
  {
    id: "project-topic",
    category: "数据管理",
    title: "工程与专题管理",
    summary:
      "说明工程和专题的区别、适用场景，以及在数据管理中心维护共享范围的方式。",
    audiences: ["科研用户", "数据管理员"],
    tags: ["工程", "专题", "共享"],
    blocks: [
      {
        type: "bullets",
        title: "概念区别",
        items: [
          "工程：更偏个人或团队工作状态，保存图层组合、地图视角、符号化和分析上下文。",
          "专题：更偏业务展示和成果共享，围绕特定保护、监测或科研主题组织图层。",
          "访问角色：工程和专题均可配置可见用户组，避免未授权内容被加载。",
        ],
      },
      {
        type: "checklist",
        title: "发布前检查",
        items: [
          "图层名称、顺序和样式是否清晰。",
          "专题说明是否写明数据来源、时间范围和适用场景。",
          "访问角色是否与数据授权范围一致。",
        ],
      },
    ],
  },
  {
    id: "admin-management",
    category: "后台管理",
    title: "后台运行概览",
    summary:
      "介绍后台管理入口中的运行概览、个人设置、系统设置和管理员常用维护动作。",
    audiences: ["系统管理员", "数据管理员"],
    tags: ["运行概览", "系统设置", "维护"],
    blocks: [
      {
        type: "bullets",
        title: "后台模块",
        items: [
          "运行概览：查看资源数量、导入任务、用户状态、日志摘要和系统健康信息。",
          "个人设置：维护个人资料、安全信息和登录状态。",
          "系统设置：配置注册开关、地图中心、上传上限、查询上限、底图和运行参数。",
          "数据备份：发起或查看备份任务，确认业务数据和研究数据的保护状态。",
        ],
      },
      {
        type: "note",
        title: "权限边界",
        body: "前端按钮是否显示只用于提升易用性，敏感操作仍必须由后端权限校验兜底。",
      },
    ],
  },
  {
    id: "permission-audit",
    category: "后台管理",
    title: "权限与日志",
    summary: "说明用户、角色、权限组、操作日志和系统日志的管理重点。",
    audiences: ["系统管理员"],
    tags: ["用户权限", "操作日志", "审计"],
    blocks: [
      {
        type: "table",
        title: "认证授权内容",
        columns: ["对象", "管理内容"],
        rows: [
          ["用户", "新建、启停、重置密码、调整角色、设置单独权限、查看日志。"],
          ["科研用户申请", "查看待审核申请，通过或拒绝申请。"],
          ["角色", "查看内置角色基线，新建自定义角色，维护功能权限。"],
          ["日志范围", "配置指定用户可查看哪些角色的操作日志。"],
        ],
      },
      {
        type: "bullets",
        title: "管理重点",
        items: [
          "用户管理：创建账号、调整角色、启用或禁用用户，并查看用户基础信息。",
          "用户组管理：通过角色和权限组控制菜单、数据资源、导出、导入和后台功能。",
          "操作日志：追踪登录、导入、导出、权限调整、配置修改和删除等关键动作。",
          "系统日志：用于排查运行异常、导入失败、后台任务错误和接口问题。",
        ],
      },
      {
        type: "checklist",
        title: "审计建议",
        items: [
          "定期检查管理员账号和高权限用户列表。",
          "排查频繁失败登录、异常导出和集中删除操作。",
          "重要配置变更前后保留日志截图或导出记录。",
        ],
      },
    ],
  },
  {
    id: "backup-security",
    category: "后台管理",
    title: "备份与数据安全",
    summary: "说明平台数据生命周期、备份策略和安全使用建议。",
    audiences: ["数据管理员", "系统管理员"],
    tags: ["备份", "数据安全", "生命周期"],
    blocks: [
      {
        type: "steps",
        title: "数据生命周期",
        items: [
          {
            title: "准备",
            description:
              "整理原始文件、字段说明、坐标系、来源单位、时间范围和质量说明。",
          },
          {
            title: "导入",
            description:
              "通过数据导入页面完成校验、入库、栅格预处理和访问范围配置。",
          },
          {
            title: "维护",
            description:
              "在存量数据中更新元数据、启停状态、默认可视化和授权范围。",
          },
          {
            title: "归档",
            description:
              "阶段性导出数据清单，结合后台备份任务保存业务数据和研究数据。",
          },
        ],
      },
      {
        type: "checklist",
        title: "安全建议",
        items: [
          "不要把业务数据根目录或研究数据根目录硬编码到前端代码或公开文档中。",
          "敏感数据仅授予必要角色可见，导出权限应独立控制。",
          "删除、权限调整和系统设置变更前确认备份状态。",
        ],
      },
    ],
  },
];

export const helpFaq = [
  {
    question: "导入数据前最容易忽略什么？",
    answer:
      "最容易忽略字段含义、坐标系、采集日期和访问范围。建议在导入前先补齐字段说明、来源单位、数据日期和敏感信息判断。",
  },
  {
    question: "空间查询没有结果时应如何排查？",
    answer:
      "先确认查询对象是可查询矢量资源，再检查绘制范围是否与资源空间范围相交、资源是否启用、账号是否有权限，以及左侧属性条件是否过严。",
  },
  {
    question: "同名数据继续导入会覆盖旧数据吗？",
    answer:
      "不会。系统会创建新的数据记录。为便于后续管理，建议在名称中加入区域、日期、批次或版本号。",
  },
  {
    question: "管理员如何为用户分配数据查看权限？",
    answer:
      "在后台用户与用户组管理中维护角色，再在数据资源、工程或专题中配置访问角色。前端可见性不是最终安全边界，后端仍会校验权限。",
  },
  {
    question: "帮助文档 PDF 可以离线使用吗？",
    answer:
      "可以。页面提供 PDF 下载按钮，适用于培训、验收附件和离线阅读。平台功能继续迭代后，应同步更新 PDF 文件。",
  },
];

export function aboutSectionByKey(key: string | undefined) {
  return (
    aboutSections.find((section) => section.key === key) ?? aboutSections[0]!
  );
}
