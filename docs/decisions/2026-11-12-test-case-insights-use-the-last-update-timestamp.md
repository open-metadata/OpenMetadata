# Test case Insights use the last update timestamp on the live-index alias

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** TestCaseIndexTest, DataInsightTestCaseCoverageIT, DataAssetTypeCoverageTest, DataAssetChartScopeTest
- **Related:** [#33432](https://github.com/open-metadata/OpenMetadata/issues/33432), [#37459](https://github.com/open-metadata/OpenMetadata/pull/37459)

## Context

The custom chart field catalog advertises test cases through `di-data-assets-testcase`,
but ordinary previews query `di-data-assets-*` with an `@timestamp` range. Documents
without that field never match. Live charts query `testCase` directly and therefore
cannot verify that the ordinary preview works.

## Decision

Test case definitions reach Data Insights through the `di-data-assets-testcase` alias
on the live test case index. `DataAssetType` includes `testCase`, but DataInsightsApp
must neither ingest test cases nor create/delete a data stream for them. There is no
test case entry in `dataInsights/config.json`.

`TestCaseIndex` writes `@timestamp` from the test case's `updatedAt` (epoch milliseconds).
Every supported search-language mapping declares this field as a date. Ordinary
previews can count and group definitions whose **last update** is in the requested
window. Existing term-axis charts use the day ending at the requested end time;
this change preserves that query behavior. Explicit live charts (`searchIndex: testCase`, live mode) continue to count
current definitions without the date restriction.

Test cases are not data assets. Data-asset metrics exclude `testCase` in their filter;
entity-type breakdowns exclude both `testCase` and `testcase`, since the keyword mapping
normalizes bucket keys to lowercase. The alias must not change `total_data_assets`.

## Consequences

These are current documents grouped or filtered by last update, not daily snapshots
or an inventory as of a past date. Updating a definition moves its contribution to
the new date; an old unchanged definition is absent from a recent window. Use live
charts for all-current-test coverage. Historical coverage requires a separate design.

Existing installations must reindex test cases after upgrading, applying the new date
mapping and populating timestamps on existing documents. Merely attaching the alias
does not backfill documents. No database migration is required.
