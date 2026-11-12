# Test cases filter by test definition FQN through search/list, and only there

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `SearchListFilterTest#testTestDefinitionConditionMatchesLowercasedFqn`, `SearchListFilterTest#testBlankTestDefinitionIsIgnored`, `TestCaseResourceIT#test_searchListFiltersByTestDefinition`
- **Related:** #36720, ADR:2026-10-12-filtered-test-case-exports-match-through-search

## Context
The test definition details page lists the test cases that use one definition. The number of
such test cases grows with the catalog, so the browser cannot load every test case and filter
locally, and it cannot send a list of ids in a GET URL (the server caps the request line at
8 KiB). Neither the database list nor `search/list` could filter by test definition.

## Decision
`GET /v1/dataQuality/testCases/search/list?testDefinition=<fqn>` adds a `term` filter on
`testDefinition.fullyQualifiedName` in the test case index. That field is a keyword with a
lowercase normalizer, so the value is lowercased and the match is a case-insensitive exact match
on the FQN. A blank or whitespace-only value is ignored, as if the parameter were absent. The
details page pages through this filter server-side.

The filter is list-only. It is not part of `TestCaseExportQuery`, so `/name/{name}/export` and
`/exportAsync` do not accept it: the export grid is opened from the test case list, which never
sends this parameter, and ADR:2026-10-12-filtered-test-case-exports-match-through-search keeps its
own filter set.

## Consequences
Linked test cases are as fresh as the search index: a test case created moments ago may be missing
until it is indexed. If the export grid ever opens from the details page, add `testDefinition` to
`TestCaseExportQuery` and to the export record's filter list in the same PR.
