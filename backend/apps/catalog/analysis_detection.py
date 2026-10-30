"""Conservative recognition from source-backed field signatures, never file names."""

from apps.catalog.ecology_contracts import normalize_analysis_table

PUBLIC_KINDS = (
    "individual",
    "population",
    "community",
    "traits",
    "samples",
    "molecular",
    "sequence",
)


def detect_table_kinds(df):
    matches = []
    for kind in PUBLIC_KINDS:
        try:
            cols = set(normalize_analysis_table(df.head(0), kind).columns)
        except ValueError:
            continue
        signature = {
            "individual": {"collection_code", "species"} <= cols,
            "population": {"plot_code", "species"} <= cols
            and bool(cols & {"individual_count", "density", "frequency", "plot_area"}),
            "community": "plot_code" in cols
            and bool(
                cols
                & {
                    "fric",
                    "feve",
                    "fdiv",
                    "fdis",
                    "raoq",
                    "shannon",
                    "simpson",
                    "cwm_lt",
                }
            ),
            "traits": "species" in cols
            and bool(
                cols
                & {
                    "height_m",
                    "leaf_water_fraction",
                    "leaf_thickness",
                    "specific_leaf_area",
                    "leaf_area",
                }
            )
            and not bool(
                cols
                & {
                    "collection_code",
                    "individual_count",
                    "density",
                    "frequency",
                    "plot_area",
                }
            ),
            "samples": "sample_code" in cols
            and not bool(
                cols
                & {
                    "result_id",
                    "marker",
                    "assay_code",
                    "sequence_id",
                    "gene_id",
                    "genotype",
                    "position",
                }
            ),
            "molecular": {"result_id", "sample_code", "marker", "unit"} <= cols,
            "sequence": {"assembly", "sequence_id", "sequence_type"} <= cols,
        }[kind]
        if signature:
            matches.append(kind)
    return matches
