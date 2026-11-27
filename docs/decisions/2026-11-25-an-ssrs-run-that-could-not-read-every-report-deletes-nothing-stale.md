# An SSRS run that could not read every report deletes nothing stale

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** ulixius9
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_ssrs.py` (`TestSsrsOutageProtection`), `ingestion/tests/integration/ssrs/test_outage_nodrop.py`
- **Related:** #38362, ADR:2026-10-30-an-empty-seen-set-deletes-the-scope-only-when-the-connector-confirms-its-listing, ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged

## Context
`deleteStale` soft-deletes whatever a non-empty seen-set leaves out of the service scope, and the
`SourceListing` confirmation only governs an empty seen-set. The topology runner swallows a
producer's or a stage processor's exception, so an SSRS outage mid-run used to end with a partial
seen-set and soft-delete every dashboard, chart or data model it had not reached. Both
`markDeletedDashboards` and `markDeletedDataModels` default to true.

## Decision
- A `/Reports` page that fails marks the dashboard and data model listings failed. That run
  deletes no stale dashboard, chart or data model.
- A report-definition fetch that fails (401/403, 5xx after retries, transport error) marks the
  data model listing failed and yields a failure. That run deletes no stale data model; stale
  dashboards and charts are still deleted, since the report listing confirmed them.
- A report definition that is not found (404), exceeds the size limit, or does not parse is a
  per-report skip, not a failure: that report's data models are deleted as stale.

## Consequences
An outage leaves stale entities in place until the next complete run, which deletes them. A
report whose definition keeps failing to fetch blocks stale data model deletion for the whole
service until it is fixed. A parser regression that rejects every definition deletes every SSRS
data model; treating a parse failure as a listing failure would prevent that, at the cost of one
permanently malformed report blocking all data model deletions.
