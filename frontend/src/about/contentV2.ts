import liJunliPortrait from "../assets/about/lijunli-portrait.jpeg";
import liZhijunPortrait from "../assets/about/lizhijun-portrait.jpeg";
import memberResearchSeedlingsImage from "../assets/about/member-research-seedlings.png";
import poplarWaterGoldenImage from "../assets/about/poplar-water-golden.jpeg";
import siJianhuaPortrait from "../assets/about/sijianhua-portrait.jpeg";
import tarimCarbonAnalysisImage from "../assets/about/tarim-carbon-analysis.png";
import teamGreenhouseImage from "../assets/about/team-greenhouse.png";
import xjafsMonitoringTowerImage from "../assets/about/xjafs-monitoring-tower.png";
import xjafsSeedBaseImage from "../assets/about/xjafs-seed-base.png";

export type InstitutionMember = {
  name: string;
  role: string;
  focus: string;
};

export type InstitutionProfile = {
  id: string;
  shortName: string;
  name: string;
  eyebrow: string;
  leader: string;
  leaderTitle: string;
  email?: string;
  positioning: string;
  summary: string;
  focusAreas: string[];
  contributions: string[];
  metrics: { value: string; label: string }[];
  publications: { title: string; meta: string; url?: string }[];
  members: InstitutionMember[];
  heroImage: string;
  portrait?: string;
  gallery: { src: string; alt: string; caption: string }[];
  sourceUrl?: string;
};

