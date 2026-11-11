# The incident listings' test-case deletion scoping is always a qualified predicate

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** TeddyCr
- **Guard:** `openmetadata-integration-tests/.../TestCaseResolutionStatusTimeSeriesListingIT#incidentListing_overRest_softDeletedTestCasesAreAlwaysExcluded`
- **Related:** the latest-without-a-time-range fix this decision emerged from (PR: fix/timeseries-latest-no-range)

## Context

The flat incident listing's `include` parameter never queried the
`test_case_resolution_status_time_series` table's own deletion state — the time-series table has
no `deleted` column. The scoping worked only through implicit column resolution: `addOriginEntityFQNJoin`
added the `test_case` join *because* an include was set, and the unqualified `deleted = FALSE`/`= TRUE`
clause `getIncludeCondition` emitted then resolved to `tc.deleted`. That made the join load-bearing
for the scoping, the scoping load-bearing for nothing the conditions declared, and any new listing
shape that did not keep the join and the clause in the same statement produced `WHERE deleted = FALSE`
against a column the table does not have. The same coupling made the join's cost unconditional
(`ListFilter`'s include field is effectively never null), and dropping the include honoring broke
the legitimate flows that list incidents of soft-deleted test cases.

## Decision

The incident listing's `include` parameter stays honored (`non-deleted` default, `deleted`, `all`),
and every incident listing (the base `TestCaseResolutionStatusTimeSeriesDAO` listing and count
shapes through `incidentCondition`) carries its test-case deletion scoping as a **qualified**
predicate: `tc.deleted = FALSE`/`TRUE` riding the `test_case` join — added only where a predicate
needs it (when `originEntityFQN` is present) — or, when the join is not needed, the equivalent
indexed `EXISTS (… FROM test_case … deleted = FALSE/TRUE)`. `include=all` adds no clause and, when
no predicate needs it, no join either. No incident listing may emit an unqualified `deleted`
clause whose resolution depends on an implicit join.

## Consequences

Default callers see the same listing as before, and `include=deleted`/`all` keep working on the
flat endpoint. Listings pay the join only when the origin predicate references its alias. The
listing shapes are shared with the incident reindexing path (`PaginatedEntityTimeSeriesSource`),
whose filter is `include=all`: it no longer joins by default and, as before, does not scope by
deletion. The incident DAO's offset listing/count shapes cannot reintroduce the dangling-clause
failure, but the keyset/cursor readers (`listAfterKeyset`, `listBeforeKeyset`, `getCursorAtOffset`)
build `filter.getCondition()` without this shaping — none is wired to an incident listing today
(`PartitionWorker` routes time-series reindexing to the offset shapes); if one ever is wired, it
must route its condition through `incidentCondition` the same way.