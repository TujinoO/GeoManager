import type mapboxgl from "mapbox-gl";
import type { GeoJsonGeometry, SpatialFilter } from "../types";
import { geometryFromPoints } from "../utils/geometry";
import { addLayerIfMissing } from "./styleHelpers";

const previewSourceId = "query-draw-preview";
const previewFillId = "query-draw-preview-fill";
const previewLineId = "query-draw-preview-line";
export type DrawMode = SpatialFilter["mode"];

export function showDrawPreview(map: mapboxgl.Map, geometry: GeoJsonGeometry) {
  upsertPolygonLayer(
    map,
    previewSourceId,
    previewFillId,
    previewLineId,
    geometry,
    0.18,
  );
}

export function clearDrawPreview(map: mapboxgl.Map) {
  removeLayerGroupSimple(map, previewSourceId, [previewFillId, previewLineId]);
}

export function bindGeometryDraw(
  map: mapboxgl.Map,
  mode: DrawMode,
  onComplete: (geometry: GeoJsonGeometry) => void,
) {
  clearDrawPreview(map);
  map.getCanvas().style.cursor = "crosshair";
  map.doubleClickZoom.disable();
  let start: [number, number] | null = null;
  let polygonPoints: Array<[number, number]> = [];

  const handleClick = (event: mapboxgl.MapMouseEvent) => {
    const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
    if (mode === "polygon") {
      polygonPoints = [...polygonPoints, point];
      if (polygonPoints.length >= 2) {
        showDrawPreview(
          map,
          geometryFromPoints("polygon", polygonPoints[0], polygonPoints[1]),
        );
      }
      return;
    }
    if (!start) {
      start = point;
      return;
    }
    const geometry = geometryFromPoints(mode, start, point);
    showDrawPreview(map, geometry);
    onComplete(geometry);
  };

  const handleMouseMove = (event: mapboxgl.MapMouseEvent) => {
    const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
    if (mode === "polygon" && polygonPoints.length > 0) {
      showDrawPreview(map, {
        type: "Polygon",
        coordinates: [[...polygonPoints, point, polygonPoints[0]]],
      });
    } else if (start) {
      showDrawPreview(map, geometryFromPoints(mode, start, point));
    }
  };

  const handleDoubleClick = (event: mapboxgl.MapMouseEvent) => {
    if (mode !== "polygon" || polygonPoints.length < 3) return;
    event.preventDefault();
    const geometry: GeoJsonGeometry = {
      type: "Polygon",
      coordinates: [[...polygonPoints, polygonPoints[0]]],
    };
    showDrawPreview(map, geometry);
    onComplete(geometry);
  };

  map.on("click", handleClick);
  map.on("mousemove", handleMouseMove);
  map.on("dblclick", handleDoubleClick);

  return () => {
    map.off("click", handleClick);
    map.off("mousemove", handleMouseMove);
    map.off("dblclick", handleDoubleClick);
    map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = "";
    clearDrawPreview(map);
  };
}

export function upsertPolygonLayer(
  map: mapboxgl.Map,
  sourceId: string,
  fillId: string,
  lineId: string,
  geometry: GeoJsonGeometry,
  fillOpacity: number,
) {
  const data = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry }],
  };
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: data as never });
  } else {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data as never);
  }
  addLayerIfMissing(map, {
    id: fillId,
    type: "fill",
    source: sourceId,
    paint: { "fill-color": "#d9a441", "fill-opacity": fillOpacity },
  });
  addLayerIfMissing(map, {
    id: lineId,
    type: "line",
    source: sourceId,
    paint: { "line-color": "#d9a441", "line-width": 2, "line-opacity": 0.9 },
  });
}

export function removeLayerGroupSimple(
  map: mapboxgl.Map,
  sourceId: string,
  layerIds: string[],
) {
  layerIds.forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}
