import { Layout, Typography } from "antd";
import { aboutSectionByKey, knowledgeThemes } from "../about/aboutSections";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";
import { KnowledgeSection } from "./AboutPage";

export default function KnowledgePage() {
  const { user } = useAppContext();
  const section = aboutSectionByKey("knowledge");

  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="knowledge"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <div className="workspace-body workspace-body-about">
        <aside className="about-page-nav-panel knowledge-page-nav-panel">
          <div className="about-page-panel-head">
            <Typography.Text strong>胡杨科普</Typography.Text>
          </div>
          <nav className="knowledge-page-topic-nav" aria-label="胡杨科普主题">
            {knowledgeThemes.map((theme, themeIndex) => (
              <a href={`#knowledge-theme-${themeIndex + 1}`} key={theme.title}>
                <span>{String(themeIndex + 1).padStart(2, "0")}</span>
                <strong>{theme.title}</strong>
              </a>
            ))}
          </nav>
          <p className="knowledge-page-nav-note">
            从物种认知、基因组机制到抗逆适应和保护应用，形成独立的胡杨科研科普入口。
          </p>
        </aside>
        <main className="about-page-main-panel knowledge-page-main-panel">
          <KnowledgeSection section={section} />
        </main>
      </div>
    </Layout>
  );
}
