import {
  FileTextOutlined,
  InfoCircleOutlined,
  MailOutlined,
  NotificationOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Typography } from "antd";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { aboutNavigationSections } from "../about/aboutSections";
import { currentLocale } from "../i18n";

type NavigationKey = (typeof aboutNavigationSections)[number]["key"];
const icons: Partial<Record<NavigationKey, ReactNode>> = {
  system: <InfoCircleOutlined />,
  team: <TeamOutlined />,
  news: <NotificationOutlined />,
  members: <UsergroupAddOutlined />,
  contact: <MailOutlined />,
  docs: <FileTextOutlined />,
};
const englishLabels: Partial<Record<NavigationKey, [string, string]>> = {
  system: ["Platform", "Mission and capabilities"],
  team: ["Research Network", "Partner institutions"],
  news: ["Team News", "News and research progress"],
  members: ["Members", "Institutional directories"],
  contact: ["Contact", "Data and technical support"],
  docs: ["Help Center", "Workflows and guidance"],
};

export default function AboutSidebar({
  activeKey,
  children,
}: {
  activeKey: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const english = currentLocale() === "en-US";
  const label = english ? "About Us" : "关于我们";
  return (
    <aside className="about-page-nav-panel" aria-label={label}>
      <div className="about-page-panel-head">
        <Typography.Text strong>{label}</Typography.Text>
      </div>
      <nav className="about-page-nav-list" aria-label={label}>
        {aboutNavigationSections.map((section) => {
          const translated = english ? englishLabels[section.key] : undefined;
          const active = section.key === activeKey;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={`about-page-nav-item${active ? " about-page-nav-item-active" : ""}`}
              key={section.key}
              type="button"
              onClick={() => navigate(section.path)}
            >
              <span className="about-page-nav-icon">{icons[section.key]}</span>
              <span>
                <strong>{translated?.[0] ?? section.title}</strong>
                <small>{translated?.[1] ?? section.navSummary}</small>
              </span>
            </button>
          );
        })}
      </nav>
      {children}
    </aside>
  );
}
