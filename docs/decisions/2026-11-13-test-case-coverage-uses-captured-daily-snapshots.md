# Test case coverage uses captured daily snapshots

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** TestCaseSnapshotTest, TestCaseSnapshotStoreTest, DataInsightTestCaseCoverageIT, DataAssetTypeCoverageTest
- **Related:** [#33432](https://github.com/open-metadata/OpenMetadata/issues/33432), [#37699 review](https://github.com/open-metadata/OpenMetadata/pull/37699#discussion_r4561712399), ADR:2026-11-12-test-case-insights-use-the-last-update-timestamp

## Context

Definitions are state. Filtering their last edit timestamp counts edits rather than inventory:
old, unchanged tests disappear from recent coverage charts. Both detailed test charts and simple
per-table coverage need the same daily population.

## Decision

DataInsightsApp captures active test case definitions into `di-data-assets-testcase` once per
collection day, before it processes tables. The snapshot timestamp is the collection day, never
`updatedAt`. Table and column tests carry their parent `originEntityFQN`, service, suite and
test-definition references. Definitions are still excluded from total-data-assets metrics.

Snapshot templates map `fullyQualifiedName` as a normalized keyword across all entity types.
Consumers sort across the snapshot streams, so a type must not inherit a text mapping for this
field from its live search index. Existing experimental test-case streams with a text mapping
need rebuilding with their captured documents preserved; rollover alone leaves incompatible
historical backing indexes in the cross-stream search.

Table snapshots carry `testCaseCount` and `hasTestCases` (0 or 1). Counts come from the test case
snapshots for that table and day, matched by stable `originEntityId` so renames do not lose coverage. Lookups use batches of at most 128 tables, keeping aggregations
bounded below the search engine's bucket limit across the existing 30-day backfill window.

History starts with successful collection after deployment. Backfills preserve test case snapshots
and reconstruct table counters from that evidence; they never recreate old definitions from today's
catalog. The retained test case snapshots remain valid after a live definition is edited or deleted.
Days without evidence omit both counters. Coverage formulas must restrict their denominator to tables
with `hasTestCases` present; missing history is not zero coverage.

`di-test-case-snapshot-checkpoints` records successful collection per UTC day and service scope
(or all services). This index is outside the chart wildcard. A checkpoint is published only after
the test-case source completes and search refresh succeeds, including a successful empty scan.
Before replacing a day's snapshots, its checkpoint is invalidated; partial scans must not publish
zero counts. A service-scoped replacement also invalidates that day's global checkpoint. Global
replacement invalidates every checkpoint for the day. Checkpoints and snapshots share retention;
explicit snapshot recreation clears checkpoints as well.

Upgrade removes only the legacy `di-data-assets-testcase` alias before creating its replacement
data stream. It must never delete the alias target, which is the live test-case index. The live
`testCase` index and result/status event aliases remain available independently.

## Consequences

Detailed charts retain grouping by table, suite and definition; table-only charts can aggregate
coverage without combining different entity populations. Storage and capture work grow with the
number of tests and retained days. A rerun replaces that day's captured state. Days when collection
did not run, failed, or predates deployment remain unknown. This is daily captured state, not an
exact transactionally consistent catalog snapshot; definitions can change while a scan runs.
