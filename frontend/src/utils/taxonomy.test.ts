import { describe, expect, it } from "vitest";
import {
  fallbackTaxonomyTree,
  findTaxonomyNode,
  flattenTaxonomy,
  taxonomyLeafOptions,
} from "./taxonomy";

describe("authoritative data taxonomy", () => {
  it("keeps four roots and fifteen selectable leaves", () => {
    expect(fallbackTaxonomyTree.map((node) => node.code)).toEqual([
      "base_geo",
      "habitat",
      "distribution",
      "thematic",
    ]);
    expect(
      flattenTaxonomy(fallbackTaxonomyTree).filter((node) => node.selectable),
    ).toHaveLength(15);
  });

  it("places LUCC, soil microbes, germplasm and remote sensing in confirmed boundaries", () => {
    expect(
      findTaxonomyNode(fallbackTaxonomyTree, "base_geo_lucc")?.path,
    ).toEqual(["基础地理信息数据", "LUCC"]);
    expect(
      findTaxonomyNode(fallbackTaxonomyTree, "habitat_biotic")?.description,
    ).toContain("土壤微生物");
    expect(
      findTaxonomyNode(fallbackTaxonomyTree, "thematic_gene_germplasm")?.path,
    ).toEqual(["胡杨专题数据", "基因与种质"]);
    expect(
      findTaxonomyNode(fallbackTaxonomyTree, "thematic_landscape_rs")?.path,
    ).toEqual(["胡杨专题数据", "景观与遥感"]);
  });

  it("only exposes leaf categories to classification forms", () => {
    const options = taxonomyLeafOptions(null);
    expect(options).toHaveLength(15);
    expect(options.some((item) => item.value === "habitat")).toBe(false);
    expect(options).toContainEqual({
      value: "distribution_survey_image",
      label: "胡杨空间分布信息 / 调查点图片",
    });
  });
});
