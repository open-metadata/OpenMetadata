# Incidents are scoped by their test case's deleted flag

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial); v2 2026-11-03 (the deleted field is declared per entity); v3 2026-11-05 (the one-open-incident rule is left out, pending a check of the workflow-based incident code)
- **Deciders:** Data Observability
- **Guard:** `TestCaseSoftDeleteSearchIT`, `SearchListFilterTest.testResolutionStatusCondition_scopesByTestCaseDeleted`, `SoftDeleteScriptTest`, `EntityTimeSeriesSearchDeletedFieldTest`
- **Related:** #34616, ADR:2026-10-29-incident-listing-test-case-deletion-scoping-is-qualified (the database listing's deletion scoping)

## Context
The search listing (`/search/list`, the classic Incident Manager) ignored `include`: incident
documents have no `deleted` field, and soft-deleting a test case never touched its incidents'
documents, so incidents of soft-deleted test cases stayed listed.

## Decision
Each search index declares the field that marks its documents deleted, on its
`EntityIndexCapability`: `deleted` for an entity and for a time series whose schema has it, none for
the other time series, and for incidents `testCase.deleted`, the flag of the test case they embed
(`TestCaseResolutionStatusRepository.getSearchDeletedField`). Two readers use it:
- soft-delete propagation (`SearchRepository.softDeleteOrRestoredChildren`) sets that field on the
  children under the parent, one script per field. A cascade writes no search document per
  descendant test case, so this update is the only one. An incident document therefore carries
  every ancestor reference it is matched on (`table`, `database`, `databaseSchema`, `service`,
  `testSuite`, `testCase`), and the strict read strips each of them;
- the `include` filter of a search listing (`SearchListFilter`): `non-deleted` excludes documents
  with the field `true` (a document without it counts as not deleted), `deleted` keeps only them,
  `all` adds nothing. The latest aggregation's scope filter carries the caller's `include`.

A rule that a test case holds at most one open incident was considered here and left out: whether
the workflow-based incident code already enforces it has to be checked first.

## Consequences
Incident documents written before this change carry the flag the test case had when they were
indexed; a reindex of `testCaseResolutionStatus` brings them in line, as it does when a soft delete
lands during a reindex or its search update fails.
