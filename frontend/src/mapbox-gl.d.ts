import type * as MapboxGl from "mapbox-gl";

declare global {
  const mapboxgl: typeof MapboxGl;

  namespace mapboxgl {
    type GeoJSONSource = MapboxGl.GeoJSONSource;
    type LngLatBounds = MapboxGl.LngLatBounds;
    type Map = MapboxGl.Map;
  }
}
