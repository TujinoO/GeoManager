import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MailOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Button, Layout, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { aboutAssets } from "../about/aboutSections";
import { institutionProfiles } from "../about/contentV2";
import poplarWaterGoldenImage from "../assets/about/poplar-water-golden.jpeg";
import xjafsMonitoringTowerImage from "../assets/about/xjafs-monitoring-tower.png";
import knowledgeAncientPoplarImage from "../assets/portal/knowledge-ancient-poplar.png";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { platformBrand } from "../config/platformBrand";
import { useAppContext } from "../contexts/AppContext";

const aboutSections = [
  {
    key: "system",
    label: "Platform",
    summary: "Mission and capabilities",
    path: "/about/system",
    icon: <InfoCircleOutlined />,
  },
  {
    key: "team",
    label: "Research Network",
    summary: "Partner institutions",
    path: "/about/team",
    icon: <TeamOutlined />,
  },
  {
    key: "members",
    label: "Members",
    summary: "Institutional directories",
    path: "/about/members",
    icon: <UsergroupAddOutlined />,
  },
  {
    key: "contact",
    label: "Contact",
    summary: "Data and technical support",
    path: "/about/contact",
    icon: <MailOutlined />,
  },
  {
    key: "docs",
    label: "Help Center",
    summary: "Workflows and guidance",
    path: "/about/docs",
    icon: <FileTextOutlined />,
  },
] as const;

const serviceChain = [
  [
    "01",
    "Ingest",
    "Bring together remote sensing, vectors, field surveys, monitoring tables, genomic data, and research outputs.",
  ],
  [
    "02",
    "Govern",
    "Attach authoritative categories, metadata, permissions, quality notes, and accountable ownership.",
  ],
  [
    "03",
    "Discover",
    "Search by keyword, business taxonomy, source, format, time, and spatial coverage.",
  ],
  [
    "04",
    "Analyze",
    "Move from catalog records into the geo workspace, tabular analytics, mapping, and result review.",
  ],
  [
    "05",
    "Share",
    "Reuse authorized data and published outputs through traceable, role-aware workflows.",
  ],
] as const;

const capabilities = [
  [
    "Multi-source catalog",
    "Organize imagery, vector layers, field records, long-term observations, tables, and research products in one governed catalog.",
    "Catalog · Metadata · Access",
  ],
  [
    "3D geo workspace",
    "Load authorized layers, inspect attributes, perform spatial queries, configure symbols, and assemble thematic maps.",
    "Layers · Queries · Mapping",
  ],
  [
    "Ecological analytics",
    "Profile fields, inspect completeness, compare community composition, and explore functional-trait relationships.",
    "Tables · Traits · Quality",
  ],
  [
    "Managed sharing",
    "Publish results to defined audiences while retaining source, owner, version, and operation history.",
    "Permissions · Versions · Audit",
  ],
] as const;

type InstitutionCopy = {
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
  metrics: Array<[string, string]>;
  publications: Array<{ title: string; meta: string; url?: string }>;
  members: Array<[string, string, string]>;
};

