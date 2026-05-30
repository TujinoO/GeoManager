import { Button, Tooltip } from "antd";
import {
  Fullscreen,
  Home,
  LocateFixed,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";
import { syncVectorInteractions } from "../map/featureInteraction";
import { addRasterLayer } from "../map/rasterLayerSync";
import {
  bindGeometryDraw,
  type DrawMode,
  upsertPolygonLayer,
} from "../map/spatialDraw";
import {
  addLoadedStyleLayers,
  removeLayerGroup,
  removeLoadedLayerGroup,
  reorderLoadedStyleLayers,
} from "../map/vectorLayerSync";
import type {
  Bootstrap,
  GeoJsonGeometry,
  LoadedLayer,
  LoadedRasterLayer,
  LoadedVectorLayer,
  SpatialFilter,
} from "../types";
import {
  boundsFromImageCoordinates,
  combinedFeatureBounds,
  sourceIdFor,
} from "../utils/geometry";

const mapStyle = "mapbox://styles/mapbox/satellite-streets-v12";
const globeOverviewZoom = 2.4;
const spatialFilterSourceId = "query-spatial-filter";
const spatialFilterFillId = "query-spatial-filter-fill";
const spatialFilterLineId = "query-spatial-filter-line";
const exportClipSourceId = "export-clip-filter";
const exportClipFillId = "export-clip-filter-fill";
const exportClipLineId = "export-clip-filter-line";

interface Props {
  bootstrap: Bootstrap;
  loadedLayers: LoadedLayer[];
  drawMode: DrawMode | null;
  spatialFilter: SpatialFilter | null;
  exportClipGeometry: GeoJsonGeometry | null;
  onDrawComplete: (mode: DrawMode, geometry: GeoJsonGeometry) => void;
  onMapReady?: (map: MapboxMap) => void;
  onMapDestroy?: () => void;
}

export default function MapCanvas({
  bootstrap,
  loadedLayers,
  drawMode,
  spatialFilter,
  exportClipGeometry,
  onDrawComplete,
  onMapReady,
  onMapDestroy,
}: Props) {
  const mapRef = useRef<MapboxMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapboxToken = bootstrap.map.mapboxAccessToken;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: bootstrap.map.defaultCenter,
      zoom: Math.min(bootstrap.map.defaultZoom, globeOverviewZoom),
      pitch: 18,
      bearing: -12,
      projection: "globe",
      language: "zh-Hans",
      localIdeographFontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      accessToken: mapboxToken,
      attributionControl: false,
    });
    map.on("style.load", () => {
      map.setFog({
        color: "rgb(221, 232, 224)",
        "high-color": "rgb(52, 96, 123)",
        "horizon-blend": 0.08,
        "space-color": "rgb(8, 20, 28)",
        "star-intensity": 0.22,
      });
      map.setLanguage("zh-Hans");
      applyChineseLabels(map);
      hideAdministrativeBoundaries(map);
      map.once("idle", () => hideAdministrativeBoundaries(map));
    });
    map.addControl(
      new mapboxgl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    mapRef.current = map;
    onMapReady?.(map);

    return () => {
      onMapDestroy?.();
      map.remove();
      mapRef.current = null;
    };
  }, [
    bootstrap.map.defaultCenter,
    bootstrap.map.defaultZoom,
    mapboxToken,
    onMapDestroy,
    onMapReady,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => syncLoadedLayers(map, loadedLayers);
    if (map.isStyleLoaded()) sync();
    else map.once("load", sync);
  }, [loadedLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (spatialFilter) {
      upsertPolygonLayer(
        map,
        spatialFilterSourceId,
        spatialFilterFillId,
        spatialFilterLineId,
        spatialFilter.geometry,
        0.16,
      );
    } else {
      removeLayerGroup(
        map,
        spatialFilterSourceId,
        [spatialFilterFillId, spatialFilterLineId],
        { cleanInteraction: false },
      );
    }
  }, [spatialFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (exportClipGeometry) {
      upsertPolygonLayer(
        map,
        exportClipSourceId,
        exportClipFillId,
        exportClipLineId,
        exportClipGeometry,
        0.14,
      );
    } else {
      removeLayerGroup(
        map,
        exportClipSourceId,
        [exportClipFillId, exportClipLineId],
        { cleanInteraction: false },
      );
    }
  }, [exportClipGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawMode) return;
    return bindGeometryDraw(map, drawMode, (geometry) =>
      onDrawComplete(drawMode, geometry),
    );
  }, [drawMode, onDrawComplete]);

  function resetView() {
    mapRef.current?.flyTo({
      center: bootstrap.map.defaultCenter,
      zoom: Math.min(bootstrap.map.defaultZoom, globeOverviewZoom),
      pitch: 18,
      bearing: -12,
    });
  }

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-container" />
      <div className="map-toolbar">
        <Tooltip title="复位">
          <Button icon={<Home size={16} />} onClick={resetView} />
        </Tooltip>
        <Tooltip title="放大">
          <Button
            icon={<ZoomIn size={16} />}
            onClick={() => mapRef.current?.zoomIn()}
          />
        </Tooltip>
        <Tooltip title="缩小">
          <Button
            icon={<ZoomOut size={16} />}
            onClick={() => mapRef.current?.zoomOut()}
          />
        </Tooltip>
        <Tooltip title="北向">
          <Button
            icon={<RotateCcw size={16} />}
            onClick={() => mapRef.current?.resetNorthPitch()}
          />
        </Tooltip>
        <Tooltip title="定位到项目范围">
          <Button
            icon={<LocateFixed size={16} />}
            onClick={() =>
              mapRef.current?.fitBounds([
                [50, 35],
                [100, 48],
              ])
            }
          />
        </Tooltip>
        <Tooltip title="全屏">
          <Button
            icon={<Fullscreen size={16} />}
            onClick={() => containerRef.current?.requestFullscreen()}
          />
        </Tooltip>
      </div>
    </div>
  );
}

