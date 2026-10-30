"""Field mappings from the client's individual, population and community workbooks."""

INDIVIDUAL = [
    ("collection_code", "采集号"),
    ("collecting_institution", "采集单位"),
    ("region", "地州"),
    ("city", "市县"),
    ("locality", "地点"),
    ("altitude_m", "海拔"),
    ("longitude", "经度"),
    ("latitude", "纬度"),
    ("species", "物种中文名"),
    ("scientific_name", "物种拉丁名"),
    ("family_order", "科排序"),
    ("family", "科中文名"),
    ("family_latin", "科拉丁名"),
    ("genus", "属中文名"),
    ("genus_latin", "属拉丁名"),
]
POPULATION = [
    ("region", "地区"),
    ("city", "市县"),
    ("town", "乡镇"),
    ("plot_code", "地点（样方）"),
    ("longitude", "经度"),
    ("latitude", "纬度"),
    ("altitude_m", "海拔"),
    ("habitat", "栖息地类型"),
    ("transect", "样线"),
    ("species", "种"),
    ("individual_count", "株数（数量）"),
    ("standardized_count", "实际株数（草本按50m2)"),
    ("distribution_pattern", "分布方式"),
    ("plot_area", "样方面积"),
    ("density", "密度（某物种个体数/样方面积）"),
    ("cover_fraction", "盖度（草、灌）/100"),
    ("occurrence_plot_count", "物种出现样方次数"),
    ("frequency", "频度(物种出现次数/样方总个数)"),
    ("total_individuals", "总株数和（所有物种株数和）"),
    ("relative_abundance", "相对多度（相对密度）*100"),
    ("total_frequency", "总频度和"),
    ("relative_frequency", "相对频度*100"),
    ("total_cover", "所有物种盖度和"),
    ("relative_cover", "相对盖度（灌草）"),
    ("importance_value", "重要值"),
]
COMMUNITY = [
    ("group", "样方分组"),
    ("plot_code", "样方编号"),
    ("longitude", "经度"),
    ("latitude", "纬度"),
    ("altitude_m", "海拔"),
    ("fric", "功能丰富度"),
    ("feve", "功能均匀度"),
    ("fdiv", "功能离散度"),
    ("fdis", "功能离散指数"),
    ("raoq", "Rao 二次熵"),
    ("cwm_lt", "群落加权平均叶厚"),
    ("cwm_lwc", "群落加权平均叶片含水量"),
    ("cwm_ldm", "群落加权平均叶干物质含量"),
    ("cwm_lma", "群落加权平均单位面积叶质量"),
    ("cwm_sla", "群落加权平均比叶面积"),
    ("cwm_la", "群落加权平均单叶面积"),
    ("cwm_tn", "群落加权平均叶片全氮"),
    ("cwm_tp", "群落加权平均叶片全磷"),
    ("cwm_tk", "群落加权平均叶片全钾"),
    ("cwm_tc", "群落加权平均叶片全碳"),
    ("cwm_cn", "群落加权平均碳氮比"),
    ("cwm_np", "群落加权平均氮磷比"),
    ("cwm_cp", "群落加权平均碳磷比"),
    ("shannon", "Shannon 多样性指数"),
    ("simpson", "Simpson 多样性指数"),
    ("richness", "物种丰富度"),
    ("pielou", "Pielou 均匀度指数"),
    ("phylogenetic_diversity", "系统发育多样性"),
    ("soil_salt", "土壤总盐"),
    ("conductivity", "电导率"),
    ("soil_ph", "土壤酸碱度"),
    ("soil_water", "土壤含水量"),
    ("solar_radiation", "太阳辐射"),
    ("pet", "潜在蒸散量"),
    ("soil_tn", "土壤全氮"),
    ("soil_tk", "土壤全钾"),
    ("soil_tp", "土壤全磷"),
    ("soil_organic_carbon", "土壤有机碳"),
    ("agbc", "地上生物量碳或地上生物量相关碳储量指标"),
    ("shrub_cover", "灌木盖度"),
    ("herb_cover", "草本盖度"),
    ("npp", "净初级生产力"),
]
CLIMATE = list(
    zip(
        [f"bio{i}" for i in range(1, 20)],
        [
            "年平均温度",
            "平均昼夜温差",
            "等温性",
            "温度季节性变化",
            "最暖月最高温",
            "最冷月最低温",
            "年温度范围",
            "最湿季度平均温度",
            "最干季度平均温度",
            "最暖季度平均温度",
            "最冷季度平均温度",
            "年降水量",
            "最湿月降水量",
            "最干月降水量",
            "降水季节性变化",
            "最湿季度降水量",
            "最干季度降水量",
            "最暖季度降水量",
            "最冷季度降水量",
        ],
        strict=True,
    )
)
POPULATION += CLIMATE
COMMUNITY += CLIMATE
TRAITS_EXTRA = [
    ("locality", "地点"),
    ("site_number", "地点号"),
    ("family", "科名"),
    ("genus", "属名"),
    ("family_latin", "英文科名"),
    ("genus_latin", "英文属名"),
    ("scientific_name", "英文种名"),
    ("leaf_thickness", "叶厚"),
    ("leaf_fresh_mass", "单叶片鲜重"),
    ("leaf_dry_mass", "单叶干重"),
    ("leaf_dry_fraction", "叶干物质含量%"),
    ("leaf_mass_area", "单位面积叶质量"),
    ("specific_leaf_area", "比叶面积"),
    ("leaf_tissue_density", "叶组织密度"),
    ("leaf_area", "单叶面积"),
    ("leaf_shape_index", "叶形指数"),
    ("leaf_nitrogen_gkg", "全氮（g/kg）"),
    ("leaf_phosphorus_gkg", "全磷（g/kg）"),
    ("leaf_potassium_gkg", "全钾（g/kg）"),
    ("leaf_carbon_gkg", "全碳（g/kg）"),
    ("carbon_nitrogen_ratio", "碳氮比"),
    ("nitrogen_phosphorus_ratio", "氮磷比"),
    ("carbon_phosphorus_ratio", "碳磷比"),
    ("standardized_count", "实际株数"),
    ("importance_value", "重要值"),
]
LABELS = dict(INDIVIDUAL + POPULATION + COMMUNITY + TRAITS_EXTRA)
LABELS.update(
    {"altitude_m": "海拔（m）", "density": "种群密度", "agbc": "地上生物量相关碳指标"}
)


