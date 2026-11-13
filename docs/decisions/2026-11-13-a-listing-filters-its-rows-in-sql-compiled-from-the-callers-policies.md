# A listing filters its rows in SQL compiled from the caller's policies, and checks rows one at a time only where SQL cannot decide them

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `RowFilterDifferentialIT`, `ListRowPolicyConditionsIT`, `ListRowAuthorizationIT`,
  `RowFilterCompilerTest`, `SqlRowFilterRendererTest`, `ListFilterAccessScopeTest`,
  `ListingConditionGuardTest`, `ListCountCacheTest`
- **Related:** `docs/plans/2026-11-09-list-access-scope-design.md`;
  supersedes ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read;
  ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads

## Context
ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read checks a listing's rows in the JVM,
page by page, whenever `RowDecisionGate` finds a rule that could refuse one. `paging.total` counts
every row. An offset listing drops rows without refilling, and a cursor page that spends its refill
budget comes back short. A listing is authorized against its type before any row is read, so a
conditional allow such as `ViewAll` with `isOwner()` answers 403 to the whole listing.

## Decision
- A type-level listing in `EntityResource`, by cursor or by offset, and its count ask the authorizer
  for a `CallerScope`. `DefaultAuthorizer.listScope` calls `ListAccess.forCaller`. It compiles the
  caller's policies (`SubjectCache.getPolicies`) and the deny rules of the teams that own rows
  (`TeamPolicySnapshot`) into a `RowFilter`, which is `AllRows`, `NoRows` or `Where(predicate)`.
  `RowFilterCompiler` combines rules as `PolicyEvaluator.hasPermission` does. `authorize` stays the
  source of truth. The SQL selects exactly the rows it allows or, where it cannot, a superset of
  them.
- `RowStorages` declares 26 types. For each, it names the table that stores the type and where its
  owners, domains and reviewers come from: the row's own relationships, an inherited parent, or
  none. For a type it does not declare, owner, domain and reviewer conditions become an `Approx`
  with a lower and an upper bound. So do tag conditions, the functions `ConditionTranslator` does
  not translate, and a team subtree larger than 1,000 teams or the Organization.
- An exact plan replaces the per-row check. The page fills to its limit, and `paging.total` counts
  only the rows the caller may read. An inexact plan renders the bound that selects a superset, and
  each row is checked after the query, with the refill budget and sealed cursors of the earlier
  record.
- A type-level listing whose compiled scope allows some row for each of the entry check's operations
  skips the entry check, because a check on the type alone cannot see the rows a condition allows.
  A `NoRows` plan and a listing through a parent, such as a service, keep the entry check and its
  error.
- A listing whose rows another entity authorizes keeps the per-row check. A test case is decided by
  ViewTests on the entity it tests. The earlier record's rules for `AuthRequest` listings and
  `/history` still hold.
- A count scoped to a caller is never read from or written to `ListCountCache`, because its key
  leaves the caller out.
- Every `ListFilter` subclass that overrides `getCondition` appends the scope. A DAO query of a
  declared type names the table its condition filters and never aliases it.
- A soft-deleted user or team reaches no row, as on the read path. Team membership counts only live
  users, and a deleted team brings no deny rules. An item read of a stored procedure or an API
  endpoint loads its parent with only the parent's live owners, as a table's read and every listing
  do.
- `TeamPolicySnapshot` keeps the snapshots of the last 4 policy generations, each for
  `SubjectCache.POLICIES_TTL` (2 minutes). A team or policy change made on another server is then
  seen within the bound the compiled policies already have. A snapshot keeps at most 256 team
  subtrees. The 1,000-team limit bounds the list of team ids the SQL renders.

## Consequences
- When its plan is exact, a listing under conditional rules costs one page query and one count
  query, with no authorization per row. It returns full pages and exact totals.
- For an exact plan, the SQL is the authorization. A wrong `RowStorages` entry or translation
  returns wrong rows with no check behind it. `RowFilterDifferentialIT` lists every declared type
  under owner, domain and team rules and compares each listing with the item reads, on MySQL and
  PostgreSQL. A type added to `RowStorages` needs fixtures there.
- A scoped count runs its correlated conditions on every page, uncached. Each team that holds a deny
  policy adds an owner subquery. Their cost was not measured.
- An `Authorizer` that does not override `listScope` checks every row of every page.
- Search-backed lists, `/history`, time-series lists, custom list endpoints, MCP tools and filters
  built outside `EntityResource` keep their current checks. A list filter can still be built
  without a scope. The later steps of `docs/plans/2026-11-09-list-access-scope-design.md` cover
  them.
- Revisit the 1,000-team limit, the 4 generations and the 256 subtrees if a tenant's team graph or
  policy churn outgrows them.
