import {
  CheckOutlined,
  GlobalOutlined,
  LoadingOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Button, Popover } from "antd";
import type {
  BasemapDefinition,
  BasemapId,
  BasemapProvider,
} from "../map/basemapCatalog";

export interface BasemapSwitcherProps {
  basemaps: readonly BasemapDefinition[];
  activeId: BasemapId;
  switching?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: (id: BasemapId) => void;
  className?: string;
}

export default function BasemapSwitcher({
  basemaps,
  activeId,
  switching = false,
  disabled = false,
  disabledReason,
  onSelect,
  className,
}: BasemapSwitcherProps) {
  const selectableBasemaps = basemaps.filter((basemap) => basemap.selectable);
  const activeBasemap = basemaps.find((basemap) => basemap.id === activeId);
  const triggerLabel = switching
    ? "正在切换底图"
    : `切换底图，当前为${activeBasemap?.label ?? "未知底图"}`;
  const content = (
    <div className="basemap-switcher-panel" role="dialog" aria-label="选择底图">
      <div className="basemap-switcher-heading">
        <div>
          <strong>选择底图</strong>
          <span>切换后保留当前视角与业务图层</span>
        </div>
        {switching ? (
          <span className="basemap-switcher-progress" role="status">
            <LoadingOutlined spin />
            正在切换
          </span>
        ) : null}
      </div>
      <div className="basemap-switcher-options">
        {selectableBasemaps.map((basemap) => {
          const selected = basemap.id === activeId;
          const unavailable = !basemap.credentials.available;
          const optionDisabled = disabled || switching || unavailable;
          const statusText = unavailable
            ? (basemap.credentials.reason ?? "当前不可用")
            : basemap.credentials.degraded
              ? (basemap.credentials.warning ?? "部分能力受限")
              : selected
                ? "当前使用"
                : "可用";
          return (
            <button
              key={basemap.id}
              type="button"
              className="basemap-switcher-option"
              aria-label={`${basemap.label}，${statusText}`}
              aria-pressed={selected}
              disabled={optionDisabled}
              title={unavailable ? statusText : undefined}
              onClick={() => {
                if (!optionDisabled && basemap.id !== activeId) {
                  onSelect(basemap.id);
                }
              }}
            >
              <span
                className={`basemap-switcher-preview basemap-switcher-preview-${basemap.visual}`}
                aria-hidden="true"
              />
              <span className="basemap-switcher-option-copy">
                <span className="basemap-switcher-option-title">
                  <span>{basemap.label}</span>
                  {switching && selected ? (
                    <LoadingOutlined spin aria-hidden="true" />
                  ) : selected ? (
                    <CheckOutlined aria-hidden="true" />
                  ) : null}
                </span>
                <span className="basemap-switcher-option-description">
                  {basemap.description}
                </span>
                <span
                  className={`basemap-switcher-option-status ${
                    unavailable
                      ? "is-error"
                      : basemap.credentials.degraded
                        ? "is-warning"
                        : "is-ready"
                  }`}
                >
                  {unavailable || basemap.credentials.degraded ? (
                    <WarningOutlined aria-hidden="true" />
                  ) : null}
                  {statusText}
                </span>
                <span className="basemap-switcher-provider">
                  服务来源：{providerLabel(basemap.provider)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <span
      className={["basemap-switcher", className].filter(Boolean).join(" ")}
      title={disabled ? disabledReason : undefined}
    >
      <Popover content={content} placement="topLeft" trigger="click">
        <Button
          className="basemap-switcher-trigger"
          icon={switching ? <LoadingOutlined spin /> : <GlobalOutlined />}
          disabled={disabled || switching}
          aria-label={
            disabled && disabledReason
              ? `${triggerLabel}，${disabledReason}`
              : triggerLabel
          }
          aria-busy={switching}
        >
          {activeBasemap?.label ?? "选择底图"}
        </Button>
      </Popover>
    </span>
  );
}

function providerLabel(provider: BasemapProvider) {
  if (provider === "mapbox") return "Mapbox";
  if (provider === "tianditu") return "天地图";
  return "OpenStreetMap";
}