export const institutionProfiles: InstitutionProfile[] = [
  {
    id: "tarim-university",
    shortName: "塔里木大学",
    name: "塔里木大学 · 李志军教授团队",
    eyebrow: "牵头建设 · 保护生物学与种质资源",
    leader: "李志军",
    leaderTitle: "教授、博士研究生导师、二级岗位教授",
    email: "lizhijun0202@126.com",
    positioning:
      "贯通基因、种质、苗木、群落、流域与数据平台的胡杨保护科研主线。",
    summary:
      "团队依托塔里木大学生命科学与技术学院，面向西北五省及中亚干旱区胡杨林分布区，长期开展胡杨、灰杨保护生物学与生态修复研究。工作覆盖种质资源调查保存、抗逆与性别决定机制、繁殖更新、水分管理、科普培训和科研数据沉淀，并牵头建设本平台。",
    focusAreas: [
      "胡杨种质资源收集、保存、评价与核心种质构建",
      "胡杨抗逆分子机制、性别决定与异形叶发育",
      "天然胡杨林更新复壮、水分调控与精准造林",
      "野外调查、遥感监测与科研成果数字化沉淀",
    ],
    contributions: [
      "提出“引水漂种 + 水量调控 + 人工辅助播种”技术体系。",
      "利用分子标记实现胡杨苗期雌雄无损鉴别，服务精准造林。",
      "长期深入西北胡杨分布区，持续积累种质资源与野外调查资料。",
      "推动胡杨、灰杨基因组学、群体遗传与多维保育恢复研究。",
    ],
    metrics: [
      { value: "30+", label: "国家及省部级项目" },
      { value: "100+", label: "学术论文" },
      { value: "32", label: "SCI 收录论文" },
      { value: "6", label: "授权发明专利" },
    ],
    publications: [
      {
        title:
          "Chromosome-scale assemblies of the male and female Populus euphratica genomes reveal the molecular basis of sex determination and sexual dimorphism",
        meta: "Communications Biology · 2022",
        url: "https://doi.org/10.1038/s42003-022-04145-7",
      },
      {
        title:
          "The chromosome-scale genome and population genomics reveal the adaptative evolution of Populus pruinosa to desertification environment",
        meta: "Horticulture Research · 2024",
        url: "https://doi.org/10.1093/hr/uhae034",
      },
    ],
    members: [
      {
        name: "焦培培",
        role: "科研骨干",
        focus: "胡杨遗传多样性、种质资源评价与分子机制",
      },
      {
        name: "格明古丽·木哈台",
        role: "科研骨干",
        focus: "胡杨资源保护、区域植物资源调查与合作交流",
      },
      {
        name: "盖中帅",
        role: "青年研究人员",
        focus: "群体遗传、核心保护单元与异形叶研究",
      },
      {
        name: "翟军团",
        role: "科研骨干",
        focus: "克隆繁殖、群体结构、生态遗传与种群适应",
      },
      {
        name: "张山河",
        role: "科研成员",
        focus: "胡杨基因组、保护生物学与科研协同",
      },
    ],
    heroImage: teamGreenhouseImage,
    portrait: liZhijunPortrait,
    gallery: [
      {
        src: memberResearchSeedlingsImage,
        alt: "李志军教授在温室查看胡杨苗木",
        caption: "从种质保存到苗木培育，研究贯通实验室与生态修复现场。",
      },
    ],
    sourceUrl: "https://www.taru.edu.cn/info/1044/20997.htm",
  },
  {
    id: "xieg-cas",
    shortName: "新疆生地所",
    name: "中国科学院新疆生态与地理研究所 · 李均力研究员团队",
    eyebrow: "遥感智能监测 · 生态输水评估",
    leader: "李均力",
    leaderTitle: "研究员、博士生导师，新疆遥感与地理信息系统应用重点实验室主任",
    email: "lijl@ms.xjb.ac.cn",
    positioning: "以遥感大数据和人工智能量化胡杨林生态输水成效与生态安全变化。",
    summary:
      "团队长期从事遥感信息提取、干旱区水资源变化与生态环境响应研究，依托空间对地观测、地面验证和系统模拟一体化平台，面向塔里木河流域开展大区域长时序监测、生态输水效益评估和生态安全预警技术研究。",
    focusAreas: [
      "遥感大数据智能处理与长时序产品生产",
      "干旱区生态要素提取与生态安全监测",
      "胡杨林生态输水淹灌范围和恢复效益评估",
      "人工智能辅助流域水资源配置与生态响应分析",
    ],
    contributions: [
      "构建大区域长时序资源环境遥感动态监测技术体系。",
      "“干旱区生态安全监测预警关键技术及应用”获 2024 年新疆科技进步一等奖。",
      "协同开展塔里木河流域胡杨林生态输水效益评估。",
      "监测显示 2023 年补水淹灌面积约 272 万亩，补水区植被覆盖度增加 4.3%。",
    ],
    metrics: [
      { value: "20+", label: "主持科研项目" },
      { value: "90+", label: "发表论文" },
      { value: "3", label: "出版专著" },
      { value: "272万亩", label: "2023 补水淹灌监测" },
    ],
    publications: [
      {
        title:
          "Individual Populus euphratica tree detection in sparse desert forests based on constrained 2D bin packing",
        meta: "IEEE TGRS · 2024",
        url: "https://doi.org/10.1109/TGRS.2024.3391352",
      },
      {
        title:
          "Ecological restoration trajectory of the Taitema Lake wetland in arid northwest China",
        meta: "Ecological Indicators · 2024",
        url: "https://doi.org/10.1016/j.ecolind.2024.111956",
      },
      {
        title:
          "Vegetation growth improvement inadequately represents the ecological restoration of the Populus euphratica forests in Xinjiang, China",
        meta: "Ecological Indicators · 2025",
        url: "https://doi.org/10.1016/j.ecolind.2025.113086",
      },
    ],
    members: [
      {
        name: "包安明",
        role: "研究员",
        focus: "干旱区水资源遥感与生态响应评估",
      },
      {
        name: "刘铁",
        role: "助理研究员",
        focus: "生态输水效益评估与遥感数据处理",
      },
    ],
    heroImage: poplarWaterGoldenImage,
    portrait: liJunliPortrait,
    gallery: [
      {
        src: tarimCarbonAnalysisImage,
        alt: "塔河中游胡杨林区碳源区分析界面",
        caption: "遥感与模型分析为胡杨林生态成效评估提供量化证据。",
      },
    ],
    sourceUrl:
      "http://www.egi.cas.cn/sourcedb/zw/zjrc/201703/t20170310_4757075.html",
  },
  {
    id: "xjafs",
    shortName: "新疆林科院",
    name: "新疆林业科学院 · 造林治沙研究所",
    eyebrow: "定位观测 · 更新复壮 · 碳水通量",
    leader: "王新英",
    leaderTitle: "新疆塔里木河胡杨林生态系统定位观测研究站站长、副研究员",
    email: "xjauwxy@126.com",
    positioning:
      "依托国家定位观测站开展胡杨林碳水循环、生态修复与长期管护技术研究。",
    summary:
      "造林治沙研究所面向新疆干旱荒漠区生态保护需求，围绕荒漠化防治、防护林体系、山水林田湖草沙一体化修复与林业技术示范开展研究。胡杨林生态站具备土壤、气象、水文、生物多样性和生态功能长期监测能力。",
    focusAreas: [
      "胡杨林生态系统定位观测与长期数据积累",
      "碳水通量监测、碳储量评估与生态水文",
      "胡杨林更新复壮、困难立地造林与生态修复",
      "塔里木河流域生态工程效益评价与技术示范",
    ],
    contributions: [
      "提出胡杨林“活立木枯枝”概念，完善生态系统碳储量估算。",
      "建成胡杨林生态系统碳水通量监测技术平台。",
      "长期监测支撑新疆胡杨林从退化走向系统性复苏。",
      "沙雅县等示范区应用研究成果开展引洪灌溉与更新复壮。",
    ],
    metrics: [
      { value: "20+", label: "生态站科研项目" },
      { value: "30+", label: "发表论文" },
      { value: "11", label: "科研人员" },
      { value: "1400万吨", label: "年固碳量监测推算" },
    ],
    publications: [
      {
        title: "不同林龄胡杨活立木枯枝生物量和化学计量特征",
        meta: "生态学报 · 2017",
        url: "http://dx.doi.org/10.5846/stxb201509171916",
      },
      {
        title: "塔里木河流域天然胡杨林营养积累特征及动态变化",
        meta: "新疆农业科学 · 2018",
        url: "https://doi.org/10.6048/j.issn.1001-4330.2018.06.007",
      },
    ],
    members: [
      {
        name: "鲁天平",
        role: "高级工程师",
        focus: "胡杨林更新复壮与困难立地造林",
      },
      {
        name: "史军辉",
        role: "研究员",
        focus: "胡杨林生态定位观测与森林生态",
      },
      {
        name: "刘茂秀",
        role: "副研究员",
        focus: "胡杨林碳储量评估与生态水文",
      },
    ],
    heroImage: xjafsSeedBaseImage,
    gallery: [
      {
        src: xjafsMonitoringTowerImage,
        alt: "新疆塔里木河流域胡杨林生态系统国家定位观测站森林梯度观测塔",
        caption: "森林梯度观测塔持续记录空气、风、辐射、温湿度等关键指标。",
      },
      {
        src: xjafsSeedBaseImage,
        alt: "胡杨杜鹃种养水久监测样地",
        caption: "长期固定样地连接群落监测、生态功能评价与修复实践。",
      },
    ],
    sourceUrl: "http://xjlky.cn/web/details?typeid=38&id=3030",
  },
  {
    id: "nieer-cas",
    shortName: "中科院西北院",
    name: "中国科学院西北生态环境资源研究院 · 荒漠生态水文团队",
    eyebrow: "荒漠生态水文 · 黑河水量调度",
    leader: "司建华",
    leaderTitle: "研究员、博士生导师，阿拉善荒漠生态水文试验研究站站长",
    email: "jianhuas@lzb.ac.cn",
    positioning: "研究胡杨林生态水文过程、地下水蒸散发与退化生态系统修复调控。",
    summary:
      "团队依托额济纳胡杨林生态水文野外观测站，长期开展黑河下游水量调度、绿洲生态保护、胡杨林水分利用和荒漠绿洲过渡带恢复研究，为我国第二大胡杨林集中分布区的生态安全提供科学依据。",
    focusAreas: [
      "胡杨林生态水文过程与荒漠河岸林耗水机理",
      "地下水蒸散发估算和生态水位调控",
      "黑河下游生态需水关键期与水量调度",
      "退化生态系统修复与风沙防护技术示范",
    ],
    contributions: [
      "开展额济纳胡杨林生态水文过程与修复调控试验示范。",
      "构建荒漠绿洲过渡带“六带一体”风沙防护技术体系。",
      "提出黑河下游额济纳绿洲生态需水关键期与水量调度方案。",
      "建立极端干旱区胡杨根系吸水模型并研发无性繁殖相关技术。",
    ],
    metrics: [
      { value: "10+", label: "固定试验观测场" },
      { value: "123", label: "固定调查点" },
      { value: "13", label: "长期观测专家" },
      { value: "90+", label: "培养研究生" },
    ],
    publications: [
      {
        title: "黑河下游额济纳绿洲生态需水量关键期及水量调度方案研究",
        meta: "中国沙漠 · 2013",
        url: "https://doi.org/10.7522/j.issn.1000-694X.2013.00077",
      },
      {
        title: "胡杨根系分布特征与根系吸水模型建立",
        meta: "地球科学进展 · 2008",
        url: "https://doi.org/10.11867/j.issn.1001-8166.2008.07.0765",
      },
      {
        title: "《荒漠河岸林胡杨水分利用过程及适应策略》",
        meta: "科学出版社 · 2022 · ISBN 9787030734136",
      },
    ],
    members: [
      {
        name: "席海洋",
        role: "研究员",
        focus: "胡杨根系吸水模型与水文水资源",
      },
      {
        name: "苏永红",
        role: "副研究员",
        focus: "生态水文与水-碳耦合循环",
      },
      {
        name: "郭小燕",
        role: "副研究员",
        focus: "荒漠生态系统定位观测与胡杨无性繁殖技术",
      },
    ],
    heroImage: poplarWaterGoldenImage,
    portrait: siJianhuaPortrait,
    gallery: [],
    sourceUrl:
      "https://www.nmg.gov.cn/ztzl/tjlswdrw/staqpz/202510/t20251031_2811126.html",
  },
];

