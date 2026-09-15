# Asset-level SPARQL RBAC: guided, small-commit plan

## Status and working agreement

**Status: proposal for discussion, not an approved architecture or implementation.**
Prepared from the live issues and checkout `9985a4261b2` on branch
`fmcardoso/add-asset-level-rbac-for-read-only-sparql-querie`.
The working tree was clean before this document was added. No implementation, tests, or commits were made during planning.

Goal: implement [OpenMetadata #33224](https://github.com/open-metadata/OpenMetadata/issues/33224), while you understand every change—not just receive a finished patch.
You own the decisions; the assistant can write the code. You do not need to become a SPARQL or Java expert first.

### How we will work together

For **one commit at a time**:
1. Explain the problem in plain English and introduce only the concepts needed now.
2. Open the relevant existing method(s), trace their inputs and outputs, and explain unfamiliar Java syntax.
3. Show the intended change and a tiny concrete example. Ask for approval before implementation.
4. Write a test that exposes the missing behavior; run it and explain the expected failure. A build/setup failure is not a successful red test.
5. Write the smallest implementation; run the test again. Explain each new method, its caller, and its security responsibility.
6. Review the entire handwritten diff together. For generated files, explain the source schema and generation rather than pretending they were written manually.
7. Show test evidence and limitations; ask you to explain the central idea in your own words, without treating this as an exam.
8. Commit only when you explicitly approve. Record the hash and next step below, then stop.

A commit is one understandable behavior, usually a production change and its test—not one arbitrary file. Aim for roughly 50–150 handwritten lines when practical; split anything hard to review. This is a review aid, not a quota. Never split a security fix so an intermediate commit exposes an unsafe endpoint. Failing tests can exist while working but should not be committed. No unrelated refactors, automatic next-commit execution, bulk staging, skipped hooks, or GitHub mutations.

**Preparation workflow (updated 2026-09-14 at your request):** a Claude Opus worker prepares one change at a time. It writes the change and an evidence report, but does not stage or commit. The coordinator reviews it. You approve before anything is committed or the next change starts. Workers are used only for this prepare/review loop.

## 1. The minimum conceptual foundation

### OpenMetadata and RDF

OpenMetadata stores catalog entities such as tables, dashboards, users, and glossary terms. Its SQL database is the catalog source of truth. RDF is another representation, or **projection**, of some of that metadata, stored in a graph service such as Fuseki. Projection data may lag behind catalog changes.

An RDF **triple** is `(subject, predicate, object)`:

```turtle
<output> om:upstream <source> .
<output> om:name "monthly_report" .
```

- Subject: the thing being described.
- Predicate: a property or relationship.
- Object: another thing, or a literal value such as a string or number.
- IRI: a globally named identifier, often shaped like a URL; it does not mean we should fetch that URL.
- Blank node: an unnamed structured node, for example a nested property record. It still needs ownership/access rules.
- Ontology: the vocabulary describing classes and properties.
- RDF dataset: a default graph plus optional named graphs. A named graph is a container, **not automatically an authorization boundary**.

**RDFS** means RDF Schema. It can describe class/property hierarchies. If `Table` is a subclass of `DataAsset`, a reasoner may infer that a table is a data asset. **OWL** supports richer logical descriptions. Neither grants permissions. Inferring relationships from hidden facts before removing those facts can leak information.

**SPARQL** queries RDF:
- `SELECT`: return rows/bindings; `COUNT`, grouping, and other aggregates summarize them.
- `ASK`: return a boolean indicating whether the pattern has a solution.
- Join: connect patterns through a shared variable.
- Property path: follow a relationship repeatedly, e.g. `om:upstream+` means one or more steps.
- Subquery: a query inside another query.
- `GRAPH`: select a named graph; `FROM` selects a dataset; `SERVICE` contacts another query endpoint.
- `CONSTRUCT`/`DESCRIBE`: return RDF graphs. Read-only does not mean safe for unrestricted callers.

### RBAC in this project

**Authentication** asks “who is calling?” **Authorization** asks “may this caller perform this operation on this resource?”

RBAC means role-based access control, but the actual project policies can also depend on resource properties, ownership, teams, etc. We must use that policy engine, not invent `if role == reader` checks.

```text
Authenticated request → SecurityContext
                     → Authorizer
                     → subject + operation + ResourceContext
                     → policy decision
```

`ResourceContext` supplies the real entity and policy-relevant attributes. `OperationContext` says what operation is requested. `VIEW_ALL` is an existing operation, not a decision we have already selected for all RDF data. We must compare normal entity-read operations and field restrictions before choosing the mapping.

**Important finding:** `SubjectContext.getActivePersona()` explicitly says personas are for personalization and must never be used for access-control decisions. Preserve effective identity and impersonation; do not turn a persona preference into a new grant or deny rule. Any optional query scope must only narrow the authorized dataset and must be specified separately.

### Why checking returned rows is insufficient

Use this fixture throughout the work:

```text
A (visible) → B (hidden) → C (visible)
A (visible) → D (visible)
```

Arrows here mean `om:upstream`, not the visual direction of data production. The ontology contract defines the actual lineage direction.

If we run a count on the full graph and hide rows afterward, the hidden `B` already affected the count. `ASK` can expose its existence without returning its ID. A path from `A` to `C` can reveal hidden connectivity.

Recommended rule: remove inaccessible facts/edges **before** evaluation. In the authorized graph, only `A → D` remains. A graph-matching query for upstream reachability from A cannot reach B or C. An isolated visible C can still appear in a query listing visible assets.

The useful test principle is: **adding or changing hidden-only data must not change a successful visible answer, under the documented projection and inference rules.** This concerns graph-derived answers; a query can echo a caller-supplied IRI via `VALUES` without proving that asset exists. Timing and resource-exhaustion side channels need separate threat-model discussion; do not claim this test proves their absence.

## 2. Verified code map: what exists today

Paths below are repository-relative. Read methods, not whole large files, during each guided session.

| Existing file | What it does / why we care |
| --- | --- |
| `openmetadata-service/src/main/java/org/openmetadata/service/resources/rdf/RdfResource.java` | GET/POST `/v1/rdf/sparql` and the update surface authorize admins. The query helper returns raw SPARQL results, with an inference-warning header where applicable. Preserve these boundaries. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/RdfSparqlService.java` | Admin graph query path: parses reads, applies limits/federation checks, delegates to repository. Not the same implementation as glossary queries. |
| `openmetadata-service/src/main/java/org/openmetadata/service/resources/glossary/GlossaryResource.java` | `queryOntology` checks `VIEW_ALL` on one glossary, then queries its database-primary model. Useful precedent, not asset-wide enforcement. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/OntologySparqlQueryService.java` | Materializes one glossary model and executes Jena against it, optionally applying RDFS/OWL locally. Demonstrates execution over a chosen model. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/OntologySparqlQueryValidator.java` | Parses read queries, rejects external dataset declarations, invokes federation guard, applies result limits. Does not establish asset permissions or a complete asset-safe language profile. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/federation/SparqlFederationGuard.java` | Inspects SERVICE clauses, including explicit subquery recursion. Configured allowlists are not permission checks. Test expression-contained nesting rather than assuming traversal is exhaustive. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/SparqlQueryLimits.java` | 100,000 query characters; default 1,000/max 10,000 rows; 10 MiB output; 30 s timeout. Output bytes are currently checked after a string exists—this alone is not a memory bound. A row limit does not bound aggregate work. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/SparqlQueryExecutionGuard.java` | Global/per-principal concurrency and outer deadline; executes on another thread. Security context/thread-local propagation and effective cancellation require explicit attention. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/RdfRepository.java` | Projection writes, relationships, storage query delegation, inference, dataset lifecycle. Existing inference is not a caller-authorized view. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/storage/RdfStorageInterface.java` | Remote storage boundary. Entity model retrieval exists, but its returned content is not automatically an authorized asset graph. |
| `openmetadata-service/src/main/java/org/openmetadata/service/rdf/translator/JsonLdTranslator.java` | Projects entities and builds entity IRIs. Do not trust arbitrary IRI strings as catalog identities. |
| `openmetadata-service/src/main/java/org/openmetadata/service/security/DefaultAuthorizer.java` | Uses existing policies and resolves effective identity, including impersonation and persona context. |
| `openmetadata-service/src/main/java/org/openmetadata/service/security/policyevaluator/ResourceContext.java` | Lazy entity/policy field resolution, including bulk hydration support. Useful for avoiding one field fetch per entity. |
| `openmetadata-service/src/main/java/org/openmetadata/service/security/policyevaluator/SubjectCache.java` | Existing bounded subject caches and invalidation. A new request-local cache does not make these underlying caches instantly fresh. |
| `openmetadata-spec/src/main/resources/json/schema/api/rdf/sparqlQuery.json` | Existing request schema supports several formats, inference modes, and graph URI options. A restricted endpoint must explicitly reject unsupported values. |
| `openmetadata-spec/src/main/resources/json/schema/api/rdf/sparqlResponse.json` | Standard SELECT/ASK-style bindings; no completeness/error envelope. Preserve RDF term type, datatype and language. |
| `docs/rdf-ontology-contract.md` | Canonical lineage direction, structured extension projection, and stored versus inference-only vocabulary. |

Existing tests to reuse/read: service `OntologySparqlQueryValidatorTest`, `OntologySparqlQueryServiceTest`, `SparqlFederationGuardTest`, resource `RdfResourceTest`; integration `RdfResourceIT`, `GlossaryOntologyExportIT`, `PermissionsResourceIT`, `PolicyResourceIT`, and `ActivePersonaHeaderIT`. Unit tests live under `openmetadata-service/src/test/java/`; integration tests under `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/`.

## 3. Choose the architecture before implementation

> **Feasibility update (commit 01 preparation):** the proposed ADR [`docs/adr/2026-09-14-authorized-sparql.md`](../adr/2026-09-14-authorized-sparql.md) checked A against the source code, without a benchmark or prototype. Asset-wide A is **not yet demonstrated to be production-feasible with existing APIs**; it is also not proven impossible. The gaps:
> - Authorization semantics are undefined for facts written about other entities, for fields, and for structured nodes.
> - No existing API returns a complete, bounded per-asset slice.
> - Inference and dataset reads are not caller- or request-scoped.
> - The documented fixture has about 27M triples, which motivates a benchmark.
>
> The ADR lists extra options, candidate evidence steps, and unresolved decisions. The alternatives below are kept as the original hypothesis.

### A. Bounded, request-local authorized RDF view — original first candidate (see update above)

Resolve catalog identities and current policy decisions, construct a strictly bounded model containing only approved facts, and run Jena against that model. Never run the user query against the unrestricted graph and post-filter.

- Advantage: joins, aggregates and paths naturally share the same authorization semantics; easy to inspect with a tiny fixture.
- Cost: obtaining a complete view can be expensive; entity retrieval alone may miss relationship/structured data. Must cap source reads, memory, and total time, and fail explicitly if the full declared scope cannot be built.
- Main areas: new view/policy adapter in `service/rdf/`, repository/storage retrieval if necessary, new execution service and endpoint.
- Risk: medium/high until ownership, projection consistency, and representative scale are proven.

A bounded **explicit scope** can make this practical, but narrowing an asset-wide request without declaring it would violate the task. If this cannot meet the agreed asset-wide use cases within budget, stop and choose another approach; a toy full-catalog copy is not a production solution.

### B. Authorization-aware dataset adapter / storage-side view

Enforce filtering at every dataset access operation or construct a server-side authorized dataset, then let the query engine operate on it.

- Advantage: potential to handle larger catalogs without copying a full graph per request.
- Cost: must prove every engine operation, graph enumeration, property path, optimized join, and inference path sees only authorized facts; remote Fuseki adds complexity.
- Main areas: storage interface/implementation, query execution and authorization context.
- Risk: high; more engine-specific code and harder to teach/review in small changes.

### C. Restricted query rewriting

Accept a deliberately small SPARQL subset and add authorization constraints before execution.

- Advantage: remote execution and less model copying.
- Cost: guarding visible variables is not sufficient for hidden intermediate path nodes, nested EXISTS, or aggregates. Needs a formal supported subset and comprehensive rejection tests.
- Main areas: validator plus a syntax/algebra rewriter, repository query path.
- Risk: high. Not recommended for the first implementation unless A is infeasible and maintainers accept the limited language contract.

**Approval gate A:** discuss these alternatives with you and confirm a candidate. The commit roadmap below is conditional on A; do not execute it as if approval or feasibility were established.

### Mandatory design decisions for the ADR

Proposed defaults below are discussion inputs, not silently settled requirements:

| Question | Proposed starting position / required proof |
| --- | --- |
| Which facts are visible? | Catalog-resolved assets allowed by existing read policies; an explicit predicate/field permission mapping, owned structured nodes, and trusted vocabulary only. Do not expose every literal because its parent is visible. |
| Relationship permission? | Both endpoints must be visible; additional owners such as pipeline/detail records must pass their own applicable checks. Shared or ambiguous structured-node ownership cannot implicitly grant access. |
| Unknown/stale identifiers? | Exclude unsupported vocabulary only when contractually declared; unexpected missing identity/ownership or inconsistent projection causes a generic projection error rather than a guessed allow. Never reveal the hidden ID in that error. |
| Paths and joins? | Evaluate solely over the authorized view; hidden intermediates do not connect visible endpoints. Test direct, inverse, multi-hop, cycles, and zero-length paths. |
| Supported language? | Initially SELECT and ASK, joins, aggregates and supported subqueries. Reject GRAPH, FROM/FROM NAMED, protocol graph URIs, all SERVICE, updates, CONSTRUCT/DESCRIBE and unapproved extension functions. Examine nested expressions and subqueries. |
| Inference? | Initially `none`, explicitly forced, independent of server defaults. Never reuse globally materialized inferred edges without safe provenance. RDFS/OWL/custom requests get a typed unsupported-query error. Add safe inference later only if required for this issue. |
| Persona? | Preserve validated context for personalization; no persona-based permission changes. Any separate scope intersects permissions and is explicit in the contract. |
| Identity? | Authenticated effective caller, including validated impersonation. No caller-selected username in the JSON body, admin bot fallback, or worker-thread context loss. |
| Permission freshness? | No cross-request authorized-view/result cache initially. Define read/revocation consistency using existing invalidation behavior, including multi-node lag and in-flight requests. Do not promise immediate revocation without evidence. |
| Limits? | End-to-end budget includes authorization, data loading, evaluation and serialization. Bounded pages, entities, triples, bytes, concurrency and cancellation. Overflow while constructing a dataset is a failure, not a partial COUNT/ASK. |
| Projection state? | Pin or otherwise guarantee a consistent serving dataset/version during the request; reject rebuilding/unhealthy/unsupported projections when correctness is unavailable. Read existing health/resolver code before choosing an implementation. |
| Empty vs denied? | Under view semantics, a valid graph lookup that matches no accessible facts returns empty/false. This must not distinguish hidden from nonexistent assets. Invalid identity, forbidden endpoint/scope, and policy-evaluation failure remain errors. |
| API compatibility? | Prefer a separate typed read endpoint, provisionally POST `/v1/rdf/sparql/authorized`; keep legacy admin and glossary media types/semantics unchanged. Final URI and schema names require agreement. |

**Approval gate B:** write the ADR, prove the view-building path with actual projection/storage behavior, agree the cross-repo contract, and review the unresolved decisions before production implementation. There is no implementation deadline that justifies skipping this gate.

## 4. Cross-repo contract to agree early

Companion: [ai-platform #1299](https://github.com/open-metadata/ai-platform/issues/1299), under [epic #224](https://github.com/open-metadata/ai-platform/issues/224). Historical evidence: [PR #1292](https://github.com/open-metadata/ai-platform/pull/1292). Do not assume that evidence PR is merged or that the epic's projection work is finished.

Record a proposed ADR at `docs/adr/2026-09-14-authorized-sparql.md` (new path; confirm maintainer placement), linking this plan, both issues, and the eventual companion ADR. Do not edit ai-platform in this task. Agree its named domain API method and declared types with its owner before enabling integration.

Contract checklist:
- Request: query text, bounded timeout, contract/projection compatibility requirements, and explicit scope only if approved. Identity travels through existing authentication, not request-controlled permissions.
- Success: SELECT bindings or ASK boolean, with unambiguous query kind; preserve IRI/literal/blank-node and literal datatype/language metadata.
- Metadata: contract/projection version, declared dataset scope, effective limits, returned-row count, and completeness reason. Do not expose hidden asset counts or identifiers in diagnostics.
- Completeness: distinguish a caller's query LIMIT from a server safety cap. Define whether “complete” means complete evaluation of the submitted query versus uncapped matches. Use lookahead or another proven method; exactly N rows does not prove truncation. Aggregates evaluate the complete declared authorized dataset, never a prefix. Empty SELECT and ASK=false can be complete successes.
- Error categories: invalid/unsupported query, unauthenticated, forbidden, timeout, capacity, dataset/output limit, projection unavailable/incompatible, and internal failure. Agree stable machine codes and HTTP statuses using existing server exception conventions; prose message parsing is not a contract.
- Safe errors: no policy internals, federation allowlist, restricted identifiers, query text containing sensitive constants, or raw backend stack traces in public responses.
- Retry guidance: validation may be repairable by the agent; authorization is not fixed by escalating credentials; transient projection/capacity failures need bounded retries. Never convert errors to “no results.”

## 5. Conditional small-commit roadmap

### Path shorthand used below

These prefixes expand to exact repository paths; proposed names are explicitly new:
- `RDF/` = `openmetadata-service/src/main/java/org/openmetadata/service/rdf/`
- `RESOURCE/` = `openmetadata-service/src/main/java/org/openmetadata/service/resources/rdf/`
- `TEST/` = `openmetadata-service/src/test/java/org/openmetadata/service/rdf/`
- `IT/` = `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/`
- `SCHEMA/` = `openmetadata-spec/src/main/resources/json/schema/api/rdf/`

Commands `U`, `I`, `F`, and `G` are defined in section 7. For each commit run its named tests plus formatting/build checks as applicable. Add tests in the same slice as behavior, not after opening non-admin access.

### Preparation — no implementation commit

- [ ] Walk through the A/B/C/D example and existing request paths together.
- [ ] Confirm Java 21, Maven and Docker; use `make dev_check`, then the dev-setup skill if needed. Do not create Python environments unless needed for generation/setup.
- [ ] Run baseline unit tests and one RDF integration test; record failures/skips before changing code.
- [ ] Read `docs/design-patterns.md`, `.claude/rules/java.md`, `.claude/rules/schema-first.md`, and the test/verification skills before their corresponding implementation steps.
- [ ] Investigate source model ownership, literal-field restrictions, stored inference provenance, entity enumeration/pagination, active-dataset consistency and resource bounds. Read actual storage and projection mapper implementations; no storage design is approved just by reading their interface.
- [ ] Approve gate A; refine the roadmap if A is not feasible.

### Commit 01 — `docs(rdf): define authorized SPARQL semantics`

**Learn:** authorization is a definition of the input dataset, not a cosmetic filter.
**Files:** new `docs/adr/2026-09-14-authorized-sparql.md` and this plan. The `docs/index.md` entry is deferred until the ADR is approved.
**Changes:** record the **proposed** (not accepted) semantics, source-backed feasibility findings, alternatives, the fixture's expected results, and unresolved decisions. Accepting an architecture and getting owner agreement that the scope meets #33224 happen later, and must not be claimed here.
**Prepared (uncommitted):** Opus drafted the ADR. Extended evidence is in `/tmp/rdf-rbac-33224-commit01-opus-report.md`. Waiting for coordinator review and your approval.
**Verify:** review every decision-table row; `git diff --check`; compare against live acceptance criteria.
**Checkpoint:** can you explain why A→C disappears even though both endpoints are visible?

### Commit 02 — `docs(rdf): specify graph-tool request and result contract`

**Learn:** a stable API tells the agent whether it found nothing or failed to answer.
**Files:** ADR and this plan.
**Changes:** settle endpoint, typed success/error examples, LIMIT semantics, projection compatibility and ai-platform linkage; record actual agreement, or mark it pending and stop before implementation.
**Verify:** manually walk examples for SELECT rows, empty SELECT, ASK=false, denial, timeout, projection failure and truncation. No GitHub posting without approval.
**Checkpoint:** why is a timeout not an empty answer? **Gate B must be satisfied here.**

### Commit 03 — `test(rdf): lock existing SPARQL access boundaries`

**Learn:** regression tests protect existing users while a new path is added.
**Files:** `IT/RdfResourceIT.java`, `IT/GlossaryOntologyExportIT.java` (split into 03a/03b if needed).
**Changes:** add only missing characterization tests: non-admin denied on legacy GET/POST/update; admin still works; glossary authorized/denied behavior and operation/format restrictions unchanged. Use real users and policies, not a NoopAuthorizer.
**Verify:** `I RdfResourceIT`; `I GlossaryOntologyExportIT` in the appropriate isolated lane. Confirm tests actually ran with RDF enabled.
**Checkpoint:** which endpoint, if any, can a non-admin use today?

### Commit 04 — `feat(rdf): define authorized query request schema`

**Learn:** schema-first means Java types are generated from JSON Schemas.
**Files:** new `SCHEMA/authorizedSparqlQuery.json`; generated outputs only through tooling.
**Changes:** encode agreed required fields and constraints. Do not copy graph URI/inference/format options we will not support. Keep existing request schema compatible.
**Verify:** `G`; compile spec and consumers; validate approved/invalid request examples against the schema.
**Checkpoint:** why shouldn't we edit the generated Java class?

### Commit 05 — `feat(rdf): define authorized query outcomes`

**Learn:** typed RDF values and completeness metadata are part of correctness.
**Files:** new `SCHEMA/authorizedSparqlResponse.json` and, if existing errors cannot express the approved contract, `SCHEMA/authorizedSparqlError.json`; reuse/reference `SCHEMA/sparqlResponse.json` where appropriate.
**Changes:** express the approved SELECT/ASK response distinction, metadata and stable errors; preserve term metadata. No endpoint yet.
**Verify:** `G`; schema fixture validation for all contract examples, including rejecting contradictory SELECT/ASK envelopes and missing completeness fields.
**Checkpoint:** distinguish “count is zero” from “count is unknown because the dataset exceeded budget.”

### Commit 06 — `feat(rdf): validate the asset-safe query profile`

**Learn:** parsing builds structured syntax; searching strings is not a security validator.
**Files:** new `RDF/AuthorizedSparqlQueryValidator.java`, `TEST/AuthorizedSparqlQueryValidatorTest.java`; reuse existing validator/guard instead of another parser. Modify shared guard plus `TEST/federation/SparqlFederationGuardTest.java` only if tests expose a shared traversal gap.
**Changes:** enforce the approved SELECT/ASK-only profile, external access restrictions, nested syntax and inference restrictions. Preserve original versus effective LIMIT information. Reject unsupported functions/extensions that could access outside the model. Keep shared glossary behavior intact.
**Verify:** `U AuthorizedSparqlQueryValidatorTest,OntologySparqlQueryValidatorTest,SparqlFederationGuardTest`. Include SERVICE inside EXISTS/NOT EXISTS, subqueries, OPTIONAL/UNION/MINUS and GRAPH nesting, plus harmless keywords in literals/comments.
**Checkpoint:** why does an allowlisted remote endpoint still not belong in this authorized view?

### Commit 07 — `feat(rdf): evaluate asset read permissions with caller context`

**Learn:** subject + operation + real resource attributes produce a decision.
**Files:** new `RDF/RdfAssetAuthorizer.java`, `IT/RdfAssetAuthorizationIT.java`.
**Changes:** adapt the existing Authorizer/ResourceContext path to the approved entity/field mapping; resolve real catalog identity. Treat expected permission denials as exclusions, but propagate authentication, policy-engine and infrastructure failures as errors. Preserve impersonation across worker boundaries without depending on lost thread-locals. Any memoization is request-local and explicitly size-bounded, including misses.
**Verify:** `I RdfAssetAuthorizationIT`: real owner/team/policy allowed/denied cases, missing principal, impersonation rejection, two users with different access. No public non-admin endpoint yet.
**Checkpoint:** why is “catch every exception and return false” wrong?

### Commit 08 — `feat(rdf): build bounded authorized entity facts`

**Learn:** an RDF node and a catalog entity are not always the same thing.
**Files:** new `RDF/AuthorizedRdfDatasetBuilder.java`, `TEST/AuthorizedRdfDatasetBuilderTest.java`, `IT/RdfAssetAuthorizationIT.java`; modify `RDF/RdfRepository.java` and `RDF/storage/RdfStorageInterface.java`/chosen storage implementation only if the approved design needs a bounded retrieval method.
**Changes:** construct a request-local model from the approved source, resolving identities through catalog metadata. Include allowed scalar predicates and owned structured nodes only; exclude sensitive fields. Trust only approved vocabulary, not arbitrary namespace-shaped IRIs. Bound enumeration, parsing and model construction; close resources on every failure. Reject incomplete view construction before any user evaluation.
**Verify:** `U AuthorizedRdfDatasetBuilderTest`; `I RdfAssetAuthorizationIT`. Test nested extension nodes, unknown ownership, malformed/stale IDs, field restrictions and dataset overflow. Compare with real projected triples, not just hand-built RDF.
**Checkpoint:** why can a visible table still contain RDF facts we must not expose?
**Size escape hatch:** split scalar facts, owned nodes, and source retrieval into 08a/08b/08c; each must remain fail-closed for unsupported data and have its own tests.

### Commit 09 — `feat(rdf): authorize relationship endpoints and details`

**Learn:** checking only the subject leaks a hidden object or relationship detail.
**Files:** `RDF/AuthorizedRdfDatasetBuilder.java`, `TEST/AuthorizedRdfDatasetBuilderTest.java`, `IT/RdfAssetAuthorizationIT.java`.
**Changes:** retain edges only under approved endpoint/detail ownership rules; no dangling edges to hidden entities, backreferences, shared-node shortcuts, or globally inferred shortcuts. Verify lineage direction from `docs/rdf-ontology-contract.md`.
**Verify:** unit and integration fixture tests for visible-visible, visible-hidden, hidden-visible, hidden-hidden, inverse edges and pipeline/column detail nodes. Hidden-only mutations leave the visible model unchanged.
**Checkpoint:** inspect the resulting triples together before any SPARQL query is executed.

### Commit 10 — `feat(rdf): execute SELECT over the authorized dataset`

**Learn:** Jena must receive the safe model, not the original repository query surface.
**Files:** new `RDF/AuthorizedSparqlQueryService.java`, `TEST/AuthorizedSparqlQueryServiceTest.java`.
**Changes:** compose validated input → authorized dataset → local Jena evaluation → typed SELECT output. Explicitly disable inference regardless of server defaults. Thread a total deadline through loading/evaluation; close models/executions. Service remains unwired publicly.
**Verify:** `U AuthorizedSparqlQueryServiceTest`: simple selection, empty selection, joins and COUNT on mixed-access fixtures, and failures before execution. Assert actual rows/counts, not only mocked method calls.
**Checkpoint:** point to the exact boundary that prevents hidden B from affecting COUNT.

### Commit 11 — `feat(rdf): support authorized ASK paths and subqueries`

**Learn:** a single bit or aggregate can leak as much as a returned row.
**Files:** `RDF/AuthorizedSparqlQueryService.java`, `TEST/AuthorizedSparqlQueryServiceTest.java` and validator tests as needed.
**Changes:** add ASK serialization; prove supported paths, correlated EXISTS/NOT EXISTS, subqueries, grouping/HAVING, OPTIONAL/MINUS/UNION operate on the same safe model. Unsupported cases remain rejected. If Jena already implements a shape correctly, a test-only commit is appropriate.
**Verify:** `U AuthorizedSparqlQueryServiceTest,AuthorizedSparqlQueryValidatorTest`: A→D reachable, A→C not reachable through B; correct distinct/non-distinct counts; cycles; zero-length paths; graph-access rejection inside subqueries.
**Checkpoint:** predict ASK and COUNT outputs before running tests. Split ASK, paths and subqueries into 11a/11b/11c if review is too large.

### Commit 12 — `feat(rdf): report query completeness and enforce output bounds`

**Learn:** a bounded answer and a complete answer are different concepts.
**Files:** service and its tests; `RDF/SparqlQueryLimits.java` / `RDF/SparqlQueryExecutionGuard.java` and corresponding tests only when reuse requires a shared improvement.
**Changes:** implement agreed lookahead/effective LIMIT behavior, bounded serialization during writing, and request timeout propagation. Keep partial-input COUNT/ASK impossible. Typed failures distinguish output/dataset limit, timeout and capacity. Cancel active storage/Jena work, not only waiting for its thread.
**Verify:** `U AuthorizedSparqlQueryServiceTest` plus touched guard/limits tests: cap−1/cap/cap+1, explicit LIMIT/OFFSET, LIMIT 0, aggregates with many inputs, large literals, slow source and evaluation, cancellation/resource cleanup. Avoid sleep-based timing tests.
**Checkpoint:** why is injecting LIMIT 1000 not a bound on the work needed for COUNT?

### Commit 13 — `test(rdf): enforce permission and projection freshness`

**Learn:** yesterday's permission and today's permission can differ even for the same username.
**Files:** `IT/RdfAssetAuthorizationIT.java`; service/builder; existing subject-cache or projection components only if an evidenced gap requires a fix. Read `RDF/RdfProjectionHealth.java` and `RDF/RdfProjectionStateResolver.java` before changes.
**Changes:** enforce the approved request consistency model; reject unavailable/incompatible projection states; prevent mixing active datasets during promotion. Prove policy, role, team, owner/tag changes follow documented invalidation. Add no new cross-request view cache. If existing invalidation cannot meet the agreed guarantee, stop and revise/fix it before opening access.
**Verify:** `I RdfAssetAuthorizationIT`: grant → query → revoke → query, owner/tag changes, user switch, persona switch (no privilege change), deleted asset, rebuild promotion/failure, and in-flight permission change under the agreed semantics. Test multi-node propagation if that guarantee is claimed; otherwise document its exact limitation.
**Checkpoint:** what freshness guarantee are we actually promising, and which cache layer makes it true?
**Size escape hatch:** separate permission freshness and projection consistency commits.

### Commit 14 — `feat(rdf): expose the authorized read-only query endpoint`

**Learn:** the REST resource is the HTTP boundary, not the place to duplicate query/policy logic.
**Files:** `RESOURCE/RdfResource.java`; new `IT/AuthorizedSparqlResourceIT.java`; schema-defined error mapping placed using existing exception conventions after reviewing them.
**Changes:** wire only the approved typed endpoint to the safe service, with authentication, effective identity, shared admission control and stable errors. Preserve legacy admin GET/POST/update/export/inference boundaries. No catch-and-fallback to unrestricted repository execution. All previously implemented protection must be active on the first reachable non-admin version.
**Verify:** `I AuthorizedSparqlResourceIT,RdfResourceIT,GlossaryOntologyExportIT`: HTTP-level allowed/denied/mixed-access COUNT/ASK/path/subquery tests, persona/impersonation, nested federation rejection, read-only enforcement, empty vs errors and completeness. Run isolated tests in their lane.
**Checkpoint:** trace an entire HTTP request and explain where each kind of failure becomes its response.

### Commit 15 — `test(rdf): validate adversarial queries and operational budgets`

**Learn:** successful happy-path queries are necessary, not sufficient evidence.
**Files:** `IT/AuthorizedSparqlResourceIT.java`, related service tests, ADR, `docs/rdf-scale-validation.md` if adding an applicable reproduction recipe.
**Changes:** complete the acceptance matrix below; exercise representative wide/deep graphs, large authorized scopes, shared structured nodes, repeated requests by different users and cancellation under load. Record budget/latency/memory measurements. Any discovered bug ships with its regression test in a separately explained fix commit.
**Verify:** targeted suites plus representative RDF scale run; no claim of production viability from tiny fixtures alone. Confirm disallowed SERVICE never contacts a controlled external HTTP boundary.
**Checkpoint:** does the chosen architecture still meet the agreed use cases? If not, do not mask failure as completeness or silently narrow scope.

### Commit 16 — `docs(rdf): publish authorized query contract and rollout guidance`

**Files:** ADR, this plan, `docs/index.md`, `docs/rdf-local-development.md` and `docs/rdf-ontology-contract.md` where applicable.
**Changes:** document final examples, error/completeness semantics, supported projection, limits, permission freshness, ai-platform issue/ADR links, verification evidence and rollout/rollback. Rollback disables the new surface; it never routes non-admin traffic to admin execution. No frontend, ingestion connector, broad inference overhaul, or workflow edits are expected.
**Verify:** section 7 full checks; all acceptance rows below linked to actual test methods. Capture any remaining limitations explicitly. Production agent enablement remains blocked until server guarantees and companion contract are validated.
**Checkpoint:** you should be able to explain the end-to-end design using the A/B/C/D example without reading Java.

## 6. Acceptance and security matrix

| Behavior | Expected outcome | Introduced / HTTP proof |
| --- | --- | --- |
| Non-admin permitted asset | Approved fields visible | 07–10 / 14 |
| Hidden asset graph lookup | Empty/false like absent data under view semantics; no hidden-ID diagnostics | 08–11 / 14 |
| Invalid/unauthorized caller or explicit forbidden scope | Typed authentication/authorization failure, not empty | 07 / 14 |
| Mixed joins and relationship endpoints | Hidden participants cannot contribute | 09–11 / 14 |
| Paths through hidden intermediates | No traversal through hidden B, including inverse/cyclic cases | 09, 11 / 14 |
| COUNT, grouping, HAVING | Computed on complete authorized view only | 10–12 / 14 |
| ASK, EXISTS, NOT EXISTS, subqueries | Same view at every nesting level | 06, 11 / 14 |
| GRAPH, FROM, protocol dataset URIs | Typed rejection under proposed initial profile | 06 / 14 |
| SERVICE including expression nesting; updates | Rejected before external I/O or mutation | 06 / 14–15 |
| Inference/default config | Cannot import globally inferred hidden facts | 08–11 / 14 |
| Sensitive literals / structured nodes / edge details | Explicit field/ownership policy, no inheritance of accidental access | 08–09 / 14–15 |
| Permissions change and user switching | Documented freshness; no cross-user view reuse | 13 / 14–15 |
| Persona and bot impersonation | Existing caller authority preserved, persona not a grant | 07, 13 / 14 |
| Projection unavailable, stale identity, dataset promotion | Agreed fail-closed/consistency behavior; no fake empty result | 08, 13 / 14 |
| Result limit / timeout / capacity / oversized input or output | Bounded work with distinct machine signals | 06, 08, 12 / 14–15 |
| Legacy admin and glossary behavior | Unchanged compatibility and protection | 03 / 14 |
| Agent contract | Typed examples, errors, projection metadata and linked ADRs | 02, 04–05, 16 |

## 7. Verification commands and evidence

These are planned commands based on current Maven configuration, **not claims of successful runs**. Confirm setup and test discovery during preparation. No Java/Docker test suite was run to write this plan.

### F — formatting/build checks (each Java commit)

```bash
mvn spotless:apply
mvn spotless:check
git diff --check
```

Read the java-checkstyle skill first. Inspect formatting diffs; do not stage unrelated files. Use Java 21. When compiling/tests need reactor dependencies, use `-am`; do not hand-install random stale module artifacts.

### U — focused service unit tests (repository root)

Replace the example class list with the classes named by the step:

```bash
mvn -pl openmetadata-service -am test \
  -Dtest=OntologySparqlQueryValidatorTest,OntologySparqlQueryServiceTest,SparqlFederationGuardTest \
  -Dsurefire.failIfNoSpecifiedTests=false
```

The last option tolerates upstream modules with no matching tests. It must not hide a misspelled target: inspect `openmetadata-service/target/surefire-reports/` and verify target test counts are nonzero with no unexpected skips.

### I — real RDF integration tests

Read `openmetadata-integration-tests/README.md` and current profile configuration when executing. Docker must run. The current `postgres-rdf-tests` profile enables RDF/Fuseki, PostgreSQL and Elasticsearch.

Build changed reactor dependencies, then select a test in the integration module:

```bash
mvn -pl openmetadata-integration-tests -am install -DskipTests
mvn -pl openmetadata-integration-tests verify -Ppostgres-rdf-tests \
  -Dit.test=RdfResourceIT -DintegrationTests.lane=parallel
```

For `GlossaryOntologyExportIT`, select the isolated lane (`-DintegrationTests.lane=isolated`). Check the profile's includes/excludes when adding a new test; tests mutating global projection/configuration state must not run alongside incompatible tests. Do not alter `.github/workflows/` without explicit authorization.

Inspect `openmetadata-integration-tests/target/failsafe-reports/`: expected class/method counts, no RDF-disabled skips, no swallowed setup failures. The build command with `-DskipTests` prepares dependencies; it is not test evidence.

### G — schema generation

Follow `.claude/rules/schema-first.md` and existing generators. Before Python generation, activate the required venv (create/repair via dev-setup if absent):

```bash
source env/bin/activate
python --version
make generate
mvn -pl openmetadata-spec -am generate-sources
```

Regenerate committed TypeScript artifacts through the documented generator if these schemas produce them; run UI checkstyle if generated UI changes require it. Never hand-edit generated Java/Python/TypeScript. Validate schema fixtures with the repository's schema test tooling selected during commit 04; record the exact command then.

### Final evidence

- Run all changed unit classes, existing glossary/admin/federation/guard regression classes, and the full new API security matrix.
- Run the required RDF integration profile with the correct lanes; inspect reports, not just Maven exit status.
- Obtain changed-class coverage per the repository test-enforcement guidance; target 90%, especially fail-closed branches.
- Record scale/budget/cancellation evidence and any untested multi-node guarantees.
- `git diff --check`, `git status --short`, and review each staged diff before an approved commit.
- No “done” or “secure” claim until evidence supports the specific acceptance criteria.

## 8. Resume log

| Step | Status | Commit / evidence | Decision or next action |
| --- | --- | --- | --- |
| Planning | Draft saved | Source checkout `9985a4261b2`; live #33224/#1299/#224 read | Review alternatives with you; no implementation approved |
| Preparation | Not started | — | Explain safe-view example; choose candidate architecture |
| 01 | Prepared, not committed | Proposed ADR drafted by Opus from reading source at `9985a4261b2`; no tests or builds run; report `/tmp/rdf-rbac-33224-commit01-opus-report.md` | Coordinator review, then your approval. Clarify catalog-wide use cases and choose the next evidence step (authorization semantics, retrieval prototype, benchmark) before commit 02 |
| 01 research | Prepared, not committed | [`docs/rdf-authorization-research.md`](../rdf-authorization-research.md): one web pass over Jena 6.2.0 source, Fuseki docs, and W3C specs; no code or builds | User decisions recorded in the ADR ("Decisions accepted by the user"). Simplest candidate: a request-local sanitized model (not proven secure; adapter variants need separate proof). The next step is the proposed minimal experiment, which needs your approval |
| 02–16 | Not started | — | Expand/update one commit at a time after approval |

**First question for our next session:** after walking through the proposed ADR's A/B/C/D example and findings, which #33224 use cases need catalog-wide evaluation? And which evidence should come first: authorization semantics for facts, fields and structured nodes, or a retrieval prototype and benchmark? All existing admin boundaries stay intact.
