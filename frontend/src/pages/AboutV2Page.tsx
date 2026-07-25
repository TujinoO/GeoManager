import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Button, Layout, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  aboutAssets,
  aboutNavigationSections,
  aboutSectionByKey,
  platformDisplayName,
  systemCapabilities,
  systemIntroduction,
  systemRoadmap,
  type AboutSection,
  type AboutSectionKey,
} from "../about/aboutSections";
import {
  contactChannels,
  institutionById,
  institutionProfiles,
  platformServiceChain,
  platformStats,
  type InstitutionProfile,
} from "../about/contentV2";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import { DocsSection } from "./AboutPage";

const sectionIcons: Record<AboutSectionKey, ReactNode> = {
  system: <InfoCircleOutlined />,
  team: <TeamOutlined />,
  members: <UsergroupAddOutlined />,
  knowledge: <GlobalOutlined />,
  contact: <MailOutlined />,
  docs: <FileTextOutlined />,
};

const capabilityIcons = [
  <DatabaseOutlined key="database" />,
  <GlobalOutlined key="global" />,
  <ApartmentOutlined key="apartment" />,
  <SafetyCertificateOutlined key="safety" />,
];

export default function AboutV2Page() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const params = useParams();
  const activeSection = aboutSectionByKey(params.section);
  const activeInstitution = institutionById(params.institutionId);

  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="about"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
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
          {activeInstitution ? (
            <div className="about-v2-nav-context">
              <span>当前单位</span>
              <strong>{activeInstitution.shortName}</strong>
              <small>{activeInstitution.leader}团队</small>
            </div>
          ) : null}
        </aside>

        <main className="about-page-main-panel">
          {renderContent(activeSection, activeInstitution, navigate)}
        </main>
      </div>
    </Layout>
  );
}

function renderContent(
  section: AboutSection,
  institution: InstitutionProfile | undefined,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (section.key === "team") {
    return institution ? (
      <InstitutionDetail
        institution={institution}
        mode="team"
        onBack={() => navigate("/about/team")}
        onSwitch={() => navigate(`/about/members/${institution.id}`)}
      />
    ) : (
      <InstitutionOverview mode="team" onNavigate={navigate} />
    );
  }
  if (section.key === "members") {
    return institution ? (
      <InstitutionDetail
        institution={institution}
        mode="members"
        onBack={() => navigate("/about/members")}
        onSwitch={() => navigate(`/about/team/${institution.id}`)}
      />
    ) : (
      <InstitutionOverview mode="members" onNavigate={navigate} />
    );
  }
  if (section.key === "contact") {
    return <ContactSection />;
  }
  if (section.key === "docs") {
    return <DocsSection section={section} />;
  }
  return <SystemOverview />;
}

