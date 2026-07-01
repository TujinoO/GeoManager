import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { cloneDefaultVectorSymbolization } from "../symbolization";
import { appTheme } from "../theme";
import type {
  DataDomainType,
  DataResourceProfile,
  ResourceListItem,
  User,
} from "../types";
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
  canViewSystemLogs: false,
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
  canViewDataResources: false,
  canCreateDataResources: false,
  canChangeDataResources: false,
  canDeleteDataResources: false,
  canLoadVectorLayer: true,
  canLoadRasterLayer: true,
  canUseCustomSymbolization: true,
  canExportData: false,
  canViewWorkspaces: false,
  canCreateWorkspaces: false,
  canChangeWorkspaces: false,
  canDeleteWorkspaces: false,
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

const rasterResource: ResourceListItem = {
  id: 2,
  name: "塔里木河胡杨提取结果",
  code: "tarim-poplar-raster",
  dataType: "raster",
  category: { code: "remote-sensing", name: "遥感监测" },
  source: "高分遥感解译",
  provider: "遥感处理组",
  dataDate: "2026-06-01",
  spatialExtent: "88.328434,40.079174,88.401642,40.160831",
  coordinateSystem: "EPSG:3857",
  fileFormat: "COG",
  description: "",
  qualityNote: "",
  sizeBytes: 5861035,
  itemCount: 1,
  status: "active",
  isQueryable: false,
  isRenderable: true,
  updatedAt: "2026-06-18T12:00:00+08:00",
};

const communityResource: ResourceListItem = {
  ...vectorResource,
  id: 3,
  name: "群落样方调查数据",
  code: "community-plots",
  domainType: "community",
  category: null,
};

const domainTypeOptions: Array<{ value: DataDomainType; label: string }> = [
  { value: "germplasm", label: "种质数据" },
  { value: "community", label: "群落数据" },
  { value: "population", label: "种群数据" },
];

const rasterProfile: DataResourceProfile = {
  resource: rasterResource,
  fields: [],
  featureCount: 0,
  geometryType: "Raster",
  bounds: [88.328434, 40.079174, 88.401642, 40.160831],
  raster: {
    id: 2,
    name: "塔里木河胡杨提取结果",
    code: "tarim-poplar-raster",
    status: "ready",
    sourcePath: "胡杨提取结果/Traim_result.tif",
    processedPath: "胡杨提取结果/Traim_result.cog.tif",
    sourceMetadataPath: "source/胡杨提取结果/Traim_result.tif.gdalinfo.json",
    processedMetadataPath:
      "preprocessed/胡杨提取结果/Traim_result.cog.tif.gdalinfo.json",
    dataResourceId: 2,
    mapLayerId: 2,
    bandCount: 1,
    bounds3857: [9832676.279, 4877454.34, 9840825.79, 4889341.335],
    bounds4326: [88.328434, 40.079174, 88.401642, 40.160831],
    imageCoordinates: [
      [88.328434, 40.160831],
      [88.401642, 40.160831],
      [88.401642, 40.079174],
      [88.328434, 40.079174],
    ],
    defaultRules: {
      mode: "gray",
      bands: [1],
      palette: "poplar",
      uniqueValues: [],
      alphaBand: "mask",
      nodata: { enabled: true },
      stretch: {
        enabled: true,
        type: "minmax",
        perBand: { "1": { min: 0, max: 2 } },
      },
    },
    sourceFileSize: 4464959,
    processedFileSize: 5861035,
    progressLog: "",
    errorMessage: "",
    importedAt: "2026-06-18T12:00:00+08:00",
    processedAt: "2026-06-18T12:10:00+08:00",
    metadata: {
      size: [12444, 18151],
      driver: "GTiff",
      coordinateSystem: 3857,
      bands: [
        {
          band: 1,
          type: "Byte",
          description: "胡杨分类值",
          colorInterpretation: "Gray",
          min: 0,
          max: 2,
          isInteger: true,
        },
      ],
    },
  },
};

function renderWithAntd(node: React.ReactNode) {
  return render(
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>{node}</AntApp>
    </ConfigProvider>,
  );
}

function StatefulVectorSymbolizationEditor({
  geometryType = "Point",
}: {
  geometryType?: string;
}) {
  const [value, setValue] = useState(cloneDefaultVectorSymbolization());

  return (
    <VectorSymbolizationEditor
      value={value}
      fields={[{ name: "species", type: "string", description: "物种" }]}
      geometryType={geometryType}
      onChange={setValue}
    />
  );
}