const institutionCopy: InstitutionCopy[] = [
  {
    id: "tarim-university",
    shortName: "Tarim University",
    name: "Tarim University · Professor Li Zhijun's Team",
    eyebrow: "Lead institution · Conservation biology and germplasm",
    leader: "Li Zhijun (李志军)",
    leaderTitle: "Professor and doctoral supervisor",
    email: "lizhijun0202@126.com",
    positioning:
      "A conservation program spanning genes, germplasm, seedlings, communities, river basins, and research data infrastructure.",
    summary:
      "Based in the College of Life Science and Technology, the team has long studied the conservation biology and ecological restoration of Populus euphratica and P. pruinosa across northwestern China and Central Asian drylands. Its work connects germplasm collection, stress tolerance, sex determination, regeneration, water management, science communication, and research-data stewardship.",
    focusAreas: [
      "Germplasm collection, conservation, evaluation, and core collections",
      "Stress-resistance mechanisms, sex determination, and heterophylly",
      "Natural-forest regeneration, water regulation, and precision planting",
      "Digital preservation of field surveys, remote sensing, and research outputs",
    ],
    contributions: [
      "Developed a combined water diversion, seed dispersal, and assisted-sowing restoration approach.",
      "Applied molecular markers for non-destructive sex identification at the seedling stage.",
      "Built long-running germplasm and field-survey collections across major poplar regions.",
      "Advanced genomic, population-genetic, and multidimensional conservation research.",
    ],
    metrics: [
      ["30+", "National and provincial projects"],
      ["100+", "Academic papers"],
      ["32", "SCI-indexed papers"],
      ["6", "Granted invention patents"],
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
      [
        "Jiao Peipei (焦培培)",
        "Research staff",
        "Genetic diversity, germplasm evaluation, and molecular mechanisms",
      ],
      [
        "Gemingguli Muhatai (格明古丽·木哈台)",
        "Research staff",
        "Resource conservation, regional plant surveys, and collaboration",
      ],
      [
        "Gai Zhongshuai (盖中帅)",
        "Early-career researcher",
        "Population genetics, conservation units, and heterophylly",
      ],
      [
        "Zhai Juntuan (翟军团)",
        "Research staff",
        "Clonal propagation, population structure, and ecological genetics",
      ],
      [
        "Zhang Shanhe (张山河)",
        "Research member",
        "Poplar genomics, conservation biology, and research coordination",
      ],
    ],
  },
  {
    id: "xieg-cas",
    shortName: "Xinjiang Institute of Ecology and Geography",
    name: "Xinjiang Institute of Ecology and Geography, CAS · Li Junli's Team",
    eyebrow: "Intelligent remote sensing · Dryland ecological response",
    leader: "Li Junli (李均力)",
    leaderTitle: "Professor and doctoral supervisor",
    email: "lijl@ms.xjb.ac.cn",
    positioning:
      "Remote-sensing big data and artificial intelligence for poplar forests, water resources, wetlands, and dryland monitoring.",
    summary:
      "The team integrates Earth observation, field validation, and environmental modelling to extract long time-series information and explain ecological responses. Work includes intelligent poplar-tree detection, wetland and glacier dynamics, soil wind erosion, salinity hazards, and Tarim River water-resource change.",
    focusAreas: [
      "Intelligent processing of remote-sensing big data and long time-series products",
      "Poplar information extraction and ecological-water-delivery assessment",
      "Monitoring dryland wetlands, glaciers, and ecosystem dynamics",
      "Soil wind erosion, salinity hazards, and watershed response",
    ],
    contributions: [
      "Established large-area, long time-series remote-sensing monitoring workflows.",
      "Contributed technologies for dryland ecological-security monitoring and early warning.",
      "Supported assessment of ecological water delivery across the Tarim River Basin.",
      "Quantified inundation and vegetation-cover change in replenishment zones.",
    ],
    metrics: [
      ["20+", "Led research projects"],
      ["90+", "Published papers"],
      ["3", "Research monographs"],
      ["2.72 M mu", "2023 replenishment monitoring"],
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
          "Vegetation growth improvement inadequately represents the ecological restoration of Populus euphratica forests",
        meta: "Ecological Indicators · 2025",
        url: "https://doi.org/10.1016/j.ecolind.2025.113086",
      },
    ],
    members: [
      [
        "Zhang Jiudan (张久丹)",
        "Assistant professor / postdoctoral researcher",
        "Remote sensing of dryland wetland ecosystems",
      ],
      [
        "Liu Jiawei (刘嘉伟)",
        "Master's researcher",
        "Intelligent extraction of poplar-forest information",
      ],
      [
        "Li Ruonan (李若楠)",
        "Doctoral researcher",
        "Glacier dynamics and stability assessment",
      ],
      [
        "Tang Shanshan (汤珊珊)",
        "Doctoral researcher",
        "Dryland ecosystem monitoring",
      ],
      ["Deng Rui (邓蕊)", "Master's researcher", "Soil wind erosion"],
      ["Zhang Tian (张甜)", "Master's researcher", "Wetland remote sensing"],
      [
        "Fan Jingchao (范景超)",
        "Master's researcher",
        "Dryland salinity-hazard monitoring",
      ],
      [
        "Yan Yanghao (闫杨豪)",
        "Master's researcher",
        "Tarim River water resources and ecological response",
      ],
    ],
  },
  {
    id: "xjafs",
    shortName: "Xinjiang Academy of Forestry Sciences",
    name: "Xinjiang Academy of Forestry Sciences · Institute of Afforestation and Desert Control",
    eyebrow: "Long-term observation · Regeneration · Carbon and water flux",
    leader: "Wang Xinying (王新英)",
    leaderTitle: "Station director and associate professor",
    email: "xjauwxy@126.com",
    positioning:
      "Long-term observations supporting carbon-water cycling, restoration, and sustained management of poplar forests.",
    summary:
      "The institute addresses ecological protection through desertification control, shelterbelt research, integrated ecosystem restoration, and forestry demonstration. Its national poplar ecosystem station monitors soil, meteorology, hydrology, biodiversity, and ecosystem function over the long term.",
    focusAreas: [
      "Long-term observation and accumulation of ecosystem data",
      "Carbon-water fluxes, carbon stocks, and ecohydrology",
      "Regeneration, difficult-site planting, and ecological restoration",
      "Assessment of Tarim River ecological projects",
    ],
    contributions: [
      "Refined ecosystem carbon estimates by studying dead branches retained on living trees.",
      "Established a carbon-water flux monitoring platform.",
      "Provided long-term evidence for recovery from forest degradation.",
      "Applied flood-irrigation and regeneration methods in demonstration areas.",
    ],
    metrics: [
      ["20+", "Station projects"],
      ["30+", "Published papers"],
      ["11", "Research staff"],
      ["14 Mt", "Estimated annual carbon fixation"],
    ],
    publications: [
      {
        title:
          "Biomass and stoichiometric characteristics of dead branches retained on living Populus euphratica trees",
        meta: "Acta Ecologica Sinica · 2017",
        url: "http://dx.doi.org/10.5846/stxb201509171916",
      },
      {
        title:
          "Nutrient accumulation and dynamics of natural Populus euphratica forests in the Tarim River Basin",
        meta: "Xinjiang Agricultural Sciences · 2018",
        url: "https://doi.org/10.6048/j.issn.1001-4330.2018.06.007",
      },
    ],
    members: [
      [
        "Lu Tianping (鲁天平)",
        "Senior engineer",
        "Regeneration and planting on difficult sites",
      ],
      [
        "Shi Junhui (史军辉)",
        "Professor",
        "Long-term ecosystem observation and forest ecology",
      ],
      [
        "Liu Maoxiu (刘茂秀)",
        "Associate professor",
        "Carbon-stock assessment and ecohydrology",
      ],
    ],
  },
  {
    id: "nieer-cas",
    shortName: "Northwest Institute of Eco-Environment and Resources",
    name: "Northwest Institute of Eco-Environment and Resources, CAS · Desert Ecohydrology Team",
    eyebrow: "Desert ecohydrology · Heihe River water allocation",
    leader: "Si Jianhua (司建华)",
    leaderTitle: "Professor, doctoral supervisor, and field-station director",
    email: "jianhuas@lzb.ac.cn",
    positioning:
      "Ecohydrological processes, groundwater evapotranspiration, and restoration control in degraded desert riparian forests.",
    summary:
      "Based at the Ejin poplar ecohydrology field station, the team studies lower-Heihe water allocation, oasis protection, poplar water use, and restoration across desert-oasis transitions. Its work supports ecological security in a major concentrated poplar-forest region.",
    focusAreas: [
      "Ecohydrological processes and water consumption",
      "Groundwater evapotranspiration and water-table regulation",
      "Critical ecological-water-demand periods and allocation",
      "Restoration and wind-sand protection",
    ],
    contributions: [
      "Conducted ecohydrological experiments and restoration demonstrations.",
      "Developed integrated wind-sand protection for desert-oasis transitions.",
      "Proposed critical ecological-water-demand periods and allocation strategies.",
      "Established root-water-uptake models and clonal-propagation techniques.",
    ],
    metrics: [
      ["10+", "Fixed observation sites"],
      ["123", "Permanent survey points"],
      ["13", "Long-term specialists"],
      ["90+", "Graduate researchers trained"],
    ],
    publications: [
      {
        title:
          "Critical periods of ecological water demand and water-allocation strategies for the Ejin Oasis",
        meta: "Journal of Desert Research · 2013",
        url: "https://doi.org/10.7522/j.issn.1000-694X.2013.00077",
      },
      {
        title:
          "Root distribution and root-water-uptake modelling for Populus euphratica",
        meta: "Advances in Earth Science · 2008",
        url: "https://doi.org/10.11867/j.issn.1001-8166.2008.07.0765",
      },
      {
        title:
          "Water-use Processes and Adaptation Strategies of Desert Riparian Populus euphratica",
        meta: "Science Press · 2022 · ISBN 9787030734136",
      },
    ],
    members: [
      [
        "Xi Haiyang (席海洋)",
        "Professor",
        "Root-water-uptake modelling and water resources",
      ],
      [
        "Su Yonghong (苏永红)",
        "Associate professor",
        "Ecohydrology and coupled water-carbon cycles",
      ],
      [
        "Guo Xiaoyan (郭小燕)",
        "Associate professor",
        "Desert observations and clonal propagation",
      ],
    ],
  },
];