def ecology_templates():
    text = {
        "record_id",
        "collection_code",
        "collecting_institution",
        "region",
        "city",
        "town",
        "locality",
        "plot_code",
        "species",
        "scientific_name",
        "family",
        "family_latin",
        "genus",
        "genus_latin",
        "group",
        "transect",
        "habitat",
        "distribution_pattern",
    }
    out = {}
    for kind, label, fields, required in [
        ("individual", "生态观测—个体", INDIVIDUAL, ["collection_code", "species"]),
        ("population", "生态观测—种群", POPULATION, ["plot_code", "species"]),
        ("community", "生态观测—群落", COMMUNITY, ["plot_code"]),
    ]:
        columns = ["record_id"] + [f for f, _ in fields]
        out[kind] = {
            "name": label,
            "domain": kind,
            "unit": "调查记录",
            "columns": columns,
            "required": required,
            "unique": ["record_id"],
            "numeric": [f for f in columns if f not in text],
            "descriptions": {
                "record_id": "原表记录编号；未提供时按原始行号生成，不代表独立生物个体",
                **dict(fields),
            },
        }
    return out


def normalize_analysis_table(df, kind):
    """Retain all input fields; rename only explicit, source-backed aliases."""
    fields = {
        "individual": INDIVIDUAL,
        "population": POPULATION,
        "community": COMMUNITY,
        "traits": TRAITS_EXTRA
        + [
            ("plot_code", "地点样方"),
            ("species", "种"),
            ("region", "地区"),
            ("life_form", "生活型（乔、灌、草）"),
            ("height_m", "平均高度m"),
            ("leaf_water_fraction", "叶片含水量%"),
        ],
        "samples": [
            ("sample_code", "DNA样本编号"),
            ("sample_code", "样品号"),
            ("region", "采集地点"),
            ("region", "地点"),
            ("sex", "性别"),
            ("sex", "雌/雄"),
            ("longitude", "经度"),
            ("latitude", "纬度"),
            ("altitude_m", "海拔（米）"),
            ("altitude_m", "海拔"),
        ],
    }.get(kind)
    if fields is None:
        return df
    df = df.copy()
    aliases = {label: field for field, label in fields}
    if kind == "individual":
        aliases["Unnamed: 3"] = "city"  # The client's XLS has an empty county header.
    if kind == "community":
        raw = [
            "km",
            "Sample",
            "Longitude",
            "latitude",
            "Altitude",
            "FRic",
            "FEve",
            "FDiv",
            "FDis",
            "RaoQ",
            "CWM-LT",
            "CWM-LWC",
            "CWM-LDM",
            "CWM-LMA",
            "CWM-SLA",
            "CWM-LA",
            "CWM-TN",
            "CWM-TP",
            "CWM-TK",
            "CWM-TC",
            "CWM-C:N",
            "CWM-N:P",
            "CWM-C:P",
            "Shannon",
            "Simpson",
            "SR",
            "Pielou",
            "PD",
            "TS",
            "EC",
            "pH",
            "SWC",
            "sol",
            "PET",
            "TN",
            "TK",
            "TP",
            "SOC",
            "AGBC",
            "Shrub-cover",
            "Herbal-coverage",
            "npp",
        ]
        aliases.update(dict(zip(raw, [f for f, _ in COMMUNITY], strict=False)))
    renames = {
        c: aliases[c]
        for c in df.columns
        if c in aliases and aliases[c] not in df.columns
    }
    if len(set(renames.values())) != len(renames):
        raise ValueError("原始表含多个对应同一含义的字段，请明确保留一个字段后再导入")
    df = df.rename(columns=renames)
    if "record_id" not in df and kind in {
        "individual",
        "population",
        "community",
        "traits",
    }:
        df.insert(0, "record_id", [f"ROW-{i + 2:06}" for i in range(len(df))])
    if kind == "samples":
        if "sex" in df:
            original = df.sex.copy()
            df["sex"] = df.sex.replace(
                {
                    "雌株": "female",
                    "雄株": "male",
                    "雌": "female",
                    "雄": "male",
                    "": "unknown",
                }
            )
            unconfirmed = ~df.sex.isin({"female", "male", "unknown"})
            if unconfirmed.any():
                df["sex_original"] = original
                df.loc[unconfirmed, "sex"] = "unknown"
        if "material_type" not in df:
            df["material_type"] = ""  # Do not infer tissue from the DNA list title.
        if "is_core" not in df:
            df["is_core"] = ""  # Missing membership is not a negative assertion.
    return df