export const institutionById = (id?: string) =>
  institutionProfiles.find((institution) => institution.id === id);

export const speciesArchiveSections = [
  {
    id: "profile",
    index: "01",
    title: "物种名片",
    eyebrow: "认识胡杨",
    summary:
      "胡杨（Populus euphratica Oliver）是荒漠河岸林的建群树种，也是风沙、高温与盐碱环境中少数能够形成天然乔木林的物种。",
    facts: [
      "成年胡杨高达十几米，树皮灰白，种子小于芝麻粒并带冠毛。",
      "同一植株可出现条形、卵形或肾形叶片，具有典型异形叶性。",
      "我国拥有全球约 61% 的胡杨林，其中 90% 以上分布在新疆。",
      "新疆胡杨林又有 90% 以上集中在塔里木河流域。",
    ],
  },
  {
    id: "ecology",
    index: "02",
    title: "生态价值",
    eyebrow: "大漠英雄树",
    summary:
      "胡杨林同时承担碳汇、防风固沙、河岸带稳定与生物多样性维系等多重生态功能，是干旱区绿洲安全的重要屏障。",
    facts: [
      "长期监测推算塔里木河流域胡杨林每年可固碳约 1400 万吨。",
      "庞大根系固定流沙、降低风速，构成塔里木盆地天然绿色屏障。",
      "高分遥感、人工智能与定位站观测正在形成空天地一体化守护体系。",
    ],
  },
  {
    id: "culture",
    index: "03",
    title: "文化象征",
    eyebrow: "坚韧与守望",
    summary:
      "“生而千年不死、死而千年不倒、倒而千年不朽”是文化传说；植物学观察显示胡杨通常寿命约百年，已发现高龄个体约 300 年。",
    facts: [
      "极端干旱减缓木质腐朽，枯干因而能够长久挺立。",
      "耐旱、抗风沙、耐盐碱的生命形态成为边疆坚守与担当的精神图腾。",
      "金秋胡杨与水上胡杨构成塔里木河流域独特景观。",
    ],
  },
  {
    id: "survival",
    index: "04",
    title: "生存智慧",
    eyebrow: "异形叶与水分利用",
    summary:
      "胡杨通过异形叶、深广根系、凝结水利用和排盐机制，在强光、干旱和盐碱胁迫中建立多层次适应策略。",
    facts: [
      "低处窄叶减少蒸腾，高处阔叶增强光合效率。",
      "冠层可吸收大气凝结水，并通过根系再分配进入土壤。",
      "主根可深扎地下十几米，水平根系延伸数十米。",
      "树皮和叶片可排出多余盐分，维持体内离子平衡。",
    ],
  },
  {
    id: "research",
    index: "05",
    title: "科研价值",
    eyebrow: "天然抗逆基因库",
    summary:
      "胡杨为解析耐盐耐旱、气候变化响应、河流变迁与荒漠生态水文过程提供不可替代的天然实验材料。",
    facts: [
      "胡杨基因组研究揭示耐盐树木适应机制，为抗逆育种提供基因资源。",
      "年轮、种群和景观变化记录干旱区气候与河流演变信息。",
      "极端水湿—极端干旱交替环境为研究碳水耦合提供天然实验室。",
    ],
  },
];