function institutionView(id: string) {
  const source = institutionProfiles.find((item) => item.id === id)!;
  const copy = institutionCopy.find((item) => item.id === id)!;
  return {
    ...copy,
    heroImage: source.heroImage,
    portrait: source.portrait,
    sourceUrl: source.sourceUrl,
  };
}

const institutions = institutionCopy.map((item) => institutionView(item.id));

export function EnglishAboutPage() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const params = useParams();
  const section = aboutSections.some((item) => item.key === params.section)
    ? params.section!
    : "system";
  const institution = institutions.find(
    (item) => item.id === params.institutionId,
  );
  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="about"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <div className="workspace-body workspace-body-about">
        <aside className="about-page-nav-panel">
          <div className="about-page-panel-head">
            <Typography.Text strong>About Us</Typography.Text>
          </div>
          <div className="about-page-nav-list">
            {aboutSections.map((item) => (
              <button
                aria-current={item.key === section ? "page" : undefined}
                className={`about-page-nav-item${item.key === section ? " about-page-nav-item-active" : ""}`}
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
              >
                <span className="about-page-nav-icon">{item.icon}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.summary}</small>
                </span>
              </button>
            ))}
          </div>
          {institution ? (
            <div className="about-v2-nav-context">
              <span>Current institution</span>
              <strong>{institution.shortName}</strong>
              <small>{institution.leader}'s team</small>
            </div>
          ) : null}
        </aside>
        <main className="about-page-main-panel">
          {section === "system" ? <EnglishSystemOverview /> : null}
          {section === "team" || section === "members" ? (
            institution ? (
              <EnglishInstitutionDetail
                institution={institution}
                mode={section as "team" | "members"}
                onBack={() => navigate(`/about/${section}`)}
                onSwitch={() =>
                  navigate(
                    `/about/${section === "team" ? "members" : "team"}/${institution.id}`,
                  )
                }
              />
            ) : (
              <EnglishInstitutionOverview
                mode={section as "team" | "members"}
                onNavigate={navigate}
              />
            )
          ) : null}
          {section === "contact" ? <EnglishContact /> : null}
          {section === "docs" ? <EnglishHelpCenter /> : null}
        </main>
      </div>
    </Layout>
  );
}

