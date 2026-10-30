from django.db import migrations


def align(apps, schema_editor):
    Resource = apps.get_model("catalog", "DataResource")
    Dictionary = apps.get_model("catalog", "DictionaryItem")
    categories = dict(Dictionary.objects.values_list("code", "pk"))
    mapping = {
        "individual": "thematic_individual",
        "population": "thematic_population",
        "community": "thematic_community",
        "traits": "thematic_community",
        "samples": "thematic_gene_germplasm",
        "molecular": "thematic_gene_germplasm",
        "genome": "thematic_gene_germplasm",
        "sequence": "thematic_gene_germplasm",
        "expression": "thematic_gene_germplasm",
        "function": "thematic_gene_germplasm",
        "variants": "thematic_gene_germplasm",
    }
    for resource in Resource.objects.all().iterator():
        config = resource.default_visualization or {}
        kind = config.get("analysisKind")
        if (
            kind == "molecular"
            and config.get("provenance") == "observed"
            and resource.name in {"叶片全氮测定", "叶片全磷测定"}
            and "物种功能性状" in resource.source
        ):
            config = {
                **config,
                "analysisKind": "traits",
                "unitOfAnalysis": "叶片理化测定记录",
            }
            resource.default_visualization = config
            resource.domain_type = "community"
            resource.category_id = categories.get("thematic_community")
            resource.save(
                update_fields=["default_visualization", "domain_type", "category"]
            )
        elif resource.category_id is None and kind in mapping:
            resource.category_id = categories.get(mapping[kind])
            resource.save(update_fields=["category"])


class Migration(migrations.Migration):
    dependencies = [("catalog", "0015_analysis_report_workflow")]
    operations = [migrations.RunPython(align, migrations.RunPython.noop)]
