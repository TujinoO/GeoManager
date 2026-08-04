import type { StyleSpecification } from "mapbox-gl";
import { createOsmRasterStyle, mapboxSatelliteStyle } from "./basemapStyle";
import { tiandituTileProviderName } from "./tiandituTileProviderConfig";

export type BasemapId =
  | "mapbox-satellite"
  | "mapbox-streets"
  | "tianditu-vector"
  | "osm";

export type BasemapProvider = "mapbox" | "tianditu" | "osm";
export type BasemapCredentialName = "mapboxAccessToken" | "tiandituKey";
export type BasemapVisual = "satellite" | "streets" | "tianditu" | "fallback";

export interface BasemapCredentials {
  mapboxAccessToken?: string;
  tiandituKey?: string;
}

export interface BasemapCredentialState {
  available: boolean;
  missing: BasemapCredentialName[];
  reason?: string;
  degraded?: boolean;
  warning?: string;
}

export interface BasemapPostProcess {
  applyExpressionSafety: boolean;
  applyChineseLanguage: boolean;
  applySatelliteColorCorrection: boolean;
  hideAdministrativeBoundaries: boolean;
}

export interface BasemapDefinition {
  id: BasemapId;
  label: string;
  description: string;
  provider: BasemapProvider;
  selectable: boolean;
  style: string | StyleSpecification;
  sourceIds: readonly string[];
  requireAllSourceIds?: boolean;
  errorMarkers: readonly string[];
  attribution: string;
  credentials: BasemapCredentialState;
  postProcess: BasemapPostProcess;
  visual: BasemapVisual;
}

export interface BasemapFallbackOptions {
  userPreference?: string | null;
  systemDefault?: string | null;
}

export const mapboxStreetsStyle = "mapbox://styles/mapbox/streets-v12";
export const tiandituMapboxGlyphs =
  "mapbox://fonts/mapbox/{fontstack}/{range}.pbf";

const tiandituVectorSourceId = "basemap-tianditu-vector";
const tiandituLabelSourceId = "basemap-tianditu-labels";
const osmSourceId = "osm-raster";
const osmLayerId = "osm-raster";

const mapboxSatelliteSourceIds = [
  "composite",
  "mapbox-satellite",
  "mapbox",
] as const;
const mapboxStreetsSourceIds = ["composite"] as const;
const tiandituSourceIds = [
  tiandituVectorSourceId,
  tiandituLabelSourceId,
] as const;

const basemapIdAliases: Readonly<Record<string, BasemapId>> = {
  satellite: "mapbox-satellite",
  streets: "mapbox-streets",
  tianditu: "tianditu-vector",
  "mapbox-satellite": "mapbox-satellite",
  "mapbox-streets": "mapbox-streets",
  "tianditu-vector": "tianditu-vector",
  osm: "osm",
};

export function createBasemapCatalog(
  credentials: BasemapCredentials,
): readonly BasemapDefinition[] {
  const hasMapboxToken = hasCredential(credentials.mapboxAccessToken);
  const hasTiandituKey = hasCredential(credentials.tiandituKey);
  const mapboxCredentials = mapboxCredentialState(hasMapboxToken);
  const tiandituCredentials = tiandituCredentialState(
    hasTiandituKey,
    hasMapboxToken,
  );

  return [
    {
      id: "mapbox-satellite",
      label: "Mapbox 卫星实景图",
      description: "高分辨率卫星影像与道路注记，平台默认底图",
      provider: "mapbox",
      selectable: true,
      style: mapboxSatelliteStyle,
      sourceIds: mapboxSatelliteSourceIds,
      errorMarkers: [
        mapboxSatelliteStyle,
        "api.mapbox.com",
        "tiles.mapbox.com",
        "mapbox://",
      ],
      attribution: "© Mapbox © OpenStreetMap",
      credentials: mapboxCredentials,
      postProcess: {
        applyExpressionSafety: true,
        applyChineseLanguage: true,
        applySatelliteColorCorrection: true,
        hideAdministrativeBoundaries: true,
      },
      visual: "satellite",
    },
    {
      id: "mapbox-streets",
      label: "Mapbox 街道图",
      description: "突出道路、地名和交通参考信息，不含实时路况",
      provider: "mapbox",
      selectable: true,
      style: mapboxStreetsStyle,
      sourceIds: mapboxStreetsSourceIds,
      errorMarkers: [
        mapboxStreetsStyle,
        "api.mapbox.com",
        "tiles.mapbox.com",
        "mapbox://",
      ],
      attribution: "© Mapbox © OpenStreetMap",
      credentials: mapboxCredentials,
      postProcess: {
        applyExpressionSafety: true,
        applyChineseLanguage: true,
        applySatelliteColorCorrection: false,
        hideAdministrativeBoundaries: false,
      },
      visual: "streets",
    },
    {
      id: "tianditu-vector",
      label: "天地图矢量注记图",
      description: "天地图矢量底图与中文注记组合",
      provider: "tianditu",
      selectable: true,
      style: createTiandituVectorStyle(credentials.tiandituKey),
      sourceIds: tiandituSourceIds,
      requireAllSourceIds: true,
      errorMarkers: [
        "tianditu.gov.cn",
        tiandituVectorSourceId,
        tiandituLabelSourceId,
      ],
      attribution: "© 天地图",
      credentials: tiandituCredentials,
      postProcess: {
        applyExpressionSafety: false,
        applyChineseLanguage: false,
        applySatelliteColorCorrection: false,
        hideAdministrativeBoundaries: false,
      },
      visual: "tianditu",
    },
    {
      id: "osm",
      label: "OpenStreetMap 技术兜底",
      description: "内部技术兜底，不提供生产可用性承诺",
      provider: "osm",
      selectable: false,
      style: createOsmRasterStyle(osmSourceId, osmLayerId),
      sourceIds: [osmSourceId],
      errorMarkers: ["tile.openstreetmap.org", osmSourceId],
      attribution: "© OpenStreetMap contributors",
      credentials: {
        available: true,
        missing: [],
        degraded: true,
        warning: "公共匿名瓦片仅作内部技术兜底，不承诺生产服务等级。",
      },
      postProcess: {
        applyExpressionSafety: false,
        applyChineseLanguage: false,
        applySatelliteColorCorrection: false,
        hideAdministrativeBoundaries: false,
      },
      visual: "fallback",
    },
  ];
}

