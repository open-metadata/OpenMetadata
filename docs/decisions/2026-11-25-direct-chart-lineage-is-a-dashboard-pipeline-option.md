# Direct chart lineage is a dashboard metadata pipeline option

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** OpenMetadata ingestion maintainers and contributors
- **Guard:** `test_looker_chart_lineage.py`, `TestMetabaseDirectChartLineage` in `test_metabase.py`, and `test_dashboard_chart_lineage.py`
- **Related:** [#28492](https://github.com/open-metadata/OpenMetadata/issues/28492), [#38448](https://github.com/open-metadata/OpenMetadata/pull/38448)

## Context

Some dashboard connectors draw lineage from a chart's upstream sources straight to the chart, in addition to the lineage to the chart's dashboard. Looker draws Explore to Chart, and Metabase draws Table to Chart. The shared dashboard topology also draws Dashboard to Chart for every chart. Some deployments want a chart to reach its sources only through its dashboard. The first version of #38448 made this a Looker connection setting. Review moved it to the pipeline, so that every connector with direct chart lineage reads one setting and each pipeline can choose.

## Decision

`DashboardServiceMetadataPipeline.includeDirectChartLineage` defaults to `true`. Connectors read it through `DashboardServiceSource.include_direct_chart_lineage`, which treats only an explicit `false` as off. When it is off, a connector makes no catalog chart lookups for direct lineage and writes no direct edges to charts. It still writes the lineage from those sources to the dashboard. The Dashboard to Chart stage ignores the option. A connector that adds direct chart lineage gates it on the same property.

## Consequences

Existing pipelines keep their lineage. The setting belongs to the pipeline, so two pipelines of the same service can differ, and the service connection holds no default for it. Direct edges written by earlier runs remain unless `overrideLineage` is enabled. The optional property needs no migration. The server stores it as given, but an ingestion worker built without it rejects the workflow, so upgrade the workers before saving the setting and remove it before downgrading them.
