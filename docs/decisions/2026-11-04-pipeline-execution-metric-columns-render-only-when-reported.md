# Pipeline execution metric columns render only when a listed task reports them

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** UI maintainers (review of #36309)
- **Guard:** `ListViewTab.component.test.tsx` ("hide the metric and log columns when no listed task reports them") and `executionUtils.test.tsx` ("falls back to the reported execution time only when start or end is missing")
- **Related:** #36308, #36309, #23341

## Context
`TaskStatus` carries optional `metrics` (`rowsRead`, `rowsWritten`, `rowsFiltered`, `executionTimeMs`)
and `logLink` (#23341). `logLink` is populated by the Airflow provider, Airbyte, Databricks and
dbt Cloud; `metrics` is populated by no connector in `ingestion/` and only by producers that post
to `PUT /v1/pipelines/{fqn}/status` themselves. Rendering one column per field unconditionally
gave every pipeline four columns of `--`, squeezed the existing columns until task names broke
mid-word and timestamps wrapped to three lines, and showed `executionTimeMs` beside a Duration
(end − start) that carried the same value on every row.

## Decision
In the Executions list view (`ListViewTab`):
- **Rows Read**, **Rows Written** and **Log** are optional columns: each renders only when at least
  one task in the listed runs reports that field; a task without it shows `--`.
- **Rows Filtered** and **Execution Time** are not columns. `executionTimeMs` is used as the
  Duration only when the task has no `startTime`/`endTime`; wall-clock duration otherwise wins.
- Counts are right-aligned with tabular digits; name and timestamp cells do not wrap; the table
  scrolls horizontally (`scroll.x: 'max-content'`) instead of compressing columns.
- The log link is an icon-only `ButtonUtility` with a "View Log" tooltip.

## Consequences
Pipelines from connectors that send no metrics look as they did before the feature; producers that
send metrics get the columns automatically. The visible column set can differ between pipelines,
and between date ranges of one pipeline. Revisit when a built-in connector starts populating
`metrics` (the columns would then be the common case), or when a producer needs `rowsFiltered`
or an execution time that differs from end − start to be visible.
