# Run durations are raw milliseconds, shown in compact units, and OSS merges before Collate

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial); v2 2026-11-06 (every run-duration display, not only agent runs)
- **Deciders:** Sweta Agarwalla
- **Guard:** `RunHistoryDrawer.test.tsx`, `agentsDataMapper.test.ts`, `DateTimeUtils.test.ts`, `QueryCard.test.tsx`; Collate `ModelsTable.test.tsx`, `PipelineStatistics.test.tsx`, `ServiceSummaryTab.utils.test.ts`; paired build and merge-order review
- **Related:** [#37052](https://github.com/open-metadata/OpenMetadata/issues/37052), [OpenMetadata #37055](https://github.com/open-metadata/OpenMetadata/pull/37055), [Collate #8265](https://github.com/open-metadata/openmetadata-collate/pull/8265)

## Context

`AgentRun.duration` held decimal minutes, and the run history drawer printed it with a localized
"min" suffix, so a nearly three-hour run read as `165.6 min`. `AgentRun` is shared with Collate: it
is handed to Collate's `RenderRunAction` plugin, and Collate tests build `AgentRun` fixtures.

Other run-duration displays had their own formatters with the same problem for long runs: pipeline
task executions (`2.76 hours`), application runs (`02:45:36`), query cards (`165 min 36 sec`), and in
Collate the dbt model and pipeline average run time (`166 min`, `166 minutes`) and the service
summary (`165m 36s`).

## Decision

`AgentRun.durationMs` is the run's `endDate − startDate` in milliseconds, or `0` when the run has
no end date.

Every run-duration display formats milliseconds with `convertMillisecondsToHumanReadableFormat(ms, 2)`,
which gives at most two units (`2h 45m`, `3m 48s`, `42s`). `formatRunDuration` wraps it for runs
that can finish in under a second and keeps their milliseconds (`210ms`). The query card keeps its
sub-minute `s.S sec` precision and rolls up from one minute. The bespoke `formatDuration` and
`formatDurationToHHMMSS` are removed.

The units are the compact, non-localized `Y`/`M`/`d`/`h`/`m`/`s` suffixes of that helper in every
locale, matching the time-left text on the agents page. `message.ran-for-duration` therefore carries
no unit of its own.

Merge OSS #37055 first, then Collate #8265, which renames its fixture field. Collate CI builds
against OpenMetadata `main`, so Collate's type check fails until both are in.

## Consequences

Consumers never convert units; a new duration display passes milliseconds to the same helper.
Localizing the units would mean changing the shared helper for every surface that uses it, not
adding a unit word back to a string. `label.duration-in-minute` has no caller once Collate #8265
merges and can be removed after it.
