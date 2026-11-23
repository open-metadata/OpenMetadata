# Looker connections can opt out of direct Explore-to-Chart lineage

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** OpenMetadata ingestion contributors
- **Guard:** `test_looker_chart_lineage.py`, `DashboardServiceResourceIT`, and `ConnectionConfigForm.schema-render.test.tsx`
- **Related:** [#28492](https://github.com/open-metadata/OpenMetadata/issues/28492)

## Context

Looker records both Explore-to-Dashboard and Explore-to-Chart lineage. The shared dashboard topology also records Dashboard-to-Chart lineage. Some Looker deployments prefer to see how a chart depends on an Explore through its dashboard.

## Decision

Add optional `includeChartLineage` to the Looker connection with a default of `true`. Explicit `false` skips direct Explore-to-Chart edge emission and the associated chart lookups. An omitted setting and any accepted null keep direct edges enabled. Managed workflows use the saved connection when they have no inline connection. Standalone workflows can set the option on their inline Looker connection.

## Consequences

Existing workflows retain their lineage behavior by default. Turning the setting off leaves the shared dashboard lineage and its existing replacement behavior in effect. Historical direct edges follow the existing lineage override policy. Deploy the server schema and ingestion worker before saving the option. Remove the new property from saved or inline connections before downgrading to a version that cannot read it.
