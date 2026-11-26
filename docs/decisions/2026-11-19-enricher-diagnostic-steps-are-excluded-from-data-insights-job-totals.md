# Enricher diagnostic steps are excluded from Data Insights job totals

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata backend maintainers
- **Guard:** `WorkflowStatsTest`, `DataInsightsAppTest`, `DataAssetsWorkflowStatsTest` (`openmetadata-service/src/test/java/org/openmetadata/service/apps/bundles/insights/`)
- **Related:** Issue #37310, PR #37947

## Context

`DataAssetsWorkflow.mergeEnricherStepStats` publishes one row per enrichment step into
`WorkflowStats.workflowStepStats`, so operators can see each step's health in
`AppRunRecord.stats.entityStats`. Every enrichment step processes the same snapshotted entities,
so summing those rows with the source rows counted each entity once per step (about 11 times), and
an isolated step failure, after which the snapshot is still emitted, was reported as a failed
entity. `AppLogsViewer` shows `entityStats` beside `jobStats`, so the rows on screen no longer add
up to the job total, and nothing in the code explains why.

## Decision

A step is diagnostic if and only if its key starts with `WorkflowStats.ENRICHER_STEP_PREFIX`
(`"[Enricher] "`), as `WorkflowStats.isDiagnosticStep` checks. Diagnostic rows stay in
`Stats.entityStats`. They never count toward `Stats.jobStats` or toward a workflow's
`totalRecords`, `successRecords` and `failedRecords`. A failure in a diagnostic step is therefore
never a job-level failure. Every job or workflow total goes through `WorkflowStats.sumTotalRecords`,
`sumSuccessRecords` and `sumFailedRecords`, which apply the rule, rather than summing the step map
directly.

## Consequences

The job totals count each entity once, and operators keep the per-step counters. A new step key
that starts with the prefix is silently dropped from the totals. A new diagnostic row without the
prefix is counted in them, so it has to use `ENRICHER_STEP_PREFIX`. Revisit if step stats gain a
typed diagnostic flag that can replace the key prefix.
