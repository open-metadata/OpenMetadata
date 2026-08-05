# Permission-Aware Entity Pagination (issue #30586)

**Status:** design for review · **Target:** `origin/main`, ship in **2.1** · **Supersedes:** the
post-fetch inline-permissions approach currently in PR #31024 (its `entityPermissions` sidecar shape
is kept; its Java-side computation is replaced by DB/search-side filtering).

## 1. Goal & why the first approach was rejected

The reported symptom (#30586, Sentry) is an N+1: list/table UIs fire one
`/permissions/{resource}/name/{fqn}` call per row to decide which action buttons to render.

PR #31024 answered it by computing each row's permissions **post-fetch in Java** and returning them
inline. Harsha's steer (design thread) changes the target:

> "the goal is to **not return permissions** — rather **not return the entities itself** … the
> pagination should apply the permissions internally, **just like SearchRBAC** … it needs to be a
> **database check itself** … policy evaluation is one of the most expensive … **2.1**, work on it
> deeply."

So the final contract is **visibility filtering enforced in the query** (SQL and search), with
`includePermissions=true` demoted to an *optional* sidecar for action-button rendering on the
already-authorized page.

## 2. Non-negotiables (from the spec)

1. **Filter before count/cursor.** `paging.total`, offsets, and cursors are computed over authorized
   rows. Never fetch a raw page and filter afterward.
2. **Database/search check**, not post-fetch Java filtering.
3. **One predicate, two targets, no drift.** SQL and search RBAC must come from a single compiler.
4. **Fail closed.** If compiled and exact evaluation could disagree, deny/fallback — never silently
   widen visibility.
5. **Authenticated principal only** — list APIs take no `user` override.
6. Parent/collection authorization stays a hard gate: **403** when no applicable list permission;
   **empty page** when conditional permissions match no rows.
7. Responses `Cache-Control: private, no-store`.

## 3. What already exists (the precedent we extend)

- `search/security/RBACConditionEvaluator` already parses SpEL policy conditions
  (`OpAnd`→must, `OpOr`→should, `OperatorNot`→mustNot, method refs→leaf) into the engine-neutral
  `search/queries/OMQueryBuilder` (ES + OS impls via `QueryBuilderFactory`). This is "SearchRBAC" and
  proves policy→query-filter is feasible. Its **leaves are search-doc fields** (`owners.id`,
  `tags.tagFQN`).
- `security/policyevaluator/{PolicyEvaluator,RuleEvaluator,SubjectContext,CompiledRule}` — the exact
  in-memory evaluator and the finite RuleEvaluator function set to translate:
  `isOwner, noOwner, hasDomain, matchAnyTag, matchAllTags, matchAnyCertification, matchTeam,
  inAnyTeam, hasAnyRole, isReviewer, isTask*`.
- SQL list path today has **no** row RBAC — only a domain filter + the coarse resource-level
  `authorizer.authorize(VIEW_BASIC)` gate in `EntityResource.listInternal`.

### Storage facts the SQL renderer relies on
- `entity_relationship(fromId, toId, fromEntity, toEntity, relation TINYINT, deleted)`;
  **`OWNS = 8`**; ownership row = `fromId=owner(user|team)`, `toId=entity`, `relation=8`.
- `tag_usage(source TINYINT, tagFQN, tagFQNHash, targetFQN, targetFQNHash, …)`; classification
  `source=0`, glossary `source=1`; entity link by `targetFQN`/`targetFQNHash`.
- `<type>_entity(id, fullyQualifiedName, json, deleted)` — `id`/`fullyQualifiedName` are generated
  columns; **no stored `fqnHash` column** (hash is computed on read).
- `EntityDAO.listAfter/listBefore` splice **dialect-specific** `<mysqlCond>`/`<postgresCond>`;
  `listCount` splices `<cond>`. `ListFilter` branches JSON access on
  `DatasourceConfig.getInstance().isMySQL()` (`JSON_EXTRACT` vs `->>`).

## 4. Architecture — Approach A: semantic IR + two renderers

One SpEL walk → a semantic, boolean **`AuthPredicate` IR** → rendered into **both** SQL and the
existing `OMQueryBuilder`. Single source of truth ⇒ no SQL/search drift (non-negotiable #3).

```
CompiledRules (VIEW ops, resource) ─┐
SubjectContext ─────────────────────┼─► PolicyPredicateCompiler ─► AuthPredicate
resource type, requested fields ────┘                                   │
                                              ┌─────────────────────────┼───────────────────────┐
                                              ▼                                                   ▼
                                     SqlPredicateRenderer                                 SearchPredicateRenderer
                                (portable EXISTS, MySQL+Postgres)                    (reuse OMQueryBuilder ES/OS)
```

### 4.1 The IR
```
sealed interface AuthPredicate
  = MatchAll | MatchNone
  | And(List<AuthPredicate>) | Or(List<AuthPredicate>) | Not(AuthPredicate)
  | IsOwner | NoOwner | HasDomain
  | HasAnyTag(List<String>) | HasAllTags(List<String>) | HasAnyCertification(List<String>)
  | IsReviewer            // task leaves added when the task surfaces need them
```
Subject-only functions (`hasAnyRole`, `inAnyTeam`, `matchTeam`, `isBot`, persona) and resource
scoping (`rule.getResources()` vs the listed type) depend only on the subject/type, **not the row**,
so the compiler **pre-resolves them to `MatchAll`/`MatchNone` at compile time**. This keeps the SQL
surface to a handful of row-dependent leaves.

### 4.2 Compilation (`PolicyPredicateCompiler`)
- Iterate the subject's applicable policies/rules (same source as `RBACConditionEvaluator` /
  `PolicyEvaluator`), keep rules whose resource matches and whose ops intersect the requested VIEW
  set (`VIEW_BASIC`/`VIEW_ALL`/`ALL`, with `ALL`/`VIEW_ALL` subsuming narrower ops).
- allow rules → `Or`; deny rules → `And(allowExpr, Not(Or(denyExpr)))` (deny overrides allow).
- **Unsupported leaf ⇒ `PredicateCompilationException`** → caller falls back to the exact per-page
  evaluator (fail-safe, correct-but-unoptimized) and emits a metric. Never silently allow.

### 4.3 SQL rendering (`SqlPredicateRenderer`) — exact `EXISTS` per leaf
`<a>` = the entity table alias in the DAO query.
- `IsOwner` → `EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId=<a>.id AND er.relation=8
  AND er.fromId IN (:rbacOwnerIds))` where `rbacOwnerIds = {user.id} ∪ {t.id : t ∈ user.getTeams()}`
  — the **same set `SubjectContext.isOwner` uses** (parity by construction).
- `NoOwner` → `NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId=<a>.id AND
  er.relation=8 AND er.fromEntity IN ('user','team'))`.
- `HasAnyTag(t…)` → `EXISTS (SELECT 1 FROM tag_usage tu WHERE tu.targetFQN=<a>.fullyQualifiedName AND
  tu.source=0 AND tu.tagFQN IN (:tags))`; `HasAllTags` → one `EXISTS` per tag, AND-ed.
- `HasDomain` → `(<a> has no domain AND user has no domain) OR (<a>.domain ∈ user domains,
  FQN-prefix hierarchy)` — see open question Q2.
- `And/Or/Not/MatchAll/MatchNone` → `(… AND …)` / `(… OR …)` / `NOT (…)` / `TRUE` / `FALSE`.
- **Portability:** boolean structure and `EXISTS` are ANSI; the two dialects only differ where a leaf
  reads a JSON field (branch on `DatasourceConfig.isMySQL()`, like `ListFilter`). Owner/tag/domain
  leaves use relationship/`tag_usage` joins, so they are **dialect-independent**.
- **Params:** owner/domain id lists are UUIDs from the authenticated subject (not user input);
  validate-as-UUID then bind. Injected into `EntityDAO` `<cond>`/`<mysqlCond>`/`<postgresCond>` for
  **both** the row select and the count query (non-negotiable #1).

### 4.4 Search rendering
Refactor `RBACConditionEvaluator` to walk SpEL → `AuthPredicate` and add
`SearchPredicateRenderer: AuthPredicate → OMQueryBuilder` reusing today's ES/OS leaf builders. Then
**deprecate `searchSettings.globalSettings.enableAccessControl`** (always-on; retain the serialized
prop as a no-op; remove the UI switch).

### 4.5 Authorizer contract
Add `buildListPredicate(subject, resourceType, ops)` and a batched-page evaluator to `Authorizer`.
`DefaultAuthorizer` + `NoopAuthorizer` implement; a custom authorizer that doesn't advertise support
**fails startup** with an actionable message (spec requirement).

### 4.6 Sidecar (reused from PR #31024)
`includePermissions=true` → `ResultList.entityPermissions` (`{uuid → {resource, permissions}}`) for
the **visible** page only, computed by one batched subject evaluation. Controls the sidecar only;
filtering is always enforced.

## 5. Staging (each stage = its own reviewable PR)
- **1 — linchpin:** IR + compiler + `SqlPredicateRenderer` for `IsOwner`/`NoOwner` + **parity ITs on
  MySQL and Postgres** (compiled-SQL vs exact `PolicyEvaluator` over interleaved visible/hidden
  rows). Unwired. *This is the de-risk; nothing else builds until parity is green.*
- **2 — Authorizer contract** + custom-authorizer startup gate.
- **3 — repository wiring:** filter-before-count in `EntityRepository.listAfter/listBefore/listCount`
  via `ListFilter`; replace the domain-only filter.
- **4 — search unification:** `RBACConditionEvaluator` onto the IR; deprecate `enableAccessControl`.
- **5 — Stage-1 surfaces + sidecar + UI:** ingestion pipelines/agents, test cases, incidents,
  knowledge pages, event subscriptions; UI sends `includePermissions=true`, consumes sidecar, drops
  per-row permission calls. Dashboard charts → dashboard-filtered paginated Chart endpoint.
- **6 — Stage 2:** every paginated `EntityInterface` list + search-backed list; remaining UI tables.

## 6. Test & acceptance (mirrors existing `*RBACConditionEvaluatorTest`)
- **Parity matrix:** exact eval vs SQL vs ES vs OS for every supported condition, boolean combo,
  allow/deny order, and `ALL`/`VIEW_ALL` subsumption.
- **MySQL + Postgres ITs:** interleaved visible/hidden entities → correct page contents, `total`,
  and stable before/after cursors (no gaps/dupes); parent-scoped lists; sidecar only for visible rows.
- Admins, bots, anonymous, `NoopAuthorizer`, role/team changes, custom-authorizer startup.
- Disabling the deprecated search setting exposes no unauthorized hits/totals/aggregations.
- UI: correct row actions from sidecar, zero per-row permission calls (Agents-page network assertion:
  1 list request, 0 `/permissions/...`, 0 per-row status calls).

## 7. Open design questions for review (@Harsha)
- **Q1 — tag leaf join key:** join `tag_usage` on raw `targetFQN` (simple, but `VARCHAR(256)` can
  truncate very long FQNs) vs `targetFQNHash` (needs the entity's fqn hash, which isn't a stored
  column). Preference?
- **Q2 — `hasDomain` in SQL:** the "no-domain entity is visible to a no-domain user" + FQN-prefix
  hierarchy rule needs the domain relationship + a prefix match; confirm the exact semantics we lock
  in (and whether inherited domains must be materialized).
- **Q3 — uncompilable policies:** fall back to exact per-page evaluation (correct, unoptimized) vs
  **reject at policy-validation time** (spec leans reject). Reject is stricter but can break existing
  custom policies on upgrade — acceptable?
- **Q4 — IR vs reuse `OMQueryBuilder` as the IR (Approach B):** a dedicated IR keeps SQL leaves clean;
  reusing `OMQueryBuilder` is a smaller change but couples SQL to ES field names. Confirm Approach A.
- **Q5 — perf:** per-leaf `EXISTS` on large tables — do we need supporting indexes on
  `entity_relationship(toId, relation)` / `tag_usage(targetFQN, source)` (present today?), and a
  bounded-chunk cap on the batched sidecar eval.

## 8. Risks
- **SQL↔search↔exact drift** is the top security risk; the parity harness (Stage 1) is the safety net
  and is built first.
- `Authorizer` contract change breaks custom authorizers → mitigated by the startup gate + migration
  message.
- Cursor/total correctness over a filtered set; `hasDomain`/tag hashing edge cases.
