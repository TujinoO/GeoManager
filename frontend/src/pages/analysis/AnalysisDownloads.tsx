import { Button, Dropdown } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { downloadBlob } from "../../api/analysis";
import { useState, type ReactNode } from "react";
import AnalysisReportEditor from "./AnalysisReportEditor";

export default function AnalysisDownloads({
  title,
  paragraphs,
  source,
  scope,
  disabled,
  onData,
  busy,
  resourceId,
  reportCharts,
}: {
  title: string;
  paragraphs: string[];
  source?: string;
  scope: () => HTMLElement | null;
  disabled: boolean;
  onData?: () => void;
  busy?: boolean;
  resourceId?: number;
  reportCharts?: ReactNode;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <>
      <Button
        disabled={disabled || !resourceId}
        onClick={() => setReportOpen(true)}
      >
        生成报告
      </Button>
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            ...(onData
              ? [{ key: "data", label: "下载数据表（CSV）", onClick: onData }]
              : []),
            {
              key: "text",
              label: "下载文字摘要",
              onClick: () =>
                downloadBlob(
                  new Blob([title + "\n\n" + paragraphs.join("\n\n")], {
                    type: "text/plain;charset=utf-8",
                  }),
                  `${title}-摘要.txt`,
                ),
            },
          ],
        }}
        disabled={disabled}
      >
        <Button loading={busy} disabled={disabled} icon={<DownloadOutlined />}>
          下载结果
        </Button>
      </Dropdown>
      {reportOpen && (
        <AnalysisReportEditor
          open
          onClose={() => setReportOpen(false)}
          resourceId={resourceId}
          title={title}
          paragraphs={paragraphs}
          source={source}
          scope={scope}
          charts={reportCharts}
        />
      )}
    </>
  );
}
