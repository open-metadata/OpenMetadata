# Filter list rows in SQL through one compiled access scope

- **Status:** Partly implemented, in a different order from the
  [migration plan](#migration-plan).
  ADR:2026-11-13-a-listing-filters-its-rows-in-sql-compiled-from-the-callers-policies records what
  shipped: the compiler, the renderer and the `EntityResource` list paths for the 26 types
  `RowStorages` declares, enforced with no shadow step. The required scope on `Filter<T>`, the
  build-time guards, the custom endpoints and search are not implemented.
- **Date:** 2026-11-09
- **Baseline:** `65d1a07dcdd`. Line numbers in this doc are at that commit.
- **Decision record:** ADR:2026-11-13-a-listing-filters-its-rows-in-sql-compiled-from-the-callers-policies
- **Related:** #36952, #37072, open-metadata/openmetadata-collate#8018, and the records in
  [How this changes the existing records](#how-this-changes-the-existing-records)

In paths below, `S/` stands for `openmetadata-service/src/main/java/org/openmetadata/service/`.

## Summary

A list API returns only the rows that `authorize` lets the caller read.
ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read makes that the rule, and today the
server enforces it in the JVM, one page at a time. This design moves the decision into SQL.
`ListAccess` compiles the caller's roles and policies into one predicate before the query runs.
Every list filter must carry that predicate, and the composer that already builds the WHERE clause
of every list query appends it.

API users get full pages, and `paging.total` counts only the rows they may read. The engineer who
adds the next list endpoint gets a filter constructor that requires an access scope, so a list
query without an access decision does not compile. The per-row check stays only for plans that SQL
cannot decide exactly, and those plans are counted.

## What list APIs do today

A listing is authorized once for its type, at entry. `RowDecisionGate` then decides whether any
rule could refuse a row. If one could, `EntityResource` checks each row as its item endpoint would,
and refills a cursor page from the pages after it. That shape leaves eight gaps.

1. **`paging.total` counts every row.** The count runs without the row check. The listing record
   says so and leaves the fix for later.
2. **Pages come back short.** A cursor page refills from at most 5 reads or 1000 scanned rows, then
   returns what it has. Offset listings, search-backed lists and `/history` drop rows without
   refilling.
3. **A conditional allow fails at entry.** The entry check runs `authorize` against a context with
   no entity. A rule such as `ViewAll if isOwner()` cannot match without a row, so the listing
   answers 403 even to a caller who owns rows.
4. **The domain-only SQL filter reads only a row's own domain.** `EntityUtil.addDomainQueryParam`
   (`S/util/EntityUtil.java:1099`) matches neither sub-domains nor domains inherited from a parent.
5. **One team's deny rule turns on row checks for every caller.** An owning team brings its deny
   rules to callers outside it. The gate cannot tell which rows a team owns, so a deny rule for the
   type in any team policy makes every caller's listing of that type checked row by row.
6. **Search translates the conditions on its own.** `RBACConditionEvaluator` compiles policies
   into the search query with a separate translation.
7. **The rules that decide a row are written five times.** They live in `RuleEvaluator` for
   `authorize`, `RowDecisionGate`, the domain-only SQL filter, `DomainAccessFilter` and
   `RBACConditionEvaluator`. `DomainAccessFilter` is a domain-only post-filter for lineage, CSV
   import, the test case export and metrics.
8. **Nothing ties a list query to an access decision.** Whether a listing filters its rows depends
   on which `EntityResource` helper its author called, and list paths also exist outside
   `resources/`, in MCP tools.

## What an endpoint author writes

A list endpoint starts its filter from the caller. That call compiles the caller's policies and
answers 403 when no row can be visible.

```java
// TableResource.list: only the first line changes.
ListFilter filter = listFilter(securityContext, fieldsParam, include) // was: new ListFilter(include)
    .addQueryParam("database", databaseParam);
return listInternal(uriInfo, securityContext, filter, limitParam, before, after);
```

A listing whose rows another entity decides overrides one method. A test case is decided by
ViewTests on the table it tests, as `TestCaseResource.rowAuthorization` decides it today
(`S/resources/dqtests/TestCaseResource.java:158`).

```java
@Override
protected ListTarget listTarget(Fields fields) {
  return new ListTarget(TEST_CASE, new Via(new FqnAncestor(TABLE), TABLE), Set.of(VIEW_TESTS));
}
```

An internal read names the reason it sees every row.

```java
ListFilter all = ListFilter.forSystem(SystemReason.MIGRATION, Include.ALL);
```

A repository that inherits fields declares, once, where each one comes from.

```java
@Override
protected InheritanceSpec inheritance() {
  return InheritanceSpec.of(
      OWNERS, new FqnParent(DATABASE_SCHEMA),
      DOMAINS, new FqnParent(DATABASE_SCHEMA),
      TAGS, new FqnParent(DATABASE_SCHEMA));
}
```

Nothing else changes for callers. The page, `before`, offset, count, time-series and history
queries read the scope from the filter.

## How the design works

### The plan is a predicate tree built before the query

`RowFilter` is `AllRows`, `NoRows` or `Where(RowPredicate)`. `AllRows` renders as no condition, and
`NoRows` answers 403 at entry. `Where` holds a tree of `And`, `Or` and `Not` over row conditions.

Each leaf reads the row's effective value, with inheritance applied. The leaves are `OwnedBy`,
`NoOwner`, `OwnerTeamWithin`, `OwnerUnderTeams`, `InDomains`, `NoDomain`, `TaggedAny`,
`TaggedAll`, `CertifiedAs`, `ReviewedBy` and `InServices`. Two of them differ in a detail that
matters:

- `OwnerTeamWithin(teams)` matches a team owner in `teams`. It selects the rows an owning team's
  deny rules reach. A user owner never brings team deny rules (`SubjectContext.getPolicies`,
  `S/security/policyevaluator/SubjectContext.java:278-306`).
- `OwnerUnderTeams(teams)` matches a team owner in `teams`, or a user owner who is a member of one.
  That is the row half of `matchTeam()`, which counts both (`SubjectContext.isTeamAsset`, `:235`).

A condition without a proven SQL translation becomes `Approx(lower, upper, reason)`, where `lower`
implies the condition and the condition implies `upper`. The renderer counts the `Not` nodes above
each `Approx`. Under an even count it renders `upper`, and under an odd count it renders `lower`, so
the SQL always selects a superset of the readable rows. A plain unknown is `Approx(FALSE, TRUE)`.
Tighter bounds keep the common inexact plans cheap.

A plan is exact when no `Approx` remains. Exactness is derived from the tree and never stored, so a
plan cannot claim to be exact while it still carries an approximation.

Some values come from the row itself. A user owns itself
(`S/security/policyevaluator/ResourceContext.java:143`), and a domain is its own domain (`:407`).
`isBotUser()` and `isAdminUser()` read the row only when the row is a user
(`S/security/policyevaluator/RuleEvaluator.java:699`), so they fold to FALSE on every other type.

### One entry point builds the scope, and one composer renders it

**`ListAccess` is the only way to get a caller scope.** Its methods are `forCaller`, `adminOnly`
and `forSearch`. `forCaller` throws the 403 for a `NoRows` plan, which replaces the entry check
against a context with no entity. The requested operations come from `ViewOperations.forFields`,
the one mapping from requested fields to view operations
(ADR:2026-11-03-every-read-path-checks-the-fields-it-returns).

**`AccessScope` is a required constructor argument of `Filter<T>`.** `Filter<T>` is the base of
`ListFilter` and `SearchListFilter`. The scope is sealed as `CallerScope` or
`SystemScope(SystemReason)`. A filter without a scope does not compile, so no `EntityDAO` or
`EntityTimeSeriesDAO` list method can run without one. The scope is a value, not request state, so
it travels with the filter into async CSV exports and bulk jobs.

**`ListFilter.getCondition` and `SearchListFilter.getCondition` become final.** Each appends
`scope.sqlCondition(storage)` to the criteria. Six subclasses override `getCondition` today and
move their criteria to an `extraConditions` hook. They are `DaoListFilter`, `BoundedListFilter`,
`LearningResourceRepository.LearningResourceFilter` and the three private filters in
`OpenLineageEntityResolver`.

**Every list statement already builds its WHERE in this composer.** That covers keyset pages,
`before` cursors, offset pages, `getCursorAtOffset`, `count`, `listKeys` and the time-series
family. In `EntityDAO`, 18 statements take the composer's output as `<cond>`, and
`EntityTimeSeriesDAO` calls `filter.getCondition()` (`S/jdbi3/EntityTimeSeriesDAO.java:186-285`).
So the pages, cursors and totals of one listing agree by construction. The history query is the
exception. It is a `UNION ALL` over `entity_extension` and the entity table
(`S/jdbi3/CoreRelationshipDAOs.java:296-372`) and does not call the composer. It gains an access
fragment and its binds, which is the only DAO signature change in the design.

**The renderer is package-private.** It checks that it renders against the listed type's storage,
and fails closed on any other.

### The compiler follows `PolicyEvaluator.hasPermission`

```
if the caller is an admin:  AllRows
otherwise:
  ReviewedBy(caller)
  OR (     NOT Or(own deny rules that match any requested operation)
       AND NOT Or(over each team T the caller is not under:
                    OwnerTeamWithin(descendantsOrSelf(T)) AND denyCondition(T))
       AND And(over each requested operation op: Or(own allow rules that grant op)) )
```

- **Own rules** come from `SubjectCache.getPolicies(user)`, the same list `authorize` walks. It holds
  the user's direct roles, then the default roles and attached policies of each team up the
  ancestry. Organization stands in for a user with no team and for a team with no parent. Bots skip
  team policies and otherwise compile like any other caller.
- **Owning-team deny rules** come from `TeamDenyIndex`, built once per policy generation. One walk
  down `PARENT_OF` gives the descendants of each team whose policies hold a deny rule.
- **Rules match** through `CompiledRule.matchResource`
  (`S/security/policyevaluator/CompiledRule.java:273`) and `CompiledRule.operationMatches`
  (`:291`), not through copies. The first is protected and the second package-private, so both
  are widened.
- **The reviewer rule** mirrors `DefaultAuthorizer.authorizeSubject`
  (`S/security/DefaultAuthorizer.java:174`), which allows a reviewer of the row without evaluating
  policies. It matches a reviewer entry that is the caller's own user, not a team the caller
  belongs to (`isReviewer`, `:350`). It does not apply to the types in
  `EDIT_RIGHT_REQUIRED_RESOURCES` (`:337`), so the compiler leaves out the `ReviewedBy` branch for
  them.
- **Conditions** are parsed once through the SpEL AST into a tree that does not depend on the
  caller, then bound per caller. Caller-only facts fold to constants. A `false` literal folds to
  FALSE. ADR:2026-10-30-deleted-policy-condition-references-become-false writes that literal in
  place of a call whose entities were deleted.
- **Coverage.** `SqlCoverage` replaces each condition that has no proven translation for the listed
  type with `Approx(FALSE, TRUE)`.

### Inheritance is declared per repository and rendered from the declaration

Owners, domains, reviewers and tags are inherited at read time and are not stored on the row. The
SQL has to compute the same effective value as the read path.

Each inheriting repository declares an `InheritanceSpec` per field. The link kinds are:

- `FqnParent(parentType)`. The parent's FQN is the row's FQN minus its last segment, as from a
  table to its schema.
- `FqnAncestor(ancestorType)`. An ancestor at a fixed FQN depth, as from a test case to its table.
  Startup fails if the depth is not fixed.
- `SameTypeAncestors(beyond)`. Same-type ancestors at any depth, then `beyond` for the root, as from
  a glossary term to its parent terms and then its glossary. It renders as "the longest-prefix
  ancestor with a value", with no recursion.
- `RelationFrom(parentType, relation)`. Parents found through a relationship, as from a data
  product to its domains through `HAS`.
- `Self`. The row is its own value, as for a user's owner and a domain's domain.

`InheritanceChains.derive` builds the full chains at startup from these declarations. A test case
declares only its link to its table. The schema, database and service levels come from those
repositories' own specs. That lets step 1 delete `ListFilter.TEST_CASE_DOMAIN_ANCESTORS`, the chain
that is written by hand today.

The spec has three readers, and each keeps its own copy of this knowledge today:

- `getInheritableFields()`, which becomes final and is derived from the spec.
- `ResourceContext.getOwners`, which reads the owner union from the spec instead of its switch over
  glossary term, tag and data product (`ResourceContext.java:167-176`).
- The SQL renderer.

Parent resolution stays in code in each repository. `InheritanceSpecDeclaredTest` and the
differential IT catch a spec that drifts from that code.

The SQL takes the read path's shape for each field:

- **Owners and domains.** The nearest level that has a value wins.
- **Reviewers.** The union of all levels.
- **Tags.** Within a mutually exclusive classification the nearest level wins, and across
  classifications the levels are unioned. That matches `EntityRepository.mergeInheritedTags`
  (`S/jdbi3/EntityRepository.java:9933`). Inherited tags count only while tag propagation is on.
- **Sub-domains.** They match by `domain_entity.fqnHash` prefix. The caller's domains are resolved
  to hashes in SQL, by id, so moving a domain cannot leave a cached plan stale.

Tags on inline children are an `Approx`. Inline children are the child fields that
`getPolicyTagFields()` adds (`EntityRepository.java:10864`), such as a table's columns. The lower
bound is the row's own and inherited tags. The upper bound adds
`targetFQNHash LIKE <row fqnHash> || '.%'`. `tag_usage` records no target type, so that prefix also
matches separate entities nested under the row's FQN, such as the test cases under a table or the
child containers of a container. The upper bound is therefore never treated as exact.

The renderer never emits `NOT IN`, because `NOT IN` over a subquery that returns a NULL selects
nothing. It inlines ids as typed UUIDs and binds strings under `la_*` keys.

### Only inexact plans keep a per-row check

An exact plan reads once, with plain cursors and an exact total from the same WHERE. An inexact
plan selects a superset, and `ScopedPager`, inside `EntityRepository.listAfter` and `listBefore`,
runs the per-row check on top:

- A cursor page refills with today's budget of 5 reads or 1000 scanned rows, and seals its cursors
  with the Fernet key. Its total is the superset count.
- An offset page is filtered without refill.

Both cases increment `list_access_inexact{type, reason}`. The per-row check is `authorize` on
authorization copies of the rows, loaded with `ResourceContext.authorizationFields`. The scope
carries the check as `CallerScope.retainReadable`, so the repository never needs the authorizer.

Responses that are trees or reference lists use `CallerScope.visibleIds(candidates)`. For an exact
plan it runs `SELECT id FROM <table> WHERE id IN (...) AND <predicate>`. For an inexact plan it runs
the superset query, then `retainReadable`. `visibleIds` serves `/teams/hierarchy`,
`/domains/hierarchy` and the reference-list trimming of
ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view.

### Every cache is bounded and keyed on all of its inputs

- **Compiled plans.** Caffeine, `maximumSize(10_000)` and
  `expireAfterWrite(SubjectCache.POLICIES_TTL)`, which is 2 minutes
  (`S/security/policyevaluator/SubjectCache.java:107`). The key holds the user,
  `SubjectCache.policyGeneration()`, the service-attribute generation, a subject fingerprint and the
  target. The fingerprint hashes the sorted role names, the direct and visited teams, the domain
  ids, the admin and bot flags and the impersonator. `SubjectCache.invalidateUser` (`:197`) does not
  bump the policy generation, so a key without the fingerprint would keep a plan after the user's
  roles, teams or domains change.
- **`TeamDenyIndex`.** `maximumSize(4)`, one entry per policy generation.
- **Parsed conditions.** `maximumSize(1000)`. Rendered SQL is not cached.
- **`ListCountCache`.** `hashFilter` (`S/cache/ListCountCache.java:226`) hashes only `include` and
  `queryParams`, and it runs before `getCondition` builds the WHERE. The key gains the scope's
  fingerprint, which is a hash of the canonical predicate. Callers with identical plans share a
  cached total, and callers with different plans never do. A write to a type also invalidates the
  cached counts of the types that inherit from it, so changing a schema's owner refreshes table
  totals.

### Guards make a skipped scope fail the build

The guards, strongest first:

1. **The compiler.** No filter exists without a scope, and the composers are final.
2. **`ListAccessArchitectureTest`.** Flat ArchUnit rules, modeled on
   `VersionHistoryArchitectureTest`:
   - Resources and MCP tools never construct a `SystemScope`.
   - Resources and MCP tools never call a DAO method that returns a list.
   - Every repository method they call that returns rows takes a scoped `Filter` or a
     `CallerScope`.
   - An exemption is an `@UnfilteredList(reason)` annotation on the handler, not an entry in a
     central list.
   - Retired names stay deleted.
3. **`DaoCondGuard`.** An extension of `DaoStatementGuardTest`. Every `EntityDAO` or
   `EntityTimeSeriesDAO` `@SqlQuery` named `list*` or `count*` that reads the entity table must
   contain `<cond>`.
4. **Unit tests.** `ConditionCoverageTest` fails until each `RuleEvaluator` `@Function` is
   translated or marked as deliberately unknown. `InheritanceSpecDeclaredTest` fails when a
   repository overrides an inheritance hook, or calls `inheritOwners`, `inheritDomains`,
   `inheritReviewers` or `inheritTags`, without declaring that field.
5. **`RowFilterDifferentialIT` on MySQL and Postgres.** For each covered pair of type and
   condition, the ids across all pages and cursors, and the total, must equal the ids that
   `GET /{id}` allows. It also sets each inherited field at each ancestor level in turn and compares
   the effective value in SQL with what `GET` returns.
6. **A strict request ledger in ITs.** System scopes carry narrow reasons: `WRITE_CASCADE` for the
   repository write templates and `PostCommitActionQueue`, `POLICY_SCAN` for the `TeamDenyIndex`
   and `SubjectCache` loads, and `EXISTENCE_CHECK`. On a request thread, any other system scope
   fails the request in ITs and is counted in production. A caller scope that is compiled and never
   rendered fails the same way.

What fails when a developer forgets a step:

- A new list endpoint that writes `new ListFilter(include)` does not compile. One that skips
  `listFilter` fails ArchUnit.
- A new entity type lists correctly but inexactly until it declares a spec and gets a coverage
  entry with a differential fixture. A coverage entry without a fixture fails the IT.
- A new `@Function` fails `ConditionCoverageTest` until someone decides whether it is translated.

### Search compiles the same plan

`SearchRowFilterEmitter` turns the same `RowFilter` into an `OMQueryBuilder` and replaces
`RBACConditionEvaluator`. `enableAccessControl` stays the switch.

- Search-backed lists render the upper bound, and the per-row check runs on top.
- `/search/query` and `/aggregate` render the lower bound, because no per-row check can run over
  hits and aggregations. They never return a row the caller may not read. A readable row can be
  missing, and each plan that can miss rows is counted.
- `SearchFieldCatalog.supports(condition, entityType)` records which effective values each index
  carries, such as the `policyTags` of table and column documents
  (ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads). A condition with no
  indexed field renders as an `Approx`. A test compares the catalog with the index mappings.

### Custom endpoints move onto the same scope

- **Test cases** use `Via(FqnAncestor(TABLE))` with ViewTests, as shown above.
- **Test case results and incidents** authorize with `AuthorizationLogic.ANY` over ViewAll on the
  test case and ViewTests on its table (`TestCaseResultResource`,
  `TestCaseResolutionStatusResource`). Their plan is the `Or` of the two subjects' plans, so
  `ListTarget` needs an any-of form for them.
- **Tasks and activity** use the `Polymorphic` subject. Their plan is always inexact, and the
  per-row check decides each row on the entity it is about, as `TaskAboutVisibility` does today.
- **`/teams/hierarchy`** uses `visibleIds` in place of `ViewPermissionFilter.viewableIds`.
- **`/domains/hierarchy`** uses the same scoped id query in place of
  `EntityUtil.applyDomainSelfRestriction`, because a domain is its own domain in the plan.
- **Glossary term search** goes through `searchInternal`.
- **`/history`** uses the scoped history query, decided on the current row as the listing record
  decides it today. Context memories and files keep their own visibility on top
  (`retainReadableHistory`).
- **`AuthRequest` listings**, such as the queries of a table, keep their entry check on the other
  entity. The plan then filters their rows.
- **CSV exports** keep `EntityRepository.retainViewableForExport` for now, per
  ADR:2026-11-03-a-csv-export-writes-only-rows-its-exporter-may-view. A descending export drops the
  children of a hidden container, and no single-type predicate expresses that.

## Type sketch

These are the core types, with bodies left out. `InheritanceChains`, `ScopedPager`,
`SqlRowFilterRenderer`, `TeamDenyIndex`, `SqlCoverage` and `ListAccessLedger` follow from them.

```java
package org.openmetadata.service.security.listaccess;

public sealed interface RowFilter permits RowFilter.AllRows, RowFilter.NoRows, RowFilter.Where {
  record AllRows() implements RowFilter {}

  record NoRows() implements RowFilter {}

  record Where(RowPredicate predicate) implements RowFilter {}

  /** TRUE becomes AllRows and FALSE becomes NoRows, so a Where never holds a constant. */
  static RowFilter of(RowPredicate predicate) { ... }

  /** No Approx node remains. Derived from the tree, never stored. */
  default boolean exact() { ... }

  sealed interface RowPredicate {
    record And(List<RowPredicate> all) implements RowPredicate {}
    record Or(List<RowPredicate> any) implements RowPredicate {}
    record Not(RowPredicate negated) implements RowPredicate {}
    /** Exists only while compiling. RowFilter.of folds it away. */
    record Const(boolean value) implements RowPredicate {}
    record Approx(RowPredicate lower, RowPredicate upper, ApproxReason reason)
        implements RowPredicate {}

    /** A row condition over the effective value, with inheritance applied. */
    sealed interface Cond extends RowPredicate {}
    record OwnedBy(Set<UUID> owners) implements Cond {}
    record NoOwner() implements Cond {}
    record OwnerTeamWithin(Set<UUID> teams) implements Cond {}
    record OwnerUnderTeams(Set<UUID> teams) implements Cond {}
    record InDomains(Set<UUID> domains) implements Cond {}
    record NoDomain() implements Cond {}
    record TaggedAny(Set<String> tagFqns) implements Cond {}
    record TaggedAll(Set<String> tagFqns) implements Cond {}
    record CertifiedAs(Set<String> tagFqns) implements Cond {}
    record ReviewedBy(Set<UUID> reviewers) implements Cond {}
    record InServices(Set<UUID> services) implements Cond {}
  }

  enum ApproxReason {
    UNTRANSLATED_FUNCTION,
    TYPE_NOT_COVERED,
    INLINE_CHILD_TAGS,
    TEAM_SET_TOO_LARGE,
    POLYMORPHIC_SUBJECT
  }
}

public sealed interface AccessScope permits AccessScope.CallerScope, AccessScope.SystemScope {
  /** Fails closed when {@code storage} is not the listed type's storage. */
  SqlFragment sqlCondition(RowStorage storage);

  /** A hash of the canonical predicate, for ListCountCache.hashFilter. */
  String fingerprint();

  enum SystemReason {
    MIGRATION,
    REINDEX,
    APP,
    WORKFLOW,
    INDEXING,
    WRITE_CASCADE,
    POLICY_SCAN,
    EXISTENCE_CHECK,
    TEST
  }

  record SystemScope(SystemReason reason) implements AccessScope { ... }

  /** Built only by ListAccess, after it refuses a NoRows plan with 403. */
  final class CallerScope implements AccessScope {
    public ListTarget target() { ... }
    public boolean needsResidualCheck() { ... }
    public <E extends EntityInterface> List<E> retainReadable(List<E> rows) { ... }
    public Set<UUID> visibleIds(Collection<UUID> candidates) { ... }
    public RowFilter rowFilterForSearch() { ... }
  }

  record RowStorage(String listedType, String table, String idColumn, String hashColumn) {}

  record SqlFragment(String sql, Map<String, Object> binds) {}
}

public final class ListAccess {
  /** Throws AuthorizationException (403) when the plan is NoRows. */
  public CallerScope forCaller(SecurityContext securityContext, ListTarget target, Fields fields) { ... }

  /** Checks admin, then returns an AllRows caller scope. */
  public CallerScope adminOnly(SecurityContext securityContext, String listedType) { ... }

  /** One caller scope per entity type a search request can return. */
  public SearchAccess forSearch(SecurityContext securityContext, Collection<String> entityTypes) { ... }
}

/** Rows of listedType, each decided as operations on the row's subject. */
public record ListTarget(String listedType, RowSubject subject, Set<MetadataOperation> operations) {
  /** The row itself, with the operations ViewOperations.forFields gives. */
  public static ListTarget of(String entityType, Fields fields) { ... }

  public sealed interface RowSubject {
    record Self() implements RowSubject {}
    record Via(ParentLink link, String subjectType) implements RowSubject {}
    record Polymorphic() implements RowSubject {}
  }
}
```

```java
package org.openmetadata.service.jdbi3;

public abstract class Filter<T extends Filter<T>> {
  /** The only constructor. A null scope throws. */
  protected Filter(AccessScope scope, Include include) { ... }

  public final AccessScope scope() { ... }
}

public class ListFilter extends Filter<ListFilter> {
  public ListFilter(AccessScope scope, Include include) { ... }

  public static ListFilter forSystem(SystemReason reason, Include include) { ... }

  /** The criteria, then the scope's predicate. */
  public final String getCondition(String tableName) { ... }

  /** Where subclasses add criteria now that getCondition is final. */
  protected List<String> extraConditions(String tableName) { ... }
}

/** Declared by EntityRepository.inheritance(). Lists the read-path-only fields too. */
public record InheritanceSpec(
    Map<InheritedField, ParentLink> fields, Optional<ParentLink> ownerUnion) {

  public sealed interface ParentLink {
    record FqnParent(String parentType) implements ParentLink {}
    record FqnAncestor(String ancestorType) implements ParentLink {}
    record SameTypeAncestors(ParentLink beyond) implements ParentLink {}
    record RelationFrom(String parentType, Relationship relation) implements ParentLink {}
    record Self() implements ParentLink {}
  }
}
```

## Code facts any implementation must handle

Each one was checked in the code at the baseline.

1. **The count cache key leaves out the row filter.** `ListCountCache.hashFilter` hashes only
   `include` and `queryParams` (`S/cache/ListCountCache.java:226`), and `getOrCompute` hashes before
   `getCondition` runs (`:90-101`). With Redis on and no fingerprint in the key, one caller's total
   would be served to another. The TTL is 60 seconds (`S/cache/CacheConfig.java:54`).
2. **The plan key needs the caller's own context.** `SubjectCache` keeps a user's context for 15
   minutes (`S/security/policyevaluator/SubjectCache.java:108`), and `invalidateUser` does not bump
   `policyGeneration` (`:197`). A key of user, type, operations and generation keeps a stale plan
   after the user's teams or domains change.
3. **Tags inherit on almost every type.** The default `EntityRepository.applyInheritance`
   (`S/jdbi3/EntityRepository.java:1392`) inherits domains and tags. `mergeInheritedTags` (`:9933`)
   drops an inherited tag when the row has its own tag in the same mutually exclusive
   classification. A rendering that unions every level and marks the plan inexact is wrong under a
   `Not`. Take the common deny rule with `matchAnyTag('PII.Sensitive')`. The union is a superset of
   the row's real tags, so its negation selects fewer rows than the caller may read, and the
   per-row check cannot add rows back.
4. **A prefix match on inline-children tags reaches separate entities.** `getPolicyTagFields()` is
   overridden for tables, topics, containers, pipelines, ML models, dashboard data models, search
   indexes, API endpoints and worksheets (`hasNestedPolicyTags`, `EntityRepository.java:10869`).
   `tag_usage` has no target type, so `targetFQNHash LIKE <row fqnHash> || '.%'` also matches the
   test cases under a table and the child containers of a container. In an allow rule, that
   selects rows the caller may not read.
5. **`matchTeam()` counts user owners.** `SubjectContext.isTeamAsset`
   (`S/security/policyevaluator/SubjectContext.java:235`) is true for a team owner in the caller's
   team subtree and for a user owner who belongs to it. The seeded `TeamOnlyPolicy` denies
   `!matchTeam()`, so a rendering that checks only team owners hides the rows that members own.
6. **Owning-team deny rules come from team owners only.** `SubjectContext.getPolicies(owners)` adds
   `denyRulesOnly` for each owner whose type is team (`:301`). A user owner adds nothing. The owners
   it walks are the effective owners, inherited ones included.
7. **Deny and allow rules combine differently** (`S/security/policyevaluator/CompiledRule.java:161-217`).
   A deny rule fires when its resource matches, any requested operation matches it, and its
   condition holds. An allow rule removes each operation it matches whose condition holds. A row is
   visible when no deny rule fires and every requested operation is allowed, possibly by different
   rules.
8. **Some rows are their own value.** A user owns itself and a domain is its own domain
   (`ResourceContext.java:143`, `:407`). `isBotUser()` and `isAdminUser()` are false for every row
   that is not a user (`RuleEvaluator.java:699`).
9. **The reviewer rule has limits.** It matches the caller's user id, not the caller's teams, and it
   does not apply to the types in `EDIT_RIGHT_REQUIRED_RESOURCES`
   (`S/security/DefaultAuthorizer.java:337-367`). Three of the four drafts applied it to those
   types.
10. **Request state reaches worker threads only when copied by hand.** `EntityRepository` copies
    `ImpersonationContext` into its bulk futures (`S/jdbi3/EntityRepository.java:15141-15159`). A
    scope kept in a `ThreadLocal` would need the same copy at every `AsyncService` job. A worker
    that defaults to a system scope would write async CSV exports without the exporter's row
    filter, against ADR:2026-11-03-a-csv-export-writes-only-rows-its-exporter-may-view.
11. **An approximation must follow polarity.** Under an even number of `Not` nodes a leaf may only
    over-approximate, and under an odd number it may only under-approximate. Every approximate leaf
    needs both bounds and makes the plan inexact.
12. **`DomainAccessFilter` exists because `hasDomain()` is true without an entity.** Its callers are
    `LineageDomainFilter`, `BulkImportVersioning`, `TestCaseRepository` (the test case export) and
    `MetricRepository`. They move to the compiled plan before that branch of `hasDomain()` can go.
13. **The owner union has its own parents.** `ResourceContext.getOwners` unions a glossary term's
    owners with its glossary's, not its parent term's. It unions a tag's owners with its
    classification's, and a data product's with its domains' (`ResourceContext.java:167-176`).

## Alternatives considered

Four independent drafts were scored against one rubric. Its criteria were one place for the rule,
coverage that cannot be skipped, fidelity to `authorize`, pagination and performance, incremental
delivery, and resistance to a change that looks right in one file and is wrong for the repository.
All four put the predicate in `ListFilter.getCondition`. They differed in how the scope reaches the
filter. The chosen design is the one where the compiler enforces it.

- **A listing service that owns the whole operation.** Every endpoint calls one service, and an
  unscoped filter throws at run time. It hides more orchestration behind one call, but a run-time
  throw plus a bytecode scan is weaker than a compile error. Its translation also applied the
  caller's bot flag to `isBotUser()` on every type, unioned owners along a glossary term's whole
  chain, and treated inherited tags as exact.
- **A request-scoped scope that the data layer reads.** Endpoints need no change. But each thread
  hop needs the scope copied by hand, and a worker thread that defaults to the system scope breaks
  async CSV exports (code fact 10). Its tag rendering also ignored polarity (code fact 3).
- **A plan, bind and finish facade.** Each caller has to run three stages in order. It also treated
  history as a single-row plan, and it found a test case's parents over `CONTAINS`, which test
  cases do not inherit through.
- **A required scope argument on every DAO and repository list method.** It is as compile-safe as
  the chosen design. But about 15 DAO signatures widen, and the criteria and the scope travel
  separately.
- **A materialized visibility table, with one row per principal and entity.** Every change to an
  owner, a domain, a tag, a team or a policy fans out to every principal.
- **Recursive CTEs over `CONTAINS`.** MySQL restricts correlation inside them, keyset pages with
  deferred joins slow down, and test cases do not inherit through `CONTAINS`.

The chosen design takes `@UnfilteredList`, per-type `OFF`, `SHADOW` and `ENFORCE` modes, and
`visibleIds` from the listing service. From the request-scoped draft it takes the named system
reasons, `DaoCondGuard`, the per-field inheritance check and the count fingerprint built from the
predicate. `SearchFieldCatalog` comes from the facade.

## Trade-offs accepted

- **A large mechanical diff buys a compile-time guarantee.** A codemod rewrites the construction
  sites, and the compiler finds any it misses. At the baseline there are 229 `new ListFilter(`
  sites in `openmetadata-service` main code, 1 in `openmetadata-mcp`, 172 in tests, and 17
  `new SearchListFilter(` sites in main code. The codemod writes a TSV report of every site it
  marks as a system read. To recount:

  ```sh
  grep -rn --include='*.java' 'new ListFilter(' openmetadata-service/src/main | wc -l
  grep -rn --include='*.java' 'new ListFilter(' openmetadata-mcp/src/main | wc -l
  grep -rn --include='*.java' 'new ListFilter(' openmetadata-service/src/test \
    openmetadata-integration-tests/src openmetadata-mcp/src/test | wc -l
  grep -rn --include='*.java' 'new SearchListFilter(' openmetadata-service/src/main \
    openmetadata-mcp/src/main | wc -l
  ```

- **Parent links are stated twice.** `InheritanceSpec` restates links that each repository also
  resolves in code. The differential IT catches drift.
- **Each system scope is a judgment at its site.** The codemod report and the request ledger make
  every one visible.
- **The hard cases stay inexact.** Tasks, activity and inline-children tag conditions stay correct,
  run slower, and are counted.
- **An inexact plan reports the superset as its total.** That is today's behavior, and it keeps
  offsets aligned.

## Migration plan

Each step ends in a state a reviewer can check.

1. **Derive the chains.** Add the `InheritanceSpec` declarations and `InheritanceChains`. Derive
   `getInheritableFields()` and the owner union from them. Rewrite the test case domain filter on
   the derived chain, and delete `ListFilter.TEST_CASE_DOMAIN_ANCESTORS`. *Check:* the existing
   test case domain ITs and `InheritTagsTest` stay green.
2. **Add the plan types and the compiler.** Add `RowFilter`, the compiler, the condition translator
   and `TeamDenyIndex`, with `SqlCoverage` empty. *Check:* unit tests assert literal trees for the
   seeded `TeamOnlyPolicy` and `DomainAccessPolicy` and for an owning-team deny, and
   `ConditionCoverageTest` passes.
3. **Add the renderer and the differential IT.** Grow coverage for table, schema, database,
   service, glossary term and test case. *Check:* `RowFilterDifferentialIT` is green on MySQL and
   Postgres.
4. **Put the scope on the filter.** Run the codemod, make the composers final, and add the ArchUnit
   rules and the count fingerprint. Every type starts in `SHADOW` and renders nothing. *Check:* no
   behavior changes, and the full IT suite stays green, including `ListRowAuthorizationIT` and
   `ListCursorsTest`.
5. **Run in shadow.** `ShadowSampler` compares the SQL with the post-filter on sampled pages, and
   the strict ledger runs in ITs. *Check:* no row is over- or under-included for any type across an
   agreed window.
6. **Enforce per type.** Turn on enforcement one type at a time through config. *Check:* the
   differential IT, plus p95 list and count latency against the shadow baseline on both databases.
7. **Move the custom endpoints.** Move tasks, glossary term search, the hierarchies, history, test
   case results and incidents, and the `DomainAccessFilter` callers. *Check:* each endpoint's IT,
   run as a restricted user.
8. **Delete the old paths.** Delete `RowDecisionGate`, the domain-only branch of
   `addDomainQueryParam`, `ListFilter.domainAccessCondition`, and the no-entity branch of
   `hasDomain()` after an audit of type-only `authorize` callers. Delete `DomainAccessFilter`, the
   `readableRowsPage`, `readableListPage` and `retainReadableRows` helpers,
   `EntityResource.RowAuthorization` and the `SHADOW` state. Delete `TaskAboutVisibility` once its
   check lives in the polymorphic per-row check. Amend
   ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view in the same change.
   *Check:* a search for each name finds nothing, and the retired-names ArchUnit rule passes.
9. **Move search.** Add the emitter, run it in shadow, enforce it, then delete
   `RBACConditionEvaluator`. *Check:* `SearchAccessRulesIT` and the search ITs pass as restricted
   users, with `enableAccessControl` on and off.

Start with step 1. It changes no behavior, and the existing ITs show that it does not.

## How this changes the existing records

- **ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read.** Its rule stays, and
  ADR:2026-11-13-a-listing-filters-its-rows-in-sql-compiled-from-the-callers-policies supersedes
  it. For an exact plan, no row is checked in the JVM, offset pages are full, and `paging.total`
  counts only readable rows. Inexact plans keep its refill budget and sealed cursors. Its rules for
  test cases, `AuthRequest` listings and `/history` carry over.
- **ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view.** Its decision names
  `RowDecisionGate`. Step 8 amends it to name `CallerScope.visibleIds`.
- **ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads.** Its rule stays. Step 9
  replaces `RBACConditionEvaluator`, and `SearchFieldCatalog` checks that each index carries the
  fields its conditions read.
- **ADR:2026-11-03-read-handlers-authorize-like-the-entity-reads-they-mirror.** Its type checks
  become the `NoRows` refusal. A conditional allow then lists the rows it matches instead of
  refusing the endpoint.
- **ADR:2026-11-03-every-read-path-checks-the-fields-it-returns.** No change. `ListTarget` takes its
  operations from `ViewOperations.forFields`, and the per-row check loads
  `ResourceContext.authorizationFields`.
- **ADR:2026-10-30-deleted-policy-condition-references-become-false.** No change. The compiler
  folds the `false` literal to FALSE.
- **ADR:2026-11-03-a-csv-export-writes-only-rows-its-exporter-may-view.** No change for now.
  Exports keep their per-row filter.

## Open questions

- **Can pages stay fast when visibility is sparse?** This is a judgment from reading the code, not a
  measurement. When a caller can read 0.1% of a type, a keyset page scans in `(name, id)` order
  until it finds `limit` readable rows. Today's post-filter pays the same cost and shows it as short
  pages. The renderer must emit semi-join shapes that let the optimizer start from the small side,
  the domain or owner edges. The p95 gate in step 6 measures this on both databases.
- **What does `count(*)` cost with `EXISTS` chains on the largest catalogs without Redis?** If it is
  too slow, is a total of "at least N" acceptable to the product?
- **Should a system scope used inside a request fail in production, not only in ITs?** That would
  force every repository helper whose rows reach a response to take a caller scope.
- **Should test case results and incidents be decided per row?** Today a listing that names a test
  case or an entity authorizes on it. A listing that names neither authorizes on a context with no
  entity (`TestCaseResolutionStatusResource.getTestCaseResourceContext` and
  `buildEntityResourceContext`). Deciding each row by its test case and table narrows such a
  listing.
- **Do search documents carry effective owners, domains and tags for every type?** Table and column
  documents carry `policyTags`, and pipeline run documents carry their pipeline's access fields.
  For other types, a leaf with no indexed field renders as an `Approx` until a reindex adds the
  field.
- **Should glossary terms, tags and data products show the owners they authorize against?** The read
  path shows the nearest level's owners. `ResourceContext.getOwners` authorizes against the union
  with the glossary, the classification or the domains. The SQL follows `authorize`, so this design
  does not depend on the answer.
- **What should `MAX_INLINED_TEAMS` be?** It is the team-subtree size above which an owning-team
  deny becomes an `Approx`. Set it from measured team-tree sizes before step 6.