function SystemOverview() {
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
            <strong>{platformDisplayName.zh}</strong>
            <small>{platformDisplayName.en}</small>
          </span>
          <Typography.Title level={1}>
            守护大漠英雄树，共筑开放科研数据底座
          </Typography.Title>
          <Typography.Paragraph>
            连接遥感影像、野外调查、长期监测、样品记录与科研成果，让胡杨林生态保护数据可发现、可理解、可复用、可追溯。
          </Typography.Paragraph>
          <div className="about-v2-hero-tags">
            {systemIntroduction.highlights.map((item) => (
              <span key={item}>
                <CheckCircleOutlined />
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="about-v2-hero-stat-grid">
          {platformStats.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="about-v2-platform-statement">
        <span className="about-page-kicker">平台定位</span>
        <Typography.Title level={2}>{systemIntroduction.lead}</Typography.Title>
        <Typography.Paragraph>{systemIntroduction.body}</Typography.Paragraph>
      </section>

      <section className="about-v2-section about-v2-service-section">
        <SectionTitle
          icon={<CompassOutlined />}
          eyebrow="DATA SERVICE CHAIN"
          title="从一份原始记录到可复用科研资产"
          description="平台将内容、空间位置、权属、质量与应用场景组织在同一条服务链中。"
        />
        <div className="about-v2-service-chain">
          {platformServiceChain.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-v2-section">
        <SectionTitle
          icon={<DatabaseOutlined />}
          eyebrow="CORE CAPABILITIES"
          title="面向胡杨林保护的四类核心能力"
          description="兼顾数据治理、空间表达、专题组织与权限共享，保持科研工作流连续。"
        />
        <div className="about-page-card-grid about-page-capability-grid">
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
        </div>
      </section>

      <section className="about-v2-section">
        <SectionTitle
          icon={<ApartmentOutlined />}
          eyebrow="COLLABORATION NETWORK"
          title="四家核心单位形成跨尺度科研协作"
          description="从分子机制、种质资源到遥感监测、生态水文和长期定位观测，构建互补的数据生产与应用网络。"
        />
        <div className="about-v2-institution-strip">
          {institutionProfiles.map((institution) => (
            <article key={institution.id}>
              <span>{institution.eyebrow}</span>
              <strong>{institution.shortName}</strong>
              <p>{institution.positioning}</p>
              <small>
                {institution.leader} · {institution.leaderTitle}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page-band about-page-system-goals about-v2-section">
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

function InstitutionOverview({
  mode,
  onNavigate,
}: {
  mode: "team" | "members";
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  const isTeam = mode === "team";
  return (
    <>
      <section className="about-v2-directory-hero">
        <div>
          <span className="about-page-kicker">
            {isTeam ? "RESEARCH NETWORK" : "MEMBER DIRECTORY"}
          </span>
          <Typography.Title level={2}>
            {isTeam
              ? "四家核心单位协同守护胡杨林"
              : "按单位进入团队成员二级名录"}
          </Typography.Title>
          <Typography.Paragraph>
            {isTeam
              ? "平台将每家单位作为独立科研节点展示，清晰呈现负责人、研究方向、科研贡献、观测基础和代表成果。"
              : "成员信息按所属单位独立维护，避免跨机构混排；进入二级页可查看负责人档案、科研成员、代表论文与联系方式。"}
          </Typography.Paragraph>
        </div>
        <div className="about-v2-directory-summary">
          <strong>4</strong>
          <span>核心科研单位</span>
          <small>{isTeam ? "跨尺度协作" : "分机构名录"}</small>
        </div>
      </section>

      <div className="about-v2-institution-grid">
        {institutionProfiles.map((institution, index) => (
          <article className="about-v2-institution-card" key={institution.id}>
            <div
              className="about-v2-institution-image"
              style={{ backgroundImage: `url(${institution.heroImage})` }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{institution.eyebrow}</small>
            </div>
            <div className="about-v2-institution-copy">
              <header>
                <div>
                  <span>{institution.shortName}</span>
                  <strong>{institution.name}</strong>
                </div>
                <Tag color="green">
                  {isTeam
                    ? "科研节点"
                    : `${institution.members.length + 1} 位成员`}
                </Tag>
              </header>
              <p>{institution.positioning}</p>
              <div className="about-v2-leader-line">
                {institution.portrait ? (
                  <img
                    alt={`${institution.leader}照片`}
                    src={institution.portrait}
                  />
                ) : (
                  <span>
                    <UserOutlined />
                  </span>
                )}
                <div>
                  <strong>{institution.leader}</strong>
                  <small>{institution.leaderTitle}</small>
                </div>
              </div>
              <div className="about-v2-focus-tags">
                {institution.focusAreas.slice(0, 3).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <Button
                icon={<ArrowRightOutlined />}
                iconPosition="end"
                type="primary"
                onClick={() => onNavigate(`/about/${mode}/${institution.id}`)}
              >
                {isTeam ? "查看团队详情" : "进入成员名录"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function InstitutionDetail({
  institution,
  mode,
  onBack,
  onSwitch,
}: {
  institution: InstitutionProfile;
  mode: "team" | "members";
  onBack: () => void;
  onSwitch: () => void;
}) {
  const isTeam = mode === "team";
  return (
    <>
      <div className="about-v2-detail-toolbar">
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>
          返回{isTeam ? "团队总览" : "成员名录"}
        </Button>
        <Button
          icon={<ArrowRightOutlined />}
          iconPosition="end"
          onClick={onSwitch}
        >
          {isTeam ? "查看成员名录" : "查看团队介绍"}
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
            <img alt={`${institution.leader}照片`} src={institution.portrait} />
          ) : (
            <span className="about-v2-hero-leader-placeholder">
              <UserOutlined />
            </span>
          )}
          <small>团队负责人</small>
          <strong>{institution.leader}</strong>
          <span>{institution.leaderTitle}</span>
          {institution.email ? (
            <a href={`mailto:${institution.email}`}>{institution.email}</a>
          ) : null}
        </div>
      </section>

      <div className="about-v2-metric-grid">
        {institution.metrics.map((metric) => (
          <article key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </article>
        ))}
      </div>

      {isTeam ? (
        <>
          <section className="about-v2-section about-v2-detail-intro">
            <div>
              <span className="about-page-kicker">团队介绍</span>
              <Typography.Title level={2}>科研定位与协作价值</Typography.Title>
              <Typography.Paragraph>{institution.summary}</Typography.Paragraph>
              {institution.sourceUrl ? (
                <a
                  href={institution.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  查看公开资料来源 <LinkOutlined />
                </a>
              ) : null}
            </div>
            <div className="about-v2-focus-panel">
              <strong>重点研究方向</strong>
              {institution.focusAreas.map((item) => (
                <p key={item}>
                  <CheckCircleOutlined />
                  {item}
                </p>
              ))}
            </div>
          </section>

          <section className="about-v2-section">
            <SectionTitle
              icon={<SafetyCertificateOutlined />}
              eyebrow="SCIENTIFIC CONTRIBUTIONS"
              title="科研贡献与平台支撑"
              description="以可验证的研究、监测和示范工作构成团队在平台中的专业角色。"
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

          {institution.gallery.length ? (
            <section className="about-v2-section">
              <SectionTitle
                icon={<GlobalOutlined />}
                eyebrow="FIELD EVIDENCE"
                title="观测基础与科研现场"
                description="来自材料中的实景与分析成果，连接团队介绍和真实科研工作。"
              />
              <div className="about-v2-gallery">
                {institution.gallery.map((item) => (
                  <figure key={item.src}>
                    <img alt={item.alt} src={item.src} />
                    <figcaption>{item.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <section className="about-v2-section">
            <SectionTitle
              icon={<UsergroupAddOutlined />}
              eyebrow="MEMBER DIRECTORY"
              title={`${institution.shortName}核心成员`}
              description="成员按研究角色与专业方向组织，负责人信息在上方独立展示。"
            />
            <div className="about-v2-member-grid">
              {institution.members.map((member) => (
                <article key={member.name}>
                  <span>
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
          </section>

          <section className="about-v2-section">
            <SectionTitle
              icon={<FileTextOutlined />}
              eyebrow="SELECTED OUTPUTS"
              title="代表论文与专著"
              description="展示材料中已列出的代表成果，便于用户继续追踪科研证据。"
            />
            <div className="about-v2-publication-list">
              {institution.publications.map((publication) => (
                <article key={publication.title}>
                  <span>{publication.meta}</span>
                  <strong>{publication.title}</strong>
                  {publication.url ? (
                    <a href={publication.url} rel="noreferrer" target="_blank">
                      访问来源 <LinkOutlined />
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

function ContactSection() {
  return (
    <>
      <section className="about-v2-contact-hero">
        <div>
          <span className="about-page-kicker">CONTACT & SUPPORT</span>
          <Typography.Title level={2}>
            把问题发给真正能处理的人
          </Typography.Title>
          <Typography.Paragraph>
            平台按“数据与权限”和“平台技术”两类场景分流。发送邮件前附上必要信息，可显著缩短定位与回复时间。
          </Typography.Paragraph>
        </div>
        <div className="about-v2-contact-promise">
          <MailOutlined />
          <strong>邮件受理</strong>
          <span>清晰分类 · 完整信息 · 可复现描述</span>
        </div>
      </section>

      <div className="about-v2-contact-grid">
        {contactChannels.map((channel) => (
          <article key={channel.type}>
            <header>
              <span>{channel.type}</span>
              <MailOutlined />
            </header>
            <strong>{channel.title}</strong>
            <p>{channel.description}</p>
            <a href={`mailto:${channel.email}`}>{channel.email}</a>
            <div>
              <small>邮件中请附</small>
              {channel.preparation.map((item) => (
                <span key={item}>
                  <CheckCircleOutlined />
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className="about-v2-section about-v2-contact-guide">
        <SectionTitle
          icon={<CompassOutlined />}
          eyebrow="SUPPORT WORKFLOW"
          title="一次有效反馈应包含什么"
          description="让接收人能够在不反复追问的情况下复现、判断并处理问题。"
        />
        <div className="about-v2-contact-steps">
          {[
            ["01", "说明身份", "写明姓名、单位、账号和当前角色。"],
            ["02", "描述目标", "说明想访问的数据或希望完成的操作。"],
            ["03", "提供证据", "附页面路径、资源名称、截图和错误提示。"],
            ["04", "给出步骤", "按发生顺序描述操作与期望结果。"],
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
          <span>通信地址</span>
          <strong>新疆阿拉尔市塔里木大学生命科学与技术学院</strong>
          <small>邮政编码：843300</small>
        </div>
        <div>
          <span>安全提醒</span>
          <strong>请勿通过普通邮件发送密码或未脱敏敏感数据</strong>
          <small>涉及受控数据时，请先完成权限确认与安全传输约定。</small>
        </div>
      </section>
    </>
  );
}

function SectionTitle({
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
