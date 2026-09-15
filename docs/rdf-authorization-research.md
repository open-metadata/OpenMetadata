# RDF authorization research: pre-evaluation filtering for read-only SPARQL (#33224)

- **Status:** research input for the proposed ADR [`docs/adr/2026-09-14-authorized-sparql.md`](adr/2026-09-14-authorized-sparql.md). Nothing here is an approved architecture, and nothing here proves an implementation secure.
- **Date / base:** 2026-09-14, checkout `9985a4261b2`. One bounded web pass: sources were downloaded with `curl` and read directly (docs text, W3C specs, Jena source at git tags). Revision 2 follows coordinator review. No code, builds, tests, or benchmarks were run.

## Beginner summary

A SPARQL answer is computed from a dataset. If a hidden fact is present while the query runs, it can change a `COUNT`, flip an `ASK`, or connect two visible nodes through a path. Hiding rows afterwards is too late, so the engine must only be able to read a dataset that lacks the hidden facts. There are two very different ways to get there:
- **Sanitized local model:** physically copy only admitted facts into a fresh in-memory model. Nothing else exists for the query to read.
- **Filtering adapter:** wrap a larger dataset (Jena's `DatasetGraphFilteredView`, Fuseki graph ACLs, the TDB tuple filter). This is safe only if *every* read path of the engine goes through the filter.

Neither Jena mechanism understands OpenMetadata policies, fields, or shared nodes. OpenMetadata still has to decide which facts a caller may see.

## Load-bearing sources (all read)

| # | Source (exact URL, version) | What it establishes |
| --- | --- | --- |
| S1 | [W3C SPARQL 1.1 Query](https://www.w3.org/TR/sparql11-query/), Recommendation 21 March 2013: §16.3, §18.4 (`ALP`, ZeroOrMorePath), §18.5, §18.5.1 | `ASK` tests "whether or not a query pattern has a solution". Path closure `ALP` walks the graph recursively. "Evaluating an exists(pattern) expression uses the dataset and active graph, D(G)". Aggregation applies a set function to grouped solution multisets. Every query form is a function of the dataset. |
| S2 | [W3C RDF 1.1: On Semantics of RDF Datasets](https://www.w3.org/TR/rdf11-datasets/), WG Note 25 February 2014 | "No agreed formal semantics exists for RDF datasets". Named graphs carry no built-in (access) meaning. |
| S3 | [`archived-modules.md` @ jena-6.2.0](https://github.com/apache/jena/blob/jena-6.2.0/archived-modules.md) | "The last release of jena-permissions was with Jena 5.6.0". The module is absent from the 6.2.0 root tree, and Maven Central's newest `jena-permissions` is 5.6.0. |
| S4 | [Jena Permissions docs](https://jena.apache.org/documentation/permissions/) and [design](https://jena.apache.org/documentation/permissions/design.html) (unversioned site); [`SecuredQueryEngine.java` @ jena-5.6.0](https://github.com/apache/jena/blob/jena-5.6.0/jena-permissions/src/main/java/org/apache/jena/permissions/query/SecuredQueryEngine.java) | "Planned for removal at Jena 6.0.0". It proxies graphs through a `SecurityEvaluator` (graph or triple decisions) and rewrites queries in `modifyOp` via `OpRewriter`. |
| S5 | [Fuseki data access control](https://jena.apache.org/documentation/fuseki2/fuseki-data-access-control.html) (unversioned site) | Graph ACL uses `access:AccessControlledDataset` plus a `(user graph…)` registry. It "only applies to read-only datasets"; "TDB1 and TDB2 have special implementations". |
| S6 | jena-6.2.0 `jena-fuseki-access`: [`SecurityContextView`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-access/src/main/java/org/apache/jena/fuseki/access/SecurityContextView.java), [`AccessCtl_SPARQL_QueryDataset`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-access/src/main/java/org/apache/jena/fuseki/access/AccessCtl_SPARQL_QueryDataset.java), [`GraphFilterTDB2`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-access/src/main/java/org/apache/jena/fuseki/access/GraphFilterTDB2.java), [`DataAccessCtl`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-access/src/main/java/org/apache/jena/fuseki/access/DataAccessCtl.java); [`jena-fuseki-main/pom.xml`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-main/pom.xml); [`FMod_GraphAccessCtl`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-main/src/main/java/org/apache/jena/fuseki/mod/access/FMod_GraphAccessCtl.java) | On TDB it installs a tuple filter in the query context; otherwise it uses `DatasetGraphFilteredView`. The user comes from `action.getUser()` (a `?user` variant is marked "Use carefully"). `FROM`/`FROM NAMED` are masked. Each visible graph name is mapped to a TDB NodeId per request. `jena-fuseki-main` depends on `jena-fuseki-access`. |
| S7 | [`DatasetGraphFilteredView.java` @ jena-6.2.0](https://github.com/apache/jena/blob/jena-6.2.0/jena-arq/src/main/java/org/apache/jena/sparql/core/DatasetGraphFilteredView.java) | "A read-only DatasetGraph that applies a filter testing all triples and quads returned by accessing the data", using a `Predicate<Quad>`. |
| S8 | [TDB Quad Filter](https://jena.apache.org/documentation/tdb/quadfilter.html); [TDB datasets](https://jena.apache.org/documentation/tdb/datasets.html) (unversioned site) | The filter is called "on every quad that it retrieves from any of the indexes… during basic graph pattern processing". A rejected quad "is as if it is not in the dataset", and "performance of the tuple filter callback is critical". With `unionDefaultGraph`, the default graph is the union of named graphs. |

## Version and facility matrix (repository at `9985a4261b2`)

| Facility | Where it runs | In this repo today? | Notes |
| --- | --- | --- | --- |
| `jena-core`, `jena-arq`, `jena-rdfconnection`, `jena-shacl` 6.2.0 | OM JVM (local engine) | **Installed**: `openmetadata-service/pom.xml`, root `jena.version` 6.2.0 (pinned for CVE-2026-61372) | `OntologySparqlQueryService` already runs `QueryExecution.model(model)` locally. No TDB jars. |
| `DatasetGraphFilteredView` (S7) | Local engine only | **Installed** (inside `jena-arq`) | An adapter over a dataset that is already in the JVM. It cannot filter the remote Fuseki store. |
| Fuseki graph ACL (S5, S6) | Remote Fuseki | **Shipped in the Fuseki 6.2.0 distribution** (`docker/rdf-store/Dockerfile`), **not configured**: `config.ttl` has no `access:` dataset | Query endpoints are `anon` (`shiro.ini.template`), and OM uses one Fuseki user (`openmetadata`). The ACL is keyed on the Fuseki user name and a static registry. |
| TDB2 tuple filter (S8) | Remote Fuseki, embedded code | Engine hook installed; no OM use | Would be added code in the existing OM Fuseki extension jar (`docker/rdf-store`), not an added dependency. |
| `jena-permissions` (S3, S4) | Local or Fuseki | **Not available on 6.x** | Would need a 5.6.0 artifact next to 6.2.0, or a CVE-reopening downgrade. Rejected. |
| Integration-test Fuseki image | Remote | `secoresearch/fuseki:5.5.0` (`openmetadata-integration-tests/pom.xml`) | Differs from production `openmetadata-fuseki:6.2.0`. Experiments must use 6.2.0. |

**Remote versus local.** A local filter only sees data already in the JVM. A remote filter needs Fuseki configuration or code, plus a trusted way to carry the caller's authorization. Today Fuseki receives no caller identity.

## Findings

1. **The principle is correct, conditionally.** Every SPARQL form evaluates over `D(G)` (S1). If *all* reads are confined to admitted facts, hidden facts cannot affect `COUNT`, `ASK`, `EXISTS`, or paths. This is a semantic principle, not proof that any implementation confines all reads.
   - A physically sanitized model confines reads by construction, as long as the query cannot reach anything else. The validator must therefore reject `SERVICE`, `GRAPH`/`FROM`, `text:query` and other property functions, and non-standard or extension functions; none is needed.
   - An adapter (S6, S7, S8) additionally requires proof that ARQ path evaluation, `EXISTS`, optimizer paths, the text index, and graph enumeration all use filtered access in 6.2.0. That is **unverified**, and the proposed experiment below does **not** test it.
2. **Graph ACL granularity is the named graph (S5, S6).** All assets live in `graph/knowledge` (ADR F1), so a per-caller graph ACL is all-or-nothing unless the projection is partitioned. Partitioning is the broad redesign excluded without proven need.
3. **Per-asset named graphs: pros and cons.**
   - Pros: an exact quad filter; remote execution; the mechanism exists.
   - Cons:
     - Shared facts (F1) need an owner graph each, or duplication.
     - Relationship facts need rules a graph filter cannot express alone.
     - Graph count grows with assets (the fixture has 200k tables and 2.4M columns).
     - Visible graph names are resolved to NodeIds per request (S6), so broad grants mean large lists.
     - The live-write, rebuild, and delete paths all change.
     - `config.ttl` wraps TDB2 in `text:TextDataset`, and `isAccessControlledTDB` unwraps only `DatasetGraphAccessControl`, so the TDB fast path may not apply (unverified source reading).
   - Named graphs have no access semantics (S2).
4. **The documented Fuseki registry configuration is static and user-keyed (S5, S6), but the Java API is pluggable.** Mirroring OM owner, team, tag, and domain policies into the configured registry is the synchronization infrastructure the user excluded. A custom `AuthorizationService` can instead compute security contexts dynamically; that still needs trusted caller propagation and OM policy integration. See the second-pass findings below. The static registry is not an inherent limitation of all Fuseki extensions.
5. **Jena Permissions is unavailable on 6.2.0 (S3).**
6. **A missing internal retrieval method does not show impossibility.** `RdfStorageInterface` has no "facts for these subjects" read (ADR F3), but SPARQL can express one, for example a paged `CONSTRUCT { ?s ?p ?o } WHERE { VALUES ?s { … } GRAPH <knowledge> { ?s ?p ?o } }`. Its completeness, consistency, memory, and latency are the unproven parts.
7. **Budgets are distinct.** `SparqlQueryLimits` caps serialized output bytes, which is not the triples or heap of a request-local model. Measure each separately.
8. **Pitfalls.**
   - *Inference:* `unionDefaultGraph true` exposes `graph/inferred/*` and ontology graphs, and materialized inferences lack source provenance. Use inference `none`, and read only `graph/knowledge`.
   - *Shared nodes and facts:* who wrote a fact does not decide who may read it. A fact being visible through A does not grant it either. Each fact must follow the existing OM resource and field policy that governs it. Example: a tag's own label follows the tag resource's view permission, while `<A> om:hasTag <T>` also follows A's `tags` field (`VIEW_BASIC` in `EntityResource.fieldsToViewOperations`). The complete predicate-to-field-to-operation map is **not yet documented (F6)**.
   - *Permission freshness:* the existing mechanisms decide revocation latency.
     - `PolicyRepository`, `RoleRepository`, `TeamRepository`, and `PolicyConditionUpdater` call `SubjectCache.invalidateAll()`; `UserRepository` calls `invalidateUser`.
     - Registered `Invalidatable` layers fan out to other pods via `CacheInvalidationPubSub` (`cache/Invalidatable.java`, described there as best-effort).
     - Entries also expire after 2 minutes (policies) and 15 minutes (user context).
     - Which change paths reach remote pods has not been traced. A pinned dataset or snapshot is not revocation. In-flight request semantics are not specified.
   - *Rebuild and partial data:* see the next section.

## Ordinary incremental queue vs full rebuild (from code)

- **Incremental.** `RdfUpdater` entity, delete, and relationship hooks go through `PostCommitActionQueue.runOrDefer` into the SQL table `rdf_live_write_queue` (`RdfLiveWriteStore.enqueue`). One cluster-wide `RdfLiveWriter` drains it in id order: 1 s poll, ≤100 writes per drain, ≤10 attempts, then dead-letter. Failures mark `RdfProjectionHealth` degraded. RDF lags SQL by queue depth. The accepted semantics allow this staleness of an otherwise complete projection.
- **Full rebuild.**
  - `RdfIndexApp` with `recreateIndex` in place: calls `clearAll()` on the **serving** dataset, then reindexes. Queries during this window would see a *partial* projection. Partial `COUNT`/`ASK` answers are unacceptable even though no hidden fact is added. The endpoint must reject while this state is detectable through existing projection state (`RdfProjectionStateResolver`, `RdfProjectionHealth`). Whether those already distinguish an in-place rebuild is unverified.
  - Blue/green: builds `openmetadata_a`/`_b` (clear, compact, reload ontologies, reindex), journals live writes (`RdfRebuildStore`, 256 MiB / 100k records), replays in pages of 16 within 5 minutes, then `promoteIfCaughtUp`. `RebuildingRdfStorage` resolves the serving dataset per call (ADR F8), so a multi-read request can span a promotion. **There is no automatic consistency guarantee.** Candidates, both using existing facilities:
    - read through one resolved `RdfDatasetManager.storage(activeDataset())` handle;
    - reject when the active dataset changed during retrieval.
    - Both are unproven, and no new version infrastructure is presumed.

## Comparison

| Candidate | Confinement of reads | Fits accepted decisions | Main unknown |
| --- | --- | --- | --- |
| **L. Request-local sanitized model** (catalog-authorized resources → new bounded retrieval → per-fact admission → fresh `Model` → local Jena, inference `none`, restricted query profile) | By construction, given the profile rejections in Finding 1 | Yes: per-request policy, existing caches, no projection or sync changes | Fact-permission map; retrieval completeness and consistency; memory and latency at realistic scope |
| **L′. `DatasetGraphFilteredView` over a larger local dataset** | Only if every engine read path is filtered (unverified) | Yes | Adapter bypass proof, and a local copy is still needed |
| **G. Fuseki graph ACL + per-asset graphs** | Per graph (S5, S6) | No: projection redesign plus registry sync | Shared facts, edges, NodeId lists, text wrapper |
| **T. Custom TDB2 tuple filter in OM Fuseki extension** | Only if all paths are filtered (S8) | Partly: ships auth data to an anonymous endpoint; object and field rules are awkward at the NodeId level | Request size, path/text coverage, trust boundary |
| **P. Jena Permissions** | Rewriter plus proxies (S4) | No: not on 6.x (S3) | — |

**Simplest candidate: L.** It reuses installed `jena-arq`, the `OntologySparqlQueryService` pattern, and existing `Authorizer`/search RBAC, and needs only the allowed proposals (one internal retrieval method, one new endpoint). If a model cannot be completed within budget, or a fact's mapping is unknown, the request fails with a typed error rather than returning a partial result.

## Proposed minimal experiment (proposal only, not approved)

**Goal:** check L's semantics on real projected triples and measure its cost. This is not an endpoint, not production wiring, and **not proof of adapter (L′/T) safety**.

1. **Fixture** (Fuseki **6.2.0** image, RDF enabled):
   - Tables A, B, C, D with `om:upstream` A→B, B→C, A→D.
   - Tag T1 on B only and tag T2 on A and B; column lineage from B's column to C's column; an extension on A.
   - User U may view A, C, D and the tags, but not B. Admin queries on the unrestricted graph serve as reference.
2. **Admission hypothesis** (test-only; an input to evaluate, not a sufficient recipe). Admit triple `(s, p, o)` only if all hold:
   - `s` is an authorized catalog resource, or an owned node whose owner chain is authorized recursively.
   - `p` maps, through the documented predicate-to-field-to-operation map, to an operation U holds on the resource that governs `s`.
   - `o` is a literal, an approved vocabulary IRI (for example ontology classes as `rdf:type` objects), an authorized resource, or a recursively authorized owned node.

   If any subject, predicate, object, or owner has an unknown mapping, the model build fails closed.
3. **Build and measure.** Build a fresh `Model` and run `QueryExecution.model` with no inference. Record separately: retrieval pages, triples admitted, retained heap, retrieval latency, evaluation latency, output bytes. At scale, repeat on the documented fixture with 1k, 10k, and 100k visible assets, without tuning.

**Acceptance tests** (in U's sanitized model; A2 comments give unrestricted results for contrast):

| # | Exact query / action | Expected for U |
| --- | --- | --- |
| A1 | `SELECT (COUNT(?x) AS ?n) WHERE { <A> om:upstream ?x }` | `1` (unrestricted: `2`) |
| A2a | `ASK { <A> om:upstream+ <C> }` | `false` (unrestricted: `true`) |
| A2b | `ASK { <C> ^om:upstream+ <A> }` | `false` (unrestricted: `true`) |
| A2c | `ASK { <D> ^om:upstream <A> }` | `true`: visible inverse edge |
| A2d | `ASK { <A> ^om:upstream+ <D> }` | `false`: wrong direction, in both graphs |
| A2e | `ASK { <A> om:upstream* <A> }` and `ASK { <urn:x:absent> om:upstream* <urn:x:absent> }` | `true` for both: a zero-length path matches a supplied term even when it is absent (S1). This echoes input and is not evidence of existence. |
| A2f | `ASK { <A> om:upstream* <B> }` | `false` |
| A2g | Add visible edge `C om:upstream A`; `ASK { <A> om:upstream+ <A> }` | `false` (unrestricted: `true`, via hidden B) |
| A3 | `ASK { ?x rdfs:label "secret_b" }`; `SELECT ?t WHERE { <A> om:hasTag ?t FILTER NOT EXISTS { <B> om:hasTag ?t } }` | Same canonical result as the reference computed with B's facts removed |
| A4 | Hidden-only mutation (edit B's label, add edges to or from B, retag B), then rerun A1–A3 | Canonical results unchanged: ASK boolean, and solution multisets compared unordered with blank nodes up to renaming. Not a byte comparison. |
| A5 | T1 and T2 label and description facts; `<A> om:hasTag <T2>` | Admitted exactly as the documented tag-resource and `tags` field permissions say. If that mapping is not documented, the build fails closed. Neither "visible via A" nor writer identity counts. |
| A6 | Server default inference on; inferred-graph facts involving B | Not present (`graph/inferred/*` never read) |
| A7 | Revoke U's view of A through a policy or role change on the same pod, then query | A's facts absent on the next request, via existing invalidation. Cross-pod and TTL-only paths are tested only where the existing mechanism guarantees them. No in-flight promise. |
| A8 | Retrieval exceeds the triple or heap budget; unknown predicate mapping | Typed failure, never a partial count |
| A9 | Retrieval during an in-place `recreateIndex`, or during a blue/green promotion | Rejected via existing projection state, or proven consistent with the candidates above. Never a partial answer. |
| A10 | Queries using `SERVICE`, `GRAPH`, `FROM`, `text:query` or other property functions, or extension functions | Rejected by the validator before execution |

## Accepted semantics vs unresolved engineering evidence

**Accepted (user, 2026-09-14; recorded in the ADR):**
- Discovery uses the same effective permissions as ordinary OM discovery, with existing field and detail restrictions.
- Relationships and shared facts follow normal OM restrictions, with no least-restrictive override.
- Hidden intermediates cannot contribute.
- Brief async staleness is allowed, with no max-lag promise.
- Authorize per request with existing caches. No new RDF permission cache and no extra revocation delay.
- No new version or sync infrastructure, and no broad projection redesign without proven need.
- A new endpoint and an internal retrieval method may be proposed.
- `docs/adr/` is the ADR location.

**Unresolved engineering evidence:**
- Documenting the predicate-to-field-to-operation map and vocabulary allowlist (F6).
- Owned-node closure for inconsistent identities (F2).
- Retrieval completeness, and safe-state handling for in-place rebuild and promotion (F3, F8).
- Model memory and latency (F4).
- Cross-pod invalidation coverage.
- Remote cancellation (F9).
- For any adapter variant, proof that all reads are filtered.
- The #1299 contract.

## Second web pass: alternatives and the latency decision gate

Revisited after the experiment was pushed through `dd361482005`. This was a bounded primary-source web/source review, not an exhaustive vendor survey or a benchmark. Jena source references below are pinned to 6.2.0; vendor and Jena documentation pages are unversioned. No Docker runs or new tests were performed for this research pass.

### Additional sources and findings

1. **Dynamic Fuseki authorization is possible; a static registry is not mandatory.** [`AuthorizationService.get(String actor)`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-access/src/main/java/org/apache/jena/fuseki/access/AuthorizationService.java) returns a `SecurityContext`. [`DataAccessCtl.controlledDataset`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-access/src/main/java/org/apache/jena/fuseki/access/DataAccessCtl.java) accepts that interface, and [`SecurityContextView`](https://github.com/apache/jena/blob/jena-6.2.0/jena-fuseki2/jena-fuseki-access/src/main/java/org/apache/jena/fuseki/access/SecurityContextView.java) installs a per-query TDB filter or selects a filtered dataset. This corrects the earlier overbroad static-registry characterization. The stock view still selects graphs, so it does not by itself distinguish assets/fields in the shared knowledge graph. **Inference:** a custom server-side authorization/filter extension remains credible without necessarily mirroring policies into static ACLs. It must still establish trusted caller/context transport, request freshness, field/shared-fact semantics, and complete engine-path coverage.
2. **Server-side tuple filtering is the strongest performance fallback to compare.** The [TDB quad-filter documentation](https://jena.apache.org/documentation/tdb/quadfilter.html) describes rejecting indexed tuples during basic graph-pattern processing and explicitly warns that callback performance is critical. Combined with the pinned TDB2 integration above, this supports investigating predicate pushdown rather than copying an entire authorized graph. It does **not** establish coverage of every path, optimizer, graph-enumeration or extension-function route. Avoid per-triple network/SQL policy evaluation; any request-scoped authorization representation needs explicit bounds. No latency advantage has been measured.
3. **ARQ query rewriting is an extension point, not turnkey RBAC.** [ARQ query evaluation](https://jena.apache.org/documentation/query/arq-query-eval.html) documents algebra transforms, `StageGenerator` for basic graph patterns, and the broader `OpExecutor` mechanism. **Inference:** a restricted, structurally validated query/template API could permit selective authorized retrieval and reduce work. But an outer `FILTER`/`VALUES` on visible endpoints does not remove hidden intermediate nodes inside transitive paths. Rewriting arbitrary SPARQL needs a separate correctness proof; narrowing the supported query contract needs agreement with #1299. Neither is automatically a better replacement for the experiment.
4. **A vendor with built-in fine-grained controls still has different semantics and limits.** Stardog's [named-graph security](https://docs.stardog.com/operating-stardog/security/named-graph-security) filters the query dataset by user/role graph permissions. Its [property-based protection](https://docs.stardog.com/operating-stardog/security/fine-grained-security) instead describes object masking through query rewriting, not removing unauthorized assets and facts. The latter page explicitly says it should not be considered production-ready and lists exposure through zero-length paths, full-text search and edge properties. **Inference:** this is useful evidence of the difficulty of complete read confinement, not a recommendation to migrate stores. It does not directly implement OM policy semantics and would add storage/deployment/policy integration work. These caveats apply to the documented feature, not to every Stardog security mechanism.
5. **Jena Permissions remains retired for the pinned release.** The [6.2.0 retired-module list](https://github.com/apache/jena/blob/jena-6.2.0/archived-modules.md) still identifies 5.6.0 as its last release. The second pass found no supported drop-in Jena Permissions module for this checkout.

### Why keep the sanitized-model candidate for now?

It gives the simplest auditable semantic baseline: after correct fact admission and query-profile confinement, hidden facts are physically absent from the model the query evaluates. It reuses local ARQ and avoids introducing a remote policy trust boundary or repartitioning the projection. The [experiment](rdf-authorization-experiment.md) now records 56 passing local tests and 56 tests with retrieval from the current-checkout Fuseki 6.2.0 image. Query evaluation is still local; four assets are not production-security or performance proof.

**Conclusion:** no clearly better drop-in solution was established in this pass. Keep the candidate provisional, not locked in. Compare a custom server-side filtered view/tuple filter if materialization costs dominate; consider a narrower query contract if selective, complete retrieval can be proved. Bulk/search-backed candidate authorization is a potential optimization, but equivalence to real OM permissions and completeness must be tested rather than assumed.

### Performance target and next experiment

The user selected **roughly 2 seconds for the complete server-side graph request**, excluding LLM SPARQL generation and answer composition. Include candidate discovery, authorization, RDF retrieval, model construction, query execution and serialization. This is an initial target, not a measured guarantee; supported scope, concurrency and the percentile used for an eventual SLO remain to be agreed.

Combine real caller/role/resource integration with measurements at increasing scopes (initially 100, 1,000 and 10,000 assets, subject to safe resource limits). Exercise lookups, traversals and global aggregates. Report cold/warm p50 and p95, modest concurrency, database calls, retrieval calls/bytes/triples, model memory and per-stage timing. Whole test-class duration and sparse container-memory samples do not answer these questions.

If representative requests routinely exceed the budget, revisit retrieval/execution before implementing a public endpoint. Never meet the target by silently limiting candidate assets, using stale permission decisions beyond existing behavior, or returning incomplete COUNT/ASK results. A cross-request authorized-model cache still requires a separate bounded-storage and invalidation design; it is not the default fix.
