from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

from django.db import transaction

from apps.catalog.models import DataResource, DictionaryItem


class TaxonomyError(ValueError):
    pass


@dataclass(frozen=True)
class TaxonomyNodeDefinition:
    code: str
    name: str
    description: str
    sort_order: int
    selectable: bool = True
    children: tuple["TaxonomyNodeDefinition", ...] = ()


DATA_TAXONOMY_VERSION = "2026.07"

DATA_TAXONOMY: tuple[TaxonomyNodeDefinition, ...] = (
    TaxonomyNodeDefinition(
        code="base_geo",
        name="基础地理信息数据",
        description="描述区域空间框架、基础地理要素和土地利用/覆被的数据。",
        sort_order=10,
        selectable=False,
        children=(
            TaxonomyNodeDefinition(
                "base_geo_admin", "行政区划", "行政边界、行政单元及相关编码。", 10
            ),
            TaxonomyNodeDefinition(
                "base_geo_elements",
                "基础地理要素",
                "水系、道路、保护地、地形等基础空间要素。",
                20,
            ),
            TaxonomyNodeDefinition(
                "base_geo_lucc",
                "LUCC",
                "土地利用/覆被现状、分类成果及变化数据。",
                30,
            ),
        ),
    ),
    TaxonomyNodeDefinition(
        code="habitat",
        name="胡杨生境数据",
        description="描述胡杨生长环境中的水、土壤、气候和生物因子。",
        sort_order=20,
        selectable=False,
        children=(
            TaxonomyNodeDefinition(
                "habitat_water", "水", "地表水、地下水、水文过程与水质指标。", 10
            ),
            TaxonomyNodeDefinition(
                "habitat_soil", "土壤", "土壤样品、理化性质、盐分和养分指标。", 20
            ),
            TaxonomyNodeDefinition(
                "habitat_climate", "气候", "温度、降水、蒸散及其他气候指标。", 30
            ),
            TaxonomyNodeDefinition(
                "habitat_biotic",
                "生物环境",
                "伴生生物、土壤微生物和其他生物环境因子。",
                40,
            ),
        ),
    ),
    TaxonomyNodeDefinition(
        code="distribution",
        name="胡杨空间分布信息",
        description="描述胡杨分布范围、调查位置及其现场影像证据。",
        sort_order=30,
        selectable=False,
        children=(
            TaxonomyNodeDefinition(
                "distribution_vector",
                "分布矢量",
                "胡杨分布点、分布范围、斑块和相关矢量成果。",
                10,
            ),
            TaxonomyNodeDefinition(
                "distribution_survey_image",
                "调查点图片",
                "与调查点、调查事件、个体或样方关联的科研照片。",
                20,
            ),
        ),
    ),
    TaxonomyNodeDefinition(
        code="thematic",
        name="胡杨专题数据",
        description="按基因/种质到景观的生态组织尺度管理胡杨专题数据。",
        sort_order=40,
        selectable=False,
        children=(
            TaxonomyNodeDefinition(
                "thematic_gene_germplasm",
                "基因与种质",
                "种质资源、分子数据、基因组数据及其样品来源。",
                10,
            ),
            TaxonomyNodeDefinition(
                "thematic_individual", "个体", "单株胡杨及其时序观测。", 20
            ),
            TaxonomyNodeDefinition(
                "thematic_population", "种群", "胡杨种群单元、范围和种群指标。", 30
            ),
            TaxonomyNodeDefinition(
                "thematic_community", "群落", "群落组成、多样性和功能性状。", 40
            ),
            TaxonomyNodeDefinition(
                "thematic_ecosystem",
                "生态系统",
                "水—土—气候—生物耦合过程和生态系统综合指标。",
                50,
            ),
            TaxonomyNodeDefinition(
                "thematic_landscape_rs",
                "景观与遥感",
                "遥感影像、指数、变化检测和景观格局数据。",
                60,
            ),
        ),
    ),
)

ROOT_CATEGORY_CODES = frozenset(node.code for node in DATA_TAXONOMY)
SAFE_LEGACY_DOMAIN_CATEGORY_MAP = {
    "germplasm": "thematic_gene_germplasm",
    "genome": "thematic_gene_germplasm",
    "molecular": "thematic_gene_germplasm",
    "individual": "thematic_individual",
    "population": "thematic_population",
    "community": "thematic_community",
}


