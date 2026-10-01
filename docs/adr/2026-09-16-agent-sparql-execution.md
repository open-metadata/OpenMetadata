# ADR: Permissioned read-only SPARQL execution for the 2.1 graph agent tool

- **Status:** Accepted for a scoped first implementation (2026-09-16, review 3). Code is
  reviewed separately.
- **Date:** 2026-09-16 (amended 2026-09-29, §2a: default grant through Data Consumer)
- **Issue:** [OpenMetadata #33384](https://github.com/open-metadata/OpenMetadata/issues/33384)
- **Branch:** `fmcardoso/add-permissioned-read-only-sparql-execution-for`
- **Amended by:** [OpenMetadata #34231](https://github.com/open-metadata/OpenMetadata/issues/34231),
  [OpenMetadata #34270](https://github.com/open-metadata/OpenMetadata/issues/34270)
  (MCP knowledge-graph tools — see the amendment before the Review log).
- **Related:** ai-platform epic #224, ai-platform #1299, ai-platform PR #1310 (design, pinned at
  `0056ceb9`); OpenMetadata #33224 (asset-level RBAC — parallel work, explicitly **not** a
  prerequisite and **not** provided here).
- **Baseline:** source rechecked on this branch 2026-09-16 (main tip; Java 21, Maven 3.9,
  Docker available). File/line references below are against that tree.

## Context

The model-authored SPARQL graph tool (ai-platform #1299) must execute caller-authored SELECT
queries without bypassing the admin-only RDF surface. Today `GET/POST /v1/rdf/sparql` and
`POST /v1/rdf/sparql/update` all call `authorizer.authorizeAdmin`
(`openmetadata-service/src/main/java/org/openmetadata/service/resources/rdf/RdfResource.java:1237,1269,1292`).
The only non-admin SPARQL surface is the single-glossary `GlossaryResource.queryOntology`.
The execution primitives the agent needs already exist and are reused, not duplicated:
`RdfSparqlService` (parse + federation check + dispatch), `SparqlFederationGuard`
(parsed-tree `ElementWalker` inspection, `rdf/federation/SparqlFederationGuard.java:47-80`),
`SparqlQueryExecutionGuard` (8 global / 2 per-principal, 30 s outer deadline,
`rdf/SparqlQueryExecutionGuard.java:28-40`), and `SparqlQueryLimits`
(100k chars, 1k default / 10k max rows, 10 MiB output, `rdf/SparqlQueryLimits.java:21-25`).

## Decision

Add a dedicated, explicitly permissioned read surface. The worker authors queries; the server
owns validation, dataset selection, execution bounds, and completeness signals.

### 1. Endpoint and schemas

```http
POST /api/v1/rdf/sparql/agent
Content-Type: application/json
Accept: application/json
```

- Request `AgentSparqlQuery`: **only `query`** (SPARQL text, ≤100,000 chars). No identity,
  credential, graph-URI, or limit-override fields. Deliberately narrower than the existing
  `SparqlQuery` schema (`api/rdf/sparqlQuery.json`), which exposes `format`, `timeout`,
  `defaultGraphUri`, `namedGraphUri`, and `inference` — none of which a model caller may set.
- Explicit SPARQL `LIMIT`/`OFFSET` remain query semantics, subject to server maxima.
- Response `AgentSparqlResponse`: SELECT `head`/`results.bindings` preserving URI,
  blank-node, literal datatype/language, and unbound-value semantics, plus
  `metadata{completeness{status, relativeTo: SUBMITTED_QUERY, reason},
  effectiveLimits{serverRowLimit, explicitQueryLimit, outputBytesLimit}}`. Empty bindings
  are success.
- **Removed from the ai-platform proposal (deliberate, see §1a):** `effectiveScope`,
  `projectionVersion`, and `projectionState` (always `READY` on success, so it carries no
  information; non-ready states are errors — §4a).
- Errors: stable `{code, message, requestId}` envelope with the 14 codes/HTTP mapping from
  #33384 (`QUERY_INVALID`, `QUERY_FORM_NOT_ALLOWED`, `GRAPH_SELECTION_NOT_ALLOWED`,
  `QUERY_LIMIT_EXCEEDED`, `AUTHENTICATION_REQUIRED`, `RDF_QUERY_FORBIDDEN`,
  `IMPERSONATION_NOT_ALLOWED`, `FEDERATION_NOT_ALLOWED`, `EXECUTION_CAPACITY_EXHAUSTED`,
  `RESULT_OUTPUT_LIMIT_EXCEEDED`, `EXECUTION_TIMEOUT`, `RDF_REPOSITORY_UNAVAILABLE`,
  `PROJECTION_NOT_READY`, `RDF_BACKEND_FAILURE`). `TRUNCATED` row results are HTTP 200,
  not errors.
- Existing admin/UI schemas, media types, and semantics are unchanged.

#### 1a. Fixed query scope (decided 2026-09-16)

There is exactly one supported scope, so the response carries no scope identifier, scope
object, or scope-resolution mechanism. The endpoint contract documents the fixed behavior:

- **Dataset selection is server-controlled:** queries run against the server-configured
  RDF dataset and its default graph, the same dataset the admin SPARQL endpoint reads.
- **Query-level graph selection is prohibited:** `FROM`, `FROM NAMED`, and `GRAPH` (constant
  or variable, any nesting level) are rejected with `GRAPH_SELECTION_NOT_ALLOWED` (§4).
- **No persona filtering and no asset-level RBAC:** results are not narrowed by the
  caller's persona, ownership, domain, or per-asset permissions (§7).

Reconciliation with ai-platform PR #1310: `effectiveScope` is intentionally dropped, not
deferred to a later field in this ticket. `projectionVersion` is also dropped — the server
has no existing projection-version signal, and adding one is new infrastructure outside this
ticket (§8). `projectionState` is dropped as redundant on success. Any of these can be
introduced later, additively, if multiple scope behaviors or version-aware callers actually
require it. The companion `KnowledgeGraphApi.executeQuery` must not depend on them; the
ai-platform proposal is updated to match (see Review log).

**Vocabulary compatibility is not signaled.** The companion relies on the documented
OpenMetadata RDF vocabulary (ontology/prefixes the projection writes). Readiness (§4a) only
says the projection is usable; it does not establish that the projection's vocabulary matches
what a given worker was authored against.

### 2. Authorization: dedicated operation on the `rdf` resource

- New `MetadataOperation` enum value (proposed name: `ExecuteSparqlQuery` — **requires
  companion-owner sign-off**), added to `definitions.operation` in
  `openmetadata-spec/.../entity/policies/accessControl/resourceDescriptor.json`
  (the enum's single source of truth; it has no RDF operation today). This is a schema
  change: assess policy-migration, AccessControl UI, and default-role impact in Step 2.
  `VIEW_ALL` is not substituted; `authorizeAdmin` is not reused.
- Register the resource at startup with the established non-entity precedent
  (`OpenMetadataApplication.java:343` registers `AUDIT_LOG` + `AUDIT_LOGS`):
  `ResourceRegistry.addResource("rdf", List.of(ExecuteSparqlQuery), emptySet())`.
  (`getResourceDescriptor` throws for unregistered names — `ResourceRegistry.java:121-130` —
  so registration is mandatory, not optional.)
- Endpoint authorizes
  `authorizer.authorize(securityContext, new OperationContext("rdf", ExecuteSparqlQuery),
  RdfResourceContext.INSTANCE)`, where `RdfResourceContext` is a singleton
  `ResourceContextInterface` with no owners/tags/domains and a `null` entity — the
  `AuditLogResourceContext` precedent (`resources/audit/AuditLogResource.java:433`).
  `new ResourceContext<>("rdf")` is **not** usable: its constructor calls
  `Entity.getEntityRepository("rdf")` (`policyevaluator/ResourceContext.java:50-55`), which
  throws for a non-entity type (`Entity.java:763-771`).

#### 2a. Explicit-name matching (decided — review feedback 2026-09-16; default amended 2026-09-29)

> **Amendment (2026-09-29, #34231).** The default changes from opt-in to opt-out through the
> Data Consumer policy. This was a team decision by the AI domain, recorded on #34231.
>
> - **What changes.** The seeded `DataConsumerPolicy` carries its own allow rule,
>   `DataConsumerPolicy-ExecuteSparqlQuery-Rule`, which names `ExecuteSparqlQuery` (resource
>   `All`). Every user inherits Data Consumer through the Organization team, so a new user can
>   run agent SPARQL queries with no role of their own. An admin who does not want this deletes
>   that one rule; it is separate from `DataConsumerPolicy-EditRule` for that reason.
> - **What does not change.** The matching described below is untouched: an allow rule matches
>   only when it names the operation (`All` does not grant it), and a deny rule matches by name
>   or by `All`. A deny rule on a role therefore still removes the permission from a user who
>   inherits the Data Consumer grant. Admins are unaffected.
> - **Why.** The agent's graph tool calls the endpoint as the user. With no default grant, most
>   users were offered the tool and refused, and the agent fell back to sampling lineage. The
>   ai-platform benchmark measured wrong answers in 3 of 5 runs (ai-platform#1370). Making the
>   refusal honest (ai-platform#1372) cannot produce the answer; only the grant can.
> - **Accepted risk.** Data Consumer already holds `ViewAll` on every resource, so on a default
>   setup the graph exposes nothing a Data Consumer could not already view.
> - **Remaining caveat (§7).** The endpoint does no asset-level filtering (#33224). An
>   organisation that restricts what users can view through custom policies must also remove the
>   rule, or its users can query assets they cannot otherwise see.
> - **Existing installations.** Seed data never updates a policy that already exists, so the
>   2.1.0 schema migration appends the rule to an existing `DataConsumerPolicy` when it is
>   absent. It is a native SQL statement, recorded once in `SERVER_MIGRATION_SQL_LOGS`, so an
>   admin who removes the rule afterwards does not get it back on a later upgrade. A Java data
>   migration was rejected because its identity is a fingerprint of the version's migration
>   classes, and changing any of them re-runs it on installs whose latest version is 2.1.0.
> - **Upgrade guard.** The accepted risk above holds only while Data Consumer can view
>   everything, so the migration adds the rule only if some allow rule of the policy still
>   lists `ViewAll`, in the same plain style as the 2.0 policy backfills. An install where an
>   admin removed `ViewAll` from Data Consumer keeps that restriction and does not receive the
>   grant; such an admin who wants it adds the rule by hand. This narrows "works after
>   upgrade" to installs that still have `ViewAll` in Data Consumer. The check is deliberately
>   simple: it does not look at a rule's condition or resources, so a `ViewAll` that was
>   narrowed by a condition or to specific resources still lets the grant through, and it does
>   not treat the wildcard `All` operation as `ViewAll`. It reads `DataConsumerPolicy` only,
>   so it cannot see deny rules in other policies (for example `DomainOnlyAccessPolicy` or a
>   conditional deny on a team's role). Instances that restrict viewing in any of these ways
>   must remove the rule themselves (§7).
> The sections below record the original opt-in decision and remain the reference for how the
> operation is matched. Where they say no default role grants the operation, read them as
> superseded by this amendment.

"No default role grants it" is **not** sufficient for opt-in. Policy evaluation matches
wildcards: resource `All` matches `rdf` (`policyevaluator/CompiledRule.java:217-218`, only
`scim` is excluded) and operation `All` subsumes any operation, including new ones
(`CompiledRule.java:236-238`). An existing non-admin policy granting `All` on `All` would
therefore authorize this endpoint, which exposes an unfiltered dataset (§7). The only
operation exempt from subsumption today is `Impersonate` (`CompiledRule.java:32-33,223-231`),
and that exemption applies to allow **and** deny rules alike.

Decision: **explicit opt-in** for non-admin callers.

- For `ExecuteSparqlQuery` only: an **Allow** rule matches only when it names the operation;
  a **Deny** rule matches by name **or** wildcard subsumption (`All`). Wildcard resource
  matching is unchanged — naming the operation on resource `All` is still an explicit grant.
- It does **not** join `EXPLICIT_GRANT_ONLY_OPERATIONS` as-is: `matchOperation` is shared by
  `evaluateDenyRule` (`CompiledRule.java:101-112`), `evaluateAllowRule` (`:139-152`), and
  `evaluatePermission` (`:160-199`), so joining would also make `Deny All` stop matching it —
  failing *open*. Instead a separate allow-explicit/deny-wildcard set is added, with the
  rule's effect deciding which matching applies.
- **`Impersonate` semantics are unchanged** (explicit match for both allow and deny). Existing
  agent integrations may rely on wildcard denies not applying to impersonation; tightening
  that is a broader policy change tracked separately, not part of this ticket.
- Permission listings (`getPermission` → `evaluatePermission`) use the same effect-aware
  match, so the UI/permissions API does not show wildcard-only callers as allowed.
- **Admins** are not affected by any of this: `DefaultAuthorizer.authorize` returns early
  for `subjectContext.isAdmin()` (`security/DefaultAuthorizer.java:83-84`) before policy
  evaluation, independent of policy `All`. Under impersonation the subject is the effective
  user, so an impersonated **admin** user passes; the bot's own admin status is never used.
- Rollout (superseded 2026-09-29, see the amendment above): originally no default role grants
  `ExecuteSparqlQuery`, and non-admins get access only through a policy that names it. Now the
  Data Consumer policy names it, so users get access by default and an admin opts out.
- Required tests (IT, real policies): wildcard-only (`All`/`All`) caller → 403
  `RDF_QUERY_FORBIDDEN`; explicit grant → 200; explicit grant plus applicable deny (named
  and wildcard `All`) → 403; admin without any grant → 200; impersonated user with/without
  explicit grant → 200/403 (bot's grants irrelevant); permissions API reflects the same
  outcomes; `CompiledRule` unit tests for allow-vs-deny matching of `ExecuteSparqlQuery`, plus
  a regression test that `Impersonate` still ignores wildcard allows **and** wildcard denies.
  With the 2026-09-29 amendment: a user who only inherits Data Consumer → 200; the same user
  plus a role denying `ExecuteSparqlQuery` → 403; the permissions API agrees in both cases; and
  removing the Data Consumer rule withdraws the grant.

### 3. Effective caller, impersonation, audit

CAIP sends a bot JWT plus `X-Impersonate-User`. The existing door-enforced flow is reused
unchanged:

- `JwtFilter` swaps the principal only for bot callers with a resolvable target
  (`security/JwtFilter.java:200-214,254-264`), enforcing `ImpersonationAuthorizer`
  (bot must be a bot with `allowImpersonation` plus the `Impersonate` policy grant on the
  target — `security/ImpersonationAuthorizer.java:36-49,71-86`). Gate behavior on
  `CatalogSecurityContext.impersonatedUser()`; a non-null `ImpersonationContext` alone is
  not proof of an authorized session (`security/ImpersonationContext.java:5-13`).
- Because the principal is already the effective user when the resource runs,
  `authorizer.authorize(...)` and the per-principal concurrency key
  (`securityContext.getUserPrincipal().getName()`, resolved **before** guard thread
  handoff) automatically use the effective caller. No caller-selected username is read
  from the body. `SubjectContext.getActivePersona` is never used for authorization.
- Audit retains **both** identities (service actor from `ImpersonationContext`, effective
  user from the principal) in one structured server log event per request: `requestId`,
  service actor, effective user, outcome code, row count, duration. The query text is not
  logged. `AuditLogRepository` only persists change and auth events
  (`audit/AuditLogRepository.java:82,170`), so a persisted read-audit record is **not** part
  of this ticket (§8). Untrusted impersonation is rejected with no fallback to bot
  privileges. Without the header, the authenticated actor is the effective caller.

### 4. Query profile and shared-service integration

- Accept SELECT (incl. aggregates, supported subqueries). Reject ASK, CONSTRUCT, DESCRIBE,
  UPDATE, `SERVICE`/federation, `FROM`/`FROM NAMED`, constant and variable `GRAPH` — via a
  new `AgentSparqlQueryValidator` using parsed-query/algebra walking in the style of
  `SparqlFederationGuard` (never regexes), covering nested subqueries, EXISTS/NOT EXISTS,
  and expression positions.
- The profile is introduced **through the shared `RdfSparqlService` read path** (profile
  parameter), not a forked executor; admin behavior is unchanged (note: the shared parser
  currently accepts SELECT/ASK/CONSTRUCT/DESCRIBE — `RdfSparqlService.java:116-123`).
- **Submitted-limit preservation:** `ReadQuery.parse` stores the post-`applyResultLimit`
  rewrite (`RdfSparqlService.java:106-147`; `SparqlQueryLimits.applyResultLimit` injects
  `LIMIT 1000` — `SparqlQueryLimits.java:37-48`). The agent path captures submitted
  LIMIT/OFFSET (present/absent/value) **before** protective rewriting; this distinction
  drives `explicitQueryLimit` metadata and the overflow probe.
- Server selects the configured dataset/default graph (§1a). Inference is `none`, forced
  regardless of server defaults (`RdfRepository.executeSparqlQuery` otherwise applies the
  configured default inference level — `rdf/RdfRepository.java:1601-1613`; the agent path
  uses the no-inference execution). Persona/relevance scope is never presented as
  authorization.
- The parsed-tree inspector supersedes `SparqlFederationGuard` on this path rather than
  reusing it: it descends into subqueries, EXISTS/NOT EXISTS, aggregates, and ORDER BY
  expressions the guard's pattern-only walk does not cover, and it grants no endpoint
  allowlist. Calling the guard in addition would add no detection — and, ordered before
  the inspector, would misreport a `SERVICE` violation as `QUERY_INVALID` instead of
  `FEDERATION_NOT_ALLOWED`.

#### 4a. Conservative projection readiness (decided 2026-09-16)

Reuse the existing signal, `RdfProjectionStateResolver.resolve()`
(`rdf/RdfProjectionStateResolver.java`), already injected into `RdfResource` as
`projectionStateSupplier` (`resources/rdf/RdfResource.java:177-188`). It yields `READY`,
`REBUILDING` (latest `RdfIndexApp` run in progress, or no run recorded), or `DEGRADED`
(failed/stopped run, malformed run record, or `RdfProjectionHealth.isDegraded()` — which
itself fails closed to degraded when health cannot be read).

- Execute only when the state is `READY`. `REBUILDING`, `DEGRADED`, or an exception while
  resolving state → 503 `PROJECTION_NOT_READY`.
- Check **before** execution and **again before returning success**. If the second check is
  not `READY`, discard the result and return 503 `PROJECTION_NOT_READY`.
- A rebuild blocks the endpoint, even if an older dataset could still serve reads. This is
  accepted for v1. No blue/green-aware availability, generation pinning, or rebuild changes.
- Repository availability stays a distinct code, 503 `RDF_REPOSITORY_UNAVAILABLE`: RDF
  disabled or no repository (`RdfResource.requireRdfRepository`, `:195-201`), an open storage
  circuit (`RdfStorageCircuitOpenException`), or a connect-class failure as already classified
  by the storage layer (`JenaFusekiStorage.isCircuitBreakerFailure`, `:655-657`). Timeouts
  map to `EXECUTION_TIMEOUT`; other storage failures to `RDF_BACKEND_FAILURE`.
- **Not a snapshot-consistency guarantee.** The before/after checks are a conservative
  readiness policy only: a rebuild or degradation that starts and finishes between the two
  checks, or a live-write failure recorded after the second check, is not detected. Callers
  must not treat a success as proof the projection was stable for the whole execution.
- Tests: `READY` → 200; `REBUILDING`/`DEGRADED`/resolver exception before execution →
  503 with no execution; `READY` then `DEGRADED` after execution → 503 with the result
  discarded; RDF disabled → 503 `RDF_REPOSITORY_UNAVAILABLE`, distinct from
  `PROJECTION_NOT_READY`.

### 5. Completeness and output bounds

- Outer result without an explicit limit uses an overflow probe: exactly 1,000 rows is
  COMPLETE only if no 1,001st row exists; otherwise HTTP 200 `TRUNCATED`/`SERVER_ROW_LIMIT`.
  Subquery/aggregate semantics are never rewritten to probe; unprovable shapes return
  `UNKNOWN`. Protective ceiling applies after OFFSET; explicit limits above the maximum
  are rejected.
- **Bounded response output:** the serialized response size is checked **before** any
  headers are committed, so overflow returns structured `RESULT_OUTPUT_LIMIT_EXCEEDED`
  rather than cut-off JSON or a committed 200; serialization memory is not bounded. The
  storage layer already materializes the backend result as a string and the shared
  `SparqlQueryLimits.requireBoundedOutput` check runs on it (`RdfSparqlService.java:97-100`,
  `JenaFusekiStorage.java:1429-1442`); v1 keeps that and does **not** add streaming,
  memory-bounded result production in the storage layer (§8). Admin-path behavior stays
  byte-identical (covered by regression tests).

### 6. Pre-resource error mapping (endpoint-scoped)

Filter/deserialization failures precede the resource method, so the resource alone cannot
satisfy §2.5's envelope:

- Map, **for the agent path only**: missing/invalid JWT → `AUTHENTICATION_REQUIRED`;
  nonexistent impersonation target (an `AuthenticationException` today —
  `JwtFilter.java:258-261`) and denied/non-bot impersonation → `IMPERSONATION_NOT_ALLOWED`
  (behavior change, recorded here deliberately); malformed JSON body → `QUERY_INVALID`.
- Mechanism (path-aware translation or higher-precedence agent-path mapper) must leave
  every other endpoint's `ErrorMessage` responses byte-identical
  (`exception/CatalogGenericExceptionMapper.java:102-118`); add a no-diff regression check
  on neighboring endpoints. Covered by actual-HTTP IT cases, since unit-level resource
  tests cannot observe filter-stage mapping.

### 7. Explicit non-guarantees

No asset-level, field-level, or path/aggregate leakage protection is provided: the query
evaluates over the configured dataset as the endpoint permission allows. This matches
#33384 (which defers mixed-access filtering to #33224) and must be stated in user-facing
docs. Nothing in this record claims otherwise.

### 8. Scope boundary for this ticket

Deliverable: one explicitly permissioned SELECT endpoint; validated impersonation and
effective-user authorization; the existing execution guards and query restrictions; typed
results, bounded output, completeness, and stable errors; focused contract and regression
tests. Nothing is built for hypothetical future requirements.

Requirements that would substantially expand scope, and are therefore **not** in this ticket
(each needs its own decision if wanted):

- Scope metadata or scope resolution (§1a).
- A projection version/generation signal, blue/green-aware availability, generation pinning,
  or snapshot-consistent reads (§1a, §4a).
- Persisted read-audit records in the audit log store; v1 uses a structured log event (§3).
- Streaming or memory-bounded result production below the storage interface; v1 bounds the
  response envelope before commit and keeps the existing materialized-result check (§5).
- Asset-level, field-level, or persona filtering (#33224, §7).
- Changing `Impersonate` policy semantics (e.g. letting wildcard denies apply) (§2a).
- A vocabulary-compatibility or ontology-version signal (§1a).

Retained because the agreed security/correctness boundaries depend on them, even though they
touch shared code: explicit-allow/wildcard-deny matching for `ExecuteSparqlQuery` in
`CompiledRule` (§2a),
endpoint-scoped pre-resource error mapping (§6), and submitted-limit capture in the shared
read path (§4). Each stays minimal and is covered by regression tests on the existing
behavior it touches.

## Consequences

- One new endpoint, three new schemas (+ generated models), one new operation, one
  validator, one shared-service profile parameter, one serialization change, one
  endpoint-scoped error-mapping mechanism, one singleton RDF resource context, one
  shared `CompiledRule` change (explicit-allow/wildcard-deny matching for
  `ExecuteSparqlQuery` only), and a before/after
  readiness check on the existing projection state. No second executor, no projection,
  rebuild, or storage changes.
- Rollout is opt-out through Data Consumer (§2a, amended 2026-09-29): the seeded
  `DataConsumerPolicy` names `ExecuteSparqlQuery`, so users inheriting it are allowed; wildcard-only
  policies still do not grant the endpoint on their own; a deny rule still removes the permission;
  admins pass via the authorizer's admin short-circuit. Instances with restricted viewing policies
  should remove the rule (§7).
- Companion `KnowledgeGraphApi.executeQuery` binds to the schemas/OpenAPI published here;
  any deviation from ai-platform PR #1310's proposal is reconciled with the owner and
  recorded as an amendment here.

## Implementation notes (2026-09-16)

Choices made while implementing that refine, but do not change, the decisions above:

- **Default graph = union of named graphs.** OpenMetadata writes entities into named graphs, so
  the agent endpoint's server-selected default graph only sees them when Fuseki runs with
  `tdb2:unionDefaultGraph true`. That is the existing requirement for the SPARQL playground and
  MCP tools (`docs/rdf-production-setup.md`, `docker/rdf-store/config.ttl`); the endpoint adds no
  new one. Without it, queries succeed with empty results.
- **Code layout.** Query policy, execution, completeness, failure classification, and audit live
  in `service/rdf/agent/` (`AgentSparqlQueryValidator`, `AgentSparqlQueryInspector`,
  `AgentSparqlService`, `AgentSparqlResultMapper`, `AgentSparqlFailures`, `AgentSparqlAudit`).
  `RdfResource.queryAgentSparql` only authorizes and delegates. The shared read path gains
  `RdfSparqlService.selectJsonWithoutInference`; the admin `query` path is unchanged.
- **UPDATE text** fails SELECT parsing and is reported as `QUERY_FORM_NOT_ALLOWED` when it parses as
  a SPARQL update, otherwise `QUERY_INVALID`.
- **`UNKNOWN` completeness is not produced in v1.** The outer-result probe never rewrites
  subqueries, so every SELECT shape is provable as `COMPLETE` or `TRUNCATED`. The enum value stays
  in the schema for future shapes.
- **Pre-resource errors.** `CatalogGenericExceptionMapper` delegates to `AgentSparqlTransport`
  only when the request path is `v1/rdf/sparql/agent`. Impersonation failures are raised as
  `ImpersonationDeniedException` (an `AuthorizationException`) and
  `ImpersonationTargetNotFoundException` (an `AuthenticationException`), so every other endpoint
  keeps its exact status and message. The request body is read as a string and parsed strictly, so
  malformed or extra-field bodies become `QUERY_INVALID` inside the resource.
- **Output bound.** The backend result is still checked by `requireBoundedOutput`, which now
  throws the typed `SparqlQueryLimits.OutputLimitExceededException` (same type hierarchy and
  message for the admin path). The serialized envelope is checked again before the response is
  built.
- **Generated TypeScript** for the new schemas and operation enum is produced by the
  `typescript-type-generation` workflow on the PR, not committed by hand.
- **Extension function IRIs are syntactically opaque to validation**, which constrains
  query form only — so Jena's dynamic class loading for `java:` IRIs (any `Function` or
  `PropertyFunction` on the classpath, no configuration) is closed at the validator
  instead: the inspector rejects `java:`-scheme function IRIs and predicate IRIs,
  including inside property paths, as `QUERY_FORM_NOT_ALLOWED`. Calls whose name is
  computed at run time cannot be allowlisted that way, so `CALL` of any shape and the
  `eval` function in both ARQ namespaces are rejected outright. Validation itself never
  touches data (parse-only).
- **Test profile uses the supported image.** `postgres-rdf-tests` no longer pins
  `secoresearch/fuseki:5.5.0`: with no `rdfContainerImage` set, `TestSuiteBootstrap`
  builds `docker/rdf-store` (Fuseki 6.2.0 + union default graph + write extension). The
  stock pin ran a bare server with no update service, so every SPARQL update failed with
  405 `Method Not Allowed` — confirmed as an image mismatch, not a client URL/credential
  bug: the same code and credentials succeed against the repo image, and the pre-existing
  `GlossaryTermRelationFixesIT` log shows the same 405s on the stock image. No production
  behavior changes; dev compose, E2E, and prod docs already use the repo image.
- **Fixtures live in a named graph.** With `tdb2:unionDefaultGraph`, triples written to
  the default graph are invisible to default-graph reads (verified by direct HTTP against
  the repo image), so the IT writes fixtures to a dedicated named graph and reads them
  through the union view — the same shape production entity writes use. Agent queries
  stay GRAPH-free per §4.
- **Audit reads the bot from both sources.** `CatalogSecurityContext.impersonatedUser()`
  carries the impersonating bot, but Jersey may deliver a wrapped `SecurityContext` to
  the resource, which dropped the actor to null. `agentSparqlCaller` now prefers the
  context value and falls back to the request thread's `ImpersonationContext`, the same
  fallback `DefaultAuthorizer` uses. Both are set by `JwtFilter` only for a validated
  session, so untrusted headers still audit as rejections without a bot actor.

## Amendment: MCP knowledge-graph tools (#34270)

- **Status:** Proposed (2026-10-01). Written before implementation so the access and execution
  decisions are reviewable on their own. Verification evidence is added at the end of this
  section once the integration tests have run.
- **Issue:** [OpenMetadata #34270](https://github.com/open-metadata/OpenMetadata/issues/34270)

### A1. Scope

The OpenMetadata MCP server and its RDF tools (`sparql_query`, `entity_neighborhood`,
`find_by_tag`, `shacl_validate`, `ontology_describe`) already exist and are shared by every
deployment that serves MCP, including Collate. This amendment **extends those existing tools to
non-admin callers who are explicitly permitted**. It does not add an MCP server or a tool, and it
does not change `get_entity_lineage`; fixing that tool (column start, cursor, edge filters) is
separate work in the MCP epic and does not depend on RDF.

Motivation: a column-lineage question over thousands of edges is answerable only by paging a graph
query, and today every RDF MCP tool is admin-only. The authorization point is a single call,
`authorizer.authorizeAdmin`, in `RdfMcpTool.execute`; bots are rejected only as a side effect of
`DefaultAuthorizer.authorizeAdmin` (no code names them). The admin-only wording in the tool
descriptions says so.

### A2. Access matrix

The permission is the one §2 defines: `ExecuteSparqlQuery` on the `rdf` resource, with the
explicit-allow / wildcard-deny matching of §2a. Admins pass through the authorizer's admin
short-circuit exactly as in §2a.

| Tool | Access |
|---|---|
| `sparql_query` | `ExecuteSparqlQuery`; the query profile depends on the caller (A3) |
| `entity_neighborhood` | `ExecuteSparqlQuery` |
| `find_by_tag` | `ExecuteSparqlQuery` |
| `ontology_describe` without `resource` | no check: it returns the bundled ontology file that the unauthenticated `GET /v1/rdf/ontology` already serves |
| `ontology_describe` with `resource` | `ExecuteSparqlQuery`: a `DESCRIBE` of an instance IRI is a data read |
| `shacl_validate` | **admin only, unchanged.** `fullGraph=true` loads up to 100k triples into memory, and the REST `/v1/rdf/validate` is admin-only |

`shacl_validate` is kept admin-only deliberately even though #34253 grants `ExecuteSparqlQuery` to
Data Consumers: a permission meant for bounded SELECTs must not become a memory-pressure lever.
The authorization hook is per tool, so each tool states its own requirement. Authorization runs
before the "RDF is not enabled" check, so an unauthorized caller learns nothing about deployment
configuration.

### A3. Execution profile for `sparql_query`

- **Admins:** behavior is unchanged: same parsing (SELECT, ASK, DESCRIBE, CONSTRUCT), the caller's
  `format` and `inferenceLevel`, the existing default row limit, and the same response shape.
- **Non-admins:** the query runs through the agent profile of §4 and §5, built by the same service
  the `/v1/rdf/sparql/agent` endpoint uses, so the two surfaces cannot drift:
  - SELECT only; `FROM`, `GRAPH`, `SERVICE`, `CALL` and `java:` IRIs are rejected;
  - inference is `none`; a request for another inference level or for a non-JSON format is
    rejected with a message naming the rule rather than silently ignored;
  - the projection must be `READY` before and after execution (§4a);
  - the server row cap, 10 MiB output bound, 30 s timeout and the global / per-principal
    concurrency limits apply;
  - one audit event per call, recorded through the same audit path as the agent endpoint;
  - the response carries the completeness status computed from the row probe (§5), so a client
    can tell a complete page from a truncated one.
- The MCP response is additionally bounded to the MCP payload budget (about 80 KB). A bounded
  response is flagged `truncated` with its full size; the caller lowers `LIMIT` and repeats the
  same `OFFSET`. This is a transport limit, separate from the completeness status.
- The other tools that read the graph (`entity_neighborhood`, `find_by_tag`) execute only inside
  the shared timeout and concurrency guard once non-admins can call them.
- Agent-profile errors keep their stable code in the MCP error message and are mapped onto the
  statuses the MCP dispatcher already uses (it has no 503 and no "unavailable" telemetry category):

  | Agent code | MCP status |
  |---|---|
  | `QUERY_INVALID`, `QUERY_FORM_NOT_ALLOWED`, `GRAPH_SELECTION_NOT_ALLOWED`, `QUERY_LIMIT_EXCEEDED`, `RESULT_OUTPUT_LIMIT_EXCEEDED` | 400 |
  | `FEDERATION_NOT_ALLOWED` | 403, as on the REST endpoints and the admin path of this tool |
  | `EXECUTION_CAPACITY_EXHAUSTED`, `PROJECTION_NOT_READY`, `RDF_REPOSITORY_UNAVAILABLE` | 429 with "Retry shortly" |
  | `EXECUTION_TIMEOUT` | 504, as for every other MCP timeout |
  | `RDF_BACKEND_FAILURE` | 500 |

  The REST agent endpoint reports `PROJECTION_NOT_READY`, `RDF_REPOSITORY_UNAVAILABLE` and
  `EXECUTION_TIMEOUT` as 503 and `RESULT_OUTPUT_LIMIT_EXCEEDED` as 413. MCP uses 429 for the
  retryable states because a 5xx would append "retrying will not help", which is wrong for a
  rebuilding projection. The cost is that telemetry counts them under `RATE_LIMIT`; a distinct
  unavailable status and category would change the `McpToolCallUsage` schema and is left to a
  follow-up if the split is needed. An MCP request on a deployment without RDF returns the
  existing "RDF is not enabled" client error.

### A4. Bots

Bots receive no exemption and no special rejection. The MCP transport has no
`X-Impersonate-User` equivalent (`JwtFilter` builds the MCP security context with no impersonated
user), so a bot is authorized on its own policies and passes only if one of them names
`ExecuteSparqlQuery`. This matches the other MCP tools and the agent endpoint without
impersonation. A bot with only an `All`/`All` rule is denied for the same reason any user is
(§2a).

### A5. Non-guarantees apply to MCP

§7 applies unchanged. There is **no asset-level, field-level, or path/aggregate leakage
protection**: a caller with `ExecuteSparqlQuery` can obtain, through counts, joins and lineage
paths, information about assets they could not open individually. This risk is accepted for the MCP
tools exactly as it was for the agent endpoint, and is not gated on asset-level filtering
(#33224). The readiness check (§4a) remains a conservative policy, not a snapshot guarantee. Tool
descriptions must not imply per-asset filtering.

### A6. Column lineage reflects the last `RdfIndexApp` run

Column-level lineage reaches the graph only through `RdfIndexApp`. A live `PUT /v1/lineage`
projects the table-to-table edge but not its `LineageDetails`, so a new column mapping appears
after the next reindex. This is the normal state of the graph on a running instance and is **not
changed here**. The column lineage section of `docs/rdf-ontology-contract.md` and the
`sparql_query` description state the dependency once. Column FQNs in `om:fromColumn` and
`om:toColumn` are plain string literals, not IRIs; the ontology and shapes currently describe
them as IRIs, which is tracked as a separate follow-up.

### A7. What this amendment does not change

- Default roles and policies (#34253 owns any default grant); §2a opt-in wording is unchanged here.
- `get_entity_lineage` behavior.
- The live-write projection of lineage details.
- Asset-level SPARQL filtering (#33224).
- Public tool descriptions carry data-model facts only (vocabulary, paging, the column-lineage
  query shape). Query-planning or routing strategy for AI agents does not belong in them.

### A8. Evidence to add after implementation

Filled in once the tests have run; the decisions above do not wait on it.

- Authorization matrix results across admin, granted, ungranted, `All`/`All`, granted-plus-deny,
  and bot callers.
- Paging timings for a graph of roughly 5,000 column-lineage nodes through MCP as a non-admin.
- Which integration cases passed locally and which were confirmed only in CI.

## Review log

- 2026-09-16 review 1: design agreed, conditional. Resolved — wildcard authorization (§2a:
  explicit opt-in chosen), admin-access wording (§2a), and resource context construction
  (§2). Operation name `ExecuteSparqlQuery` and inference `none` accepted for the initial
  integration.
- 2026-09-16 review 2: `effectiveScope` removed; fixed scope documented (§1a).
  `projectionVersion` also removed, since no existing signal backs it (§1a). Conservative
  readiness using the existing projection state (§4a). Scope kept to the listed deliverable,
  and expansions flagged (§8).
- 2026-09-16 review 3: **approved to implement** as a scoped first iteration (not approval of
  the eventual code). Final trims: `Impersonate` semantics left unchanged (§2a);
  `projectionState` removed as redundant (§1); vocabulary compatibility documented as not
  signaled (§1a). ai-platform proposal to be reconciled with the dropped fields.

- 2026-09-29 amendment (#34231): default flipped from opt-in to opt-out through Data Consumer
  (§2a). Explicit-name matching unchanged. Accepted risk and the restricted-viewing caveat
  recorded there.

## Open items

- Reconcile ai-platform PR #1310's server proposal with the dropped `effectiveScope`,
  `projectionVersion`, and `projectionState` fields.
- Step 2 assessment (does not block the wire contract): migration, AccessControl UI, and
  default-role impact of the new `MetadataOperation` value.