export const protectionCases = [
  {
    id: "tarim-rescue",
    index: "CASE 01",
    title: "塔里木河流域胡杨林拯救行动",
    summary:
      "以常态化生态输水、科学调度、汊渗轮灌和林长制网格巡护恢复下游地下水与天然更新能力。",
    measures: [
      "自 2000 年起持续实施下游生态输水；截至 2025 年累计约 102 亿立方米。",
      "采用“双河道、小流量、长历时、多时段”调度，提高横向漫溢与地下补给效率。",
      "通过生态闸、轮灌与引洪灌溉，将有限水量精准引入天然胡杨林。",
    ],
    outcomes: [
      "地下水埋深抬升 6-8 米",
      "植被覆盖度 8.35% → 11.62%",
      "植物物种 17 种 → 46 种",
      "中幼树比例超过 80%",
    ],
  },
  {
    id: "luntai-flood",
    index: "CASE 02",
    title: "轮台县百万亩胡杨林引洪生态灌溉",
    summary:
      "利用汛期洪水资源，疏通引洪渠、修建挡水坝并依托 9 座生态闸分片灌溉塔里木河两岸天然胡杨林。",
    measures: [
      "境内覆盖 168 公里塔里木河中下游干流河道。",
      "自 2019 年起持续开展百万亩天然胡杨林生态补水。",
      "新增人工造林 2000 余亩并纳入常态化补水范围。",
    ],
    outcomes: ["百万亩级常态补水", "天然林优先灌溉", "人工林同步管护"],
  },
  {
    id: "keping-restoration",
    index: "CASE 03",
    title: "柯坪县哈拉坤胡杨林区系统治理",
    summary:
      "构建“天上增水、地上调水、地下补水”立体增水体系，用监测样井和固定样地持续评估修复效果。",
    measures: [
      "2022-2025 年累计生态补水 7.19 亿立方米。",
      "实施人工防雹增雨 47 次。",
      "新建地下水位监测样井 22 处、植被监测样地 46 处。",
    ],
    outcomes: [
      "地下水位抬升 1.32 米",
      "郁闭度 4.71% → 7.67%",
      "植被总盖度 18.39%",
    ],
  },
];