export function resolveBasemapDefinition(
  catalog: readonly BasemapDefinition[],
  id: string | null | undefined,
): BasemapDefinition | undefined {
  if (!id) return undefined;
  const normalizedId = basemapIdAliases[id.trim().toLowerCase()];
  if (!normalizedId) return undefined;
  return catalog.find((basemap) => basemap.id === normalizedId);
}

export function availableBasemapFallback(
  catalog: readonly BasemapDefinition[],
  options: BasemapFallbackOptions = {},
): BasemapDefinition {
  const preferredCandidates = [options.userPreference, options.systemDefault];

  for (const id of preferredCandidates) {
    const basemap = resolveBasemapDefinition(catalog, id);
    if (basemap?.selectable && basemap.credentials.available) return basemap;
  }

  const selectableFallbacks = [
    "mapbox-satellite",
    "mapbox-streets",
    "tianditu-vector",
  ];

  for (const id of selectableFallbacks) {
    const basemap = resolveBasemapDefinition(catalog, id);
    if (basemap?.selectable && basemap.credentials.available) return basemap;
  }

  const technicalFallback = resolveBasemapDefinition(catalog, "osm");
  if (technicalFallback?.credentials.available) return technicalFallback;
  throw new Error("底图目录中没有可用的底图");
}

function createTiandituVectorStyle(
  key: string | undefined,
): StyleSpecification {
  return {
    version: 8,
    glyphs: tiandituMapboxGlyphs,
    sources: {
      [tiandituVectorSourceId]: {
        type: "raster",
        provider: tiandituTileProviderName,
        tiles: tiandituTiles("vec", key),
        tileSize: 256,
        maxzoom: 18,
        attribution: "© 天地图",
      },
      [tiandituLabelSourceId]: {
        type: "raster",
        provider: tiandituTileProviderName,
        tiles: tiandituTiles("cva", key),
        tileSize: 256,
        maxzoom: 18,
        attribution: "© 天地图",
      },
    },
    layers: [
      {
        id: tiandituVectorSourceId,
        type: "raster",
        source: tiandituVectorSourceId,
      },
      {
        id: tiandituLabelSourceId,
        type: "raster",
        source: tiandituLabelSourceId,
      },
    ],
  };
}

function tiandituTiles(layer: "vec" | "cva", key: string | undefined) {
  const encodedKey = encodeURIComponent(key?.trim() ?? "");
  return Array.from(
    { length: 8 },
    (_, index) =>
      `https://t${index}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${encodedKey}`,
  );
}

function mapboxCredentialState(
  hasMapboxToken: boolean,
): BasemapCredentialState {
  return hasMapboxToken
    ? { available: true, missing: [] }
    : {
        available: false,
        missing: ["mapboxAccessToken"],
        reason: "未配置 Mapbox Token",
      };
}

function tiandituCredentialState(
  hasTiandituKey: boolean,
  hasMapboxToken: boolean,
): BasemapCredentialState {
  if (!hasTiandituKey) {
    return {
      available: false,
      missing: ["tiandituKey"],
      reason: "未配置天地图 Key",
    };
  }
  if (!hasMapboxToken) {
    return {
      available: true,
      missing: ["mapboxAccessToken"],
      degraded: true,
      warning: "底图可用，但平台业务文字字体能力受限。",
    };
  }
  return { available: true, missing: [] };
}

function hasCredential(value: string | undefined) {
  return Boolean(value?.trim());
}
