import { AimOutlined } from "@ant-design/icons";
import { Tabs } from "antd";
import type { FeatureInfo } from "../types";
import FeatureDetailPanel from "./FeatureDetailPanel";

interface Props {
  selectedFeature: FeatureInfo | null;
}

export default function RightSidePanel({ selectedFeature }: Props) {
  return (
    <Tabs
      className="right-side-tabs"
      size="small"
      tabPlacement="bottom"
      items={[
        {
          key: "feature",
          label: (
            <span className="tab-label">
              <AimOutlined style={{ fontSize: 14 }} />
              要素属性
            </span>
          ),
          children: <FeatureDetailPanel feature={selectedFeature} />,
        },
      ]}
    />
  );
}
