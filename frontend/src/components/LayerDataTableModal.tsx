import { DatabaseOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import {
  Button,
  Checkbox,
  Descriptions,
  Dropdown,
  Empty,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { LoadedLayer, LoadedVectorLayer } from "../types";

interface Props {
  layer: LoadedLayer | null;
  open: boolean;
  onClose: () => void;
  onSelectionChange?: (featureIds: (string | number)[]) => void;
}

export default function LayerDataTableModal({
  layer,
  open,
  onClose,
  onSelectionChange,
}: Props) {
  return (
    <Modal
      title={layer ? `${layer.name} 数据表` : "数据表"}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1100px, calc(100vw - 48px))"
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
    >
      {!layer ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请选择图层"
          style={{ padding: 24 }}
        />
      ) : layer.layerType === "vector" ? (
        <VectorAttributeTable
          layer={layer}
          onSelectionChange={onSelectionChange}
        />
      ) : (
        <Descriptions size="small" column={2} bordered style={{ padding: 16 }}>
          <Descriptions.Item label="图层">{layer.name}</Descriptions.Item>
          <Descriptions.Item label="类型">栅格</Descriptions.Item>
          <Descriptions.Item label="波段数">
            {layer.rasterMetadata?.bands.length ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {layer.renderStatus || "默认"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}

type RowData = Record<string, unknown> & { __rowKey: string };
const defaultDataColumnWidth = 160;
const minDataColumnWidth = 88;
const indexColumnPaddingWidth = 38;
const indexDigitWidth = 9;

function VectorAttributeTable({
  layer,
  onSelectionChange,
}: {
  layer: LoadedVectorLayer;
  onSelectionChange?: (featureIds: (string | number)[]) => void;
}) {
  const fieldNames = layer.fields.length
    ? layer.fields.map((field) => field.name)
    : inferPropertyNames(layer);
  const rows = useMemo(
    () => buildTableRows(layer, fieldNames),
    [layer, fieldNames],
  );

  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const toggleHidden = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleFieldNames = fieldNames.filter((n) => !hiddenKeys.has(n));
  const indexColumnWidth = Math.max(
    48,
    String(Math.max(rows.length, 1)).length * indexDigitWidth +
      indexColumnPaddingWidth,
  );
  const resizeColumn = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: width }));
  }, []);
  const selectedKeySet = useMemo(
    () => new Set(selectedRowKeys),
    [selectedRowKeys],
  );

  const handleSelectionChange = useCallback(
    (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);

      if (onSelectionChange) {
        const featureIds = newSelectedRowKeys
          .map((key) => extractFeatureIdFromRowKey(String(key)))
          .filter((id): id is string | number => id !== null);
        onSelectionChange(featureIds);
      }
    },
    [onSelectionChange],
  );

  const rowSelection = {
    selectedRowKeys,
    onChange: handleSelectionChange,
    columnWidth: 40,
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
  };

  const columns: TableColumnsType<RowData> = useMemo(() => {
    const indexCol: TableColumnsType<RowData>[number] = {
      title: "#",
      key: "__index",
      width: indexColumnWidth,
      fixed: "left",
      rowSpan: 2,
      render: (_, __, index) => index + 1,
      onCell: (record) => ({
        className: selectedKeySet.has(record.__rowKey)
          ? "layer-table-cell-selected"
          : "",
      }),
    };

    const dataCols: TableColumnsType<RowData> = visibleFieldNames.map(
      (fieldName) => {
        const field = layer.fields.find((f) => f.name === fieldName);
        const hasDescription =
          field?.description && field.description.trim() !== "";

        return {
          title: fieldName,
          dataIndex: fieldName,
          key: fieldName,
          width: columnWidths[fieldName] ?? defaultDataColumnWidth,
          ellipsis: true,
          onCell: (record: RowData) => ({
            className: selectedKeySet.has(record.__rowKey)
              ? "layer-table-cell-selected"
              : "",
          }),
          onHeaderCell: () =>
            ({
              width: columnWidths[fieldName] ?? defaultDataColumnWidth,
              onResize: (width: number) => resizeColumn(fieldName, width),
            }) as React.ThHTMLAttributes<HTMLTableCellElement>,
          // 如果有描述，使用children实现两层表头
          ...(hasDescription
            ? {
                children: [
                  {
                    title: field.description,
                    dataIndex: fieldName,
                    key: `${fieldName}__desc`,
                    width: columnWidths[fieldName] ?? defaultDataColumnWidth,
                    ellipsis: true,
                    sorter: (a: RowData, b: RowData) => {
                      const va = String(a[fieldName] ?? "");
                      const vb = String(b[fieldName] ?? "");
                      return va.localeCompare(vb, "zh-CN", { numeric: true });
                    },
                    filters: buildColumnFilters(rows, fieldName),
                    onFilter: (value: boolean | React.Key, record: RowData) =>
                      String(record[fieldName] ?? "").includes(String(value)),
                    filterSearch: true,
                    render: (value: unknown) => String(value ?? "-"),
                    onCell: (record: RowData) => ({
                      className: selectedKeySet.has(record.__rowKey)
                        ? "layer-table-cell-selected"
                        : "",
                    }),
                  },
                ],
              }
            : {
                sorter: (a: RowData, b: RowData) => {
                  const va = String(a[fieldName] ?? "");
                  const vb = String(b[fieldName] ?? "");
                  return va.localeCompare(vb, "zh-CN", { numeric: true });
                },
                filters: buildColumnFilters(rows, fieldName),
                onFilter: (value: boolean | React.Key, record: RowData) =>
                  String(record[fieldName] ?? "").includes(String(value)),
                filterSearch: true,
                render: (value: unknown) => String(value ?? "-"),
              }),
        };
      },
    );

    return [indexCol, ...dataCols];
  }, [
    columnWidths,
    indexColumnWidth,
    layer.fields,
    resizeColumn,
    selectedKeySet,
    visibleFieldNames,
    rows,
  ]);
  const tableScrollX = Math.max(
    960,
    indexColumnWidth +
      visibleFieldNames.reduce(
        (total, name) => total + (columnWidths[name] ?? defaultDataColumnWidth),
        0,
      ),
  );
  const hasSelected = selectedRowKeys.length > 0;

  return (
    <div className="layer-table-modal-content">
      <div className="bottom-table-heading">
        <Space size={8}>
          <DatabaseOutlined style={{ fontSize: 15 }} />
          <Typography.Text strong>{layer.name}</Typography.Text>
          <Tag color="green">{rows.length} 条</Tag>
          {hasSelected && (
            <Tag color="blue">已选 {selectedRowKeys.length} 条</Tag>
          )}
        </Space>
        <Space size={8}>
          <Dropdown
            menu={{
              items: fieldNames.map((name) => ({
                key: name,
                label: (
                  <Checkbox
                    checked={!hiddenKeys.has(name)}
                    onChange={() => toggleHidden(name)}
                  >
                    {name}
                  </Checkbox>
                ),
              })),
            }}
            trigger={["click"]}
          >
            <Button
              size="small"
              icon={<EyeInvisibleOutlined style={{ fontSize: 14 }} />}
            >
              列显隐
            </Button>
          </Dropdown>
          <Typography.Text type="secondary">{layer.summary}</Typography.Text>
        </Space>
      </div>
      <Table<RowData>
        virtual
        size="small"
        rowKey="__rowKey"
        dataSource={rows}
        columns={columns}
        rowSelection={rowSelection}
        rowClassName={(record) =>
          selectedKeySet.has(record.__rowKey) ? "layer-table-row-selected" : ""
        }
        components={{ header: { cell: ResizableHeaderCell } }}
        pagination={false}
        scroll={{ x: tableScrollX, y: 460 }}
        showSorterTooltip={{ target: "sorter-icon" }}
      />
    </div>
  );
}

