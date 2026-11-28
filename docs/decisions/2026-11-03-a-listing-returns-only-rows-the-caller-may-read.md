# A listing returns only rows the caller may read

- **Status:** Superseded by ADR:2026-11-13-a-listing-filters-its-rows-in-sql-compiled-from-the-callers-policies
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-04 (the team answer expires)
- **Deciders:** Mohit Yadav
- **Guard:** `ListRowAuthorizationIT.aTableListingLeavesOutRowsADenyRuleRefusesAndStillFillsThePage`,
  `ListRowAuthorizationIT.aTestSuiteListingLeavesOutTestCasesTheirItemEndpointRefuses`,
  `ListRowAuthorizationIT.aQueryListingOfATableLeavesOutQueriesTheirItemEndpointRefuses`,
  `ListCursorsTest`, `RowDecisionGateTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
A listing is authorized once for its type, while a rule can decide on what a row carries: its tags,
owners and domains, or its owning team's policies. So whenever such a rule could change the
outcome, each row is checked as its item endpoint checks it. `/history` lists versions across
entities and keeps only those the caller may view.

## Decision
- Rows are checked only when a rule could refuse one (`RowDecisionGate`): when a deny rule for the
  type and operations is among the caller's own policies or in a policy attached to a team, since
  an owning team brings its deny rules to callers outside it, or when the caller's own policies do
  not grant the operations without a condition. A policy attached to no team, such as the seeded
  `TeamOnlyPolicy`, reaches a caller only through their own roles, so it makes rows checked only
  for callers who hold it. Whether a team policy has such a rule is kept per policy generation and
  for as long as the compiled policies, so a policy change made on another server reaches this one
  within the same bound. A checked row is checked as its item endpoint checks it
  (`EntityResource.rowAuthorization`).
  By default that is the entity itself with the operations its requested fields need, on a copy
  loaded with the authorization fields; a test case is checked for ViewTests on the entity it
  tests, once per tested entity on a page. The gate is asked about that resource and those
  operations. Otherwise rows are not checked.
- Cursor listings refill a page from the following pages, up to 5 reads or 1000 scanned rows, and
  then return short. Their cursors are sealed with the Fernet key, since one may point at a hidden
  row; a sealed cursor is accepted wherever a plain one is. On a first page `before` stays null, as
  the repository returns it, so a client offers no previous page. Offset listings drop rows without
  refilling. `paging.total` still counts every row.
- In an `AuthRequest` listing (queries, test cases) a request on another entity, such as the table
  whose queries are listed or the test suite whose test cases are, allows the listing but not its
  rows: they are still checked as above. A logical test suite spans many tables, and a query's own
  rules decide its item endpoint.
- `/history` keeps the versions of entities the caller may view now; context memories and files
  also apply their own visibility (`retainReadableHistory`).

## Consequences
A listing never shows a row its item endpoint refuses. A caller who may ViewQueries on a table but
may not view one of its queries does not see that query in the table's query listing, as
`GET /queries/{id}` refuses it. Listings under row-dependent rules cost one authorization load and
evaluation per page read; a test-case page costs one load of each entity it tests. Totals count
every row; making them count only readable rows needs the conditions in SQL, which is left for
later. Without a Fernet key cursors stay plain.
