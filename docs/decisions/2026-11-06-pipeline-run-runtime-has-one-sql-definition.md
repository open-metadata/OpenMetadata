# A pipeline run's runtime has one SQL definition, shared by the average and the runtime trend

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `PipelineStatusPaginationSqlTest` (the average and the runtime trend over the same runs,
  on MySQL and PostgreSQL)
- **Related:** ADR:2026-11-05-pipeline-entity-status-reads-hold-at-most-one-page

## Context
Two places report how long a pipeline's runs take: the average runtime in a pipeline's
observability summary, over its last 30 days, and the runtime trend, per day. The average was
computed in Java over every run in its window, the trend in SQL, and they measured a run
differently, so the same runs could show different numbers:
- The average spanned only the tasks that have both a start and an end time, and dropped runtimes
  that were zero or negative.
- The trend took the earliest start and the latest end separately across all tasks, and kept zero
  and negative runtimes. On MySQL it used the task span only when the first task had an end time,
  where PostgreSQL used it when any task had one; and because MySQL cast the task times to
  `UNSIGNED`, one run whose span came out negative failed the whole MySQL query.

## Decision
- A run's runtime is the span from the earliest start to the latest end of its tasks that have
  both. When no task has both, it is the run's `endTime` minus its `timestamp`. It is null unless
  positive, so an aggregate over it leaves zero and negative runtimes out.
- It is written once per engine, positivity included, as `MYSQL_RUN_RUNTIME` and
  `POSTGRES_RUN_RUNTIME` in `EntityExtensionTimeSeriesDAO`. The average (`averagePipelineRuntime`,
  an `AVG` in SQL) and the trend (`getRuntimeTrendData`) both select it.
- This is the definition the average already used, so the average keeps its values and the trend
  changes to match it.

## Consequences
- The average and the trend agree for the same runs, on both engines, and the average is one number
  computed in the database instead of the window's runs read into the server.
- The trend no longer reports zero or negative runtimes, measures a run whose tasks lack a start or
  an end time over the tasks that have both, and no longer fails on MySQL for a run whose tasks end
  before they start.
- The status list's `minDuration`/`maxDuration` filter is not this definition: it measures the tasks
  a search matches, from their earliest start to their latest end.
- Changing the definition means changing both constants and the guard's expected runtimes together.
