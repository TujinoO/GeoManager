import { AppstoreOutlined } from "@ant-design/icons";
import { Empty, Layout, Typography } from "antd";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { useAppContext } from "../contexts/AppContext";

export default function NonGeoPage() {
  const { user } = useAppContext();

  return (
    <Layout className="workspace">
      <WorkspaceHeader
        activeTab="nongeo"
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <div className="workspace-body workspace-body-nongeo">
        <main className="nongeo-stage" aria-label="非地理数据">
          <section className="nongeo-coming-soon">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div className="nongeo-coming-soon-copy">
                  <Typography.Title level={3}>正在开发中</Typography.Title>
                  <Typography.Text type="secondary">
                    非地理数据浏览与分析功能正在接入。
                  </Typography.Text>
                </div>
              }
            >
              <AppstoreOutlined className="nongeo-coming-soon-icon" />
            </Empty>
          </section>
        </main>
      </div>
    </Layout>
  );
}
