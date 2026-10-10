# ADR: Authorized read-only SPARQL for non-admin callers

- **Status:** Proposed. Not accepted. No cross-repo agreement has been reached.
- **Date:** 2026-09-14
- **Issue:** [OpenMetadata #33224](https://github.com/open-metadata/OpenMetadata/issues/33224)
- **Blocks:** [ai-platform #1299](https://github.com/open-metadata/ai-platform/issues/1299) (epic [#224](https://github.com/open-metadata/ai-platform/issues/224)). No companion ai-platform ADR was located or verified in this preparation.
- **Evidence:** Based on reading source at `9985a4261b2`. No tests, builds, benchmarks, or prototypes were run.
- **Research:** [docs/rdf-authorization-research.md](../rdf-authorization-research.md) covers Jena/Fuseki facilities, a version matrix, the simplest candidate, and a proposed experiment.

## Context

`GET`/`POST /v1/rdf/sparql` call `authorizer.authorizeAdmin` (`RdfResource.querySparqlGet`, `querySparqlPost`). The only non-admin SPARQL surface is `GlossaryResource.queryOntology`. It checks `VIEW_ALL` on a single glossary, then runs Jena over a model materialized from the database for that glossary. #33224 asks for non-admin queries across assets, limited to what the caller may see.

Filtering the final rows is not enough. `COUNT`, `ASK`, `EXISTS`, and property paths can reveal a hidden asset without returning its IRI. Authorization therefore has to decide **which facts the query can see before it runs**.

## Tiny example (used throughout)

`om:upstream` points from an output to its source (`docs/rdf-ontology-contract.md`). The caller may see A, C, and D, but not B.

```turtle
<A> om:upstream <B> .   <B> om:upstream <C> .   <A> om:upstream <D> .
<B> rdfs:label "secret_b" .   # written by A's projection, see finding F1
```

Expected answers if the caller's query runs over an authorized view:

| Query | Unrestricted graph | Authorized view |
| --- | --- | --- |
| `SELECT (COUNT(?x) AS ?n) { <A> om:upstream ?x }` | 2 | **1** (D) |
| `ASK { <A> om:upstream+ <C> }` | true | **false**: hidden B does not connect A and C |
| `SELECT ?l { ?x rdfs:label ?l }` | includes `secret_b` | **excludes** `secret_b` |
| `SELECT ?x { ?x a om:Table }` (if all are tables) | A B C D | A C D. Isolated C is still visible |

Test principle: if a change touches only hidden data, a successful visible answer must not change.

## Feasibility findings (from source)

Details, including file and method references, are in the preparation report. These findings shape the decision:

- **F1. No defined rule yet for which permission covers a fact.** Every entity and relationship is stored in one named graph, `https://open-metadata.org/graph/knowledge` (`JenaFusekiStorage`, `RdfRepository`). One entity's projection can also write facts whose subject is *another* entity. `RdfPropertyMapper.addEntityReference` and `addLineageEdge` write `rdf:type`, `rdfs:label`, and `om:fullyQualifiedName` onto referenced entities. `addTagLabel` writes tag labels and descriptions. `linkColumn` writes column facts for other tables. The code that writes a fact does not by itself decide who may read it. The gap is that nobody has yet defined who may read a fact, a field, or a structured node. Whether the owner can be worked out at query time is still being researched.
- **F2. Structured nodes have inconsistent identities.** Examples: `lifecycle/{localName}` (which the mapper's own comment calls unreliable for UUIDs), `lineageDetails/{local}/{local}/{randomUUID}` in the translator versus `lineageDetails/{fromId}/{toId}` in live writes, columns as `entity/column/{FQN}`, and RDF lists as blank nodes. Only custom properties and extensions have a declared ownership pattern (`RdfOwnedResources`). A comment notes that orphaned blank-node subtrees are not garbage-collected. Stable IRIs would help as a candidate fix, but they are not proven necessary for every architecture.
- **F3. No existing API returns a complete, bounded slice for one asset.** `RdfStorageInterface.getEntity` returns only `<entity> ?p ?o`, without owned nodes. On error or when the circuit breaker is open it returns `null`, which looks the same as "absent". `executeSparqlQuery` returns one fully materialized string. SPARQL itself can express paging. Still unsolved: keeping pages consistent with each other, and collecting all the nodes an asset owns.
- **F4. Whether an asset-wide copy fits the budget is not demonstrated.** The documented scale fixture has 200,000 tables and 26,952,284 triples (`docs/rdf-scale-validation.md`). The shared request limits include 30 s and 10 MiB of *output* (`SparqlQueryLimits`). The output cap is not a limit on in-memory model size. The large fixture is a reason to benchmark, not proof in either direction.
- **F5. Policy evaluation is per resource.** `Authorizer.authorize` throws on denial. `authorizeRequests` combines several requests with all/any logic. Search already compiles policies into index filters (`RBACConditionEvaluator`), but only for `VIEW_BASIC`/`VIEW_ALL`/`ALL` and only for the conditions it supports. That is a useful precedent for turning policy into a filter.
- **F6. No mapping exists from predicate to field to permission.** `EntityResource.fieldsToViewOperations` maps owners, tags, extension, domains and other fields to `VIEW_BASIC`. `TableResource` maps `usageSummary`, `testSuite`, and `sampleData` to their own operations. Projection maps fields to predicates through JSON-LD contexts, but it also emits unmapped fields as opaque literals. `IGNORED_PROPERTIES` excludes `profile` and `usageSummary`. The context maps `sampleData`, but `TableRepository` seems to load it only through its dedicated API (not verified).
- **F7. Inference provenance is unsafe for this purpose.** Fuseki uses `tdb2:unionDefaultGraph true`, so queries without `GRAPH` read the ontology and `graph/inferred/<rule>` graphs too. Materialized rules run over all data. `RdfRepository.executeSparqlQuery` silently applies the configured default inference. The legacy in-memory inference loads the whole store and caches it by `(level, tripleCount)`.
- **F8. Reads are not pinned to one dataset.** `RebuildingRdfStorage` resolves the serving dataset on every call. Several reads in one request can therefore span a blue/green promotion. `RdfProjectionStateResolver` reports one global state, not a per-request version.
- **F9. Admission and caller wait are bounded; remote cancellation and memory are not proven.** `SparqlQueryExecutionGuard` caps concurrency at 8 global and 2 per principal, and limits how long the caller waits (30 s). Whether a timeout cancels remote Fuseki work has not been shown; Fuseki's own deadline is 50 s. Output size is checked only after the result string exists, so memory is not bounded. The guard runs work on virtual threads, so identity must be resolved before submitting. `SubjectContext.getActivePersona` must never be used for authorization.

## Options

1. **Request-local view over the entire catalog.** Copy every authorized fact into a Jena model, then query it. The semantics are easy. Production feasibility is **not demonstrated with existing APIs** (F3, F4): it needs a complete, consistent retrieval path and a benchmark at representative scale.
2. **Request-local view over an explicit, bounded scope.** Example: declared seed assets plus N hops, or one domain. The semantics match the table above, and it reuses the glossary precedent's pattern of running Jena over a chosen model. It still needs F1, F2, and F6 semantics and a bounded retrieval (F3). It narrows #33224, so the issue owners would have to accept that explicitly.
3. **Storage-side authorized dataset.** Fuseki or a dataset wrapper filters every access, including paths and joins. Could scale, but must prove every engine operation sees only allowed facts. High risk.
4. **Provenance-partitioned projection plus a compiled allowed set.** A candidate, not a proven requirement. Projection records each fact's owner, for example in a per-asset graph. The server compiles policy into an allowed-asset set, as F5 does for search. This changes projection, rebuild, and live writes. Broad grants create very large allowed sets, and field-level rules (F6) remain. Needs research.
5. **Query rewriting over a restricted subset, or server-defined parameterized operations.** Adding guards only on the variables a query returns is not enough: hidden intermediate path nodes and aggregates escape them (see the example). A rewriter needs a precisely defined supported subset and a proof, or equivalent tests, that it preserves authorization. Parameterized operations change the #1299 contract, and each one still needs the same authorization proof.

## Proposed recommendation (for review)

- Keep the admin-only boundary. Do not open any non-admin arbitrary-SPARQL surface until one option has proven semantics and evidence.
- **Safe, bounded, asset-wide retrieval is not yet demonstrated to be production-feasible with existing APIs.** It is also not shown to be impossible.
- Next evidence to gather, before choosing an architecture:
  - Document how the accepted semantics (below) map onto existing policies for facts, fields, and structured nodes (F1, F2, F6).
  - Check whether authorization owners can be resolved at query time without projection changes.
  - Prototype a complete, consistent retrieval.
  - Measure memory and latency at representative scale.
- Ask the #33224 and #1299 owners which use cases need catalog-wide queries. Do not narrow the scope without their agreement.
- Candidate constraints for any option (not yet accepted):
  - inference `none`;
  - reject named graphs and `SERVICE`;
  - SELECT/ASK only;
  - no cross-request view cache;
  - fail closed, never empty, when the view or rewrite cannot be completed.

## Decisions accepted by the user (2026-09-14)

These settle semantics only. No architecture is approved.

- Chat discovers assets under the same effective caller permissions as ordinary OM discovery, including existing field and detail restrictions.
- Relationships and shared facts follow normal OM restrictions, with no least-restrictive override. Writer identity is not the authorization owner, and visibility through another asset grants nothing.
- Hidden intermediates cannot contribute to paths, joins, or aggregates.
- Metadata may be briefly stale through the existing async RDF updates, with no strict max-lag promise. A partial projection (for example during an in-place rebuild) is not acceptable for `COUNT`/`ASK`.
- Authorize per request from catalog-backed policy attributes and the existing caches. No new RDF permission cache, and no extra RDF-induced revocation delay. A snapshot or pinned dataset is not a revocation mechanism.
- For the proposed sanitized-model approach, rebuild the caller-specific model on every request, even for repeated queries. Reuse the existing RDF projection and authorization caches; do not regenerate the catalog graph or cache authorized models across requests. Measure rebuild cost before considering reuse. Any later model cache needs a separate design for bounded storage and invalidation on permission and policy-attribute changes, without adding revocation delay.
- Least friction: no new permission version or synchronization infrastructure, and no broad projection redesign without proven need.
- A new public endpoint and an internal retrieval method may be proposed. A missing retrieval method is implementable and does not make an option impossible.
- `docs/adr/` is the approved location.

The research names a request-local **sanitized model** (Option 1/2 family) as the simplest candidate for evidence gathering. It is not proven secure. A filtering adapter such as `DatasetGraphFilteredView` would additionally need proof that every read is confined. Jena Permissions is retired on Jena 6.x. Fuseki graph ACLs would need per-asset graphs and registry synchronization.

## Remaining questions

Policy questions answered above are closed: fact and shared-node authorization follows existing OM policies, hidden intermediates are excluded, staleness is allowed without a max-lag promise, revocation uses existing invalidation, and the ADR location is `docs/adr/`. What remains is engineering and measurement, plus the contract:

1. Which #33224 use cases need catalog-wide evaluation, and what visible-set sizes must the model handle within budget? (Measure; do not narrow scope silently.)
2. Document the exact mapping from predicates, vocabulary IRIs, and structured nodes to the existing resource, field, and operation policies (for example `sampleData`, usage, tests, tags, glossary terms, lineage columns). Unknown mappings fail closed.
3. Exact behavior during in-place rebuild and blue/green promotion, using existing projection state or rejection. No new version infrastructure presumed.
4. Which existing invalidation paths reach other pods, compared with TTL-only expiry.
5. Endpoint, request/response/error contract, and completeness semantics for #1299.

## Next steps

- [x] Test the authorized-model approach on four assets, including one hidden asset; verify counts and paths cannot reveal it. This is a test-only prototype; see [docs/rdf-authorization-experiment.md](../rdf-authorization-experiment.md). As of 2026-09-18: 96 local tests pass on in-process Jena; the opt-in Fuseki-backed variant last passed with the 56 tests that existed on 2026-09-14.
- [x] Check in-process authorization against real OpenMetadata REST decisions on one fixture: six domain and role phases, including a revocation, matched (2 integration tests pass).
- [ ] Verify field/shared-node permissions and retrieval completeness against existing OpenMetadata behavior. Partly done: table and domain scalars, the non-deleted scope and containment for readable containers are mapped; tag application, lineage details, joins, domain membership, domain lineage and service secrets still fail closed, so live projections are still rejected. See the experiment's "Status for review".
- [ ] Measure practical memory, latency, and execution limits at representative scope.
- [ ] Agree the typed API contract, including errors and completeness, with #1299.
- [ ] Implement in small commits: Opus prepares, the coordinator reviews and explains, and the user approves before committing or moving on.

Plan only the next change in detail, adapting to the evidence. The experiment does not expose a production endpoint.

## Consequences

The accepted semantics are recorded above; the architecture remains proposed. Production implementation waits for experimental evidence and approval.
