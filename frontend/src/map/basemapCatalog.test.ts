import { describe, expect, it } from "vitest";
import {
  availableBasemapFallback,
  createBasemapCatalog,
  resolveBasemapDefinition,
  tiandituMapboxGlyphs,
} from "./basemapCatalog";
import { tiandituTileProviderName } from "./tiandituTileProviderConfig";

describe("basemapCatalog", () => {
  it("provides three user choices and keeps OSM as an internal fallback", () => {
    const catalog = createBasemapCatalog({
      mapboxAccessToken: "mapbox-test-token",
      tiandituKey: "tianditu-test-key",
    });

    expect(catalog.map((basemap) => basemap.id)).toEqual([
      "mapbox-satellite",
      "mapbox-streets",
      "tianditu-vector",
      "osm",
    ]);
    expect(
      catalog
        .filter((basemap) => basemap.selectable)
        .map((basemap) => basemap.id),
    ).toEqual(["mapbox-satellite", "mapbox-streets", "tianditu-vector"]);
    expect(catalog[0].id).toBe("mapbox-satellite");
    expect(resolveBasemapDefinition(catalog, "osm")?.selectable).toBe(false);
  });

  it("marks Mapbox choices unavailable when their token is missing", () => {
    const catalog = createBasemapCatalog({ tiandituKey: "test-key" });

    for (const id of ["mapbox-satellite", "mapbox-streets"] as const) {
      const basemap = resolveBasemapDefinition(catalog, id);
      expect(basemap?.credentials).toMatchObject({
        available: false,
        missing: ["mapboxAccessToken"],
        reason: "未配置 Mapbox Token",
      });
    }
  });

  it("marks Tianditu unavailable when its key is missing", () => {
    const catalog = createBasemapCatalog({
      mapboxAccessToken: "mapbox-test-token",
    });

    expect(
      resolveBasemapDefinition(catalog, "tianditu-vector")?.credentials,
    ).toMatchObject({
      available: false,
      missing: ["tiandituKey"],
      reason: "未配置天地图 Key",
    });
  });

  it("keeps Tianditu usable without Mapbox while warning about business fonts", () => {
    const catalog = createBasemapCatalog({ tiandituKey: "test-key" });
    const tianditu = resolveBasemapDefinition(catalog, "tianditu-vector");

    expect(tianditu?.credentials).toMatchObject({
      available: true,
      degraded: true,
      missing: ["mapboxAccessToken"],
    });
    expect(tianditu?.credentials.warning).toContain("业务文字字体能力受限");
    expect(typeof tianditu?.style).toBe("object");
    expect(
      typeof tianditu?.style === "object" ? tianditu.style.glyphs : null,
    ).toBe(tiandituMapboxGlyphs);
  });

  it("builds vec_w and cva_w WMTS sources from the supplied encoded key", () => {
    const rawKey = "test key/+?&";
    const catalog = createBasemapCatalog({ tiandituKey: rawKey });
    const tianditu = resolveBasemapDefinition(catalog, "tianditu-vector");
    expect(tianditu).toBeDefined();
    expect(tianditu?.requireAllSourceIds).toBe(true);
    expect(typeof tianditu?.style).toBe("object");
    if (!tianditu || typeof tianditu.style === "string") {
      throw new Error("天地图应使用内联样式");
    }

    expect(Object.keys(tianditu.style.sources)).toEqual(tianditu.sourceIds);
    const vectorSource = tianditu.style.sources[tianditu.sourceIds[0]] as {
      tiles?: string[];
      maxzoom?: number;
      provider?: string;
    };
    const labelSource = tianditu.style.sources[tianditu.sourceIds[1]] as {
      tiles?: string[];
      maxzoom?: number;
      provider?: string;
    };
    expect(vectorSource.tiles).toHaveLength(8);
    expect(labelSource.tiles).toHaveLength(8);
    expect(vectorSource.maxzoom).toBe(18);
    expect(labelSource.maxzoom).toBe(18);
    expect(vectorSource.provider).toBe(tiandituTileProviderName);
    expect(labelSource.provider).toBe(tiandituTileProviderName);
    expect(
      vectorSource.tiles?.every((url) => url.includes("/vec_w/wmts")),
    ).toBe(true);
    expect(labelSource.tiles?.every((url) => url.includes("/cva_w/wmts"))).toBe(
      true,
    );
    const encodedKey = encodeURIComponent(rawKey);
    expect(
      [...(vectorSource.tiles ?? []), ...(labelSource.tiles ?? [])].every(
        (url) => url.includes(`tk=${encodedKey}`) && !url.includes(rawKey),
      ),
    ).toBe(true);
    expect(tianditu.style.layers?.map((layer) => layer.id)).toEqual([
      tianditu.sourceIds[0],
      tianditu.sourceIds[1],
    ]);
  });

  it("uses the explicit preference and fallback order", () => {
    const allAvailable = createBasemapCatalog({
      mapboxAccessToken: "mapbox-test-token",
      tiandituKey: "tianditu-test-key",
    });
    expect(
      availableBasemapFallback(allAvailable, {
        userPreference: "streets",
        systemDefault: "satellite",
      }).id,
    ).toBe("mapbox-streets");
    expect(
      availableBasemapFallback(allAvailable, {
        userPreference: "unknown",
        systemDefault: "tianditu-vector",
      }).id,
    ).toBe("tianditu-vector");
    expect(
      availableBasemapFallback(allAvailable, {
        userPreference: "osm",
        systemDefault: "osm",
      }).id,
    ).toBe("mapbox-satellite");
    expect(availableBasemapFallback(allAvailable).id).toBe("mapbox-satellite");

    const tiandituOnly = createBasemapCatalog({
      tiandituKey: "tianditu-test-key",
    });
    expect(availableBasemapFallback(tiandituOnly).id).toBe("tianditu-vector");

    const noCredentials = createBasemapCatalog({});
    expect(
      availableBasemapFallback(noCredentials, { systemDefault: "osm" }).id,
    ).toBe("osm");
    expect(availableBasemapFallback(noCredentials).id).toBe("osm");
  });

  it("resolves legacy configuration aliases without guessing unknown values", () => {
    const catalog = createBasemapCatalog({
      mapboxAccessToken: "mapbox-test-token",
      tiandituKey: "tianditu-test-key",
    });

    expect(resolveBasemapDefinition(catalog, "satellite")?.id).toBe(
      "mapbox-satellite",
    );
    expect(resolveBasemapDefinition(catalog, "streets")?.id).toBe(
      "mapbox-streets",
    );
    expect(resolveBasemapDefinition(catalog, "osm")?.id).toBe("osm");
    expect(resolveBasemapDefinition(catalog, "not-a-basemap")).toBeUndefined();
  });
});
