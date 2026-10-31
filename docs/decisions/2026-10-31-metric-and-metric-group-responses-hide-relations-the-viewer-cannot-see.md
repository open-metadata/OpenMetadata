# Metric and MetricGroup responses hide relations, counts and stored change entries the viewer cannot see

- **Status:** Accepted
- **Revisions:** v1 2026-10-31 (initial)
- **Deciders:** PR #36764 (fixes #36762)
- **Guard:** reviewer — `MetricResourceIT.hierarchyEndpointsFilterAndSanitizeEveryRestrictedMetricReference` and the metric repository/resource unit tests
- **Related:** #36762, PR #36764, the hierarchy-endpoint filtering introduced in `e4e88a41f268`

## Context

A metric's relation fields (`parent`, `children`, `childrenCount`, `relatedMetrics`, `metricGroup`), a metric group's member list and `metricCount`, and the stored `changeDescription` / `incrementalChangeDescription` that quote those references all name other metrics, groups and data assets. The hierarchy endpoints (`/metrics/{id}/hierarchy`, `/metrics/hierarchy`, `/metricGroups/{id}/metrics`) filtered those references per viewer with a `ViewBasic` test, but every other response that carried a `Metric` or `MetricGroup` — generic reads, list, writes, version histories — returned the references as stored, letting a caller denied `ViewBasic` on the referenced entities read their id, name, displayName and description. Version snapshots are stored rows, so the same filtering had to apply on read, not at write.

## Decision

Every response that carries a `Metric` or `MetricGroup` drops any `parent` / `children` / `relatedMetrics` / `metricGroup` / `metrics` reference, and any stored change entry (`fieldsAdded` / `fieldsUpdated` / `fieldsDeleted` for those fields) that names an entity the caller lacks `ViewBasic` on, and recounts `childrenCount` / `metricCount` over the visible references. This holds for generic reads, list pages, write responses and version snapshots alike. A caller with unconditional `ViewBasic` on metrics and metric groups gets the unchanged payload. The per-request authorization decisions are cached per referenced entity, and list pages recount the visible counts in one batch query per page rather than one scan per row.

Callers with conditional access pay for the check with one permission evaluation per distinct referenced entity per request; relations and counts in their responses show only what they may view, even when another caller sees more on the same entities.

## Consequences

- `relatedMetrics` is still accepted at write time without a check on the named metric: the link is stored, but a writer who cannot view the named metric no longer reads it back in any response. Requiring a view or edit permission for each named metric at write time is a possible follow-up.
- Change events of a restricted writer lack the relations that writer could not see, because `ChangeEventHandler` builds the persisted event from the write response entity and the response is now the writer-scoped view; the full change record stays on the entity's stored history and version snapshots. What a metric or metric group change event may carry, and filtering events per subscriber when they are read back, is one follow-up decision that should cover this writer-side loss and the reader-side exposure of unrestricted writers' events through the audit log together.
- The inherited `/metrics/history` and `/metricGroups/history` endpoints, like `/history` of every entity type, still lack a per-entity or domain filter; that is a separate, broader issue.
- Sanitizers deep-copy entities; adding a relation field to `Metric` or `MetricGroup` responses requires adding it to the sanitizer maps, or it bypasses the rule.
