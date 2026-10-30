from django.urls import path
from apps.omics import analysis_views

urlpatterns = [
    path("assemblies/", analysis_views.assemblies),
    path("assemblies/<int:id>/summary/", analysis_views.summary),
    path("assemblies/<int:id>/genes/", analysis_views.genes),
    path("assemblies/<int:id>/genes/<str:geneId>/", analysis_views.gene),
    path("assemblies/<int:id>/sequence/", analysis_views.sequence),
    path("import/", analysis_views.genome_import),
]
