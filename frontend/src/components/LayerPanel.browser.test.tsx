import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { LayerContext, type LayerContextValue } from "../hooks/LayerContext";
import {
  cloneDefaultGroupSymbolization,
  cloneDefaultVectorSymbolization,
} from "../symbolization";
import type {
  LoadedLayerGroup,
  LoadedVectorLayer,
  ResourceListItem,
} from "../types";
import LayerPanel from "./LayerPanel";

describe("LayerPanel drag ordering", () => {
  it("uses the pointer position at drop time instead of a stale dragover frame", async () => {
    const moveLayer = vi.fn();
    const context = makeContext(
      [
        {
          ...makeGroup("manual", [
            makeLayer("layer-a", "图层 A"),
            makeLayer("layer-b", "图层 B"),
          ]),
          isManual: true,
        },
      ],
      moveLayer,
    );
    render(
      <AntdApp>
        <LayerContext.Provider value={context}>
          <LayerPanel />
        </LayerContext.Provider>
      </AntdApp>,
    );

    const sourceHandle = screen.getByRole("button", {
      name: "拖动图层 A排序",
    });
    const targetNode = screen.getByText("图层 B").closest("[role='treeitem']");
    expect(targetNode).not.toBeNull();
    Object.defineProperty(targetNode, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 200,
          height: 100,
          left: 0,
          right: 300,
          width: 300,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });
    const dataTransfer = new DataTransfer();

    fireEvent.dragStart(sourceHandle, { dataTransfer });
    fireEvent.dragOver(targetNode!, { clientY: 110, dataTransfer });
    await waitFor(() => {
      expect(targetNode).toHaveClass("layer-drop-before");
    });

    fireEvent.drop(targetNode!, { clientY: 190, dataTransfer });

    expect(moveLayer).toHaveBeenCalledWith(
      "manual",
      "layer-a",
      "manual",
      "layer-b",
      "after",
    );
    await waitFor(() => {
      expect(targetNode).not.toHaveClass("layer-drop-before");
      expect(targetNode).not.toHaveClass("layer-drop-after");
    });
  });
});

function makeContext(
  groups: LoadedLayerGroup[],
  moveLayer: LayerContextValue["moveLayer"],
): LayerContextValue {
  return {
    groups,
    selectedLayerId: null,
    selectLayer: vi.fn(),
    openLayerTable: vi.fn(),
    addGroup: vi.fn(),
    replaceGroups: vi.fn(),
    updateLayer: vi.fn(),
    updateRasterLayer: vi.fn(),
    setGroupVisibility: vi.fn(),
    setGroupName: vi.fn(),
    setGroupSymbolization: vi.fn(),
    setLayerVisibility: vi.fn(),
    isLayerExtentVisible: vi.fn(() => false),
    setLayerExtentVisibility: vi.fn(),
    setLayerName: vi.fn(),
    setLayerSymbolization: vi.fn(),
    removeGroup: vi.fn(),
    removeLayer: vi.fn(),
    reorderGroups: vi.fn(),
    moveLayer,
    extractLayer: vi.fn(),
    startRasterRender: vi.fn(),
    locateLayer: vi.fn(),
    locateGroup: vi.fn(),
    mapRef: createRef(),
    canUseCustomSymbolization: false,
    canExportData: false,
    exportClipGeometry: null,
    clearExportClipGeometry: vi.fn(),
    exportLayers: vi.fn(async () => undefined),
    workspaceScenes: [],
    workspaceAccessGroups: [],
    canCreateWorkspaces: false,
    saveWorkspace: vi.fn(async () => undefined),
  };
}

function makeGroup(
  id: string,
  children: LoadedLayerGroup["children"],
): LoadedLayerGroup {
  return {
    id,
    name: "测试图层组",
    sourceResource: sourceResource(),
    visible: true,
    summary: "",
    createdAt: "2026-07-29T00:00:00.000Z",
    metadata: {},
    symbolization: cloneDefaultGroupSymbolization(),
    children,
  };
}

function makeLayer(id: string, name: string): LoadedVectorLayer {
  return {
    id,
    name,
    layerType: "vector",
    sourceResource: sourceResource(),
    geojson: { type: "FeatureCollection", features: [] },
    geometryType: "Point",
    visible: true,
    summary: "",
    metadata: {},
    symbolization: cloneDefaultVectorSymbolization(),
    fields: [],
  };
}

function sourceResource(): ResourceListItem {
  return {
    id: 1,
    name: "测试资源",
    code: "test-resource",
    dataType: "vector",
    category: null,
    categoryPath: [],
    classificationStatus: "classified",
    spatialClass: "spatial",
    domainType: "vector",
    availableViews: ["map"],
    defaultView: "map",
    source: "测试",
    provider: "测试",
    dataDate: null,
    spatialExtent: "",
    coordinateSystem: "EPSG:4326",
    fileFormat: "GeoJSON",
    description: "",
    qualityNote: "",
    sizeBytes: 0,
    itemCount: 0,
    status: "active",
    isQueryable: true,
    isRenderable: true,
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
}
