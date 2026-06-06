import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  cloneDefaultGroupSymbolization,
  cloneDefaultRasterSymbolization,
  cloneDefaultVectorSymbolization,
} from "../symbolization";
import type {
  LoadedLayerGroup,
  LoadedRasterLayer,
  LoadedVectorLayer,
  ResourceListItem,
} from "../types";
import { useLayerGroups } from "./useLayerGroups";

describe("useLayerGroups", () => {
  it("prepends new groups and updates group-level state", () => {
    const { result } = renderHook(() => useLayerGroups());

    act(() => {
      result.current.addGroup(makeGroup("first"));
      result.current.addGroup(makeGroup("second"));
    });
    act(() => {
      result.current.setGroupVisibility("first", false);
      result.current.setGroupName("first", "重命名图层组");
    });

    expect(result.current.groups.map((group) => group.id)).toEqual([
      "second",
      "first",
    ]);
    expect(result.current.groups[1].visible).toBe(false);
    expect(result.current.groups[1].name).toBe("重命名图层组");
  });

  it("updates only raster layers through updateRasterLayer", () => {
    const { result } = renderHook(() => useLayerGroups());
    const group = makeGroup("group", [
      makeVectorLayer("vector-layer"),
      makeRasterLayer("raster-layer"),
    ]);

    act(() => {
      result.current.addGroup(group);
    });
    act(() => {
      result.current.updateRasterLayer("group", "vector-layer", (layer) => ({
        ...layer,
        summary: "不应更新",
      }));
      result.current.updateRasterLayer("group", "raster-layer", (layer) => ({
        ...layer,
        renderStatus: "ready",
      }));
    });

    const [vectorLayer, rasterLayer] = result.current.groups[0].children;
    expect(vectorLayer.summary).toBe("vector-layer 摘要");
    expect(rasterLayer.layerType).toBe("raster");
    expect(rasterLayer.renderStatus).toBe("ready");
  });

  it("removes empty groups when the last layer is removed", () => {
    const { result } = renderHook(() => useLayerGroups());

    act(() => {
      result.current.addGroup(
        makeGroup("group", [makeVectorLayer("only-layer")]),
      );
    });
    act(() => {
      result.current.removeLayer("group", "only-layer");
    });

    expect(result.current.groups).toEqual([]);
  });

  it("reorders groups around a target group", () => {
    const { result } = renderHook(() => useLayerGroups());

    act(() => {
      result.current.setGroups([
        makeGroup("a"),
        makeGroup("b"),
        makeGroup("c"),
      ]);
    });
    act(() => {
      result.current.reorderGroups("a", "c", "after");
    });

    expect(result.current.groups.map((group) => group.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

function makeGroup(
  id: string,
  children: LoadedLayerGroup["children"] = [makeVectorLayer(`${id}-layer`)],
): LoadedLayerGroup {
  return {
    id,
    name: `${id} 组`,
    sourceResource: sourceResource(),
    visible: true,
    summary: `${id} 摘要`,
    createdAt: "2026-06-06T00:00:00.000Z",
    metadata: {},
    symbolization: cloneDefaultGroupSymbolization(),
    children,
  };
}

function makeVectorLayer(id: string): LoadedVectorLayer {
  return {
    id,
    name: id,
    layerType: "vector",
    sourceResource: sourceResource(),
    geojson: { type: "FeatureCollection", features: [] },
    geometryType: "Point",
    visible: true,
    summary: `${id} 摘要`,
    metadata: {},
    symbolization: cloneDefaultVectorSymbolization(),
    fields: [],
  };
}

function makeRasterLayer(id: string): LoadedRasterLayer {
  return {
    id,
    name: id,
    layerType: "raster",
    sourceResource: sourceResource() as LoadedRasterLayer["sourceResource"],
    geometryType: "Raster",
    visible: true,
    summary: `${id} 摘要`,
    metadata: {},
    symbolization: cloneDefaultRasterSymbolization(),
    fields: [],
  };
}

function sourceResource(): ResourceListItem {
  return {
    id: 1,
    name: "测试资源",
    dataType: "vector",
  } as ResourceListItem;
}
