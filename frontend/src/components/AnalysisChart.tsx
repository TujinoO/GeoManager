import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { downloadBlob } from "../api/analysis";
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  BoxplotChart,
  SankeyChart,
  GraphChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  AriaComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  BoxplotChart,
  SankeyChart,
  GraphChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  AriaComponent,
  SVGRenderer,
]);

export default function AnalysisChart({
  title,
  subtitle,
  option,
  height = 300,
  canExport = false,
  onSelect,
  extra,
  minimumWidth = 0,
}: {
  title: string;
  subtitle?: string;
  option: EChartsOption;
  height?: number;
  canExport?: boolean;
  onSelect?: (name: string) => void;
  extra?: ReactNode;
  minimumWidth?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    let chart: ReturnType<typeof echarts.init> | undefined;
    function update() {
      if (!container.clientWidth || !container.clientHeight) return;
      if (chart) {
        chart.resize();
        return;
      }
      chart = echarts.init(
        container,
        {
          categoryAxis: {
            axisLine: { lineStyle: { color: "#d0e3db" } },
            axisTick: { show: false },
          },
          valueAxis: {
            splitLine: { lineStyle: { color: "#e6eeea", type: "dashed" } },
            axisLine: { show: false },
          },
        },
        { renderer: "svg" },
      );
      chartRef.current = chart;
      chart.setOption({
        animation: false,
        color: ["#16b8a9", "#927dd7", "#46a3d8", "#d6a247", "#dc7894"],
        backgroundColor: "transparent",
        textStyle: {
          color: "#5f7974",
          fontFamily: "Microsoft YaHei, sans-serif",
        },
        tooltip: { trigger: "item", confine: true, renderMode: "richText" },
        aria: { enabled: true },
        ...option,
      });
      if (onSelect) chart.on("click", (event) => onSelect(event.name));
    }
    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();
    return () => {
      observer.disconnect();
      chartRef.current = null;
      chart?.dispose();
    };
  }, [option, title, canExport, onSelect]);
  return (
    <section className="analysis-card analysis-chart-card">
      <div className="analysis-card-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="analysis-chart-actions">
          {extra}
          {canExport && (
            <Button
              size="small"
              type="text"
              icon={<DownloadOutlined />}
              aria-label={`导出${title}矢量图`}
              onClick={() => {
                const svg = ref.current?.querySelector("svg");
                if (svg && chartRef.current)
                  downloadBlob(
                    new Blob([new XMLSerializer().serializeToString(svg)], {
                      type: "image/svg+xml;charset=utf-8",
                    }),
                    `${title}.svg`,
                  );
              }}
            >
              SVG
            </Button>
          )}
        </div>
      </div>
      <div className="analysis-chart-viewport">
        <div
          ref={ref}
          role="img"
          aria-label={title}
          style={{ height, width: "100%", minWidth: minimumWidth }}
        />
      </div>
    </section>
  );
}
