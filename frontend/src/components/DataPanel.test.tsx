import { fireEvent, render, screen } from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { describe, expect, it, vi } from "vitest";
import { cloneDefaultVectorSymbolization } from "../symbolization";
import type { ResourceListItem, User } from "../types";
import DataPanel from "./DataPanel";
import { VectorSymbolizationEditor } from "./SymbolizationEditor";

const permissions: User["permissions"] = {
  canAccessAdmin: true,
  canManageFeaturePermissions: false,
  canCreateUser: false,
  canViewOperationLogs: false,
  canViewAllOperationLogs: false,
  canViewOwnOperationLogs: false,
  canViewGroupOperationLogs: false,
  canManageSystemSettings: false,
  canManageAuth: false,
  canViewDashboardResourceCard: false,
  canViewDashboardLayerCard: false,
  canViewDashboardRasterCard: false,
  canViewDashboardUserCard: false,
  canViewDashboardActiveUsersCard: false,
  canViewDashboardSystemCard: false,
  canViewDataOverview: false,
  canBrowseData: true,
  canQueryData: true,
  canUploadData: false,
  canLoadVectorLayer: true,
  canLoadRasterLayer: true,
  canUseCustomSymbolization: true,
  canExportData: false,
  canMaintainData: false,
  canManageRasterData: false,
};

const vectorResource: ResourceListItem = {
  id: 1,
  name: "胡杨样方点位",
  code: "poplar-samples",
  dataType: "vector",
  category: null,
  source: "野外调查",
  provider: "生态监测组",
  dataDate: null,
  spatialExtent: "80,40,90,45",
  coordinateSystem: "EPSG:4326",
  fileFormat: "GeoPackage",
  description: "",
  qualityNote: "",
  sizeBytes: 1200,
  itemCount: 8,
  status: "active",
  isQueryable: true,
  isRenderable: false,
  updatedAt: "2026-06-17T00:00:00+08:00",
};

function renderWithAntd(node: React.ReactNode) {
  return render(
    <ConfigProvider locale={zhCN}>
      <AntApp>{node}</AntApp>
    </ConfigProvider>,
  );
}

describe("DataPanel", () => {
  it("calls quick load for queryable resources", () => {
    const onQuickLoadResource = vi.fn();

    renderWithAntd(
      <DataPanel
        resources={[vectorResource]}
        profile={null}
        selectedResourceId={null}
        queryResult={null}
        loadingProfile={false}
        querying={false}
        permissions={permissions}
        onFilterResources={vi.fn()}
        onSelectResource={vi.fn()}
        onQuickLoadResource={onQuickLoadResource}
        onQueryAndLoad={vi.fn()}
        onLoadRaster={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "快速加载" }));

    expect(onQuickLoadResource).toHaveBeenCalledWith(vectorResource);
  });
});

describe("VectorSymbolizationEditor", () => {
  it("shows vector symbolization controls with Chinese labels", () => {
    renderWithAntd(
      <VectorSymbolizationEditor
        value={cloneDefaultVectorSymbolization()}
        fields={[{ name: "species", type: "string", description: "物种" }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText("圆点").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "圆点" }));
    expect(screen.getByText("圆点颜色")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "图标" }));
    expect(screen.getByText("图标布局")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "标注" }));
    expect(screen.getByText("标注字段")).toBeInTheDocument();
    expect(screen.queryByText("circle-color")).not.toBeInTheDocument();
  });
});
