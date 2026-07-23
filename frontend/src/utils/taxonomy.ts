import type { DataSchemaCatalogNode, DataSchemaSummary } from "../types";

export const fallbackTaxonomyTree: DataSchemaCatalogNode[] = [
  taxonomyRoot(
    "base_geo",
    "基础地理信息数据",
    "区域空间框架、基础地理要素与土地利用/覆被数据。",
    [
      taxonomyLeaf(
        "base_geo_admin",
        "行政区划",
        "行政边界、行政单元及相关编码。",
      ),
      taxonomyLeaf(
        "base_geo_elements",
        "基础地理要素",
        "水系、道路、保护地和地形等基础空间要素。",
      ),
      taxonomyLeaf(
        "base_geo_lucc",
        "LUCC",
        "土地利用/覆被现状、分类成果与变化数据。",
      ),
    ],
  ),
  taxonomyRoot(
    "habitat",
    "胡杨生境数据",
    "胡杨生长环境中的水、土壤、气候和生物因子。",
    [
      taxonomyLeaf(
        "habitat_water",
        "水",
        "地表水、地下水、水文过程与水质指标。",
      ),
      taxonomyLeaf(
        "habitat_soil",
        "土壤",
        "土壤样品、理化性质、盐分和养分指标。",
      ),
      taxonomyLeaf(
        "habitat_climate",
        "气候",
        "温度、降水、蒸散及其他气候指标。",
      ),
      taxonomyLeaf(
        "habitat_biotic",
        "生物环境",
        "伴生生物、土壤微生物和其他生物环境因子。",
      ),
    ],
  ),
  taxonomyRoot(
    "distribution",
    "胡杨空间分布信息",
    "胡杨分布范围、调查位置及现场影像证据。",
    [
      taxonomyLeaf(
        "distribution_vector",
        "分布矢量",
        "胡杨分布点、分布范围、斑块和相关矢量成果。",
      ),
      taxonomyLeaf(
        "distribution_survey_image",
        "调查点图片",
        "必须与调查点、调查事件、个体或样方关联的科研照片。",
      ),
    ],
  ),
  taxonomyRoot(
    "thematic",
    "胡杨专题数据",
    "按基因与种质到景观的生态组织尺度管理专题数据。",
    [
      taxonomyLeaf(
        "thematic_gene_germplasm",
        "基因与种质",
        "种质、分子、基因组及其样品来源。",
      ),
      taxonomyLeaf("thematic_individual", "个体", "单株胡杨及其时序观测。"),
      taxonomyLeaf("thematic_population", "种群", "种群单元、范围和种群指标。"),
      taxonomyLeaf(
        "thematic_community",
        "群落",
        "群落组成、多样性和功能性状。",
      ),
      taxonomyLeaf(
        "thematic_ecosystem",
        "生态系统",
        "水—土壤—气候—生物耦合过程与综合指标。",
      ),
      taxonomyLeaf(
        "thematic_landscape_rs",
        "景观与遥感",
        "遥感影像、指数、变化检测和景观格局数据。",
      ),
    ],
  ),
];

export interface TaxonomySelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  children?: TaxonomySelectOption[];
}

export function taxonomyTree(
  schema: DataSchemaSummary | null | undefined,
): DataSchemaCatalogNode[] {
  return schema?.catalogTree.length ? schema.catalogTree : fallbackTaxonomyTree;
}

export function taxonomySelectOptions(
  schema: DataSchemaSummary | null | undefined,
): TaxonomySelectOption[] {
  return taxonomyTree(schema).map(toSelectOption);
}

export function taxonomyLeafOptions(
  schema: DataSchemaSummary | null | undefined,
): Array<{ value: string; label: string }> {
  return flattenTaxonomy(taxonomyTree(schema))
    .filter((node) => node.selectable)
    .map((node) => ({
      value: node.categoryCode,
      label: node.path.join(" / "),
    }));
}

export function flattenTaxonomy(
  nodes: DataSchemaCatalogNode[],
): DataSchemaCatalogNode[] {
  return nodes.flatMap((node) => [node, ...flattenTaxonomy(node.children)]);
}

export function findTaxonomyNode(
  nodes: DataSchemaCatalogNode[],
  categoryCode: string | null | undefined,
): DataSchemaCatalogNode | null {
  if (!categoryCode) return null;
  for (const node of nodes) {
    if (node.categoryCode === categoryCode || node.code === categoryCode) {
      return node;
    }
    const child = findTaxonomyNode(node.children, categoryCode);
    if (child) return child;
  }
  return null;
}

function taxonomyRoot(
  code: string,
  name: string,
  description: string,
  children: DataSchemaCatalogNode[],
): DataSchemaCatalogNode {
  return {
    code,
    name,
    categoryCode: code,
    selectable: false,
    description,
    path: [name],
    domainType: null,
    spatialClass: null,
    children: children.map((child) => ({ ...child, path: [name, child.name] })),
  };
}

function taxonomyLeaf(
  code: string,
  name: string,
  description: string,
): DataSchemaCatalogNode {
  return {
    code,
    name,
    categoryCode: code,
    selectable: true,
    description,
    path: [name],
    domainType: null,
    spatialClass: null,
    children: [],
  };
}

function toSelectOption(node: DataSchemaCatalogNode): TaxonomySelectOption {
  return {
    value: node.categoryCode,
    label: node.name,
    disabled: !node.selectable,
    children: node.children.length
      ? node.children.map(toSelectOption)
      : undefined,
  };
}
