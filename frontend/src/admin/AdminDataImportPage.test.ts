import { describe, expect, it } from "vitest";
import { normalizeImportValues } from "./importValues";

describe("normalizeImportValues", () => {
  it("keeps the selected business domain type in the import payload", () => {
    expect(
      normalizeImportValues({
        name: " 胡杨群落样方数据 ",
        domainType: "community",
        importMode: "geographic",
        longitudeColumn: "Longitude",
        latitudeColumn: "Latitude",
        accessGroupIds: [],
      }),
    ).toEqual({
      name: "胡杨群落样方数据",
      domainType: "community",
      importMode: "geographic",
      longitudeColumn: "Longitude",
      latitudeColumn: "Latitude",
      accessGroupIds: [],
    });
  });
});