describe("DataPanel", () => {
  it("submits metadata filters with the current keyword and source text", () => {
    const onFilterResources = vi.fn();

    renderWithAntd(
      <DataPanel
        resources={[vectorResource]}
        profile={null}
        selectedResourceId={null}
        queryResult={null}
        loadingProfile={false}
        querying={false}
        permissions={permissions}
        searchKeyword="胡杨"
        onFilterResources={onFilterResources}
        onSelectResource={vi.fn()}
        onQuickLoadResource={vi.fn()}
        onQueryAndLoad={vi.fn()}
        onLoadRaster={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText("数据名称、来源或单位"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("数据来源"), {
      target: { value: "野外调查" },
    });
    fireEvent.click(screen.getByRole("button", { name: /筛选数据/ }));

    expect(onFilterResources).toHaveBeenCalledWith(
      expect.objectContaining({ q: "胡杨", source: "野外调查" }),
    );
  });

  it("defaults the domain type selector to all data without sending a filter", () => {
    const onFilterResources = vi.fn();

    renderWithAntd(
      <DataPanel
        resources={[communityResource]}
        profile={null}
        selectedResourceId={null}
        queryResult={null}
        loadingProfile={false}
        querying={false}
        permissions={permissions}
        domainTypeOptions={domainTypeOptions}
        onFilterResources={onFilterResources}
        onSelectResource={vi.fn()}
        onQuickLoadResource={vi.fn()}
        onQueryAndLoad={vi.fn()}
        onLoadRaster={vi.fn()}
      />,
    );

    expect(screen.getByText("全部数据")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /筛选数据/ }));

    expect(onFilterResources).toHaveBeenCalledWith({});
  });

  it("uses the imported domain type for filtering and resource labels", () => {
    const onFilterResources = vi.fn();

    renderWithAntd(
      <DataPanel
        resources={[communityResource]}
        profile={null}
        selectedResourceId={null}
        queryResult={null}
        loadingProfile={false}
        querying={false}
        permissions={permissions}
        domainTypeOptions={domainTypeOptions}
        selectedDomainType="community"
        onFilterResources={onFilterResources}
        onSelectResource={vi.fn()}
        onQuickLoadResource={vi.fn()}
        onQueryAndLoad={vi.fn()}
        onLoadRaster={vi.fn()}
      />,
    );

    expect(screen.getByText(/群落数据.*GeoPackage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /筛选数据/ }));

    expect(onFilterResources).toHaveBeenCalledWith(
      expect.objectContaining({ domainType: "community" }),
    );
  });

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

  it("spins the clicked quick load button while loading", async () => {
    let resolveQuickLoad: () => void = () => undefined;
    const onQuickLoadResource = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveQuickLoad = resolve;
        }),
    );

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

    const button = screen.getByRole("button", { name: "快速加载" });
    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveClass("ant-btn-loading"));
    resolveQuickLoad();
    await waitFor(() => expect(button).not.toHaveClass("ant-btn-loading"));
  });

  it("hides vector query execution when the user lacks query permissions", () => {
    renderWithAntd(
      <DataPanel
        resources={[vectorResource]}
        profile={{
          resource: vectorResource,
          fields: [
            { name: "name", type: "str", nullable: false, sampleValues: ["A"] },
          ],
          featureCount: 8,
          geometryType: "Point",
          bounds: [87.6, 43.8, 87.7, 43.9],
        }}
        selectedResourceId={vectorResource.id}
        queryResult={null}
        loadingProfile={false}
        querying={false}
        permissions={{ ...permissions, canQueryData: false }}
        onFilterResources={vi.fn()}
        onSelectResource={vi.fn()}
        onQuickLoadResource={vi.fn()}
        onQueryAndLoad={vi.fn()}
        onLoadRaster={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "查询并加载" }),
    ).not.toBeInTheDocument();
  });

  it("loads renderable raster resources through the raster action only", () => {
    const onLoadRaster = vi.fn();

    renderWithAntd(
      <DataPanel
        resources={[rasterResource]}
        profile={rasterProfile}
        selectedResourceId={rasterResource.id}
        queryResult={null}
        loadingProfile={false}
        querying={false}
        permissions={permissions}
        onFilterResources={vi.fn()}
        onSelectResource={vi.fn()}
        onQuickLoadResource={vi.fn()}
        onQueryAndLoad={vi.fn()}
        onLoadRaster={onLoadRaster}
      />,
    );

    expect(screen.getByText("波段数")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "查询并加载" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加载栅格" }));

    expect(onLoadRaster).toHaveBeenCalledOnce();
  });
});

describe("VectorSymbolizationEditor", () => {
  it("shows streamlined point and heatmap symbolization controls", () => {
    renderWithAntd(<StatefulVectorSymbolizationEditor geometryType="Point" />);

    expect(screen.getByText("表达方式")).toBeInTheDocument();
    expect(screen.getByText("基础样式")).toBeInTheDocument();
    expect(screen.getByText("标注")).toBeInTheDocument();
    expect(screen.getByText("单点符号")).toBeInTheDocument();
    expect(screen.getByText("点颜色")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("密度热力")[0]!);

    expect(screen.getByText("影响半径")).toBeInTheDocument();
    expect(screen.getByText("热力强度")).toBeInTheDocument();
    expect(screen.getByText(/当前按点位数量计算密度/)).toBeInTheDocument();
    expect(screen.queryByText("点颜色")).not.toBeInTheDocument();
    expect(screen.queryByText("circle-color")).not.toBeInTheDocument();
  });

  it("hides point heatmap choices for line layers", () => {
    renderWithAntd(
      <StatefulVectorSymbolizationEditor geometryType="LineString" />,
    );

    expect(screen.getByText("表达方式")).toBeInTheDocument();
    expect(screen.getByText("线颜色")).toBeInTheDocument();
    expect(screen.getByText("线型")).toBeInTheDocument();
    expect(screen.queryByText("密度热力")).not.toBeInTheDocument();
    expect(screen.queryByText("点数据表达")).not.toBeInTheDocument();
  });
});
