import type { GeoJsonGeometry, SpatialFilter } from "../types";
import { geometryFromPoints } from "../utils/geometry";
import { removeLayerGroup } from "./vectorLayerSync";

const previewSourceId = "query-draw-preview";
const previewFillId = "query-draw-preview-fill";
const previewLineId = "query-draw-preview-line";
const defaultRangeStyle: PolygonLayerStyle = {
  fillColor: "#ef4444",
  fillOpacity: 0.16,
  lineColor: "#ef4444",
  lineOpacity: 0.95,
  lineWidth: 2,
};
export type DrawMode = SpatialFilter["mode"];

export interface PolygonLayerStyle {
  fillColor: string;
  fillOpacity: number;
  lineColor: string;
  lineOpacity: number;
  lineWidth: number;
  beforeId?: string;
}

export function showDrawPreview(map: mapboxgl.Map, geometry: GeoJsonGeometry) {
  upsertPolygonLayer(
    map,
    previewSourceId,
    previewFillId,
    previewLineId,
    geometry,
    { ...defaultRangeStyle, fillOpacity: 0.18 },
  );
}

export function clearDrawPreview(map: mapboxgl.Map) {
  removeLayerGroup(map, previewSourceId, [previewFillId, previewLineId], {
    cleanInteraction: false,
  });
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
        const firstPoint = polygonPoints[0];
        const secondPoint = polygonPoints[1];
        if (!firstPoint || !secondPoint) return;
        showDrawPreview(
          map,
          geometryFromPoints("polygon", firstPoint, secondPoint),
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
  style: PolygonLayerStyle = defaultRangeStyle,
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
  upsertStyledLayer(
    map,
    {
      id: fillId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": style.fillColor,
        "fill-opacity": style.fillOpacity,
      },
    },
    style.beforeId,
  );
  upsertStyledLayer(
    map,
    {
      id: lineId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": style.lineColor,
        "line-width": style.lineWidth,
        "line-opacity": style.lineOpacity,
      },
    },
    style.beforeId,
  );
}

function upsertStyledLayer(
  map: mapboxgl.Map,
  layer: mapboxgl.AnyLayer,
  beforeId?: string,
) {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer, beforeId);
  } else {
    const writableMap = map as unknown as {
      setPaintProperty: (
        layerId: string,
        property: string,
        value: unknown,
      ) => void;
    };
    for (const [property, value] of Object.entries(layer.paint ?? {})) {
      writableMap.setPaintProperty(layer.id, property, value);
    }
  }
  if (beforeId && map.getLayer(beforeId) && map.getLayer(layer.id)) {
    map.moveLayer(layer.id, beforeId);
  }
}
