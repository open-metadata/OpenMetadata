# A listing filters its rows in SQL through an access scope that every list filter must carry

- **Status:** Proposed
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Pending maintainer review
- **Guard:** reviewer until step 4 of the plan lands. Then the `Filter<T>` constructor,
  `ListAccessArchitectureTest`, `DaoCondGuard`, `ConditionCoverageTest` and
  `RowFilterDifferentialIT`.
- **Related:** `docs/plans/2026-11-09-list-access-scope-design.md`;
  ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read;
  ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads;
  ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view;
  open-metadata/openmetadata-collate#8018

## Context
ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read makes a listing return only the rows
the caller may read. It checks rows in the JVM, page by page, whenever `RowDecisionGate` finds a
rule that could refuse one. That record leaves three things open. `paging.total` counts every row.
Offset listings drop rows without refilling. A cursor page that spends its refill budget comes back
short. Its consequences name what closes them, which is the conditions in SQL.

The rules that decide a row are written in five places: `RuleEvaluator` for `authorize`,
`RowDecisionGate`, the domain-only filter in `EntityUtil.addDomainQueryParam`, `DomainAccessFilter`,
and `RBACConditionEvaluator` for search. Whether a listing filters its rows depends on which
`EntityResource` helper its author called.

## Decision
- `ListAccess.forCaller` compiles the caller's policies into a `RowFilter`, which is `AllRows`,
  `NoRows` or `Where(predicate)`. It reads the same policies as `authorize`: `SubjectCache.getPolicies`
  and the deny rules of the teams that own rows. It combines rules as `PolicyEvaluator.hasPermission`
  does, and `authorize` stays the source of truth. A `NoRows` plan answers 403. That replaces the
  entry check against a context with no entity.
- `AccessScope` is a required constructor argument of `Filter<T>`, the base of `ListFilter` and
  `SearchListFilter`. Only `ListAccess` builds a caller scope. An internal read passes a
  `SystemScope` that names its `SystemReason`.
- `ListFilter.getCondition` and `SearchListFilter.getCondition` are final and append the scope's
  predicate. The page, `before`, offset, count and time-series queries of a listing share one
  WHERE. The history query takes the same predicate.
- A plan is exact when each of its conditions has a proven SQL translation for the listed type. An
  exact plan has no per-row check, and its `paging.total` counts only the rows the caller may read.
  A condition without a translation becomes an `Approx` with a lower and an upper bound. The
  renderer picks the bound that makes the SQL select a superset of the readable rows, and the
  per-row check runs on top with the refill budget and sealed cursors of the earlier record.
- Each inheriting repository declares an `InheritanceSpec`. The SQL renders inherited owners,
  domains, reviewers and tags from it.
- The earlier record's rules for test cases, `AuthRequest` listings and `/history` still hold. A
  test case is decided by ViewTests on the entity it tests. A request on another entity allows the
  listing but not its rows. `/history` keeps the versions of entities the caller may view now.
- Search compiles the same `RowFilter`, in place of `RBACConditionEvaluator`.
- Compiled plans are cached for `SubjectCache.POLICIES_TTL` (2 minutes), at most 10,000 entries,
  keyed on every input the compiler folds. The TTL keeps a plan no staler than the compiled
  policies it came from. The cap is a judgment that covers active users times listed types times
  operation sets on a large tenant. `TeamDenyIndex` keeps the last 4 policy generations, and parsed
  conditions keep at most 1,000 entries.

## Consequences
- A listing under conditional rules costs one query per page instead of page reads plus an
  authorization load per row. It returns full pages and exact totals.
- A list query cannot be written without a scope. ArchUnit keeps system scopes and DAO list calls
  out of resources and MCP tools.
- The cost is a codemod over 230 `new ListFilter(` sites in main code, 172 in tests and 17
  `new SearchListFilter(` sites, counted at `65d1a07dcdd`, and an `InheritanceSpec` for each
  inheriting repository.
- When this record is accepted, the earlier record's `Status` points here. When `RowDecisionGate`
  is deleted, ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view gets an
  amendment that names `CallerScope.visibleIds` instead.
- Revisit for a type that fails the p95 latency gate on MySQL or Postgres when no semi-join shape
  fixes it. That type stays on the per-row check.
