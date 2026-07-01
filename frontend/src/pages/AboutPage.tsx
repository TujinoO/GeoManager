import {
  BookOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReadOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Layout, Progress, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  aboutSectionByKey,
  aboutSections,
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

const sectionProgress: Record<AboutSectionKey, number> = {
  system: 35,
  team: 20,
  members: 18,
  knowledge: 25,
  docs: 30,
};

export default function AboutPage() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const params = useParams();
  const activeSection = aboutSectionByKey(params.section);
  const permissions = user?.permissions;
  const canBrowseData = Boolean(permissions?.canBrowseData);

  const allKeywords = useMemo(
    () => Array.from(new Set(aboutSections.flatMap((section) => section.highlights))),
    [],
  );

  return (
    <Layout className="workspace">
      <WorkspaceHeader activeTab="about" canBrowseData={canBrowseData} />
      <div className="workspace-body workspace-body-about">
        <aside className="about-page-nav-panel">
          <div className="about-page-panel-head">
            <Typography.Text strong>关于我们</Typography.Text>
            <Tag>信息中心</Tag>
          </div>
          <div className="about-page-nav-list">
            {aboutSections.map((section) => (
              <button
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
                  <small>{section.badge}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="about-page-main-panel">
          <section className="about-page-hero">
            <div>
              <span className="about-page-kicker">{activeSection.eyebrow}</span>
              <Typography.Title level={2}>{activeSection.title}</Typography.Title>
              <Typography.Paragraph>{activeSection.summary}</Typography.Paragraph>
            </div>
            <div className="about-page-hero-meter">
              <span className="about-page-hero-icon">
                {sectionIcons[activeSection.key]}
              </span>
              <strong>{sectionProgress[activeSection.key]}%</strong>
              <small>内容占位进度</small>
            </div>
          </section>

          <section className="about-page-highlight-row">
            {activeSection.highlights.map((item) => (
              <span key={item}>
                <CheckCircleOutlined />
                {item}
              </span>
            ))}
          </section>

          <section className="about-page-block-grid">
            {activeSection.blocks.map((block) => (
              <article className="about-page-block" key={block.title}>
                <div className="about-page-block-title">
                  <BookOutlined />
                  <Typography.Title level={4}>{block.title}</Typography.Title>
                </div>
                <Typography.Paragraph>{block.description}</Typography.Paragraph>
                <div className="about-page-chip-list">
                  {block.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className="about-page-timeline">
            <div className="about-page-block-title">
              <InfoCircleOutlined />
              <Typography.Title level={4}>后续完善方向</Typography.Title>
            </div>
            <div className="about-page-step-list">
              <span>前端栏目与详情页已预留</span>
              <span>后续接入后台可维护内容</span>
              <span>最终形成文档、团队、知识一体化展示</span>
            </div>
          </section>
        </main>

        <aside className="about-page-side-panel">
          <div className="about-page-panel-head">
            <Typography.Text strong>栏目状态</Typography.Text>
            <Tag color="cyan">占位</Tag>
          </div>
          <div className="about-page-status-card">
            <span className="about-page-status-icon">
              {sectionIcons[activeSection.key]}
            </span>
            <strong>{activeSection.title}</strong>
            <small>{activeSection.badge}</small>
          </div>
          <div className="about-page-progress-list">
            {aboutSections.map((section) => (
              <label key={section.key}>
                <span>{section.title}</span>
                <Progress
                  percent={sectionProgress[section.key]}
                  showInfo={false}
                  strokeColor="#22b8ae"
                  trailColor="rgba(25, 79, 76, 0.12)"
                />
              </label>
            ))}
          </div>
          <div className="about-page-keyword-cloud">
            {allKeywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        </aside>
      </div>
    </Layout>
  );
}
