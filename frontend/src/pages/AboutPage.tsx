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
  NodeIndexOutlined,
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
  aboutSectionByKey,
  aboutSections,
  contactRows,
  cooperationNodes,
  coreMembers,
  helpArticles,
  helpCategories,
  helpDocumentDownload,
  helpFaq,
  helpQuickLinks,
  type HelpArticle,
  type HelpArticleBlock,
  knowledgeGraphNodes,
  knowledgeGraphEdges,
  knowledgeGraphClusters,
  knowledgeGraphLegend,
  knowledgeMechanisms,
  knowledgePapers,
  knowledgeThemes,
  knowledgeValueCards,
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
            {aboutSections.map((section) => (
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
          backgroundImage: `linear-gradient(90deg, rgba(7, 35, 31, 0.72), rgba(7, 35, 31, 0.2)), url(${aboutAssets.populusForestImage})`,
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

        <div>
          <div className="about-page-block-title">
            <NodeIndexOutlined />
            <Typography.Title level={3}>稳定合作网络</Typography.Title>
          </div>
          <div className="about-page-network">
            <svg aria-hidden="true" viewBox="0 0 100 100">
              <line x1="46" x2="20" y1="48" y2="28" />
              <line x1="46" x2="72" y1="48" y2="28" />
              <line x1="46" x2="30" y1="48" y2="76" />
              <line x1="46" x2="68" y1="48" y2="76" />
            </svg>
            {cooperationNodes.map((node) => (
              <span
                className={`about-page-network-node about-page-network-${node.type}`}
                key={node.name}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <strong>{node.name}</strong>
                <small>{node.type}</small>
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function KnowledgeSection({ section }: { section: AboutSection }) {
  const graphNodeById = new Map(
    knowledgeGraphNodes.map((node) => [node.id, node]),
  );
  const graphEdges = knowledgeGraphEdges.flatMap((edge) => {
    const from = graphNodeById.get(edge.from);
    const to = graphNodeById.get(edge.to);
    return from && to
      ? [{ ...edge, from, to, key: `${edge.from}-${edge.to}` }]
      : [];
  });
  const featuredPapers = knowledgePapers.slice(0, 2);
  const supportingPapers = knowledgePapers.slice(2);

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
            alt="李志军教授在温室查看胡杨苗木"
            src={aboutAssets.researchSeedlingsImage}
          />
          <figcaption>胡杨苗木培育与保护生物学研究场景</figcaption>
        </figure>
      </section>

      <section className="about-page-card-grid about-page-knowledge-theme-grid">
        {knowledgeThemes.map((item) => (
          <article
            className="about-page-feature-card about-page-knowledge-theme-card"
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
          <div className="about-page-graph-clusters" aria-hidden="true">
            {knowledgeGraphClusters.map((cluster) => (
              <span
                className={`about-page-graph-cluster about-page-graph-cluster-${cluster.group}`}
                key={cluster.group}
              >
                {cluster.label}
              </span>
            ))}
          </div>
          <svg aria-hidden="true" viewBox="0 0 100 100">
            <defs>
              <filter
                id="about-page-graph-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur result="blur" stdDeviation="0.7" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {graphEdges.map((edge) => (
              <g
                className={`about-page-graph-edge-group about-page-graph-edge-${edge.tone}`}
                key={edge.key}
              >
                <path d={getKnowledgeGraphPath(edge)} />
                <text
                  x={getKnowledgeGraphLabelPoint(edge).x}
                  y={getKnowledgeGraphLabelPoint(edge).y}
                >
                  {edge.label}
                </text>
              </g>
            ))}
          </svg>
          {knowledgeGraphNodes.map((node) => (
            <span
              className={`about-page-graph-node about-page-graph-${node.group}`}
              key={node.id}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              title={node.detail}
            >
              <strong>{node.label}</strong>
              <small>{node.detail}</small>
            </span>
          ))}
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

function getKnowledgeGraphPath(edge: {
  bend?: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const bend = edge.bend ?? 0;
  const { x, y } = getKnowledgeGraphControlPoint(edge, bend);
  return `M ${edge.from.x} ${edge.from.y} Q ${x} ${y} ${edge.to.x} ${edge.to.y}`;
}

function getKnowledgeGraphLabelPoint(edge: {
  bend?: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const bend = (edge.bend ?? 0) * 0.62;
  return getKnowledgeGraphControlPoint(edge, bend);
}

function getKnowledgeGraphControlPoint(
  edge: {
    from: { x: number; y: number };
    to: { x: number; y: number };
  },
  bend: number,
) {
  const midX = (edge.from.x + edge.to.x) / 2;
  const midY = (edge.from.y + edge.to.y) / 2;
  const dx = edge.to.x - edge.from.x;
  const dy = edge.to.y - edge.from.y;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x: midX + (-dy / distance) * bend,
    y: midY + (dx / distance) * bend,
  };
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
          <section className="about-page-help-side-panel about-page-help-download-panel">
            <FilePdfOutlined />
            <strong>PDF 版本</strong>
            <p>{helpDocumentDownload.meta}</p>
            <Button
              download={helpDocumentDownload.filename}
              href={helpDocumentDownload.href}
              icon={<DownloadOutlined />}
              block
            >
              下载 PDF
            </Button>
          </section>
          <section className="about-page-pro-tip">
            提交问题时请附上资源名称、操作路径、截图和复现步骤，便于管理员快速定位。
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
  return [block.title, ...block.items];
}
