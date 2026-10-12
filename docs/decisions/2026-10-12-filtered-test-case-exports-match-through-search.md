# Filtered test case exports select their rows through search, not the database list filter

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `TestCaseExportFilterIT`
- **Related:** #26756

## Context
The DQ Bulk Edit grid is opened from the test case list, which is served by
`GET /v1/dataQuality/testCases/search/list`. Its export (`/name/{name}/export` and `/exportAsync`)
had to honour the same filters (`testCaseStatus`, `testCaseType`, `entityFQN`/`entityLink`, `tags`,
`tier`, `owner`) plus `limit`/`offset`. The database `ListFilter` supports similar parameter names
but not the same meaning: its owner condition sees only owners set on the test case itself, while
the search document carries the owners a test case inherits from its table. Exporting through
`ListFilter` would hand the grid rows that differ from the list the user filtered.

## Decision
When any filter or a page is given, `TestCaseRepository#exportToCsv(name, user, TestCaseExportArgs,
callback)` builds a `SearchListFilter`, scopes it to the export target (table: `entityFQN` +
`includeAllTests`; test suite: `testSuiteId`; `*`: none), and resolves matching ids with the same
`search_after` walk the filtered bundle-suite add uses (`resolveMatchingTestCaseIds`), sorted by
`fullyQualifiedName.keyword` so pages are stable. The rows are then read from the database in that
order and domain-filtered as before. With no filters and no page, the export keeps the original
database path unchanged.

Both endpoints take their parameters from one `@BeanParam` (`TestCaseExportQuery`) and validate
before a job is queued, so `export` and `exportAsync` cannot accept different inputs.

## Consequences
The export matches what the filtered list shows, including inherited owners. Membership is only as
fresh as the search index: a test case edited moments before export may match on its old values,
though the exported row content is read fresh from the database. Paging deep into a large result
walks ids from the start (ids only, 1000 per page). Revisit if the list endpoint stops being
search-backed, or if `ListFilter` gains inherited-owner semantics.
