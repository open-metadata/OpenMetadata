# A bot PUT never removes a metric's parent or group

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** ulixius9
- **Guard:** `MetricResourceIT#put_reingestingKeepsParentAndGroupSetInTheUi` fails if re-ingestion
  drops a parent or group or versions the metric; `MetricResourceIT#put_byBotChildOfDeletedParent_restoresItAsARoot`
  fails if a bot PUT keeps a deleted parent
- **Related:** ADR:2026-10-27-a-bot-put-never-removes-a-related-metric-edge,
  ADR:2026-11-03-a-metric-is-restored-with-its-parent-never-under-a-deleted-one

## Context
No connector (dbt, Snowflake semantic views, Unity Catalog, Looker, Tableau, Power BI) models the
metric hierarchy. Users build it on top of ingested metrics. Ingestion re-PUTs every metric with no
`parent` and no `metricGroup`, and `MetricUpdater` applied those nulls, so each scheduled run
removed the hierarchy users had built and added a version to every curated metric.

## Decision
- A bot PUT that names no parent keeps the stored parent, and with it the group the metric inherits
  from that parent.
- A bot PUT on a root that names no group keeps the stored group. One that names a group, or names
  a parent, applies it as before.
- A stored parent that is deleted is not kept: the metric comes back as a root, as the restore rule
  requires.
- This holds with `overrideMetadata=true`: connectors never send these fields, so a null never
  means "remove".
- A PUT by a user and any PATCH apply the request as before.

## Consequences
Re-ingesting unchanged metrics leaves the hierarchy and the version untouched. A bot cannot detach
a metric from its parent or group. If a connector starts sourcing the hierarchy, it must send the
parent explicitly, and removing one will need provenance on the edge, as for related metrics.
