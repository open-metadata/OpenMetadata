# The table Queries tab follows view access on the Query resource, with conditionalAllow as access

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Rohit0301
- **Guard:** `TableDetailsPageV1.test.tsx` ("Queries tab count"), `playwright/e2e/Features/Permissions/TableQueriesTabPermissions.spec.ts`
- **Related:** #21289; ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads

## Context
The table page always rendered a Queries tab, gated only by the table's `ViewQueries`. A role
denying the `query` resource still saw the tab: its count request (`GET /queries?entityId=`) was
refused with 403 while the list, read from the search index, showed the denied queries. Hiding the
tab needs a resource-level check, and at resource level the backend answers `conditionalAllow` for
rules such as `isOwner()` or `hasDomain()` that it can only evaluate per query. The app-wide
`PERMISSION_POLICY.resourceLevelConditionalAllow` is `'strict'`, which would read those users as
denied and remove a tab whose list the backend already filters for them.

## Decision
- The Queries tab is hidden unless the caller's `ViewBasic` on the `query` resource is allowed,
  with an explicit `ViewBasic` value winning and `ViewAll` used only when `ViewBasic` is absent.
- For this check a resource-level `conditionalAllow` counts as allowed, through
  `PERMISSION_POLICY.tableQueriesTabConditionalAllow = 'attempt'`, independent of
  `resourceLevelConditionalAllow`. `deny`, `conditionalDeny` and `notAllow` hide the tab.
- The tab is marked `isHidden`, not omitted, so a persona layout that lists it does not fall back
  to rendering it with the Schema tab's content.
- The query count is requested only when both the Query view check and the table's `ViewQueries`
  pass. A denied table `ViewQueries` keeps the tab and its "View Queries" placeholder.
- The page shows its skeleton until the Query permission resolves, so a deep link to the tab never
  lands on another tab first.

## Consequences
- One extra `GET /permissions/query` per table page load, cached for `PERMISSION_STALE_TIME` under
  `permissionQueryKeys.tableQueriesTab`.
- Hiding the tab does not stop a client from reading queries through the search API; that needs
  "Enable Roles & Policies in Search" (ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads).
- Flipping `resourceLevelConditionalAllow` to `'attempt'` makes this exception redundant; remove
  it then rather than keeping two switches that agree.
