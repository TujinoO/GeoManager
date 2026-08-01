import { describe, expect, it } from "vitest";
import type { RasterImportPreview } from "../types";
import {
  normalizeImportValues,
  suggestedRasterCategoryCode,
} from "./importValues";

describe("normalizeImportValues", () => {
  it("keeps the selected business domain type in the import payload", () => {
    expect(
      normalizeImportValues({
        name: " 胡杨群落样方数据 ",
        domainType: "community",
        categoryCode: "thematic_community",
        importMode: "geographic",
        longitudeColumn: "Longitude",
        latitudeColumn: "Latitude",
        accessGroupIds: [],
      }),
    ).toEqual({
      name: "胡杨群落样方数据",
      domainType: "community",
      categoryCode: "thematic_community",
      importMode: "geographic",
      longitudeColumn: "Longitude",
      latitudeColumn: "Latitude",
      accessGroupIds: [],
    });
  });

  it("accepts the vector business domain type", () => {
    expect(
      normalizeImportValues({
        name: " 新疆边界 ",
        domainType: "vector",
        categoryCode: "base_geo_admin",
        importMode: "geographic",
        longitudeColumn: "",
        latitudeColumn: "",
        accessGroupIds: [],
      }),
    ).toMatchObject({
      name: "新疆边界",
      domainType: "vector",
      categoryCode: "base_geo_admin",
      importMode: "geographic",
    });
  });
});

describe("suggestedRasterCategoryCode", () => {
  it("routes a labeled LUCC classification raster to the LUCC category", () => {
    expect(
      suggestedRasterCategoryCode({
        rasterKind: "categorical",
        defaultRules: {
          uniqueValues: ["耕地", "林地", "水体", "建筑", "道路"].map(
            (label, value) => ({ value, label, color: "#000000" }),
          ),
        },
      } as RasterImportPreview),
    ).toBe("base_geo_lucc");
  });

  it("keeps non-LUCC rasters in landscape and remote sensing", () => {
    expect(
      suggestedRasterCategoryCode({
        rasterKind: "continuous",
        defaultRules: { mode: "gray" },
      } as RasterImportPreview),
    ).toBe("thematic_landscape_rs");
  });
});
