# Plan: permissioned read-only SPARQL execution for the 2.1 graph agent tool

- **Status:** Approved to implement as a scoped first iteration (2026-09-16). Decisions recorded in
  `docs/adr/2026-09-16-agent-sparql-execution.md` (ADR wins where they differ).
- **Date:** 2026-09-16
- **Issue:** [OpenMetadata #33384](https://github.com/open-metadata/OpenMetadata/issues/33384)
  (`gh issue view 33384 --json title,body,labels,assignees,milestone,url,state`)
- **Branch:** `fmcardoso/add-permissioned-read-only-sparql-execution-for` (empty — at main
  tip, clean tree, no PR; verified via `git log main..HEAD` and `gh pr view`)
- **Assignee / milestone:** fmcardoso / Wave 3 – 2.1 (Sep 7 – Oct 16)
- **Parent epic:** [ai-platform #224](https://github.com/open-metadata/ai-platform/issues/224)
- **Companion:** [ai-platform #1299](https://github.com/open-metadata/ai-platform/issues/1299)
  (agent tool), [ai-platform PR #1310](https://github.com/open-metadata/ai-platform/pull/1310)
  (architecture/design, OPEN, `make verify` green at `0056ceb9`)
- **Reviewed baseline (pinned to ai-platform `0056ceb9`, fetched via `gh api .../contents/...?ref=0056ceb9`):**
  - `docs/plans/1299-openmetadata-server-proposal.md` — the server contract proposal
  - `docs/plans/1299-sparql-graph-tool-implementation-plan.md`
  - `docs/decisions/2026-09-15-graph-query-authoring-lives-in-the-worker-and-execution-on-the-server.md`
    (Accepted: worker authors SELECT, server owns execution; asset-level RBAC parallel, not gating)
- **Explicitly NOT a blocker / out of scope:** [OpenMetadata #33224](https://github.com/open-metadata/OpenMetadata/issues/33224)
  (asset-level RBAC). This ticket must document the *absence* of asset-level filtering, never
  claim it. Do not port the sibling branch
  `fmcardoso/add-asset-level-rbac-for-read-only-sparql-querie` prototype here — it targets
  #33224's pre-evaluation filtering, which is out of scope.
- **Note:** `PR_DESCRIPTION.md` in this worktree is stale (incident-manager #30151 text) — ignore it.

## 1. Problem and goal

The model-authored SPARQL graph tool needs a permissioned, read-only, bounded server execution
surface for lineage, relationship filtering, and traversal aggregation. The existing
`POST /api/v1/rdf/sparql` is an administrator surface (`authorizer.authorizeAdmin` in
`openmetadata-service/src/main/java/org/openmetadata/service/resources/rdf/RdfResource.java:1237,1269`);
the agent must not bypass it with elevated credentials or by dropping caller impersonation.

This ticket implements **server execution and its contract tests only** — not the ai-platform
tool, not LLM query generation. Existing admin/UI behavior must remain backward-compatible.

## 2. Contract to implement (from #33384 + pinned server proposal)

### 2.1 Endpoint

```http
POST /api/v1/rdf/sparql/agent
Content-Type: application/json
Accept: application/json
```

- Request schema `AgentSparqlQuery`: **only `query`** (SPARQL text). No body fields for
  identity, credentials, arbitrary dataset/graph URI, or protective-limit overrides.
- Explicit SPARQL `LIMIT`/`OFFSET` remain query semantics, subject to server maxima.
- Authorize a **dedicated RDF-query operation** for the effective caller. Do NOT reuse
  `authorizeAdmin`; do NOT substitute `VIEW_ALL` without an explicit operation/policy mapping.
- Keep `GET/POST /v1/rdf/sparql` and `/v1/rdf/sparql/update` admin-only and unchanged.

### 2.2 Effective caller and audit identity

CAIP sends a bot JWT in `Authorization` and the requested user in `X-Impersonate-User`.

- Validate impersonation with existing server rules **before** authorization/execution:
  `JwtFilter.IMPERSONATE_USER_HEADER` (`security/JwtFilter.java:89,200-231`),
  `ImpersonationAuthorizer` (bot must hold the impersonation grant), `DefaultAuthorizer`
  subject resolution. Gate behavior on `CatalogSecurityContext.impersonatedUser()` — a
  non-null `ImpersonationContext.getImpersonatedBy()` alone does NOT mean an authorized
  session (`security/ImpersonationContext.java:5-13`).
- Use the **validated effective caller** for permissions and per-user execution concurrency.
- Retain **both** authenticated service actor and effective caller in audit records.
- Reject invalid/untrusted impersonation; **never fall back to the bot's privileges**.
- Without the header, the authenticated actor is the effective caller and must independently
  hold the endpoint permission.

### 2.3 Query profile (parsed-tree inspection, never regex)

Reuse `RdfSparqlService`, `SparqlFederationGuard`, `SparqlQueryExecutionGuard`,
`SparqlQueryLimits`. Do not create a second executor.

- Accept **SELECT only**, including aggregates and supported subqueries.
- Reject ASK, CONSTRUCT, DESCRIBE, UPDATE, `SERVICE`/federation, `FROM`, `FROM NAMED`,
  constant **and** variable `GRAPH` — inspecting the parsed query tree **including nested
  forms** (subqueries, EXISTS/NOT EXISTS, aggregates, ORDER BY expressions).
- Note: `RdfSparqlService.java:116-123` currently accepts SELECT/ASK/CONSTRUCT/DESCRIBE —
  the agent path narrows this without changing the admin path.
- Fixed scope (ADR §1a): the server-configured dataset/default graph only; query-level graph
  selection prohibited; no persona filtering, no asset-level RBAC. Inference forced to `none`
  (no-inference execution path). Relevance/persona scope must NOT be presented as authorization.
- Conservative readiness (ADR §4a): existing `RdfProjectionStateResolver` state; execute only
  on `READY`; `REBUILDING`/`DEGRADED`/unresolvable → 503 `PROJECTION_NOT_READY`; re-check
  before returning success and discard results if not `READY`; repository disabled/circuit
  open/connect failure stays `RDF_REPOSITORY_UNAVAILABLE`. Rebuilds block the endpoint (v1).
  Not a snapshot-consistency guarantee. No blue/green, generation pinning, or rebuild work.

### 2.4 Typed results, limits, completeness

New schemas + generated models; response preserves URI, blank-node, literal
datatype/language, and unbound-value semantics, plus bounded metadata:

```json
{ "head": {...}, "results": {"bindings": [...]},
  "metadata": {
    "completeness": {"status": "COMPLETE|TRUNCATED|UNKNOWN", "relativeTo": "SUBMITTED_QUERY", "reason": null},
    "effectiveLimits": {"serverRowLimit": 1000, "explicitQueryLimit": 10, "outputBytesLimit": 10485760}} }
```

- `effectiveScope`, `projectionVersion`, and `projectionState` from the ai-platform proposal
  are deliberately omitted (ADR §1, §1a). Readiness does not establish RDF vocabulary
  compatibility; the companion relies on the documented vocabulary.
- Successful empty bindings ≠ failure.
- Completeness is relative to the **submitted query** (`LIMIT 10` succeeding is COMPLETE for
  those ten rows — no claim about an 11th row).
- Preserve `OFFSET` and limits inside aggregate-producing subqueries.
- Outer result without explicit limit → **overflow probe**: exactly 1,000 rows is COMPLETE
  only if no 1,001st row exists; overflow → HTTP 200 with `TRUNCATED` / `SERVER_ROW_LIMIT`.
- Never alter subquery/aggregate semantics to probe; return `UNKNOWN` when unprovable.
- Explicit limits above the server maximum → rejected. Protective outer limit applies
  **after** OFFSET.
- Response exceeding 10 MiB → structured error, **no partial body / cut-off JSON**.
- Retain ceilings unless measurement + decision record justify change: 100,000 query chars,
  1,000 default outer rows, 10,000 max explicit/protective rows, 10 MiB output, 30 s,
  8 global / 2 per-effective-caller concurrent executions. Row limits do not bound aggregate
  input work — execution guards stay mandatory.

### 2.5 Stable failure contract

`{code, message, requestId}` with safe diagnostics (no credentials, no backend/query
internals). Shared HTTP statuses must not collapse distinct machine-readable codes:

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `QUERY_INVALID` | malformed request / invalid SPARQL |
| 400 | `QUERY_FORM_NOT_ALLOWED` | ASK, CONSTRUCT, DESCRIBE, UPDATE, unsupported form |
| 400 | `GRAPH_SELECTION_NOT_ALLOWED` | FROM, FROM NAMED, GRAPH at any query level |
| 400 | `QUERY_LIMIT_EXCEEDED` | explicit limit above server maximum |
| 401 | `AUTHENTICATION_REQUIRED` | missing / invalid bot authentication |
| 403 | `RDF_QUERY_FORBIDDEN` | effective caller lacks the dedicated permission |
| 403 | `IMPERSONATION_NOT_ALLOWED` | invalid / unauthorized X-Impersonate-User |
| 403 | `FEDERATION_NOT_ALLOWED` | SERVICE / federation policy violation |
| 429 | `EXECUTION_CAPACITY_EXHAUSTED` | global or per-caller capacity exhausted |
| 413 | `RESULT_OUTPUT_LIMIT_EXCEEDED` | complete result exceeds output byte ceiling |
| 503 | `EXECUTION_TIMEOUT` | exceeded execution deadline |
| 503 | `RDF_REPOSITORY_UNAVAILABLE` | RDF repository unavailable |
| 503 | `PROJECTION_NOT_READY` | projection unavailable / incompatible |
| 500 | `RDF_BACKEND_FAILURE` | unexpected backend failure |

`TRUNCATED` row results are valid HTTP 200, not errors.

### 2.6 Pre-resource failures need endpoint-scoped mapping (not resource-local)

`AUTHENTICATION_REQUIRED` and `IMPERSONATION_NOT_ALLOWED` can fire **before**
`RdfResource` executes, so a resource-local mapper alone cannot satisfy the contract:

- `JwtFilter.java:204-210` throws `AuthorizationException` (non-bot impersonation attempt)
  and `resolveImpersonationTarget` (`JwtFilter.java:254-264`) throws `AuthenticationException`
  for a **nonexistent impersonation target** — the contract wants both impersonation cases
  as 403 `IMPERSONATION_NOT_ALLOWED`, which differs from current behavior (record the change
  in the ADR).
- `CatalogGenericExceptionMapper.java:69-72,109-118` renders these as the existing
  Dropwizard `ErrorMessage` envelope (`{code, message}` HTTP-status-shaped), not the
  `{code, message, requestId}` stable-code envelope from §2.5.
- Strategy must be **endpoint-scoped**: translate only for the agent path (e.g. a
  path-aware translation layer or an agent-path-specific mapper with precedence over the
  generic one), preserving every other endpoint's current responses byte-for-byte.
- Deserialization failures (malformed JSON body) land in the same pre-resource bucket and
  must map to `QUERY_INVALID`, not a generic 400.
- Tests go through **actual HTTP requests** in the IT: missing JWT, invalid JWT,
  nonexistent impersonation target, denied impersonation, non-bot impersonation attempt.

## 3. Implementation steps (one reviewable commit each; stop at gates)

### Step 1 — Recheck + ADR (GATE: no schemas/code before this is recorded)

- Re-verify against this branch: `RdfResource` admin methods, `RdfSparqlService` parse path,
  guard/limit ceilings, `JwtFilter`/`ImpersonationAuthorizer`/`DefaultAuthorizer` flow.
- Settle the operation/policy-mapping seam: `MetadataOperation` is generated from
  `openmetadata-spec/src/main/resources/json/schema/entity/policies/accessControl/resourceDescriptor.json`
  (`definitions.operation` → `org.openmetadata.schema.type.MetadataOperation`), whose enum
  currently has **no RDF/SPARQL query operation** — so a dedicated operation means adding an
  enum value (a schema change: check policy-migration, `AccessControl` UI, and default-role
  implications) versus explicitly justifying reuse. Record the choice and its rollout.
- Write `docs/adr/<date>-agent-sparql-execution.md`: endpoint, operation/policy mapping,
  fixed dataset/default-graph scope (no `effectiveScope`), inference policy, conservative
  projection readiness, and the **explicit no-asset-level-authz
  limitation**. Reconcile deviations from the pinned proposal with the companion owner
  (ai-platform PR #1310). Per issue §"Reviewed design baseline", the proposed API is not
  yet a deployed contract.
- Verify: full read-through of the ADR against #33384 acceptance criteria; `git diff --check`.

### Step 2 — Schemas (schema-first)

- New `openmetadata-spec/src/main/resources/json/schema/api/rdf/agentSparqlQuery.json`,
  `agentSparqlResponse.json` (+ error envelope only if existing types can't express §2.5).
- Regenerate via `make generate` (+ `mvn -pl openmetadata-spec -am generate-sources`);
  never hand-edit generated Java/Python/TS. Validate approved/invalid examples against schemas.
- Verify: schema fixture validation for SELECT success, empty bindings, TRUNCATED, UNKNOWN,
  and each error code; existing admin schemas byte-identical.

### Step 3 — Query-profile validator

- New `openmetadata-service/.../rdf/AgentSparqlQueryValidator.java`: Jena parsed-query +
  algebra walk rejecting §2.3 forms at every nesting level (subqueries, EXISTS/NOT EXISTS,
  GRAPH/FROM/SERVICE nesting, extension/property functions, `CALL`).
- New `openmetadata-service/src/test/java/.../rdf/AgentSparqlQueryValidatorTest.java`:
  allowed SELECT/aggregate/subquery shapes pass; every rejected form fails **including
  nested placements**; harmless keywords in literals/comments pass.
- Verify: `mvn -pl openmetadata-service -am test -Dtest=AgentSparqlQueryValidatorTest,...`
  plus existing `OntologySparqlQueryValidatorTest,SparqlFederationGuardTest` (no shared-behavior
  regression); `mvn spotless:check`.

### Step 4 — Endpoint + authorization + audit

- `RdfResource`: new `POST /sparql/agent` wired to the shared `RdfSparqlService`/guards.
  Authenticate → validate impersonation (existing rules) → authorize dedicated operation as
  **effective caller** → execute with per-effective-caller concurrency (resolve identity
  **before** submitting to guard threads; `SubjectContext.getActivePersona` never for authz).
  Dual-identity audit (service actor + effective user). No request-controlled identity, no
  admin fallback, no second executor. Admin endpoints untouched.
- **Preserve submitted-query semantics before protective rewriting.** `RdfSparqlService`
  `parseReadOnlyQuery` calls `SparqlQueryLimits.applyResultLimit` and `ReadQuery.parse`
  then stores the **rewritten** query (`RdfSparqlService.java:106-147`) — an originally
  unlimited query already looks like `LIMIT 1000`, destroying the explicit-vs-absent
  distinction that overflow detection (`explicitQueryLimit` metadata, §2.4 probe) depends
  on. Capture the submitted LIMIT/OFFSET (present/absent/value) **before** protective
  rewriting, and introduce the agent execution profile (SELECT-only, no graph selection,
  agent limits) **through the shared service** (e.g. a profile parameter on the shared
  read path), not as a forked executor and without changing admin behavior.
- Readiness (ADR §4a): check `projectionStateSupplier` before execution and again before
  returning success; tests for READY, REBUILDING, DEGRADED, resolver exception, READY→DEGRADED
  discard, and RDF-disabled → `RDF_REPOSITORY_UNAVAILABLE` (distinct code).
- Dual-identity audit is a structured server log event (requestId, service actor, effective
  user, outcome code, row count, duration; no query text) — not a persisted audit-log record
  (ADR §3, §8).
- Wire the §2.6 endpoint-scoped error mapping for pre-resource failures; the resource
  method alone cannot produce `AUTHENTICATION_REQUIRED` / `IMPERSONATION_NOT_ALLOWED`
  for filter-stage rejections.
- Verify: new `IT/AgentSparqlResourceIT.java` (or `AuthorizedSparqlResourceIT`) — permitted
  ordinary caller succeeds; unauthorized effective caller 403 `RDF_QUERY_FORBIDDEN`;
  bot-JWT + valid/trusted `X-Impersonate-User` attributes to the effective user (authz,
  per-user concurrency, audit shows both); untrusted impersonation 403
  `IMPERSONATION_NOT_ALLOWED` with no bot-privilege fallback; no-header call authorized as
  the actor itself. Explicit opt-in (ADR §2a): wildcard-only `All`/`All` caller 403;
  explicit grant 200; explicit grant + named/wildcard deny 403; admin with no grant 200;
  permissions API agrees; `CompiledRule` allow-vs-deny unit test for `ExecuteSparqlQuery`
  and a regression test that `Impersonate` matching is unchanged.
  Run in the correct IT lane with `postgres-rdf-tests` profile; inspect
  failsafe reports (counts, no RDF-disabled skips).

### Step 5 — Completeness + output bounds + error mapping

- Overflow probe for unbounded outer results (1000 vs 1001); `UNKNOWN` when probing would
  change semantics; protective limit after OFFSET; over-max explicit limit rejected;
  byte-ceiling enforced during serialization (error, never partial JSON); stable §2.5
  code→HTTP mapper.
- **Bounded serialization requires a refactor below the endpoint wrapper, not around it.**
  `RdfSparqlService.directQuery` (`RdfSparqlService.java:97-100`) receives a fully
  materialized result string and checks its size afterward — wrapping that call cannot
  bound memory, and once HTTP 200 headers commit, overflow can no longer become a
  structured error. Plan an explicit shared result-production change: serialize the agent
  response (full envelope — bindings **plus** head/metadata, not bindings alone) and check
  the serialized size **before** committing headers, returning `RESULT_OUTPUT_LIMIT_EXCEEDED`
  when the envelope exceeds 10 MiB. Serialization memory itself is not bounded (ADR §5).
  Keep the admin path's behavior unchanged; if the
  refactor must touch shared code, cover it with the existing admin regression tests.
  **v1 scope (ADR §5, §8):** the storage layer's materialized result and existing
  `requireBoundedOutput` check stay; no streaming/memory-bounded storage refactor.
- Profile tests from Step 3 must run through the **real shared service path** (agent
  profile via `RdfSparqlService`), proving the executed query is the validated, bounded
  one — validator-only tests are insufficient.
- Boundary tests: explicit `LIMIT 10`, exactly-1000 vs 1001 unbounded rows, over-maximum,
  `OFFSET`, subquery/aggregate limit preservation, output-byte exhaustion without partial
  JSON, timeout/capacity/unavailable/incompatible-projection/backend-failure codes.

### Step 6 — Fixture + regression coverage, docs, draft PR

- Known-fixture tests: empty results, joins, aggregates, typed bindings
  (URI/bnode/datatype/language/unbound).
- Regression: existing admin/UI RDF behavior (`RdfResourceIT`, glossary ontology tests)
  green and backward-compatible.
- Docs: exposed dataset, inference/projection behavior, endpoint permission, and the honest
  absence of asset-level authorization.
- Open companion **draft** PR linking #33384, ai-platform #1299, epic #224, design PR #1310
  with exact verification results and any checks not run. Human merge only.

## 4. Acceptance mapping (from #33384 — all must be demonstrably met; see §7 for evidence)

- [x] Schemas + OpenAPI published for `KnowledgeGraphApi.executeQuery` (Steps 2, 6;
  TS types via the `typescript-type-generation` workflow, pending bot commit)
- [x] Permitted ordinary caller executes; unauthorized rejected (Step 4)
- [x] Bot-JWT + `X-Impersonate-User` tests: effective-user authz, per-user concurrency,
  dual audit attribution, untrusted rejection (Step 4)
- [x] Pre-resource failures (missing/invalid JWT, nonexistent/denied/non-bot impersonation,
  malformed body) return stable §2.5 codes via actual HTTP, other endpoints unchanged
  (Steps 4, 6)
- [x] Admin/UI regression coverage, backward-compatible (Step 6; one baseline-reproduced
  error — `RdfResourceIT.testForeignKeyReferencesInRdf` fails identically on clean main)
- [x] Parsed-query rejection incl. nested forms (Step 3)
- [x] Fixture tests: empty, joins, aggregates, typed bindings (Step 6)
- [x] Boundaries: LIMIT 10, 1000-vs-1001, over-max, OFFSET, subquery limits, output
  exhaustion without partial JSON (Step 5)
- [x] Timeout/capacity/unavailable/incompatible/failure + stable codes (Step 5)
- [x] Submitted-vs-protective limit distinction preserved through the shared service;
  serialized size checked before headers commit, memory not bounded per ADR §5 (Steps 4–5)
- [x] Docs: fixed server-controlled dataset, no graph selection, inference `none`,
  conservative readiness (not snapshot consistency), permission, NO persona/asset-level
  authz (Step 6)
- [x] Readiness: non-READY → 503 `PROJECTION_NOT_READY`, post-execution re-check discards
  results, repository unavailability distinct (Step 4)
- [x] Leakage tests stay conditional on #33224 — out of scope here
- [x] Wire contract + limitation in an OM decision record (Step 1)
- [x] Draft PR with links + exact verification (Step 6; #33428, draft)

## 5. Verification commands (original plan; executed variants with results are in §7)

```bash
mvn spotless:apply && mvn spotless:check && git diff --check
mvn -pl openmetadata-service -am test -Dtest=AgentSparqlQueryValidatorTest -Dsurefire.failIfNoSpecifiedTests=false
source env/bin/activate && make generate && mvn -pl openmetadata-spec -am generate-sources
mvn -pl openmetadata-integration-tests -am install -DskipTests
mvn -pl openmetadata-integration-tests verify -Ppostgres-rdf-tests -Dit.test=AgentSparqlResourceIT
```

Inspect `target/surefire-reports` / `target/failsafe-reports` (nonzero counts, no unexpected
skips); target 90% changed-class coverage; record scale/latency evidence where applicable.

## 7. Verification results (2026-09-16)

Proposed checked-in configuration — `openmetadata-integration-tests/pom.xml` no longer pins an
image, so `postgres-rdf-tests` builds the supported `docker/rdf-store` image (Fuseki 6.2.0).
All runs below use `-Ppostgres-rdf-tests` with no pom override.

Executed commands (offline mode; `mvn -o` throughout):

```bash
# Unit lane (JaCoCo override disclosed: 0.8.10 pinned via jacoco-plugin.version is not
# in the local repository, so every coverage run below adds -Djacoco-plugin.version=0.8.13)
mvn -o -pl openmetadata-service test -P static-code-analysis -Djacoco-plugin.version=0.8.13 \
  -Dtest='org.openmetadata.service.security.**.*Test, org.openmetadata.service.rdf.**.*Test, \
  org.openmetadata.service.resources.rdf.**.*Test, org.openmetadata.service.exception.**.*Test' \
  -Dsurefire.failIfNoSpecifiedTests=false -DfailIfNoTests=false
# Contract IT (single lane; -DintegrationTests.skipIsolated=true avoids running the class
# once per failsafe execution, since -Dit.test overrides both executions' includes)
mvn -o -pl openmetadata-integration-tests verify -Ppostgres-rdf-tests \
  -DintegrationTests.skipIsolated=true -Dit.test=AgentSparqlResourceIT \
  -Dfailsafe.failIfNoSpecifiedTests=false -DfailIfNoTests=false
# Regression lane, same profile (class list in -Dit.test, same skipIsolated flag)
mvn -o -pl openmetadata-integration-tests verify -Ppostgres-rdf-tests \
  -DintegrationTests.skipIsolated=true \
  -Dit.test='RdfResourceIT,RdfGlossaryGraphIT,GlossaryTermRelationIT,GlossaryTermRelationFixesIT,GlossaryRdfImportIT' \
  -Dfailsafe.failIfNoSpecifiedTests=false -DfailIfNoTests=false
```

- `AgentSparqlResourceIT`: **18/18 pass** (`BUILD SUCCESS`; failsafe report
  `TEST-org.openmetadata.it.tests.AgentSparqlResourceIT.xml`, 0 skipped). Covers the
  permitted/unauthorized matrix, bot-JWT + `X-Impersonate-User` attribution to the effective
  user, dual-identity audit (`serviceActor=<bot> effectiveUser=<user>` in
  `AgentSparqlAudit`), a deleted-user token mapping to 401 `AUTHENTICATION_REQUIRED`
  (unknown caller, not `QUERY_INVALID`), per-effective-user concurrency (guard quota keyed by effective user:
  the same user shares one quota across callers, while users on different stripes are
  independent — unit-proven in `SparqlQueryExecutionGuardTest` plus the forwarding
  assertion in `AgentSparqlServiceTest`). Limitation: the guard stripes 64 hash buckets
  over 2-permit semaphores, so two different users can collide on one stripe and share
  it; no guard redesign in this ticket. Pre-resource 401/403 mapping with the neighboring admin
  endpoint's `ErrorMessage` shape unchanged, parsed-query rejections, fixture
  joins/aggregates/typed bindings, LIMIT/OFFSET/completeness boundaries, and readiness
  transitions.
- Unit lane `security.**`, `rdf.**`, `resources/rdf/**`, `exception.**`: **1613/1613 pass**.
  New classes measure 94–100% line coverage; every touched shared-code line is covered by a
  unit test except the `JwtFilter`/`ImpersonationAuthorizer` throw-type swaps, which are
  covered by the impersonation IT cases instead. Operation matching lives in one shared
  static (`CompiledRule.operationMatches`) used by enforcement and the permission-debug
  tool alike.
- Regression lane on the same profile: `GlossaryRdfImportIT` 33/33,
  `GlossaryTermRelationFixesIT` 14/14, `GlossaryTermRelationIT` 5/5,
  `RdfGlossaryGraphIT` 11/11, `RdfResourceIT` 9/10 — i.e. **one baseline-reproduced error**,
  not a green lane. `RdfResourceIT.testForeignKeyReferencesInRdf` (15 s awaitility on the
  async FK triple) fails identically on clean main with the repo image (evidence below),
  so it is pre-existing/environmental and unrelated to this branch. It could never pass
  on the old stock-image pin, where every SPARQL update 405s.
- `mvn spotless:check` clean for `openmetadata-service` and
  `openmetadata-integration-tests`. The `SapBw4Hana` javaEnum message during spec
  generation is pre-existing noise.

### Baseline failure evidence (`testForeignKeyReferencesInRdf` on clean main)

- Main SHA: `cf3fd2871f` (`feat(alerts): let a consumer record its own deliveries (#33127)`),
  checked out detached as a throwaway worktree (removed after verification).
- Exact reproduction (workdir `/tmp/om-main`, since removed):
  ```bash
  git worktree add --detach /tmp/om-main main
  sed -i "" "/<rdfContainerImage>secoresearch\/fuseki:5.5.0<\/rdfContainerImage>/d" \
    openmetadata-integration-tests/pom.xml
  mvn -o -q -pl openmetadata-service -am install -DskipTests
  mvn -o -pl openmetadata-integration-tests verify -Ppostgres-rdf-tests \
    -DintegrationTests.skipIsolated=true -Dit.test='RdfResourceIT#testForeignKeyReferencesInRdf' \
    -Dfailsafe.failIfNoSpecifiedTests=false -DfailIfNoTests=false
  ```
  The `sed` line only mirrors this branch's committed profile fix inside the throwaway
  worktree; main itself is untouched.
- Observed: `Tests run: 1, Failures: 0, Errors: 1` — the same
  `ConditionTimeoutException` (`FOREIGN_KEY constraint should produce direct om:references
  triple ... within 15 seconds`, `RdfResourceIT.java:318`), `BUILD FAILURE`.
- Surviving log: `/tmp/it-main-fk.log` (full Maven log: service install exit 0, IT exit 1,
  stack trace included). The worktree-local failsafe XML went away with the removed
  worktree; re-running the block above reproduces it.

## 6. Risks and open decisions (for the ADR, Step 1)

1. ~~`effectiveScope`: stable identifier vs structured object~~ — resolved, see 8.
2. Dedicated operation = new `MetadataOperation` enum value in `resourceDescriptor.json`
   (`definitions.operation`; provenance confirmed — no discovery step needed). Settle
   policy-migration, AccessControl UI, and default-role implications in the ADR.
3. Endpoint-scoped error translation for filter/deserialization failures must not alter
   any other endpoint's `ErrorMessage` responses — needs a precedence/path-scoping design
   plus a no-diff regression check on neighboring endpoints; note the behavior change of
   nonexistent-target (auth error today → `IMPERSONATION_NOT_ALLOWED`).
4. ~~Projection readiness during in-place rebuild vs blue/green promotion~~ — resolved, see 8.
   Multi-read/snapshot consistency explicitly not guaranteed (ADR §4a).
5. Per-effective-caller guard keying under impersonation (identity before thread handoff).
6. Bounded response serialization before header commit; admin path byte-identical (Step 6
   regression). Storage-layer streaming is out of scope (ADR §8).
7. Wildcard policies (`All` on `All`) would silently grant the new operation — resolved in
   ADR §2a: explicit-allow/wildcard-deny matching for `ExecuteSparqlQuery` only;
   `Impersonate` semantics unchanged (broader tightening tracked separately). Use a singleton RDF resource context, not
   `new ResourceContext<>("rdf")` (throws: no entity repository).
8. `effectiveScope` — resolved: removed (ADR §1a); `projectionVersion` removed too (no
   existing signal). Projection readiness — resolved: conservative before/after check on the
   existing state (ADR §4a). Remaining ADR gate: reviewer approval + ai-platform owner
   acknowledging the field removals.
9. Scope expansions flagged, not in this ticket (ADR §8): scope metadata, projection
   version/blue-green/pinning/snapshot consistency, persisted read-audit, streaming storage
   results, asset/persona filtering.
10. `PR_DESCRIPTION.md` staleness — rewrite at PR creation from this plan, not from that file.
