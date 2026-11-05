# A Tableau run that deletes stale data models stops, and deletes nothing, while the Metadata API backfills

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_tableau_backfill.py`, `ingestion/tests/integration/tableau/test_backfill.py`
- **Related:** [#16038](https://github.com/open-metadata/OpenMetadata/issues/16038)

## Context
Tableau rebuilds the store behind its Metadata API after the API is enabled and after upgrades,
for up to a week. Meanwhile every GraphQL response carries a `BACKFILL_RUNNING` warning next to
data that may be missing whole workbooks. The connector reads workbooks and views from the REST
API but data models only from the Metadata API, so a workbook the store had not reached yet still
looked live while its data models looked deleted. The run soft-deleted them under
`markDeletedDataModels`, and re-sent the dashboard without them, which drops its links on the
server. Raising where the warning is read would not help: the topology runner records a
producer's exception and then runs the `markDeleted*` steps anyway, against a listing cut short.

## Decision
- A Metadata API response whose `errors` carry the code `BACKFILL_RUNNING` marks the store
  incomplete for the rest of the run.
- When `includeDataModels` and `markDeletedDataModels` are both on, the source stops producing
  dashboards from the first one read after that point, skips all three `markDeleted*` steps, and
  raises `WorkflowFatalError` once the topology is done, so the run fails whatever
  `successThreshold` is.
- Otherwise the partial results are ingested as returned, the reconciliation still configured
  runs, and the run ends with a status warning. #16038 asks for the error only when deletion is on.

## Consequences
With default settings, a Tableau run ingests nothing and fails while a backfill lasts, with a
message to re-run after it or to turn off `markDeletedDataModels`. Turning it off keeps dashboards
and charts current during the backfill, but dashboards lose their links to the data models the
store has not reached until the next complete run. Tableau's per-query partial-result warnings
(`NODE_LIMIT_EXCEEDED`, `TIME_LIMIT_EXCEEDED`) and failed data source queries are not covered and
still turn into short listings. Unlike a backfill, they can recur on every run for one large
workbook, so failing the run would block that site for good; they need a guard of their own, such
as skipping data model reconciliation for that run.
