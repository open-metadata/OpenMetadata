# Run durations are raw milliseconds, shown in compact units, and OSS merges before Collate

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial); v2 2026-11-06 (every run-duration display, not only agent runs); v3 2026-11-06 (only displays that showed a large count of minutes or seconds)
- **Deciders:** Sweta Agarwalla
- **Guard:** `RunHistoryDrawer.test.tsx`, `agentsDataMapper.test.ts`, `DateTimeUtils.test.ts`, `QueryCard.test.tsx`, `TestConnectionModal.test.tsx`, `OntologyQueryResults.test.tsx`, `PipelineExecution.spec.ts`; Collate `ModelsTable.test.tsx`, `PipelineStatistics.test.tsx`, `ServiceSummaryTab.utils.test.ts`, `QueryResultsPanel.test.tsx`, `ChatRunTimer.test.tsx`, `RunHistoryTable.test.tsx` (scoring job); paired build and merge-order review
- **Related:** [#37052](https://github.com/open-metadata/OpenMetadata/issues/37052), [OpenMetadata #37055](https://github.com/open-metadata/OpenMetadata/pull/37055), [Collate #8265](https://github.com/open-metadata/openmetadata-collate/pull/8265)

## Context

`AgentRun.duration` held decimal minutes, and the run history drawer printed it with a localized
"min" suffix, so a nearly three-hour run read as `165.6 min`. `AgentRun` is shared with Collate: it
is handed to Collate's `RenderRunAction` plugin, and Collate tests build `AgentRun` fixtures.

Other displays had the same problem: a long run read as a large count of minutes, seconds or
milliseconds. Pipeline task executions (`165.60 minutes`), query cards (`165 min 36 sec`), connection
test steps and SPARQL timings (`125000 ms`), and in Collate the dbt model and pipeline average run
time (`166 min`), the service summary (`165m 36s`), the SQL Studio execution time (`9936s`), the AI
chat timer (`165m, 36.0s`), the scoring-job run (`190m 05s`) and MCP latency (`12345 ms`).

## Decision

`AgentRun.durationMs` is the run's `endDate − startDate` in milliseconds, or `0` when the run has
no end date.

Only a display that showed a large count of minutes, seconds or milliseconds is converted. A display
that already showed hours, days or years keeps its format, including application runs
(`02:45:36`), table freshness lateness, workflow and incident times, and Collate agent job runs.

Converted displays roll a long value into compact units:

- Every converted display, in OpenMetadata and Collate, uses one helper: `formatDuration(ms, length?)`
  in `DateTimeUtils`. It keeps sub-minute precision (`<1ms`, `950ms`, `42.3s`) and rolls up from one
  minute (`2m 5s`, `2h 45m 36s`). The agent run drawer, the query card and the Collate displays
  pass `length` 2 (`2h 45m`); pipeline task executions, connection test steps, ontology and SPARQL
  timings, and the data quality run card leave it unset.
- Displays whose text comes from a translated string (the Collate AI chat timer and the scoring-job
  run) gain an hours-and-minutes key in every locale instead.

The compact units are the non-localized `Y`/`M`/`d`/`h`/`m`/`s`/`ms` suffixes of the shared helper in
every locale, written with no space, matching the time-left text on the agents page.
`message.ran-for-duration` therefore carries no unit of its own.

Merge OSS #37055 first, then Collate #8265, which renames its fixture field. Collate CI builds
against OpenMetadata `main`, so Collate's type check fails until both are in.

## Consequences

Consumers never convert units; a new duration display passes milliseconds to the shared helper. A
display that already reads in hours is not rewritten just to match. Localizing the compact units
would mean changing the shared helper for every surface that uses it, not adding a unit word back to
a string. `label.duration-in-minute` has no caller once Collate #8265 merges and can be removed after
it.