export const platformServiceChain = [
  {
    step: "01",
    title: "汇聚",
    description: "接入遥感、矢量、调查、监测、表格、基因与成果文件。",
  },
  {
    step: "02",
    title: "治理",
    description: "以分类、元数据、权限和质量状态形成统一数据目录。",
  },
  {
    step: "03",
    title: "发现",
    description: "通过关键词、权威分类、时空范围与来源快速检索。",
  },
  {
    step: "04",
    title: "应用",
    description: "进入地理工作台、数据分析、专题制图与成果展示。",
  },
  {
    step: "05",
    title: "共享",
    description: "在角色权限和可追溯机制下复用数据与科研成果。",
  },
];

export const platformStats = [
  { value: "9", label: "一级业务门户" },
  { value: "4", label: "权威数据分类" },
  { value: "7", label: "核心资源形态" },
  { value: "1", label: "统一科研数据底座" },
];

export const contactChannels = [
  {
    type: "数据与权限",
    email: "lizhijun0202@126.com",
    title: "数据使用、访问权限与资料提交",
    description:
      "适用于数据访问申请、角色权限、数据内容、共享范围、资料提交与科研使用咨询。",
    preparation: ["姓名与单位", "账号或角色", "数据名称", "用途与所需权限"],
  },
  {
    type: "平台技术",
    email: "wanghaoyu191@mails.ucas.ac.cn",
    title: "平台建设、功能建议与 Bug 修复",
    description:
      "适用于页面异常、功能故障、导入或下载问题、平台建设建议与技术协作。",
    preparation: ["页面路径", "浏览器版本", "截图或录屏", "完整复现步骤"],
  },
];
