# The flat incident listing's `include` parameter is deprecated and has no effect

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** TeddyCr
- **Guard:** `openmetadata-integration-tests/.../TestCaseResolutionStatusTimeSeriesListingIT#incidentListing_overRest_softDeletedTestCasesAreAlwaysExcluded`
- **Related:** the latest-without-a-time-range fix this decision emerged from (PR: fix/timeseries-latest-no-range)

## Context

`GET /v1/dataQuality/testCases/testCaseIncidentStatus` documents an `include` parameter. Its
`non-deleted`/`deleted` scoping never queried the `test_case_resolution_status_time_series`
table's own deletion state — the time-series table has no `deleted` column. The predicate only
ever worked by riding the `test_case` join (`addOriginEntityFQNJoin` added the join *because* an
include was set, and the unqualified `deleted = FALSE`/`= TRUE` clause then resolved to
`tc.deleted`). That implicit contract broke the moment a listing path was added that did not keep
the join and the include clause in the same statement — exactly what the latest-without-time-range
fix introduced — producing `WHERE deleted = FALSE` against a column the table does not have.

## Decision

The flat incident listing always scopes to **non-deleted test cases** via the join
(`addOriginEntityFQNJoin` now joins unconditionally and appends `tc.deleted = FALSE`), matching the
`incidentGroups` summary SQL, which already hardcodes `tc.deleted = FALSE`. The `include` query
parameter on this endpoint is deprecated: it stays in the OpenAPI (marked `deprecated`) but has no
effect; an explicit `include` gets an RFC 9745 `Deprecation` response header and a server-side
warning log. The search-based incident listing is unchanged and still honors `include`.

## Consequences

Default callers (the UI, the SDKs) see the same listing as before. Callers that used
`include=deleted` or `include=all` on this endpoint lose that scoping and must move to the
search-based listing. Future listing paths for the incident time-series cannot reintroduce a
deleted clause that dangles on a column the table lacks, because the join carries the scoping
wherever the conditions need it. Reintroducing per-request deleted scoping would require
re-deciding this record.