function buildColumnFilters(
  rows: RowData[],
  fieldName: string,
): { text: string; value: string }[] {
  const unique = new Set<string>();
  for (const row of rows) {
    const val = String(row[fieldName] ?? "");
    if (val) unique.add(val);
  }
  const values = Array.from(unique).slice(0, 50);
  return values.map((v) => ({ text: v, value: v }));
}

interface ResizableHeaderCellProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: number;
  onResize?: (width: number) => void;
}

function ResizableHeaderCell({
  width,
  onResize,
  children,
  ...restProps
}: ResizableHeaderCellProps) {
  // 如果没有onResize，直接使用默认的header cell（如checkbox列）
  if (!onResize) {
    return <th {...restProps}>{children}</th>;
  }

  function handleResizeStart(event: React.MouseEvent<HTMLSpanElement>) {
    if (!width) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(
        minDataColumnWidth,
        startWidth + moveEvent.clientX - startX,
      );
      onResize?.(nextWidth);
    };
    const handleMouseUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <th {...restProps} style={{ ...restProps.style, width }}>
      <div className="resizable-table-header">
        <span className="resizable-table-title">{children}</span>
        <button
          type="button"
          aria-label="调整列宽"
          className="resizable-table-handle"
          onMouseDown={handleResizeStart}
        />
      </div>
    </th>
  );
}

function inferPropertyNames(layer: LoadedVectorLayer) {
  const names = new Set<string>();
  for (const feature of layer.geojson.features) {
    const properties = (feature as { properties?: Record<string, unknown> })
      .properties;
    for (const name of Object.keys(properties ?? {})) {
      names.add(name);
    }
  }
  return Array.from(names);
}

function buildTableRows(layer: LoadedVectorLayer, fieldNames: string[]) {
  const keyCounts = new Map<string, number>();
  return layer.geojson.features.map((feature) => {
    const properties =
      (feature as { properties?: Record<string, unknown> }).properties ?? {};
    const baseKey = stableFeatureKey(feature);
    const count = keyCounts.get(baseKey) ?? 0;
    keyCounts.set(baseKey, count + 1);
    return {
      __rowKey: count ? `${baseKey}-${count}` : baseKey,
      ...Object.fromEntries(
        fieldNames.map((fieldName) => [fieldName, properties[fieldName]]),
      ),
    };
  });
}

function stableFeatureKey(feature: Record<string, unknown>) {
  const featureId = feature.id;
  if (typeof featureId === "string" || typeof featureId === "number") {
    return `feature-${featureId}`;
  }
  const text = JSON.stringify({
    properties: feature.properties ?? {},
    geometry: feature.geometry ?? {},
  });
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return `feature-${hash.toString(16)}`;
}

function extractFeatureIdFromRowKey(rowKey: string): string | number | null {
  // 从 "feature-{id}" 格式中提取id
  const match = rowKey.match(/^feature-(.+)$/);
  if (!match) return null;

  const idStr = match[1];
  if (!idStr) return null;
  // 尝试解析为数字
  const numId = Number(idStr);
  if (!Number.isNaN(numId) && String(numId) === idStr) {
    return numId;
  }
  // 否则作为字符串返回
  return idStr;
}
