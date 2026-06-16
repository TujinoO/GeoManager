import { AimOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Descriptions, Empty, Tag, Typography } from "antd";
import type { FeatureInfo } from "../types";

interface Props {
  feature: FeatureInfo | null;
}

export default function FeatureDetailPanel({ feature }: Props) {
  const entries = Object.entries(feature?.properties ?? {}).filter(
    ([, value]) => value !== undefined,
  );

  return (
    <section className="panel-section feature-detail-panel">
      <div className="panel-title">
        <InfoCircleOutlined style={{ fontSize: 18 }} />
        <Typography.Title level={5}>要素信息</Typography.Title>
      </div>
      {feature ? (
        <>
          <div className="feature-detail-heading">
            <AimOutlined style={{ fontSize: 15 }} />
            <Typography.Text strong>{feature.layerName}</Typography.Text>
            <Tag color="green">单击选中</Tag>
          </div>
          {entries.length > 0 ? (
            <Descriptions size="small" column={1} bordered>
              {entries.map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  {String(value ?? "-")}
                </Descriptions.Item>
              ))}
            </Descriptions>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="该要素没有属性"
            />
          )}
        </>
      ) : (
        <Empty
          className="feature-detail-empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="单击地图要素查看属性"
        />
      )}
    </section>
  );
}
