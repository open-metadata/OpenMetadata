# The metric list's bulk delete is a recursive soft delete

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** karanh37
- **Guard:** `deleteMetricAsync` params test in `openmetadata-ui/src/main/resources/ui/src/rest/metricsAPI.test.ts`; the bulk-deletion test in `src/pages/MetricsPage/MetricListPage/MetricListPage.test.tsx`
- **Related:** #36424

## Context
Metrics form a hierarchy: a parent metric holds its variants through `CONTAINS` edges. A
non-recursive delete of a parent fails with "metric is not empty", so bulk-deleting a selection
that includes a parent failed. A recursive hard delete would succeed, but would irreversibly remove
every variant under the selected parents, which the user may not have looked at.

## Decision
The metric list's bulk delete calls `DELETE /v1/metrics/async/{id}` with `recursive=true` for each
selected metric and never sends `hardDelete`. A parent's variants are removed with it, and the
whole hierarchy can be restored. The confirmation copy (`message.delete-metrics-warning`) promises
exactly this.

## Consequences
- Bulk-deleting a parent cannot fail on its variants, and cannot destroy them.
- Permanent removal stays on the single-entity delete flow, where the user chooses it explicitly.
- Changing bulk delete to a hard delete means superseding this record and changing the
  confirmation copy in the same PR.
