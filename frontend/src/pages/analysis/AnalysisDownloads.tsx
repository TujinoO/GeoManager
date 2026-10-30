import { Button, Dropdown } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { downloadBlob } from "../../api/analysis";
import { reportDocument } from "./presentation";

export default function AnalysisDownloads({
  title,
  paragraphs,
  source,
  scope,
  disabled,
  onData,
  busy,
}: {
  title: string;
  paragraphs: string[];
  source?: string;
  scope: () => HTMLElement | null;
  disabled: boolean;
  onData?: () => void;
  busy?: boolean;
}) {
  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: [
          ...(onData
            ? [{ key: "data", label: "下载数据表（CSV）", onClick: onData }]
            : []),
          {
            key: "report",
            label: "下载分析报告（含当前图表）",
            onClick: () =>
              downloadBlob(
                new Blob([reportDocument(title, paragraphs, scope(), source)], {
                  type: "text/html;charset=utf-8",
                }),
                `${title}-分析报告.html`,
              ),
          },
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
  );
}
