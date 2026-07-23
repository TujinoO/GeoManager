import {
  AlertOutlined,
  BellOutlined,
  CloudOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Layout, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import warningPoplarMountainAerialImage from "../assets/portal/warning-poplar-mountain-aerial.png";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";

const plannedCapabilities: Array<{
  icon: ReactNode;
  title: string;
  description: string;
}> = [
  {
    icon: <RadarChartOutlined />,
    title: "遥感变化监测",
    description: "预留胡杨林覆盖变化、退化斑块和异常变化识别能力。",
  },
  {
    icon: <CloudOutlined />,
    title: "水分与气候胁迫",
    description: "规划接入水文、土壤和气象指标，形成阈值监测与趋势研判。",
  },
  {
    icon: <BellOutlined />,
    title: "预警消息与处置",
    description: "规划预警分级、消息通知、处置记录和闭环跟踪。",
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "规则与权限管理",
    description: "后续统一管理指标来源、阈值规则、可见范围和审计记录。",
  },
];

export default function WarningPage() {
  const { user } = useAppContext();

  return (
    <Layout className="portal-shell warning-page-shell">
      <WorkspaceHeader
        activeTab="warning"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <main className="portal-content-page warning-page">
        <section
          className="portal-hero warning-page-hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(5, 29, 33, 0.95) 0%, rgba(8, 39, 43, 0.78) 42%, rgba(9, 31, 36, 0.38) 72%, rgba(4, 23, 29, 0.58) 100%), url(${warningPoplarMountainAerialImage})`,
          }}
        >
          <div>
            <Tag color="gold">二期建设预留</Tag>
            <Typography.Title level={1}>智能预警</Typography.Title>
            <Typography.Paragraph>
              面向胡杨林生态保护的实时监测、异常识别和分级预警入口。本期完成模块占位与信息架构，不展示未经接入验证的实时数据。
            </Typography.Paragraph>
          </div>
          <AlertOutlined aria-hidden="true" />
        </section>

        <section className="warning-capability-grid">
          {plannedCapabilities.map((capability) => (
            <article key={capability.title}>
              <span>{capability.icon}</span>
              <Typography.Title level={3}>{capability.title}</Typography.Title>
              <Typography.Paragraph>
                {capability.description}
              </Typography.Paragraph>
            </article>
          ))}
        </section>

        <section className="warning-roadmap">
          <div>
            <span>01</span>
            <strong>监测数据接入</strong>
            <small>明确数据源、更新频率、质量规则和空间范围</small>
          </div>
          <div>
            <span>02</span>
            <strong>指标与阈值确认</strong>
            <small>由业务专家确认指标含义、阈值和预警等级</small>
          </div>
          <div>
            <span>03</span>
            <strong>预警闭环建设</strong>
            <small>接入通知、处置、复核、归档和审计能力</small>
          </div>
        </section>
      </main>
    </Layout>
  );
}
