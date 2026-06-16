import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import type {
  ActionType,
  ProColumns,
  ProFormInstance,
} from "@ant-design/pro-components";
import { ProTable } from "@ant-design/pro-components";
import { App, AutoComplete, Button, Space, Tag } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { AdminOperationLog, AdminOperationLogQuery } from "../types";
import { downloadTextFile } from "../utils/download";
import { operationLogsToCsv } from "./data";

interface OperationLogTableQuery extends AdminOperationLogQuery {
  occurredAt?: unknown[];
}

interface OperationLogHints {
  operators: string[];
  modules: string[];
}

const resultText: Record<string, string> = {
  success: "成功",
  warning: "告警",
  failed: "失败",
};

const resultColor: Record<string, string> = {
  success: "success",
  warning: "warning",
  failed: "error",
};

export default function AdminOperationLogsPage() {
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const { message } = App.useApp();
  const [exporting, setExporting] = useState(false);
  const [hints, setHints] = useState<OperationLogHints>({
    operators: [],
    modules: [],
  });
  const columns = useMemo(() => buildColumns(hints), [hints]);

  useEffect(() => {
    let mounted = true;
    api
      .adminOperationLogs({ current: 1, pageSize: 500 })
      .then((result) => {
        if (!mounted) return;
        setHints({
          operators: uniqueValues(result.items.map((item) => item.operator)),
          modules: uniqueValues(result.items.map((item) => item.module)),
        });
      })
      .catch(() => {
        if (!mounted) return;
        setHints({ operators: [], modules: [] });
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function exportLogs() {
    setExporting(true);
    try {
      const query = buildLogQuery(
        (formRef.current?.getFieldsValue() ?? {}) as OperationLogTableQuery,
      );
      const firstPage = await api.adminOperationLogs({
        ...query,
        current: 1,
        pageSize: 1,
      });
      const result =
        firstPage.total <= firstPage.items.length
          ? firstPage
          : await api.adminOperationLogs({
              ...query,
              current: 1,
              pageSize: firstPage.total,
            });
      downloadTextFile(operationLogsToCsv(result.items), "operation-logs.csv");
      message.success("已生成操作日志导出文件");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "操作日志导出失败",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <ProTable<AdminOperationLog, OperationLogTableQuery>
      className="admin-table"
      actionRef={actionRef}
      formRef={formRef}
      rowKey="id"
      columns={columns}
      cardBordered
      options={false}
      search={{
        labelWidth: 92,
        span: { xs: 24, sm: 12, md: 8, lg: 8, xl: 6, xxl: 6 },
      }}
      pagination={{
        pageSize: 5,
        showSizeChanger: false,
      }}
      scroll={{ x: 1200 }}
      request={async (params) => {
        const result = await api.adminOperationLogs(buildLogQuery(params));
        return {
          data: result.items,
          total: result.total,
          success: true,
        };
      }}
      headerTitle="日志列表"
      toolBarRender={() => [
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={() => actionRef.current?.reload()}
        >
          刷新
        </Button>,
        <Button
          key="export"
          type="primary"
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={exportLogs}
        >
          导出日志
        </Button>,
      ]}
      tableAlertRender={({ selectedRowKeys }) => (
        <Space size={12}>
          已选择 <strong>{selectedRowKeys.length}</strong> 条日志
        </Space>
      )}
      rowSelection={{}}
    />
  );
}

function buildColumns(
  hints: OperationLogHints,
): ProColumns<AdminOperationLog>[] {
  return [
    {
      title: "操作时间",
      dataIndex: "occurredAt",
      valueType: "dateTimeRange",
      width: 190,
      sorter: (a, b) => a.occurredAt.localeCompare(b.occurredAt),
      render: (_, record) => record.occurredAt,
    },
    {
      title: "操作用户",
      dataIndex: "operator",
      width: 140,
      ellipsis: true,
      formItemRender: (_schema, config) => (
        <AutoComplete
          allowClear
          value={config.value}
          onChange={config.onChange}
          options={toOptions(hints.operators)}
          placeholder="输入或选择用户"
          filterOption={filterOption}
        />
      ),
    },
    {
      title: "模块",
      dataIndex: "module",
      width: 130,
      ellipsis: true,
      formItemRender: (_schema, config) => (
        <AutoComplete
          allowClear
          value={config.value}
          onChange={config.onChange}
          options={toOptions(hints.modules)}
          placeholder="输入或选择模块"
          filterOption={filterOption}
        />
      ),
    },
    {
      title: "动作",
      dataIndex: "action",
      width: 150,
      ellipsis: true,
    },
    {
      title: "结果",
      dataIndex: "result",
      width: 110,
      valueType: "select",
      valueEnum: {
        success: { text: "成功", status: "Success" },
        warning: { text: "告警", status: "Warning" },
        failed: { text: "失败", status: "Error" },
      },
      render: (_, record) => (
        <Tag color={resultColor[record.result] ?? "default"}>
          {resultText[record.result] ?? record.result}
        </Tag>
      ),
    },
    {
      title: "IP 地址",
      dataIndex: "ipAddress",
      width: 140,
      search: false,
    },
    {
      title: "关键词",
      dataIndex: "keyword",
      hideInTable: true,
    },
    {
      title: "摘要",
      dataIndex: "summary",
      width: 360,
      search: false,
      ellipsis: true,
    },
  ];
}

function buildLogQuery(params: OperationLogTableQuery): AdminOperationLogQuery {
  const [startTime, endTime] = params.occurredAt ?? [];
  return {
    current: params.current,
    pageSize: params.pageSize,
    operator: params.operator,
    module: params.module,
    action: params.action,
    result: params.result,
    keyword: params.keyword,
    startTime: formatQueryDate(startTime),
    endTime: formatQueryDate(endTime),
  };
}

function formatQueryDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (
    typeof value === "object" &&
    "format" in value &&
    typeof value.format === "function"
  ) {
    return value.format("YYYY-MM-DD HH:mm:ss");
  }
  return String(value);
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

function toOptions(values: string[]) {
  return values.map((value) => ({ value }));
}

function filterOption(inputValue: string, option?: { value?: string }) {
  return (option?.value ?? "").toLowerCase().includes(inputValue.toLowerCase());
}
