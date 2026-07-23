import {
  ApartmentOutlined,
  BookOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Button, Input, Layout, Tag, Typography } from "antd";
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  aboutAssets,
  aboutNavigationSections,
  aboutSectionByKey,
  contactRows,
  coreMembers,
  helpAudienceCards,
  helpArticles,
  helpCategories,
  helpDocumentDownload,
  helpFaq,
  helpQuickLinks,
  type HelpArticle,
  type HelpArticleBlock,
  knowledgeGraphNodes,
  knowledgeGraphLegend,
  knowledgeMechanisms,
  knowledgePapers,
  knowledgeThemes,
  knowledgeValueCards,
  partnerInstitutions,
  platformDisplayName,
  principalPublicationHighlights,
  principalScientist,
  principalWorkThemes,
  systemCapabilities,
  systemIntroduction,
  systemRoadmap,
  teamEvidence,
  teamFocusAreas,
  teamIntro,
  teamLeaderCard,
  teamNewsItems,
  type AboutSection,
  type AboutSectionKey,
} from "../about/aboutSections";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";

const sectionIcons: Record<AboutSectionKey, ReactNode> = {
  system: <InfoCircleOutlined />,
  team: <TeamOutlined />,
  members: <UsergroupAddOutlined />,
  knowledge: <ReadOutlined />,
  docs: <FileTextOutlined />,
};

const capabilityIcons = [
  <DatabaseOutlined key="database" />,
  <GlobalOutlined key="global" />,
  <ApartmentOutlined key="apartment" />,
  <SearchOutlined key="search" />,
];

const teamFocusIcons = [
  <GlobalOutlined key="resource" />,
  <BranchesOutlined key="gene" />,
  <ExperimentOutlined key="water" />,
  <DatabaseOutlined key="data" />,
];

