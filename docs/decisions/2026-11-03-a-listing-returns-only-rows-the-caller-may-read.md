# A listing returns only rows the caller may read

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `ListRowAuthorizationIT.aTableListingLeavesOutRowsADenyRuleRefusesAndStillFillsThePage`,
  `ListRowAuthorizationIT.aTestSuiteListingLeavesOutTestCasesTheirItemEndpointRefuses`,
  `ListRowAuthorizationIT.aQueryListingOfATableLeavesOutQueriesTheirItemEndpointRefuses`,
  `ListCursorsTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
List endpoints authorized the listing once, against a context that names only the entity type, and
returned every row. A deny rule that reads the row (its tags, owners, domains, the owning team's
policies) never fired, so a row the item endpoint refused was readable through the list, and
`/history` returned versions of entities the caller could not view.

## Decision
- When a row-dependent rule could change the outcome (`RowDecisionGate`: some enabled policy has a
  deny rule for the type and operations, or the caller's own policies do not grant them without a
  condition), each row is checked as its item endpoint checks it (`EntityResource.rowAuthorization`).
  By default that is the entity itself with the operations its requested fields need, on a copy
  loaded with the authorization fields; a test case is checked for ViewTests on the entity it
  tests, once per tested entity on a page. The gate is asked about that resource and those
  operations. Otherwise rows are not checked.
- Cursor listings refill a page from the following pages, up to 5 reads or 1000 scanned rows, and
  then return short. Their cursors are sealed with the Fernet key, since one may point at a hidden
  row; a sealed cursor is accepted wherever a plain one is. Offset listings drop rows without
  refilling. `paging.total` still counts every row.
- In an `AuthRequest` listing (queries, test cases) a request on another entity, such as the table
  whose queries are listed or the test suite whose test cases are, allows the listing but not its
  rows: they are still checked as above. A logical test suite spans many tables, and a query's own
  rules decide its item endpoint.
- `/history` keeps the versions of entities the caller may view now; context memories and files
  also apply their own visibility (`retainReadableHistory`).

## Consequences
A listing never shows a row its item endpoint refuses. A caller who may ViewQueries on a table but
not view one of its queries no longer sees that query in the table's query listing, as
`GET /queries/{id}` refuses it. Listings under row-dependent rules cost one authorization load and
evaluation per page read; a test-case page costs one load of each entity it tests. Totals reveal
how many rows exist; making them exact needs the conditions in SQL, which is left for later.
Without a Fernet key cursors stay plain.
