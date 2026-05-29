import type mapboxgl from "mapbox-gl";
import { createContext, type RefObject, useContext } from "react";
import type {
  GroupSymbolization,
  RasterSymbolization,
  VectorSymbolization,
} from "../symbolization";
import type {
  ExportLayerItem,
  GeoJsonGeometry,
  LoadedLayer,
  LoadedLayerGroup,
  LoadedRasterLayer,
  SpatialFilter,
} from "../types";

type DropPlacement = "before" | "after";
type DrawMode = SpatialFilter["mode"];
export interface ExportOptions {
  epsg: number | null;
  reproject: boolean;
  clip: boolean;
  clipGeometry: GeoJsonGeometry | null;
}

export type ExportProgressHandler = (state: {
  status: "queued" | "running" | "ready" | "failed";
  percent: number;
  messages: string[];
}) => void;

export interface LayerContextValue {
  groups: LoadedLayerGroup[];
  addGroup: (group: LoadedLayerGroup) => void;
  updateLayer: (
    groupId: string,
    layerId: string,
    updater: (layer: LoadedLayer) => LoadedLayer,
  ) => void;
  updateRasterLayer: (
    groupId: string,
    layerId: string,
    updater: (layer: LoadedRasterLayer) => LoadedRasterLayer,
  ) => void;
  setGroupVisibility: (groupId: string, visible: boolean) => void;
  setGroupName: (groupId: string, name: string) => void;
  setGroupSymbolization: (groupId: string, value: GroupSymbolization) => void;
  setLayerVisibility: (
    groupId: string,
    layerId: string,
    visible: boolean,
  ) => void;
  setLayerName: (groupId: string, layerId: string, name: string) => void;
  setLayerSymbolization: (
    groupId: string,
    layerId: string,
    value: VectorSymbolization | RasterSymbolization,
  ) => void;
  removeGroup: (groupId: string) => void;
  removeLayer: (groupId: string, layerId: string) => void;
  reorderGroups: (
    sourceGroupId: string,
    targetGroupId: string,
    placement: DropPlacement,
  ) => void;
  startRasterRender: (
    groupId: string,
    layerId: string,
    symbolization: RasterSymbolization,
    layer: LoadedRasterLayer,
    rulesMode: "default" | "custom",
  ) => void;
  locateLayer: (groupId: string, layerId: string) => void;
  locateGroup: (groupId: string) => void;
  mapRef: RefObject<mapboxgl.Map | null>;
  canUseCustomSymbolization: boolean;
  canExportData: boolean;
  permissionDeniedMessage: string;
  exportClipGeometry: GeoJsonGeometry | null;
  startExportClipDraw: (mode: DrawMode) => void;
  clearExportClipGeometry: () => void;
  exportLayers: (
    items: ExportLayerItem[],
    options: ExportOptions,
    onProgress?: ExportProgressHandler,
  ) => Promise<void>;
}

export const LayerContext = createContext<LayerContextValue | null>(null);

export function useLayerContext(): LayerContextValue {
  const ctx = useContext(LayerContext);
  if (!ctx)
    throw new Error(
      "useLayerContext must be used within LayerContext.Provider",
    );
  return ctx;
}