def data_category_queryset():
    return DictionaryItem.objects.filter(
        dict_type=DictionaryItem.DictType.DATA_CATEGORY
    )


def resolve_data_category(code: str, *, selectable: bool = True) -> DictionaryItem:
    normalized = str(code or "").strip()
    if not normalized:
        raise TaxonomyError("请选择数据业务分类")
    try:
        category = data_category_queryset().select_related("parent").get(
            code=normalized, is_active=True
        )
    except DictionaryItem.DoesNotExist as exc:
        raise TaxonomyError("数据业务分类不存在或已停用") from exc
    if selectable and not category.is_selectable:
        raise TaxonomyError("请选择可挂接的数据业务分类叶节点")
    return category


def category_path(category: DictionaryItem | None) -> list[DictionaryItem]:
    if category is None:
        return []
    path: list[DictionaryItem] = []
    seen: set[int] = set()
    current: DictionaryItem | None = category
    while current is not None:
        if current.pk is not None and current.pk in seen:
            raise TaxonomyError("数据分类存在循环父子关系")
        if current.pk is not None:
            seen.add(current.pk)
        if current.dict_type != DictionaryItem.DictType.DATA_CATEGORY:
            raise TaxonomyError("资源分类必须属于数据分类字典")
        path.append(current)
        current = current.parent
    path.reverse()
    return path


def serialize_category_path(category: DictionaryItem | None) -> list[dict]:
    return [
        {"id": item.id, "code": item.code, "name": item.name}
        for item in category_path(category)
    ]


def category_codes_for_filter(code: str) -> list[str]:
    category = resolve_data_category(code, selectable=False)
    items = list(
        data_category_queryset()
        .filter(is_active=True)
        .only("id", "code", "parent_id")
    )
    children: dict[int | None, list[DictionaryItem]] = defaultdict(list)
    for item in items:
        children[item.parent_id].append(item)
    result: list[str] = []
    pending = [category]
    seen: set[int] = set()
    while pending:
        current = pending.pop()
        if current.id in seen:
            continue
        seen.add(current.id)
        result.append(current.code)
        pending.extend(children.get(current.id, []))
    return result


def taxonomy_tree() -> list[dict]:
    items = list(
        data_category_queryset()
        .filter(is_active=True)
        .select_related("parent")
        .order_by("sort_order", "id")
    )
    children: dict[int | None, list[DictionaryItem]] = defaultdict(list)
    for item in items:
        children[item.parent_id].append(item)

    def serialize(item: DictionaryItem, path: list[str]) -> dict:
        current_path = [*path, item.name]
        return {
            "code": item.code,
            "name": item.name,
            "categoryCode": item.code,
            "selectable": item.is_selectable,
            "description": item.description,
            "path": current_path,
            "domainType": None,
            "spatialClass": None,
            "children": [
                serialize(child, current_path) for child in children.get(item.id, [])
            ],
        }

    return [serialize(item, []) for item in children.get(None, [])]


@transaction.atomic
def assign_resource_category(
    resource: DataResource, category_code: str
) -> DictionaryItem:
    category = resolve_data_category(category_code)
    if category.parent_id is None or category.code in ROOT_CATEGORY_CODES:
        raise TaxonomyError("一级分类仅用于分组，不能直接挂接数据资源")
    if resource.category_id != category.id:
        resource.category = category
        resource.save(update_fields=["category", "updated_at"])
    return category


def safe_legacy_category_code(domain_type: str | None) -> str | None:
    return SAFE_LEGACY_DOMAIN_CATEGORY_MAP.get(str(domain_type or "").strip())


def flatten_taxonomy_definitions(
    nodes: Iterable[TaxonomyNodeDefinition] = DATA_TAXONOMY,
) -> list[TaxonomyNodeDefinition]:
    flattened: list[TaxonomyNodeDefinition] = []
    for node in nodes:
        flattened.append(node)
        flattened.extend(flatten_taxonomy_definitions(node.children))
    return flattened