function EnglishSystemOverview() {
  return (
    <>
      <section
        className="about-page-visual-hero about-v2-system-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(5, 30, 27, 0.94), rgba(5, 30, 27, 0.52) 58%, rgba(5, 30, 27, 0.14)), url(${aboutAssets.aboutPoplarGroveImage})`,
        }}
      >
        <div className="about-page-visual-copy">
          <span className="about-page-platform-badge">
            <strong>{platformBrand.englishName}</strong>
            <small>{platformBrand.shortName}</small>
          </span>
          <Typography.Title level={1}>
            Shared data for global Populus euphratica forest ecosystem
            conservation
          </Typography.Title>
          <Typography.Paragraph>
            Connect remote-sensing imagery, field surveys, long-term monitoring,
            biological samples, and research outputs so conservation data can be
            discovered, understood, reused, and traced.
          </Typography.Paragraph>
          <div className="about-v2-hero-tags">
            {[
              "Research data foundation",
              "Digital poplar archive",
              "Responsible sharing",
            ].map((item) => (
              <span key={item}>
                <CheckCircleOutlined />
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="about-v2-hero-stat-grid">
          {[
            ["9", "Primary service portals"],
            ["4", "Authoritative data classes"],
            ["7", "Core resource forms"],
            ["1", "Unified data foundation"],
          ].map(([value, label]) => (
            <article key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="about-v2-platform-statement">
        <span className="about-page-kicker">PLATFORM MISSION</span>
        <Typography.Title level={2}>
          A data-sharing platform led by Tarim University for global Populus
          euphratica forest ecosystem conservation
        </Typography.Title>
        <Typography.Paragraph>
          GPEDSP organizes multi-source data to support global Populus
          euphratica forest ecosystem conservation and scientific collaboration.
          It connects ecological patterns, field observations, sample records,
          and molecular evidence while preserving source, access scope, quality
          notes, and accountable ownership to support data sharing and research
          reuse.
        </Typography.Paragraph>
      </section>
      <section className="about-v2-section about-v2-service-section">
        <EnglishSectionTitle
          icon={<CompassOutlined />}
          eyebrow="DATA SERVICE CHAIN"
          title="From a raw observation to a reusable research asset"
          description="Content, location, provenance, quality, access, and intended use remain connected through one service chain."
        />
        <div className="about-v2-service-chain">
          {serviceChain.map(([step, title, description]) => (
            <article key={step}>
              <span>{step}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="about-v2-section">
        <EnglishSectionTitle
          icon={<DatabaseOutlined />}
          eyebrow="CORE CAPABILITIES"
          title="Four capabilities for poplar-forest conservation"
          description="Data governance, spatial expression, ecological analysis, and responsible sharing remain part of one continuous workflow."
        />
        <div className="about-page-card-grid about-page-capability-grid">
          {capabilities.map(([title, description, meta], index) => (
            <article
              className="about-page-feature-card about-page-luminous-card"
              key={title}
            >
              <span className="about-page-feature-icon">
                {
                  [
                    <DatabaseOutlined key="d" />,
                    <GlobalOutlined key="g" />,
                    <ExperimentOutlined key="e" />,
                    <SafetyCertificateOutlined key="s" />,
                  ][index]
                }
              </span>
              <strong>{title}</strong>
              <p>{description}</p>
              <small>{meta}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="about-v2-section">
        <EnglishSectionTitle
          icon={<ApartmentOutlined />}
          eyebrow="COLLABORATION NETWORK"
          title="Four institutions contribute complementary expertise"
          description="The network spans molecular mechanisms, germplasm, remote sensing, ecohydrology, restoration, and long-term observation."
        />
        <div className="about-v2-institution-strip">
          {institutions.map((item) => (
            <article key={item.id}>
              <span>{item.eyebrow}</span>
              <strong>{item.shortName}</strong>
              <p>{item.positioning}</p>
              <small>
                {item.leader} · {item.leaderTitle}
              </small>
            </article>
          ))}
        </div>
      </section>
      <section className="about-page-band about-page-system-goals about-v2-section">
        <div className="about-page-block-title">
          <CompassOutlined />
          <Typography.Title level={3}>Platform goals</Typography.Title>
        </div>
        <div className="about-page-roadmap">
          {[
            [
              "Goal 1",
              "Build a trusted data foundation",
              "Standardize ecological, spatial, phenotypic, molecular, and result assets.",
            ],
            [
              "Goal 2",
              "Support conservation and research",
              "Connect spatial exploration, analytics, field interpretation, and reusable outputs.",
            ],
            [
              "Goal 3",
              "Enable responsible collaboration",
              "Give teams, stewards, and researchers clear routes to discover, use, and share authorized information.",
            ],
          ].map(([phase, title, body]) => (
            <article key={phase}>
              <span>{phase}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function EnglishInstitutionOverview({
  mode,
  onNavigate,
}: {
  mode: "team" | "members";
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  const teamMode = mode === "team";
  return (
    <>
      <section className="about-v2-directory-hero">
        <div>
          <span className="about-page-kicker">
            {teamMode ? "RESEARCH NETWORK" : "MEMBER DIRECTORY"}
          </span>
          <Typography.Title level={2}>
            {teamMode
              ? "Four institutions working across scales to protect poplar forests"
              : "Institution-based member directories"}
          </Typography.Title>
          <Typography.Paragraph>
            {teamMode
              ? "Each institution is presented as an accountable research node with its leader, expertise, evidence, observation facilities, and selected outputs."
              : "Member records remain grouped by institution so roles, research areas, outputs, and contact details stay attributable and verifiable."}
          </Typography.Paragraph>
        </div>
        <div className="about-v2-directory-summary">
          <strong>4</strong>
          <span>Core institutions</span>
          <small>
            {teamMode ? "Cross-scale collaboration" : "Separate directories"}
          </small>
        </div>
      </section>
      <div className="about-v2-institution-grid">
        {institutions.map((item, index) => (
          <article className="about-v2-institution-card" key={item.id}>
            <div
              className="about-v2-institution-image"
              style={{ backgroundImage: `url(${item.heroImage})` }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{item.eyebrow}</small>
            </div>
            <div className="about-v2-institution-copy">
              <header>
                <div>
                  <span>{item.shortName}</span>
                  <strong>{item.name}</strong>
                </div>
                <Tag color="green">
                  {teamMode
                    ? "Research node"
                    : `${item.members.length + 1} members`}
                </Tag>
              </header>
              <p>{item.positioning}</p>
              <div className="about-v2-leader-line">
                {item.portrait ? (
                  <img alt={`Portrait of ${item.leader}`} src={item.portrait} />
                ) : (
                  <span>
                    <UserOutlined />
                  </span>
                )}
                <div>
                  <strong>{item.leader}</strong>
                  <small>{item.leaderTitle}</small>
                </div>
              </div>
              <div className="about-v2-focus-tags">
                {item.focusAreas.slice(0, 3).map((focus) => (
                  <span key={focus}>{focus}</span>
                ))}
              </div>
              <Button
                icon={<ArrowRightOutlined />}
                iconPlacement="end"
                type="primary"
                onClick={() => onNavigate(`/about/${mode}/${item.id}`)}
              >
                {teamMode ? "View team details" : "Open member directory"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function EnglishInstitutionDetail({
  institution,
  mode,
  onBack,
  onSwitch,
}: {
  institution: (typeof institutions)[number];
  mode: "team" | "members";
  onBack: () => void;
  onSwitch: () => void;
}) {
  const teamMode = mode === "team";
  return (
    <>
      <div className="about-v2-detail-toolbar">
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>
          Back to {teamMode ? "research network" : "member directory"}
        </Button>
        <Button
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          onClick={onSwitch}
        >
          {teamMode ? "View member directory" : "View team profile"}
        </Button>
      </div>
      <section
        className="about-v2-institution-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(4, 31, 27, 0.94), rgba(4, 31, 27, 0.55) 62%, rgba(4, 31, 27, 0.2)), url(${institution.heroImage})`,
        }}
      >
        <div>
          <span>{institution.eyebrow}</span>
          <Typography.Title level={1}>{institution.name}</Typography.Title>
          <Typography.Paragraph>{institution.positioning}</Typography.Paragraph>
          <div className="about-v2-hero-tags">
            {institution.focusAreas.slice(0, 3).map((item) => (
              <span key={item}>
                <CheckCircleOutlined />
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="about-v2-hero-leader">
          {institution.portrait ? (
            <img
              alt={`Portrait of ${institution.leader}`}
              src={institution.portrait}
            />
          ) : (
            <span className="about-v2-hero-leader-placeholder">
              <UserOutlined />
            </span>
          )}
          <small>Team leader</small>
          <strong>{institution.leader}</strong>
          <span>{institution.leaderTitle}</span>
          {institution.email ? (
            <a href={`mailto:${institution.email}`}>{institution.email}</a>
          ) : null}
        </div>
      </section>
      <div className="about-v2-metric-grid">
        {institution.metrics.map(([value, label]) => (
          <article key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
      {teamMode ? (
        <>
          <section className="about-v2-section about-v2-detail-intro">
            <div>
              <span className="about-page-kicker">TEAM PROFILE</span>
              <Typography.Title level={2}>
                Research role and collaborative value
              </Typography.Title>
              <Typography.Paragraph>{institution.summary}</Typography.Paragraph>
              {institution.sourceUrl ? (
                <a
                  href={institution.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  View public source <LinkOutlined />
                </a>
              ) : null}
            </div>
            <div className="about-v2-focus-panel">
              <strong>Priority research areas</strong>
              {institution.focusAreas.map((item) => (
                <p key={item}>
                  <CheckCircleOutlined />
                  {item}
                </p>
              ))}
            </div>
          </section>
          <section className="about-v2-section">
            <EnglishSectionTitle
              icon={<SafetyCertificateOutlined />}
              eyebrow="SCIENTIFIC CONTRIBUTIONS"
              title="Research contributions and platform support"
              description="Verifiable research, monitoring, and demonstration work defines the institution's professional role."
            />
            <div className="about-v2-contribution-grid">
              {institution.contributions.map((item, index) => (
                <article key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="about-v2-section">
            <EnglishSectionTitle
              icon={<UsergroupAddOutlined />}
              eyebrow="MEMBER DIRECTORY"
              title={`${institution.shortName} team members`}
              description={`${institution.members.length} members are organized by role and research focus; the leader is presented separately above.`}
            />
            <div className="about-v2-member-grid">
              {institution.members.map(([name, role, focus]) => (
                <article key={name}>
                  <span>
                    <UserOutlined />
                  </span>
                  <div>
                    <strong>{name}</strong>
                    <small>{role}</small>
                    <p>{focus}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="about-v2-section">
            <EnglishSectionTitle
              icon={<FileTextOutlined />}
              eyebrow="SELECTED OUTPUTS"
              title="Selected papers and monographs"
              description="Selected outputs provide a direct route from the directory to supporting evidence."
            />
            <div className="about-v2-publication-list">
              {institution.publications.map((item) => (
                <article key={item.title}>
                  <span>{item.meta}</span>
                  <strong>{item.title}</strong>
                  {item.url ? (
                    <a href={item.url} rel="noreferrer" target="_blank">
                      Open source <LinkOutlined />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function EnglishContact() {
  const channels = [
    {
      type: "Data and access",
      title: "Resource use, access requests, and data contribution",
      email: "lizhijun0202@126.com",
      description:
        "Use this route for access scope, intended research use, contribution proposals, and questions about resource ownership.",
      items: [
        "Your name, institution, and account",
        "Resource name and intended use",
        "Requested scope and expected duration",
      ],
    },
    {
      type: "Platform support",
      title: "Interface, workflow, and technical issue reporting",
      email: "lizhijun0202@126.com",
      description:
        "Use this route for page errors, failed workflows, display problems, and reproducible technical issues.",
      items: [
        "Page path and account role",
        "Steps, timestamp, and expected result",
        "Screenshot and exact error message",
      ],
    },
  ];
  return (
    <>
      <section className="about-v2-contact-hero">
        <div>
          <span className="about-page-kicker">CONTACT & SUPPORT</span>
          <Typography.Title level={2}>
            Route each question to the team that can resolve it
          </Typography.Title>
          <Typography.Paragraph>
            The platform separates data-access requests from technical support.
            Include the essential context in the first message to reduce
            repeated clarification.
          </Typography.Paragraph>
        </div>
        <div className="about-v2-contact-promise">
          <MailOutlined />
          <strong>Email support</strong>
          <span>Clear category · Complete context · Reproducible evidence</span>
        </div>
      </section>
      <div className="about-v2-contact-grid">
        {channels.map((item) => (
          <article key={item.type}>
            <header>
              <span>{item.type}</span>
              <MailOutlined />
            </header>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <a href={`mailto:${item.email}`}>{item.email}</a>
            <div>
              <small>Include in your email</small>
              {item.items.map((line) => (
                <span key={line}>
                  <CheckCircleOutlined />
                  {line}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
      <section className="about-v2-section about-v2-contact-guide">
        <EnglishSectionTitle
          icon={<CompassOutlined />}
          eyebrow="SUPPORT WORKFLOW"
          title="What an actionable report should contain"
          description="Give the receiving team enough information to reproduce, assess, and resolve the issue."
        />
        <div className="about-v2-contact-steps">
          {[
            [
              "01",
              "Identify yourself",
              "Provide your name, institution, account, and current role.",
            ],
            [
              "02",
              "State the goal",
              "Name the data or operation you are trying to access.",
            ],
            [
              "03",
              "Attach evidence",
              "Include the page path, resource name, screenshot, and error text.",
            ],
            [
              "04",
              "List the steps",
              "Describe the operation sequence and expected result.",
            ],
          ].map(([step, title, description]) => (
            <article key={step}>
              <span>{step}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="about-v2-contact-footer">
        <div>
          <span>Postal address</span>
          <strong>
            College of Life Science and Technology, Tarim University, Alar,
            Xinjiang, China
          </strong>
          <small>Postal code: 843300</small>
        </div>
        <div>
          <span>Security reminder</span>
          <strong>
            Do not send passwords or unsanitized sensitive data by ordinary
            email
          </strong>
          <small>
            Confirm authorization and a secure transfer method before sharing
            controlled data.
          </small>
        </div>
      </section>
    </>
  );
}

function EnglishHelpCenter() {
  const cards = [
    [
      "01",
      "Getting started",
      "Sign in, understand your role, browse the catalog, and open an authorized resource.",
    ],
    [
      "02",
      "Geo workspace",
      "Load layers, inspect fields, run spatial queries, configure symbols, and save projects.",
    ],
    [
      "03",
      "Data analytics",
      "Analyze tabular or genetic resources, review distributions, inspect completeness, and query details.",
    ],
    [
      "04",
      "Data and result import",
      "Prepare files, select a business category, validate fields, set access, and commit the import.",
    ],
    [
      "05",
      "Publishing and sharing",
      "Review previews, publish to approved audiences, manage versions, and preserve provenance.",
    ],
    [
      "06",
      "Administration",
      "Manage users, roles, inventories, backups, projects, taxonomies, and operation logs with permission checks.",
    ],
  ];
  return (
    <>
      <section className="about-v2-directory-hero">
        <div>
          <span className="about-page-kicker">HELP CENTER</span>
          <Typography.Title level={2}>
            Platform workflows, organized by user task
          </Typography.Title>
          <Typography.Paragraph>
            Start with the catalog, move into a workspace or analysis view, and
            publish only after source, quality, ownership, and audience are
            clear.
          </Typography.Paragraph>
        </div>
        <div className="about-v2-directory-summary">
          <strong>6</strong>
          <span>Core guidance areas</span>
          <small>Role-aware workflows</small>
        </div>
      </section>
      <section className="about-v2-section">
        <EnglishSectionTitle
          icon={<BookOutlined />}
          eyebrow="QUICK GUIDES"
          title="From first sign-in to managed publication"
          description="Each guide keeps the task boundary, permission requirement, and expected result visible."
        />
        <div className="about-v2-contribution-grid">
          {cards.map(([index, title, body]) => (
            <article key={index}>
              <span>{index}</span>
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="about-v2-section">
        <EnglishSectionTitle
          icon={<SafetyCertificateOutlined />}
          eyebrow="DELIVERY CHECKLIST"
          title="Before reporting a workflow as complete"
          description="A successful click is not sufficient; confirm content, permissions, rendering, and traceability."
        />
        <div className="about-page-card-grid about-page-capability-grid">
          {[
            [
              "Access",
              "Confirm the intended role can see the resource and unauthorized roles cannot.",
            ],
            [
              "Content",
              "Verify names, fields, counts, descriptions, units, and source information.",
            ],
            [
              "Display",
              "Check tables, charts, maps, previews, and responsive layouts.",
            ],
            [
              "Traceability",
              "Retain owner, source, version, publication scope, and operation history.",
            ],
          ].map(([title, body]) => (
            <article
              className="about-page-feature-card about-page-luminous-card"
              key={title}
            >
              <span className="about-page-feature-icon">
                <CheckCircleOutlined />
              </span>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const speciesArchive = [
  {
    id: "profile",
    index: "01",
    eyebrow: "MEET THE SPECIES",
    title: "Species profile",
    summary:
      "Populus euphratica Oliver is a dominant tree of desert riparian forests and one of the few species able to form natural woodland under wind, heat, drought, and salinity.",
    facts: [
      "Mature trees can exceed ten metres; tiny wind-dispersed seeds carry silky hairs.",
      "Linear, ovate, and kidney-shaped leaves can occur on one individual.",
      "China holds about 61% of the world's P. euphratica forest, most in Xinjiang.",
      "More than 90% of Xinjiang's natural stands occur in the Tarim River Basin.",
    ],
  },
  {
    id: "ecology",
    index: "02",
    eyebrow: "DESERT KEYSTONE",
    title: "Ecological value",
    summary:
      "Poplar forests support carbon storage, wind and sand control, river-bank stability, habitat continuity, and biodiversity.",
    facts: [
      "Deep roots stabilize mobile sand and reduce near-surface wind speed.",
      "Riparian stands connect river processes with oasis ecological security.",
      "Satellite, UAV, field-station, and AI observations form an integrated monitoring system.",
    ],
  },
  {
    id: "culture",
    index: "03",
    eyebrow: "RESILIENCE AND MEMORY",
    title: "Cultural meaning",
    summary:
      "Persistence in harsh landscapes has made the poplar a symbol of endurance, guardianship, and commitment.",
    facts: [
      "Extreme aridity slows wood decay, so dead trunks can remain upright for long periods.",
      "Drought, wind, and salinity tolerance underpin its image as a desert guardian.",
      "Golden autumn forests and water-reflected poplars are distinctive Tarim landscapes.",
    ],
  },
  {
    id: "survival",
    index: "04",
    eyebrow: "WATER AND HETEROPHYLLY",
    title: "Survival strategies",
    summary:
      "Heterophylly, deep roots, atmospheric-water use, and salt regulation form a multi-layered adaptation strategy.",
    facts: [
      "Narrow lower leaves reduce water loss; broader upper leaves support light capture.",
      "Canopies can intercept condensed water and redistribute it through the root zone.",
      "Main roots may reach deep groundwater while lateral roots spread long distances.",
      "Bark and leaves help regulate excess salts and internal ion balance.",
    ],
  },
  {
    id: "research",
    index: "05",
    eyebrow: "NATURAL STRESS-RESISTANCE LIBRARY",
    title: "Research value",
    summary:
      "Poplar systems support research on salt and drought tolerance, climate response, river change, and desert ecohydrology.",
    facts: [
      "Genome research identifies stress-tolerance resources for breeding and restoration.",
      "Tree rings, populations, and landscapes record climate and river dynamics.",
      "Alternating flooding and drought provide a natural carbon-water laboratory.",
    ],
  },
] as const;

const protectionCases = [
  {
    index: "CASE 01",
    title: "Tarim River poplar-forest rescue program",
    summary:
      "Long-term ecological water delivery, regulated diversion, rotational inundation, and grid-based stewardship raise groundwater and restore natural regeneration.",
    measures: [
      "Continuous lower-reach ecological water delivery since 2000.",
      "Small-flow, long-duration allocation improves flooding and groundwater recharge.",
      "Ecological gates direct limited water to priority natural stands.",
    ],
    outcomes: [
      "Groundwater rise: 6–8 m",
      "Vegetation cover: 8.35% → 11.62%",
      "Plant species: 17 → 46",
      "Young and middle-aged trees: >80%",
    ],
  },
  {
    index: "CASE 02",
    title: "Flood-based irrigation of one million mu in Luntai",
    summary:
      "Seasonal floodwater is routed through channels, retaining structures, and nine ecological gates to natural forests along the Tarim River.",
    measures: [
      "Coverage includes 168 km of the middle and lower main channel.",
      "Routine replenishment has continued since 2019.",
      "More than 2,000 mu of planted forest is included.",
    ],
    outcomes: [
      "Million-mu routine replenishment",
      "Natural stands prioritized",
      "Planted stands maintained",
    ],
  },
  {
    index: "CASE 03",
    title: "Integrated restoration in Halakun, Kalpin",
    summary:
      "Atmospheric enhancement, surface-water regulation, and groundwater recharge are evaluated with monitoring wells and permanent plots.",
    measures: [
      "Ecological replenishment from 2022 to 2025.",
      "Targeted rain and snow enhancement operations.",
      "Groundwater wells and vegetation plots track recovery.",
    ],
    outcomes: [
      "Groundwater rise: 1.32 m",
      "Canopy closure: 4.71% → 7.67%",
      "Total vegetation cover: 18.39%",
    ],
  },
] as const;

export function EnglishKnowledgePage() {
  const { user } = useAppContext();
  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="knowledge"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <div className="workspace-body workspace-body-about">
        <aside className="about-page-nav-panel knowledge-page-nav-panel">
          <div className="about-page-panel-head">
            <Typography.Text strong>Poplar Knowledge</Typography.Text>
          </div>
          <nav
            className="knowledge-v2-primary-nav"
            aria-label="Poplar knowledge navigation"
          >
            {[
              [
                "01",
                "Species archive",
                "Profile, value, culture, survival, and research",
                "#species-archive",
              ],
              [
                "02",
                "Protection and management",
                "Water delivery, flood irrigation, and restoration",
                "#protection-management",
              ],
              [
                "03",
                "Research knowledge network",
                "Papers, mechanisms, and applications",
                "#knowledge-graph",
              ],
            ].map(([index, title, summary, href]) => (
              <a href={href} key={index}>
                <span>{index}</span>
                <strong>{title}</strong>
                <small>{summary}</small>
              </a>
            ))}
          </nav>
          <div className="knowledge-v2-species-links">
            <strong>Species archive</strong>
            {speciesArchive.map((item) => (
              <a href={`#species-${item.id}`} key={item.id}>
                {item.index} {item.title}
              </a>
            ))}
          </div>
          <p className="knowledge-page-nav-note">
            Begin with the species, continue through conservation practice, then
            explore genomic, leaf-development, and stress-adaptation evidence.
          </p>
        </aside>
        <main className="about-page-main-panel knowledge-page-main-panel knowledge-v2-main">
          <section
            className="knowledge-v2-hero"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(5, 31, 27, 0.95), rgba(5, 31, 27, 0.54) 58%, rgba(5, 31, 27, 0.08)), url(${knowledgeAncientPoplarImage})`,
            }}
          >
            <div>
              <span>POPULUS EUPHRATICA · DESERT SURVIVOR</span>
              <Typography.Title level={1}>
                A keystone tree of desert river corridors
              </Typography.Title>
              <Typography.Paragraph>
                One poplar connects species evolution, riparian corridors,
                desert ecohydrology, regional culture, and modern conservation
                technology. Explore how it survives and why it matters through
                visual archives, management cases, and a research network.
              </Typography.Paragraph>
              <div>
                {[
                  "A natural tree-forming species of extreme arid lands",
                  "About 61% of global natural stands occur in China",
                  "The Tarim River Basin is a core conservation region",
                ].map((item) => (
                  <span key={item}>
                    <CheckCircleOutlined />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <aside>
              <small>Species archive</small>
              <strong>PE-001</strong>
              <span>Salicaceae · Populus</span>
              <em>Populus euphratica Oliver</em>
            </aside>
          </section>
          <section className="knowledge-v2-section" id="species-archive">
            <EnglishKnowledgeTitle
              icon={<ReadOutlined />}
              index="01"
              eyebrow="SPECIES ARCHIVE"
              title="Species archive"
              description="Five connected sections move from rapid identification to scientific understanding."
            />
            <div className="knowledge-v2-archive-grid">
              {speciesArchive.map((item) => (
                <article id={`species-${item.id}`} key={item.id}>
                  <header>
                    <span>{item.index}</span>
                    <div>
                      <small>{item.eyebrow}</small>
                      <strong>{item.title}</strong>
                    </div>
                  </header>
                  <p>{item.summary}</p>
                  <ul>
                    {item.facts.map((fact) => (
                      <li key={fact}>
                        <CheckCircleOutlined />
                        {fact}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="knowledge-v2-image-story">
              <figure>
                <img
                  alt="Golden poplar forest beside a river"
                  src={poplarWaterGoldenImage}
                />
              </figure>
              <div>
                <span>LANDSCAPE AND ECOLOGY</span>
                <Typography.Title level={3}>
                  Golden autumn and water-reflected poplars
                </Typography.Title>
                <Typography.Paragraph>
                  Autumn colour and river reflections create iconic landscapes.
                  Their beauty also reveals how tightly desert riparian forests
                  are coupled to river processes, groundwater, and the timing of
                  water delivery.
                </Typography.Paragraph>
                <div>
                  <span>Typical viewing period</span>
                  <strong>Mid-October to early November</strong>
                </div>
              </div>
            </div>
          </section>
          <section
            className="knowledge-v2-section knowledge-v2-protection"
            id="protection-management"
          >
            <EnglishKnowledgeTitle
              icon={<SafetyCertificateOutlined />}
              index="02"
              eyebrow="PROTECTION MANAGEMENT"
              title="Protection and management"
              description="From ecological water delivery to field monitoring, conservation actions become measurable evidence."
            />
            <div className="knowledge-v2-protection-lead">
              <div>
                <span>Integrated conservation pathway</span>
                <Typography.Title level={3}>
                  Water allocation + flood irrigation + long-term monitoring +
                  stewardship
                </Typography.Title>
                <Typography.Paragraph>
                  Restoration is not a single watering event. It is a long-term
                  program based on river processes, ecological gates, diversion
                  channels, groundwater monitoring, permanent plots, and field
                  stewardship.
                </Typography.Paragraph>
              </div>
              <figure>
                <img
                  alt="Poplar-forest observation tower"
                  src={xjafsMonitoringTowerImage}
                />
                <figcaption>
                  Long-term observations convert management outcomes into
                  continuous scientific evidence.
                </figcaption>
              </figure>
            </div>
            <div className="knowledge-v2-case-list">
              {protectionCases.map((item) => (
                <article key={item.index}>
                  <header>
                    <span>{item.index}</span>
                    <strong>{item.title}</strong>
                  </header>
                  <p>{item.summary}</p>
                  <div className="knowledge-v2-case-body">
                    <section>
                      <small>Measures</small>
                      {item.measures.map((measure) => (
                        <p key={measure}>
                          <BranchesOutlined />
                          {measure}
                        </p>
                      ))}
                    </section>
                    <section>
                      <small>Key outcomes</small>
                      <div>
                        {item.outcomes.map((outcome) => (
                          <span key={outcome}>{outcome}</span>
                        ))}
                      </div>
                    </section>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="knowledge-v2-section" id="knowledge-graph">
            <EnglishKnowledgeTitle
              icon={<ExperimentOutlined />}
              index="03"
              eyebrow="RESEARCH KNOWLEDGE NETWORK"
              title="From scientific papers to conservation decisions"
              description="Research themes, representative papers, mechanisms, and applications are kept in one evidence-aware view."
            />
            <div className="about-page-card-grid about-page-knowledge-theme-grid">
              {[
                [
                  "01",
                  "Genome and sex determination",
                  "Male and female genomes, the sex-linked region, ARR17 regulation, and molecular markers form a mechanism-to-application chain.",
                ],
                [
                  "02",
                  "Heterophylly",
                  "Leaf development, methylation, and transcriptomic response explain leaf-form plasticity.",
                ],
                [
                  "03",
                  "Stress adaptation",
                  "Salt and drought response, WOX-family evidence, and comparative P. pruinosa genomics support resistant germplasm.",
                ],
                [
                  "04",
                  "Conservation application",
                  "Remote sensing, germplasm conservation, water delivery, and restoration translate evidence into management.",
                ],
              ].map(([index, title, body]) => (
                <article
                  className="about-page-feature-card about-page-knowledge-theme-card"
                  key={index}
                >
                  <span>{index}</span>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </article>
              ))}
            </div>
            <section className="about-page-knowledge-paper-wall">
              <div className="about-page-block-title">
                <ReadOutlined />
                <Typography.Title level={3}>
                  Representative research evidence
                </Typography.Title>
              </div>
              <div className="about-page-paper-wall-layout">
                <div className="about-page-paper-feature-column">
                  {institutions[0]!.publications.map((paper) => (
                    <article
                      className="about-page-paper-cover-card about-page-paper-cover-feature"
                      key={paper.title}
                    >
                      <div className="about-page-paper-cover-head">
                        <span>PE</span>
                        <small>{paper.meta}</small>
                      </div>
                      <strong>{paper.title}</strong>
                      <em>
                        Genome resources connect sex determination, adaptive
                        evolution, germplasm conservation, and restoration.
                      </em>
                      {paper.url ? (
                        <a href={paper.url} rel="noreferrer" target="_blank">
                          Open publication <LinkOutlined />
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
                <div className="about-page-paper-support-grid">
                  {institutions[1]!.publications.slice(0, 2).map((paper) => (
                    <article
                      className="about-page-paper-cover-card"
                      key={paper.title}
                    >
                      <div className="about-page-paper-cover-head">
                        <span>RS</span>
                        <small>{paper.meta}</small>
                      </div>
                      <strong>{paper.title}</strong>
                      <em>
                        Remote sensing connects individual trees and restoration
                        trajectories to landscape monitoring.
                      </em>
                      {paper.url ? (
                        <a href={paper.url} rel="noreferrer" target="_blank">
                          Open publication <LinkOutlined />
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            </section>
            <section className="about-page-knowledge-mechanism-section">
              <div className="about-page-block-title">
                <SafetyCertificateOutlined />
                <Typography.Title level={3}>
                  Core mechanisms and evidence chains
                </Typography.Title>
              </div>
              <div className="about-page-knowledge-mechanism-grid">
                {[
                  [
                    "Sex determination",
                    "Male and female genomes → sex-linked region → ARR17 regulation → early molecular identification",
                    ["Genome", "SLR", "ARR17", "Markers"],
                  ],
                  [
                    "Heterophylly",
                    "Leaf development → methylation regulation → transcriptomic response → leaf-form plasticity",
                    ["Leaf form", "Methylation", "Transcriptome", "Water use"],
                  ],
                  [
                    "Dryland adaptation",
                    "Comparative genome → population differentiation → stress expression → resistant germplasm",
                    [
                      "P. pruinosa",
                      "WOX genes",
                      "Salt and drought",
                      "Restoration",
                    ],
                  ],
                ].map(([title, body, tags]) => (
                  <article
                    className="about-page-mechanism-card"
                    key={title as string}
                  >
                    <div>
                      <span className="about-page-feature-icon">
                        <SafetyCertificateOutlined />
                      </span>
                      <small>Evidence chain</small>
                    </div>
                    <strong>{title as string}</strong>
                    <p>{body as string}</p>
                    <div className="about-page-chip-list">
                      {(tags as string[]).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="about-page-knowledge-value-band">
              <div>
                <div className="about-page-block-title">
                  <GlobalOutlined />
                  <Typography.Title level={3}>
                    Desert guardian and green ecological barrier
                  </Typography.Title>
                </div>
                <Typography.Paragraph>
                  Through drought tolerance, salt regulation, deep rooting, and
                  river-bank stabilization, P. euphratica protects oases while
                  providing material for germplasm conservation,
                  climate-response research, and restoration.
                </Typography.Paragraph>
              </div>
              <div className="about-page-knowledge-value-grid">
                {[
                  [
                    "61%",
                    "Global share in China",
                    "A major responsibility for conservation and monitoring",
                  ],
                  [
                    "90%+",
                    "Xinjiang stands in the Tarim Basin",
                    "A core link between river management and regeneration",
                  ],
                  [
                    "Multi-scale",
                    "Evidence network",
                    "Genomes, samples, plots, populations, landscapes, and remote sensing",
                  ],
                ].map(([value, label, detail]) => (
                  <article key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                    <p>{detail}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </main>
      </div>
    </Layout>
  );
}

function EnglishSectionTitle({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="about-v2-section-title">
      <span>{icon}</span>
      <div>
        <small>{eyebrow}</small>
        <Typography.Title level={3}>{title}</Typography.Title>
        <Typography.Paragraph>{description}</Typography.Paragraph>
      </div>
    </div>
  );
}

function EnglishKnowledgeTitle({
  icon,
  index,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="knowledge-v2-title">
      <span>{icon}</span>
      <div>
        <small>
          {index} · {eyebrow}
        </small>
        <Typography.Title level={2}>{title}</Typography.Title>
        <Typography.Paragraph>{description}</Typography.Paragraph>
      </div>
    </div>
  );
}