export default function AboutPage() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const params = useParams();
  const activeSection = aboutSectionByKey(params.section);
  const permissions = user?.permissions;
  const canBrowseData = Boolean(permissions?.canBrowseData);

  return (
    <Layout className="workspace">
      <WorkspaceHeader activeTab="about" canBrowseData={canBrowseData} />
      <div className="workspace-body workspace-body-about">
        <aside className="about-page-nav-panel">
          <div className="about-page-panel-head">
            <Typography.Text strong>关于我们</Typography.Text>
          </div>
          <div className="about-page-nav-list">
            {aboutNavigationSections.map((section) => (
              <button
                aria-current={
                  section.key === activeSection.key ? "page" : undefined
                }
                className={`about-page-nav-item${
                  section.key === activeSection.key
                    ? " about-page-nav-item-active"
                    : ""
                }`}
                key={section.key}
                type="button"
                onClick={() => navigate(section.path)}
              >
                <span className="about-page-nav-icon">
                  {sectionIcons[section.key]}
                </span>
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.navSummary}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="about-page-main-panel">
          {renderAboutContent(activeSection)}
        </main>
      </div>
    </Layout>
  );
}

function renderAboutContent(section: AboutSection) {
  switch (section.key) {
    case "team":
      return <TeamSection section={section} />;
    case "members":
      return <MembersSection section={section} />;
    case "knowledge":
      return <KnowledgeSection section={section} />;
    case "docs":
      return <DocsSection section={section} />;
    case "system":
    default:
      return <SystemSection />;
  }
}

function SystemSection() {
  return (
    <>
      <section
        className="about-page-visual-hero about-page-system-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(7, 35, 31, 0.9), rgba(7, 35, 31, 0.38) 58%, rgba(7, 35, 31, 0.14)), url(${aboutAssets.aboutPoplarGroveImage})`,
        }}
      >
        <div className="about-page-visual-copy">
          <span className="about-page-platform-badge">
            <strong>{platformDisplayName.zh}</strong>
            <small>{platformDisplayName.en}</small>
          </span>
          <Typography.Title level={1}>
            守护大漠英雄树，共筑生态屏障
          </Typography.Title>
          <Typography.Paragraph>
            以胡杨林生态保护数据为核心，连接遥感影像、野外调查、长期监测和科研成果，构建可浏览、可查询、可追溯的数据共享工作台。
          </Typography.Paragraph>
        </div>
        <div className="about-page-hero-fact">
          <img alt="塔里木大学校徽" src={aboutAssets.tarimUniversitySeal} />
          <strong>科研数据底座</strong>
          <small>服务胡杨林生态保护与长期监测</small>
        </div>
      </section>
      <section className="about-page-system-intro">
        <div>
          <span className="about-page-kicker">平台定位</span>
          <Typography.Title level={2}>
            {systemIntroduction.lead}
          </Typography.Title>
          <Typography.Paragraph>{systemIntroduction.body}</Typography.Paragraph>
        </div>
        <div className="about-page-system-intro-tags">
          {systemIntroduction.highlights.map((item) => (
            <span key={item}>
              <CheckCircleOutlined />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="about-page-card-grid about-page-capability-grid">
        {systemCapabilities.map((item, index) => (
          <article
            className="about-page-feature-card about-page-luminous-card"
            key={item.title}
          >
            <span className="about-page-feature-icon">
              {capabilityIcons[index]}
            </span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <small>{item.meta}</small>
          </article>
        ))}
      </section>

      <section className="about-page-band about-page-system-goals">
        <div className="about-page-block-title">
          <CompassOutlined />
          <Typography.Title level={3}>平台建设目标</Typography.Title>
        </div>
        <div className="about-page-roadmap">
          {systemRoadmap.map((item) => (
            <article key={item.phase}>
              <span>{item.phase}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function TeamSection({ section }: { section: AboutSection }) {
  return (
    <>
      <section className="about-page-team-hero">
        <div className="about-page-team-hero-copy">
          <span className="about-page-kicker">{section.eyebrow}</span>
          <Typography.Title level={2}>{section.title}</Typography.Title>
          <Typography.Paragraph>{section.summary}</Typography.Paragraph>
          <div className="about-page-highlight-row">
            {section.tags.map((item) => (
              <span key={item}>
                <CheckCircleOutlined />
                {item}
              </span>
            ))}
          </div>
          <a
            className="about-page-team-source-link"
            href={teamIntro.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            <LinkOutlined />
            {teamIntro.sourceLabel}
          </a>
        </div>

        <article className="about-page-team-leader-card">
          <img alt="李志军教授登记照" src={aboutAssets.liZhijunPortrait} />
          <div>
            <span>团队负责人</span>
            <Typography.Title level={3}>{teamLeaderCard.name}</Typography.Title>
            <strong>{teamLeaderCard.title}</strong>
            <small>{teamLeaderCard.role}</small>
            <p>{teamLeaderCard.description}</p>
            <a
              href={teamLeaderCard.profileUrl}
              rel="noreferrer"
              target="_blank"
            >
              查看个人简介
            </a>
          </div>
        </article>
      </section>

      <section className="about-page-split about-page-team-position">
        <div className="about-page-team-position-copy">
          <div className="about-page-block-title">
            <TeamOutlined />
            <Typography.Title level={3}>团队定位</Typography.Title>
          </div>
          <Typography.Title level={4}>{teamIntro.title}</Typography.Title>
          <Typography.Paragraph>{teamIntro.position}</Typography.Paragraph>
        </div>
        <div className="about-page-team-evidence-strip">
          <div className="about-page-proof-grid">
            {teamEvidence.map((item) => (
              <article className="about-page-team-glow-card" key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </article>
            ))}
          </div>
        </div>
        <figure>
          <img
            alt="团队在温室开展胡杨苗木相关研究"
            src={aboutAssets.teamGreenhouseImage}
          />
          <figcaption>团队科研与苗木实验场景</figcaption>
        </figure>
      </section>

      <section className="about-page-team-section about-page-institution-section">
        <div className="about-page-block-title">
          <ApartmentOutlined />
          <Typography.Title level={3}>多机构协作团队</Typography.Title>
        </div>
        <Typography.Paragraph className="about-page-institution-intro">
          各参与单位独立展示机构定位、协作方向和成员名录。尚未获得项目办公室确认的信息明确标注为待补充，避免用推测内容代替正式团队资料。
        </Typography.Paragraph>
        <div className="about-page-institution-grid">
          {partnerInstitutions.map((institution) => (
            <article
              className={`about-page-institution-card about-page-institution-card-${institution.tone}`}
              key={institution.id}
            >
              <header>
                <span>{institution.shortName.slice(0, 2)}</span>
                <div>
                  <Tag color={institution.tone === "lead" ? "green" : "blue"}>
                    {institution.role}
                  </Tag>
                  <strong>{institution.name}</strong>
                </div>
              </header>
              <p>{institution.description}</p>
              <div>
                {institution.focusAreas.map((focus) => (
                  <span key={focus}>{focus}</span>
                ))}
              </div>
              <footer>
                <CheckCircleOutlined />
                {institution.status}
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page-team-section">
        <div className="about-page-block-title">
          <ExperimentOutlined />
          <Typography.Title level={3}>研究方向</Typography.Title>
        </div>
        <div className="about-page-card-grid about-page-team-focus-grid">
          {teamFocusAreas.map((item, index) => (
            <article
              className="about-page-feature-card about-page-team-focus-card"
              key={item.title}
            >
              <span className="about-page-feature-icon">
                {teamFocusIcons[index]}
              </span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page-team-section">
        <div className="about-page-block-title">
          <FileSearchOutlined />
          <Typography.Title level={3}>团队前沿动态</Typography.Title>
        </div>
        <div className="about-page-team-news-grid">
          {teamNewsItems.map((item) => (
            <a
              className="about-page-team-news-card"
              href={item.url}
              key={item.title}
              rel="noreferrer"
              target="_blank"
            >
              <span>{item.date}</span>
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <em>
                查看详情
                <LinkOutlined />
              </em>
            </a>
          ))}
        </div>
      </section>

      <section className="about-page-split about-page-team-contact-section">
        <figure>
          <img
            alt="实验室中整理胡杨叶片材料"
            src={aboutAssets.labLeavesImage}
          />
          <figcaption>实验室样品整理与叶片观察</figcaption>
        </figure>
        <div>
          <div className="about-page-block-title">
            <FileSearchOutlined />
            <Typography.Title level={3}>联系我们</Typography.Title>
          </div>
          <div className="about-page-contact-list about-page-team-glow-card">
            {contactRows.map(([label, value]) => (
              <div
                className={
                  label === "通信地址" ? "about-page-contact-address" : ""
                }
                key={label}
              >
                <strong>{label}</strong>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function MembersSection({ section }: { section: AboutSection }) {
  return (
    <>
      <section className="about-page-members-hero">
        <div>
          <span className="about-page-kicker">{section.eyebrow}</span>
          <Typography.Title level={2}>{section.title}</Typography.Title>
          <Typography.Paragraph>{section.summary}</Typography.Paragraph>
        </div>
        <div className="about-page-highlight-row">
          {section.tags.map((item) => (
            <span key={item}>
              <CheckCircleOutlined />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="about-page-principal-showcase">
        <div className="about-page-principal-portrait">
          <img alt="李志军教授头像" src={aboutAssets.liZhijunPortrait} />
          <span>首席科学家</span>
        </div>
        <div className="about-page-principal-copy">
          <span className="about-page-kicker">
            PI & 胡杨保护生物学研究带头人
          </span>
          <Typography.Title level={2}>
            {principalScientist.name}
          </Typography.Title>
          <Typography.Text strong>
            {principalScientist.role} · {principalScientist.affiliation}
          </Typography.Text>
          <Typography.Paragraph>
            {principalScientist.description}
          </Typography.Paragraph>
          <Typography.Paragraph>
            {principalScientist.story}
          </Typography.Paragraph>
          <div className="about-page-chip-list about-page-principal-appointments">
            {principalScientist.highlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <a
            className="about-page-inline-link"
            href={principalScientist.source}
            rel="noreferrer"
            target="_blank"
          >
            查看人物事迹
            <LinkOutlined />
          </a>
        </div>
        <aside className="about-page-principal-honor-panel">
          <span className="about-page-kicker">重要荣誉</span>
          <div>
            {principalScientist.honorHighlights.map((item) => (
              <strong key={item}>{item}</strong>
            ))}
          </div>
        </aside>
      </section>

      <section className="about-page-principal-stat-grid">
        {principalScientist.stats.map((item) => (
          <article
            className="about-page-stat-card about-page-member-glow-card"
            key={item.label}
          >
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="about-page-team-section">
        <div className="about-page-block-title">
          <SafetyCertificateOutlined />
          <Typography.Title level={3}>科研方向与团队贡献</Typography.Title>
        </div>
        <div className="about-page-card-grid about-page-principal-theme-grid">
          {principalWorkThemes.map((item) => (
            <article
              className="about-page-feature-card about-page-member-glow-card"
              key={item.title}
            >
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page-team-section about-page-publication-section">
        <div className="about-page-block-title">
          <ReadOutlined />
          <Typography.Title level={3}>近年代表论文</Typography.Title>
        </div>
        <div className="about-page-publication-grid">
          {principalPublicationHighlights.map((paper) => (
            <article className="about-page-publication-card" key={paper.doi}>
              <div>
                <span>{paper.year}</span>
                <small>{paper.journal}</small>
              </div>
              <strong>{paper.title}</strong>
              <p>{paper.authors}</p>
              <em>{paper.summary}</em>
              <a href={paper.url} rel="noreferrer" target="_blank">
                DOI: {paper.doi}
                <LinkOutlined />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page-team-section about-page-institution-roster-section">
        <div className="about-page-block-title">
          <ApartmentOutlined />
          <Typography.Title level={3}>分机构成员名录</Typography.Title>
        </div>
        <Typography.Paragraph className="about-page-institution-intro">
          名录按机构独立维护，便于后续补充各单位负责人、科研成员、数据联系人和平台技术成员。
        </Typography.Paragraph>
        <div className="about-page-institution-roster-grid">
          {partnerInstitutions.map((institution) => (
            <article key={institution.id}>
              <header>
                <div>
                  <span>{institution.shortName}</span>
                  <strong>{institution.name}</strong>
                </div>
                <Tag color={institution.members.length ? "green" : "default"}>
                  {institution.members.length
                    ? `${institution.members.length} 位已展示成员`
                    : "待确认"}
                </Tag>
              </header>
              {institution.members.length ? (
                <div className="about-page-institution-member-list">
                  {institution.members.map((member) => (
                    <div key={member.name}>
                      <UserOutlined />
                      <span>
                        <strong>{member.name}</strong>
                        <small>{member.role}</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="about-page-institution-member-pending">
                  <UsergroupAddOutlined />
                  <strong>成员名单待正式确认</strong>
                  <span>确认后可在此补充负责人、研究方向与联系方式。</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="about-page-member-layout about-page-member-layout-polished">
        <div>
          <div className="about-page-block-title">
            <UsergroupAddOutlined />
            <Typography.Title level={3}>核心成员</Typography.Title>
          </div>
          <div className="about-page-member-grid">
            {coreMembers.map((member) => (
              <article
                key={member.name}
                className="about-page-member-card about-page-member-glow-card"
              >
                <span className="about-page-avatar">
                  <UserOutlined />
                </span>
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                  <p>{member.focus}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <figure className="about-page-member-research-photo">
          <img
            alt="李志军教授在温室查看胡杨苗木"
            src={aboutAssets.memberResearchSeedlingsImage}
          />
          <figcaption>李志军教授在温室查看胡杨苗木</figcaption>
        </figure>
      </section>
    </>
  );
}

export function KnowledgeSection({ section }: { section: AboutSection }) {
  const [hoveredGraphNodeId, setHoveredGraphNodeId] = useState<string | null>(
    null,
  );
  const graphNodeById = new Map(
    knowledgeGraphNodes.map((node) => [node.id, node]),
  );
  const graphDomains = [
    {
      group: "genome",
      index: "01",
      title: "基因组机制",
      summary: "雌雄基因组、性别决定区域与鉴定标记构成分子识别链条。",
      nodeIds: ["genome", "slr", "arr17", "marker"],
    },
    {
      group: "leaf",
      index: "02",
      title: "异形叶调控",
      summary: "从异形叶发育进入甲基化调控与转录组响应，解释叶形适应。",
      nodeIds: ["leaf", "methyl", "transcriptome"],
    },
    {
      group: "stress",
      index: "03",
      title: "抗逆适应",
      summary: "围绕盐旱胁迫、WOX 基因家族和灰杨比较研究形成抗逆证据链。",
      nodeIds: ["stress", "wox", "pruinosa"],
    },
    {
      group: "conservation",
      index: "04",
      title: "保护应用",
      summary: "将遥感监测、种质保育和生态修复连接到平台的数据服务场景。",
      nodeIds: ["monitoring", "germplasm", "restoration"],
    },
  ];
  const featuredPapers = knowledgePapers.slice(0, 2);
  const supportingPapers = knowledgePapers.slice(2);
  const defaultGraphNode =
    knowledgeGraphNodes.find((node) => node.id === "hub") ??
    knowledgeGraphNodes[0]!;
  const activeGraphNode =
    (hoveredGraphNodeId ? graphNodeById.get(hoveredGraphNodeId) : undefined) ??
    defaultGraphNode;
  const activeGraphNodeGroup =
    knowledgeGraphLegend.find((item) => item.group === activeGraphNode.group)
      ?.label ?? "知识节点";
  const activeGraphDomain =
    graphDomains.find((domain) => domain.group === activeGraphNode.group) ??
    graphDomains[0]!;
  const activeGraphDomainTitle =
    activeGraphNode.group === "hub" ? "联合知识体系" : activeGraphDomain.title;

  return (
    <>
      <section className="about-page-knowledge-hero">
        <div className="about-page-knowledge-hero-copy">
          <span className="about-page-kicker">{section.eyebrow}</span>
          <Typography.Title level={2}>
            胡杨知识（Populus euphratica）
          </Typography.Title>
          <Typography.Paragraph>
            面向胡杨林生态保护、种质资源保育和荒漠适应机制研究，本页将胡杨与灰杨相关科研成果重组为论文脉络、知识图谱、机制图解和生态价值四类内容，帮助用户从宏观生态屏障快速进入基因组、异形叶、抗逆响应等关键科学问题。
          </Typography.Paragraph>
          <div className="about-page-highlight-row">
            {section.tags.map((item) => (
              <span key={item}>
                <CheckCircleOutlined />
                {item}
              </span>
            ))}
          </div>
        </div>
        <figure>
          <img
            alt="河畔古胡杨林景观"
            src={aboutAssets.knowledgePopulusForestImage}
          />
          <figcaption>河畔古胡杨林与荒漠绿洲生态屏障</figcaption>
        </figure>
      </section>

      <section className="about-page-card-grid about-page-knowledge-theme-grid">
        {knowledgeThemes.map((item, themeIndex) => (
          <article
            className="about-page-feature-card about-page-knowledge-theme-card"
            id={`knowledge-theme-${themeIndex + 1}`}
            key={item.title}
          >
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="about-page-knowledge-paper-wall">
        <div className="about-page-block-title">
          <ReadOutlined />
          <Typography.Title level={3}>
            从学术前沿到分子密码的科研路径全景
          </Typography.Title>
        </div>
        <div className="about-page-paper-wall-layout">
          <div className="about-page-paper-feature-column">
            {featuredPapers.map((paper) => (
              <article
                className="about-page-paper-cover-card about-page-paper-cover-feature"
                key={paper.doi}
              >
                <div className="about-page-paper-cover-head">
                  <span>{paper.mark}</span>
                  <small>
                    {paper.volume} · {paper.impact}
                  </small>
                </div>
                <strong>{paper.title}</strong>
                <p>{paper.authors}</p>
                <em>{paper.summary}</em>
                <div>
                  <Tag color="green">{paper.year}</Tag>
                  <Tag>{paper.theme}</Tag>
                  <Tag>{paper.group}</Tag>
                </div>
                <a href={paper.url} rel="noreferrer" target="_blank">
                  DOI: {paper.doi}
                  <LinkOutlined />
                </a>
              </article>
            ))}
          </div>
          <div className="about-page-paper-support-grid">
            {supportingPapers.map((paper) => (
              <article className="about-page-paper-cover-card" key={paper.doi}>
                <div className="about-page-paper-cover-head">
                  <span>{paper.mark}</span>
                  <small>{paper.volume}</small>
                </div>
                <strong>{paper.title}</strong>
                <p>{paper.authors}</p>
                <em>{paper.summary}</em>
                <div>
                  <Tag color="green">{paper.year}</Tag>
                  <Tag>{paper.theme}</Tag>
                </div>
                <a href={paper.url} rel="noreferrer" target="_blank">
                  DOI: {paper.doi}
                  <LinkOutlined />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-page-split about-page-graph-section about-page-knowledge-map-section">
        <div className="about-page-knowledge-map-copy">
          <div className="about-page-block-title">
            <BranchesOutlined />
            <Typography.Title level={3}>
              胡杨知识互联网联合交互图谱
            </Typography.Title>
          </div>
          <Typography.Paragraph>
            知识图谱把论文中的基因组、性别决定、异形叶发育、抗逆适应、种质保育和遥感监测等知识点连接起来。节点之间的关系用于呈现研究主题的延展方向，鼠标悬停可查看简要说明，便于从单篇论文进入更完整的科研知识网络。
          </Typography.Paragraph>
          <div className="about-page-legend about-page-knowledge-legend">
            {knowledgeGraphLegend.map((item) => (
              <span data-group={item.group} key={item.group}>
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="about-page-knowledge-graph">
          <div className="about-page-graph-board">
            {graphDomains.map((domain) => {
              const isActiveDomain = activeGraphNode.group === domain.group;
              return (
                <article
                  className={`about-page-graph-domain about-page-graph-domain-${domain.group}${
                    isActiveDomain ? " about-page-graph-domain-active" : ""
                  }`}
                  key={domain.group}
                >
                  <header>
                    <span>{domain.index}</span>
                    <div>
                      <strong>{domain.title}</strong>
                      <small>{domain.summary}</small>
                    </div>
                  </header>
                  <div className="about-page-graph-chain">
                    {domain.nodeIds.map((nodeId) => {
                      const node = graphNodeById.get(nodeId);
                      if (!node) {
                        return null;
                      }
                      return (
                        <button
                          aria-label={`${node.label}：${node.detail}`}
                          className={`about-page-graph-chip about-page-graph-chip-${node.group}${
                            activeGraphNode.id === node.id
                              ? " about-page-graph-chip-active"
                              : ""
                          }`}
                          key={node.id}
                          title={node.detail}
                          type="button"
                          onClick={() => setHoveredGraphNodeId(node.id)}
                          onFocus={() => setHoveredGraphNodeId(node.id)}
                          onMouseEnter={() => setHoveredGraphNodeId(node.id)}
                        >
                          {node.label}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
            <button
              aria-label={`${defaultGraphNode.label}：${defaultGraphNode.detail}`}
              className={`about-page-graph-hub-card${
                activeGraphNode.id === defaultGraphNode.id
                  ? " about-page-graph-hub-card-active"
                  : ""
              }`}
              type="button"
              onClick={() => setHoveredGraphNodeId(defaultGraphNode.id)}
              onFocus={() => setHoveredGraphNodeId(defaultGraphNode.id)}
              onMouseEnter={() => setHoveredGraphNodeId(defaultGraphNode.id)}
            >
              <span>知识枢纽</span>
              <strong>{defaultGraphNode.label}</strong>
              <small>整合论文证据、平台数据与应用场景</small>
            </button>
          </div>
          <aside
            className={`about-page-graph-detail about-page-graph-detail-${activeGraphNode.group}`}
          >
            <div>
              <span>{activeGraphNodeGroup}</span>
              <small>{activeGraphDomainTitle}</small>
            </div>
            <strong>{activeGraphNode.label}</strong>
            <p>{activeGraphNode.detail}</p>
          </aside>
        </div>
      </section>

      <section className="about-page-knowledge-mechanism-section">
        <div className="about-page-block-title">
          <SafetyCertificateOutlined />
          <Typography.Title level={3}>核心机制图解</Typography.Title>
        </div>
        <div className="about-page-knowledge-mechanism-grid">
          {knowledgeMechanisms.map((item) => (
            <article
              className={`about-page-mechanism-card about-page-mechanism-card-${item.tone}`}
              key={item.title}
            >
              <div>
                <span className="about-page-feature-icon">
                  <SafetyCertificateOutlined />
                </span>
                <small>{item.source}</small>
              </div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <div className="about-page-mechanism-diagram">
                {item.steps.map((step) => (
                  <span key={step}>{step}</span>
                ))}
              </div>
              <div className="about-page-chip-list">
                {item.tags.map((tag) => (
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
            <Typography.Title level={3}>沙漠卫士与绿色屏障</Typography.Title>
          </div>
          <Typography.Paragraph>
            胡杨以强大的耐旱、耐盐碱和河岸固沙能力守护干旱区绿洲，被誉为“沙漠卫士”。在塔里木河流域，沿河岸延展的天然胡杨林构成抵御风沙侵袭的绿色屏障，也为种质资源保育、气候变化响应和区域生态修复研究提供不可替代的天然样本。
          </Typography.Paragraph>
        </div>
        <div className="about-page-knowledge-value-grid">
          {knowledgeValueCards.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function DocsSection({ section }: { section: AboutSection }) {
  const [activeArticleId, setActiveArticleId] = useState("platform-guide");
  const [searchKeyword, setSearchKeyword] = useState("");
  const activeArticle =
    helpArticles.find((article) => article.id === activeArticleId) ??
    helpArticles[0]!;
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredCategories = helpCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        const article = helpArticles.find(
          (candidate) => candidate.id === item.articleId,
        );
        return article ? helpArticleMatches(article, normalizedKeyword) : true;
      }),
    }))
    .filter((category) => category.items.length > 0);
  const filteredFaq = helpFaq.filter((item) => {
    if (!normalizedKeyword) {
      return true;
    }
    return `${item.question} ${item.answer}`
      .toLowerCase()
      .includes(normalizedKeyword);
  });

  return (
    <>
      <section className="about-page-help-hero">
        <div className="about-page-help-hero-copy">
          <span className="about-page-kicker">{section.eyebrow}</span>
          <Typography.Title level={2}>{section.title}</Typography.Title>
          <Typography.Paragraph>{section.summary}</Typography.Paragraph>
          <div
            className="about-page-help-audience-grid"
            aria-label="帮助文档适用对象"
          >
            {helpAudienceCards.map((card) => (
              <article key={card.title}>
                <strong>{card.title}</strong>
                <span>{card.description}</span>
              </article>
            ))}
          </div>
          <div className="about-page-help-actions">
            {helpQuickLinks.map((quickLink) => (
              <button
                aria-pressed={activeArticle.id === quickLink.articleId}
                key={quickLink.articleId}
                type="button"
                onClick={() => setActiveArticleId(quickLink.articleId)}
              >
                <CheckCircleOutlined />
                {quickLink.label}
              </button>
            ))}
          </div>
        </div>
        <div className="about-page-help-download">
          <FilePdfOutlined />
          <strong>离线帮助文档</strong>
          <small>{helpDocumentDownload.meta}</small>
          <Button
            download={helpDocumentDownload.filename}
            href={helpDocumentDownload.href}
            icon={<DownloadOutlined />}
            type="primary"
          >
            {helpDocumentDownload.label}
          </Button>
        </div>
      </section>

      <section className="about-page-help-shell">
        <aside className="about-page-help-index">
          <Input
            allowClear
            aria-label="搜索帮助文章"
            placeholder="搜索帮助文章"
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
          />
          <div className="about-page-help-index-groups">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category) => (
                <div key={category.title}>
                  <strong>{category.title}</strong>
                  {category.items.map((item) => (
                    <button
                      aria-current={
                        activeArticle.id === item.articleId ? "page" : undefined
                      }
                      className={
                        activeArticle.id === item.articleId
                          ? "about-page-help-index-active"
                          : ""
                      }
                      key={item.articleId}
                      type="button"
                      onClick={() => setActiveArticleId(item.articleId)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <p className="about-page-help-empty">没有匹配的帮助文章。</p>
            )}
          </div>
        </aside>

        <article className="about-page-help-reader">
          <span className="about-page-kicker">
            帮助 / {activeArticle.category} / {activeArticle.title}
          </span>
          <Typography.Title level={3}>{activeArticle.title}</Typography.Title>
          <Typography.Paragraph>{activeArticle.summary}</Typography.Paragraph>
          <div className="about-page-help-meta">
            {activeArticle.audiences.map((audience) => (
              <Tag color="green" key={audience}>
                {audience}
              </Tag>
            ))}
            {activeArticle.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <div className="about-page-help-content">
            {activeArticle.blocks.map((block) => (
              <HelpArticleBlockView block={block} key={block.title} />
            ))}
          </div>
        </article>

        <aside className="about-page-help-side">
          <section className="about-page-help-side-panel about-page-help-download-panel">
            <FilePdfOutlined />
            <strong>PDF 帮助文档</strong>
            <p>{helpDocumentDownload.meta}</p>
            <Button
              download={helpDocumentDownload.filename}
              href={helpDocumentDownload.href}
              icon={<DownloadOutlined />}
              block
              type="primary"
            >
              下载 PDF
            </Button>
          </section>
          <section className="about-page-help-side-panel">
            <div className="about-page-block-title">
              <BookOutlined />
              <Typography.Title level={4}>常见问题</Typography.Title>
            </div>
            <div className="about-page-help-faq-list">
              {(filteredFaq.length > 0 ? filteredFaq : helpFaq).map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="about-page-pro-tip">
            反馈问题时请附上账号角色、页面路径、资源名称、截图和复现步骤；导入或栅格任务请同时提供任务
            ID。
          </section>
        </aside>
      </section>
    </>
  );
}

function HelpArticleBlockView({ block }: { block: HelpArticleBlock }) {
  if (block.type === "steps") {
    return (
      <section className="about-page-help-block">
        <Typography.Title level={4}>{block.title}</Typography.Title>
        <div className="about-page-help-steps">
          {block.items.map((item, index) => (
            <div key={item.title}>
              <span>{index + 1}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (block.type === "note") {
    return (
      <section className="about-page-help-note">
        <strong>{block.title}</strong>
        <p>{block.body}</p>
      </section>
    );
  }

  if (block.type === "table") {
    return (
      <section className="about-page-help-block">
        <Typography.Title level={4}>{block.title}</Typography.Title>
        <div className="about-page-help-table-wrap">
          <table className="about-page-help-table">
            <thead>
              <tr>
                {block.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, index) => (
                    <td key={`${index}-${cell}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="about-page-help-block">
      <Typography.Title level={4}>{block.title}</Typography.Title>
      <ul
        className={
          block.type === "checklist"
            ? "about-page-help-checklist"
            : "about-page-help-bullets"
        }
      >
        {block.items.map((item) => (
          <li key={item}>
            {block.type === "checklist" ? <CheckCircleOutlined /> : null}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function helpArticleMatches(article: HelpArticle, normalizedKeyword: string) {
  if (!normalizedKeyword) {
    return true;
  }
  return [
    article.category,
    article.title,
    article.summary,
    ...article.audiences,
    ...article.tags,
    ...article.blocks.flatMap(helpBlockText),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedKeyword);
}

function helpBlockText(block: HelpArticleBlock) {
  if (block.type === "steps") {
    return [
      block.title,
      ...block.items.flatMap((item) => [item.title, item.description]),
    ];
  }
  if (block.type === "note") {
    return [block.title, block.body];
  }
  if (block.type === "table") {
    return [block.title, ...block.columns, ...block.rows.flat()];
  }
  return [block.title, ...block.items];
}
