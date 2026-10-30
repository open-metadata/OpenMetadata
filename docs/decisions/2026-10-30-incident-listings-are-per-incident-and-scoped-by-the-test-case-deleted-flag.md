# The database incident listing returns one record per incident; the search listing scopes on the embedded test case's deleted flag

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Data Observability
- **Guard:** `IncidentGroupsIT.testDrillDownListsEveryOpenIncidentOfATestCase`, `TestCaseSoftDeleteSearchIT`, `SearchListFilterTest.testResolutionStatusCondition_scopesByTestCaseDeleted`
- **Related:** #34616, PR #36594 (database incident listing deletion scoping)

## Context
An incident is a `stateId` chain of `testCaseResolutionStatus` records. A test case can hold more
than one open incident: a task-first incident (`syncFromTask`) starts its own chain without closing
an older one. The incident groups count incidents (`COUNT(DISTINCT stateId)`), but the flat
`latest=true` database listing kept one record per test case (`PARTITION BY entityFQNHash`), so a
group's drill-down, the drawer and the bulk actions missed the older incident.

The search listing (`/search/list`, the classic Incident Manager) ignored `include`: incident
documents have no `deleted` field, and soft-deleting a test case never touched its incidents'
documents, so incidents of soft-deleted test cases stayed listed.

## Decision
- The `latest` database listing (`GET /testCaseIncidentStatus`: the grouped view's drill-down,
  drawer and bulk actions, and the table's open-incident badge) returns the latest record of each
  `stateId`, not of each test case.
- The `latest` search listing (`/search/list`, the classic Incident Manager) stays one record per
  test case: it shows each test case's current incident, which
  `TestCaseResourceIT.test_incidentReopensAsNewAfterResolveAndNewFailure` relies on. A second open
  incident of the same test case therefore shows in the grouped view only.
- The search listing scopes `include` on the embedded `testCase.deleted`: `non-deleted` excludes
  `testCase.deleted: true` (a document without the flag counts as not deleted), `deleted` keeps only
  it, `all` adds nothing. The latest aggregation's scope filter carries the caller's `include`.
- A soft delete or restore of any parent whose child aliases include `testCaseResolutionStatus`
  (table, schema, database, service, test suite, test case) sets `testCase.deleted` on the incident
  documents under it, matched on the same parent field as the soft-delete cascade and sent the same
  synchronous way. A cascade writes no search document per descendant test case, so the top-level
  update is the only one.

## Consequences
Counts that read `paging.total` of a `latest` database listing now count incidents, so they can
rise where a test case had several incidents in range. Incident documents written before this change carry
the flag the test case had when they were indexed; a reindex of `testCaseResolutionStatus` brings
them in line. Reverting to per-test-case listings would need the groups to count per test case too.