function syncLoadedLayers(map: MapboxMap, layers: LoadedLayer[]) {
  const renderableVectorLayers = layers.filter(
    (l): l is LoadedVectorLayer => l.layerType === "vector" && "geojson" in l,
  );
  const renderableRasterLayers = layers.filter(
    (l): l is LoadedRasterLayer =>
      l.layerType === "raster" && Boolean(l.tileUrl),
  );
  const activeIds = new Set([
    ...renderableVectorLayers.map((l) => sourceIdFor(l.id)),
    ...renderableRasterLayers.map((l) => sourceIdFor(l.id)),
  ]);

  const existing =
    (map as unknown as { __loadedSources?: Set<string> }).__loadedSources ??
    new Set<string>();
  for (const sourceId of existing) {
    if (!activeIds.has(sourceId)) removeLoadedLayerGroup(map, sourceId);
  }

  const newVectorBounds: mapboxgl.LngLatBounds[] = [];
  for (const layer of renderableVectorLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) {
      removeLoadedLayerGroup(map, sourceId);
      continue;
    }
    const isNew = !map.getSource(sourceId);
    if (isNew) {
      map.addSource(sourceId, {
        type: "geojson",
        data: layer.geojson as never,
        generateId: true,
      });
      const bounds = combinedFeatureBounds([layer.geojson]);
      if (bounds) newVectorBounds.push(bounds);
    } else {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(
        layer.geojson as never,
      );
    }
    addLoadedStyleLayers(map, sourceId, layer);
  }

  const newRasterBounds: mapboxgl.LngLatBounds[] = [];
  for (const layer of renderableRasterLayers) {
    const sourceId = sourceIdFor(layer.id);
    if (!layer.visible) {
      removeLoadedLayerGroup(map, sourceId);
      continue;
    }
    const isNew = !map.getSource(sourceId);
    if (isNew && layer.imageCoordinates) {
      const bounds = boundsFromImageCoordinates(layer.imageCoordinates);
      if (bounds) newRasterBounds.push(bounds);
    }
    addRasterLayer(map, sourceId, layer);
  }

  const allNewBounds = [...newVectorBounds, ...newRasterBounds];
  if (allNewBounds.length > 0) {
    const combined = allNewBounds.reduce(
      (b, next) => b.extend(next),
      new mapboxgl.LngLatBounds(
        allNewBounds[0].getSouthWest(),
        allNewBounds[0].getNorthEast(),
      ),
    );
    map.fitBounds(combined, { padding: 80, duration: 900, essential: true });
  }

  reorderLoadedStyleLayers(map, [
    ...renderableVectorLayers,
    ...renderableRasterLayers,
  ]);
  syncVectorInteractions(map, renderableVectorLayers);
  (map as unknown as { __loadedSources: Set<string> }).__loadedSources =
    activeIds;
}

function applyChineseLabels(map: MapboxMap) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    if (
      layer.type !== "symbol" ||
      !layer.layout ||
      !("text-field" in layer.layout)
    )
      continue;
    const textField = JSON.stringify(layer.layout["text-field"]);
    if (!textField.includes("name")) continue;
    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name_zh-Hans"],
      ["get", "name_zh"],
      ["get", "name"],
      ["get", "name_en"],
    ]);
  }
}

function hideAdministrativeBoundaries(map: MapboxMap) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    const sourceLayer =
      "source-layer" in layer && layer["source-layer"]
        ? String(layer["source-layer"])
        : "";
    const searchText = `${layer.id} ${sourceLayer}`.toLowerCase();
    const isBoundaryLayer =
      layer.type === "line" &&
      (searchText.includes("admin") || searchText.includes("boundary"));
    if (isBoundaryLayer && map.getLayer(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}
