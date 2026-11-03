# A test case holds one open incident; incidents are scoped by their test case's deleted flag

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial); v2 2026-11-03 (one open incident per test case instead of per-incident listings; the deleted field is declared per entity)
- **Deciders:** Data Observability
- **Guard:** `IncidentTaskIntegrationIT.testIncidentTaskIsRefusedWhileTheTestCaseHasAnOpenIncident`, `IncidentTaskIntegrationIT.testFailureJoinsAnOpenIncidentThatHasNoTask`, `TestCaseSoftDeleteSearchIT`, `SearchListFilterTest.testResolutionStatusCondition_scopesByTestCaseDeleted`, `SoftDeleteScriptTest`
- **Related:** #34616, ADR:2026-10-29-incident-listing-test-case-deletion-scoping-is-qualified (the database listing's deletion scoping)

## Context
An incident is a `stateId` chain of `testCaseResolutionStatus` records. Every listing, count and
status write assumes a test case has at most one open incident: the latest listings keep one record
per test case, and a status write applies to the test case's latest incident. A task-first incident
broke that. A failing test reused only an open incident *task*, so an open incident started through
the status API (which has no task) got a second open chain beside it, and `POST /tasks` could start
one at any time. The incident groups then counted two incidents while the drill-down showed one.

The search listing (`/search/list`, the classic Incident Manager) ignored `include`: incident
documents have no `deleted` field, and soft-deleting a test case never touched its incidents'
documents, so incidents of soft-deleted test cases stayed listed.

## Decision
- A test case holds at most one open incident. Creating a `TestCaseResolution` task about a test
  case that has an open incident is refused, unless the task is that incident (the v200 migration
  adopts an open chain under its own `stateId`). A failing test joins the open incident, whether or
  not it has a task. Listings and writes keep resolving to the test case's latest incident.
- Each search index declares the field that marks its documents deleted, on its
  `EntityIndexCapability`: `deleted` for an entity, none for most time series, and for incidents
  `testCase.deleted`, the flag of the test case they embed
  (`TestCaseResolutionStatusRepository.getSearchDeletedField`). Two readers use it:
  - soft-delete propagation (`SearchRepository.softDeleteOrRestoredChildren`) sets that field on the
    children under the parent, one script per field. A cascade writes no search document per
    descendant test case, so this update is the only one. An incident document therefore carries
    every ancestor reference it is matched on (`table`, `database`, `databaseSchema`, `service`,
    `testSuite`, `testCase`), and the strict read strips each of them;
  - the `include` filter of a search listing (`SearchListFilter`): `non-deleted` excludes documents
    with the field `true` (a document without it counts as not deleted), `deleted` keeps only them,
    `all` adds nothing. The latest aggregation's scope filter carries the caller's `include`.

## Consequences
Clients that started a second incident through `POST /tasks` while one was open now get a 400 and
must update the open one. Incident documents written before this change carry the flag the test
case had when they were indexed; a reindex of `testCaseResolutionStatus` brings them in line, as it
does when a soft delete lands during a reindex or its search update fails. Data written before the
guard can still hold two open incidents of one test case; the listings show its latest.
