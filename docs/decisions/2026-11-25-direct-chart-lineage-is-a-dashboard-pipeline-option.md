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

Existing pipelines keep their lineage. The setting belongs to the pipeline, so two pipelines of the same service can differ, and the service connection holds no default for it. Direct edges written by earlier runs remain unless `overrideLineage` is enabled. The optional property needs no migration. An ingestion worker built without it rejects any workflow that carries it. The UI form fills in schema defaults, so it writes `includeDirectChartLineage: true` into every dashboard pipeline it saves, including pipelines that leave the option untouched. Workers already have to match the server's major and minor version (`validate_versions`), so this matters only for a worker on an earlier patch of the same minor, or after a downgrade. Upgrade the workers before saving dashboard pipelines, and remove the property from dashboard pipelines saved since the upgrade before downgrading the workers. Every defaulted pipeline option had the same compatibility when it was added, `includeDraftDashboard` included.
