# RDF authorization experiment: request-local sanitized model (candidate L)

- **Status:** test-only prototype evidence for the proposed ADR [`docs/adr/2026-09-14-authorized-sparql.md`](adr/2026-09-14-authorized-sparql.md), candidate **L** of [`docs/rdf-authorization-research.md`](rdf-authorization-research.md). No production code, endpoint, schema, POM, or configuration changed. Not an approved architecture.
- **Date / base:** 2026-09-14, on top of `9c2f27a7682`.
- **Question:** On real projected triples, does a request-local model that physically contains only admitted facts give the ADR's answers for `COUNT`, `ASK`, paths, joins and `EXISTS`? Can a bounded retrieval from `graph/knowledge` build that model without guessing?
- **Scope:** the core model, its fixture and the semantic tests, plus a test-only query profile that confines queries to the sanitized model. Local tests run on in-process Jena. An opt-in subclass reruns the same tests with every retrieval sent to an isolated, memory-capped Fuseki 6.2.0 container built from `docker/rdf-store`.

## Short answer

- **Semantics: yes, on four tables.** All ADR example answers hold. Changes that touch only the hidden table leave visible answers unchanged.
  - The current 56 tests pass in-process.
  - All 56 also pass with retrieval from Fuseki 6.2.0 built from this checkout.
- **Retrieval without guessing: not yet for realistic data.** Ordinary projected facts fail closed because no documented permission covers them:
  - `om:labelType` and `om:tagState` on shared tag nodes;
  - lineage details.
  The fixture avoided both so the semantic tests could run. Those two mappings are the next decision.

## What was added (test code only)

All files are under `openmetadata-service/src/test/java/org/openmetadata/service/`.

| File | Role |
| --- | --- |
| `rdf/SanitizedModelExperimentTest.java` | 56 tests: the ADR A1–A4, A6, A8 and A10 cases, owned nodes, tag policy, fail-closed cases, structured-node ownership conflicts, query-profile rejections. |
| `rdf/SanitizedModelFusekiTest.java` | Opt-in subclass. Inherits every local test and reruns it with retrieval from a throwaway Fuseki container capped at 1 GiB. It asserts the server reports version 6.2.0, and before every `DROP ALL` it checks that the endpoint belongs to that container. Disabled unless `-DrdfAuthorizationFusekiImage` is set. |
| `rdf/SanitizedModelFixture.java` | Tables A–D and tags projected by the production `JsonLdTranslator` and `RdfRepository.buildLineageModel`. Also holds the catalog and the policy rules. |
| `rdf/SanitizedModelBuilder.java` | The experiment itself: bounded retrieval, the per-fact admission map, and a fresh `Model`. |
| `rdf/SanitizedQueryProfile.java` | Test-only query profile: `SELECT`/`ASK` only, confined to the model. |
| `security/policyevaluator/PolicyContextFixture.java` | Builds `PolicyContext`, whose constructor is package-private. |

## Beginner walkthrough

The fixture: tables A, B, C and D, with `A om:upstream B`, `B om:upstream C`, `A om:upstream D`. B carries tag `Restricted.Secret`; A and B share `PII.Sensitive`. The caller's rules are "allow `ViewAll` on all resources" and "deny `ViewAll` on tables when `matchAnyTag('Restricted.Secret')`". So the caller sees A, C, D and both tags, but not B.

1. **Decide which resources are visible.** For each catalog resource, OpenMetadata's real `PolicyEvaluator.hasPermission` runs with those rules. That call exercises deny-before-allow ordering, `CompiledRule` operation matching and SpEL conditions. Only the subject's policy lookup (`SubjectContext.getPolicies`) is stubbed.
2. **Fetch facts by subject, with a budget.** One query per page of at most 100 subjects:
   ```sparql
   CONSTRUCT { ?s ?p ?o } WHERE { VALUES ?s { … } GRAPH <https://open-metadata.org/graph/knowledge> { ?s ?p ?o } } LIMIT <remaining budget + 1>
   ```
   - Only visible resources are fetched, so B's own facts are never read.
   - Owned nodes are then fetched the same way, following only `om:hasColumn`, `om:hasChildColumn`, `om:hasExtension` and `om:hasExtensionProperty`, to a depth of at most 8.
   - Every such edge is an ownership claim. The build fails if a claim points at a catalog resource, or disagrees with an earlier claim (a different owner or a different node kind), in the same wave or a later one. Identical repeated claims are accepted, and the node is fetched once.
   - If the budget is exceeded, the build throws: no `COUNT` or `ASK` is ever computed from a partial model.
   - Inferred and default graphs are never read.
3. **Admit each fact, or fail the whole build.** For a fact `(s, p, o)`:
   - Find what governs `s`: a catalog resource, or the resource that owns it.
   - Map `p` to a field, and the field to a view operation. The caller must hold that operation on the governing resource.
   - The object must be one of:
     - a literal;
     - an approved type, for `rdf:type` only;
     - a node the caller may see.
     A hidden catalog resource drops the fact: `<A> om:upstream <B>` and `<A> prov:wasDerivedFrom <B>` disappear. Anything unknown fails the whole build, and every violation is reported at once.
4. **Query the copy.** The admitted facts go into a fresh in-memory `Model` with no reasoner.
   - Every test query passes the query profile first.
   - The profile rejects `SERVICE`, `GRAPH`, `FROM`, `FROM NAMED`, property functions (ARQ, `text:`, `java:`, registered), extension functions and `CALL`, and anything other than `SELECT`/`ASK`.
   - It also checks inside `EXISTS`, `BIND`, projections, `GROUP BY`, aggregates, `HAVING` and `ORDER BY`.
   - Nothing else exists for the engine to read.

### Permission map used (explicit and partial)

| Node kind | Predicates | Field → operation | Source |
| --- | --- | --- | --- |
| table | `rdf:type`, `rdfs:label`, `om:fullyQualifiedName`, `dct:description`, `dct:modified`, `dcat:version` | core → `VIEW_BASIC` | `EntityResource.getViewOperations` (no fields) |
| table | `om:hasTag` | tags → `VIEW_BASIC` | `EntityResource` constructor |
| table | `om:hasExtension` | extension → `VIEW_BASIC` | `EntityResource` constructor |
| table | `om:hasColumn` | columns → `VIEW_BASIC` | `TableResource.getEntitySpecificOperations` |
| table | `om:upstream`, `om:downstream`, `prov:wasDerivedFrom` | lineage → `VIEW_BASIC` on both ends | `LineageResource` (`VIEW_BASIC` per entity) |
| tag | `rdf:type`, `rdfs:label`, `om:fullyQualifiedName`, `dct:description`, `dct:modified`, `dcat:version`, `om:tagFQN`, `om:tagSource` | core → `VIEW_BASIC` on the **tag** resource | same |
| column | `rdf:type`, `rdfs:label`, `om:fullyQualifiedName`, `om:columnDataType`, `om:hasChildColumn` | owner's `columns` field | same |
| extension / extension property | `rdf:type`, `om:hasExtensionProperty`, `om:extensionKey`, `om:extensionValue` | owner's `extension` field | same |

Approved `rdf:type` objects: `om:Table`, `om:Tag`, `om:Column`, `om:Extension`, `om:ExtensionProperty`, `dcat:Dataset`, `skos:Concept`, `prov:Entity`.

## Results

### Verification (commands run in this worktree)

Pre-existing build note, not repaired: `mvn -pl openmetadata-service -am test-compile` fails, because the relocated `es.co.elastic…` classes only exist after the shade plugin runs at `package`. So every run below uses `package`.

Local test command: `mvn -pl openmetadata-service -am package -Dtest='SanitizedModelExperimentTest' -Dsurefire.failIfNoSpecifiedTests=false -Dspotless.check.skip=true`.

| Step | Outcome |
| --- | --- |
| RED: builder copied the whole knowledge graph (before the split, suite then included the query-profile cases) | The builder leaked: COUNT 2, paths through B, label `secret_b` visible, no fail-closed, no budget. |
| RED: ownership regression (before the split) | Conflicting owners and kinds were accepted silently. Visible table D was accepted as a column of A. Hidden table B was reclassified as a column of A and failed only incidentally, on unmapped `dct:modified` for COLUMN. `om:hasChildColumn` had no column mapping. |
| RED: query profile (before the split) | The first profile let `apf:strSplit` and `ORDER BY <fn>(…)` through. The ARQ namespace and explicit `ORDER BY`/TopN/`GROUP BY` walking were added before GREEN. |
| GREEN: core model only, local | **33 tests, 0 failures, 0 errors, 0 skipped** |
| GREEN: with query profile, local | **56 tests, 0 failures, 0 errors, 0 skipped**. Every core query also passes through the profile. |
| GREEN: local + Fuseki 6.2.0 from this checkout | See "Opt-in Fuseki run" below: **112 tests (56 local + 56 Fuseki), 0 failures, 0 errors, 0 skipped**. |
| Formatting | `mvn spotless:check -pl openmetadata-service -DspotlessFiles='.*/(SanitizedModel[A-Za-z0-9]*\|SanitizedQueryProfile\|PolicyContextFixture)\.java'`: clean |

Without `-DrdfAuthorizationFusekiImage` the Fuseki class is disabled, and CI is unaffected. With the Fuseki subclass restored, `-Dtest='SanitizedModel*Test'` (no image property) was verified to report:
- `SanitizedModelExperimentTest`: 56 tests, 0 failures, 0 errors, 0 skipped.
- `SanitizedModelFusekiTest`: 21 tests, all 21 skipped. JUnit counts the disabled class per test method, without expanding parameterized cases.
- Total: 77 run, 21 skipped, and no container created.

### Opt-in Fuseki run

**What runs where.** In the Fuseki class, the four-table fixture is loaded into Fuseki with SPARQL Update, and the builder's retrieval `CONSTRUCT` queries run against Fuseki. The sanitized `Model` and every test query are then evaluated locally by Jena. The unrestricted reference is also read back through Fuseki.

**Docker requirements.**
- Docker must be able to run one extra container with a 1 GiB memory limit and no swap. Measured on 2026-09-14: the Docker VM had 5.78 GiB, and existing services used about 1.5 GiB.
- The test container runs with `-Xms384m -Xmx384m -XX:MaxMetaspaceSize=128m`, overriding the image's 4 GiB production heap, and a 256 MiB tmpfs `/fuseki-data`. The tmpfs and TDB2's memory-mapped files count against the same limit.
- Maven and the test JVM run on the host, not in the VM.
- Check free Docker memory before running. Do not point the test at a shared Fuseki: it drops and reloads the dataset.

**Commands used** (2026-09-14):

```bash
docker build --pull=false -t openmetadata-fuseki:6.2.0-rbac-recheck docker/rdf-store
mvn -pl openmetadata-service -am package -Dtest='SanitizedModel*Test' \
  -DrdfAuthorizationFusekiImage=openmetadata-fuseki:6.2.0-rbac-recheck \
  -Dsurefire.failIfNoSpecifiedTests=false -Dspotless.check.skip=true
```

- **Image:** built from commit `2e2ed48d800` (`docker/rdf-store` tree `ed6684dfd7f5`, no uncommitted changes there). Image ID `sha256:bd9d053889fa…`, arm64, base images `eclipse-temurin:21-jre-jammy` / `21-jdk-jammy` already present locally. The build verified the Fuseki 6.2.0 tarball's sha512, reported `Apache Jena version 6.2.0`, and included the OpenMetadata extension jar. The image was removed after the run.
- **Surefire XML:** `SanitizedModelExperimentTest` 56 tests, 0 failures, 0 errors, 0 skipped, 1.6 s. `SanitizedModelFusekiTest` 56 tests, 0 failures, 0 errors, 0 skipped, 22.5 s, including all 6 ownership tests. Maven exit 0, wall time 124 s.
- **Container:** started in 5.5 s. `HostConfig.Memory` = `MemorySwap` = 1 GiB; random host port. Sampled usage reached 458 MiB of 1 GiB (3 samples at about 4 s intervals, so not a guaranteed peak). All Docker containers together stayed below 2.0 GiB. The container was not OOM-killed (asserted after the class); it and the Testcontainers Ryuk container exited after the run.

**Not measured:** Fuseki or model heap per request, retrieval latency or evaluation latency per request. The Fuseki timings above are whole test classes, and the memory figures are coarse container samples.

### Findings

1. **The ADR semantics hold on four tables.**
   - `COUNT` of A's upstreams: 1 (unrestricted: 2).
   - `A om:upstream+ C` and `C ^om:upstream+ A`: false. The visible inverse edge `D ^om:upstream A` is still true.
   - A cycle `A→B→C→A` through hidden B is not a visible cycle.
   - Label `secret_b` is invisible. `NOT EXISTS { <B> om:hasTag ?t }` returns the shared tag. Three tables are typed `om:Table`, not four.
   - The whole sanitized model is isomorphic to "knowledge graph minus B and B's IRI-prefixed owned nodes". That reference is computed by IRI convention, independently of the builder. Joins, subqueries, `EXISTS`, `OPTIONAL`, `GROUP BY` and `MINUS` match it, compared unordered by RDF term.
   - Hidden-only mutations leave all 8 canonical answers unchanged: relabelling B, edges to and from B, removing B's tag, adding a column to B. The unrestricted answers do change, so the test is sensitive.
   - Facts in an inferred graph and in the default graph are not retrieved.
   - The budget boundary is exact: `budget = retrieved` succeeds, `retrieved − 1` throws.
   - 22 escape forms are rejected by the query profile.
2. **Jena 6.2 zero-length paths differ from research row A2e.** `ASK { <urn:x:absent> om:upstream* <urn:x:absent> }` is **false** in Jena 6.2.0, even on the unrestricted graph. The research expected true. Hidden B therefore behaves exactly like an absent term in the sanitized model (`<B> om:upstream* <B>` is false, but true unrestricted). This is safe, but it shows that zero-length path results depend on whether the term is in the model.
3. **Tag-application facts on shared tag nodes have no owner (blocking).**
   - `RdfPropertyMapper.addTagLabel` writes each asset's `labelType` and `state` onto the shared `entity/tag/{id}` node. The tag's own policy does not cover them, and neither does the asset's `tags` field, because they are no longer attached to the asset.
   - A table tagged `Manual`/`Confirmed` makes the build fail closed; the test asserts both predicates.
   - OpenMetadata normally populates these attributes, so realistic catalogs would fail closed until the projection or the mapping is decided.
   - Related, unproven: label-copied tag facts (`rdfs:label`, `dct:description`, `om:tagFQN`, `om:tagSource`) exist because some asset uses the tag. If they diverge from the tag's own projection, they could hint at hidden usage.
4. **Lineage details are edge-owned and fail closed.** `om:hasLineageDetails` hangs off the *source* entity. The details node links `prov:used`, the SQL plan and column lineage for an edge that involves two assets. No single resource or field governs it.
5. **Soft-deleted projection.** A deleted entity emits `prov:invalidatedAtTime`. It was left unmapped, because whether deleted entities appear is an include-semantics question, not a field permission. The fixture uses non-deleted entities.
6. **Field-level distinctions were not exercised.** Every mapped predicate here resolves to `VIEW_BASIC`. `VIEW_USAGE`, `VIEW_SAMPLE_DATA`, `VIEW_TESTS`, `VIEW_QUERIES`, and custom-property or domain rules did not come up.
7. **Retrieval shape.** 5 visible resources needed 3 queries: resources, then columns and extension, then extension properties. That is asserted.
8. **Structured-node ownership must not depend on order.** Without the ownership check:
   - A node claimed by two owners gets whichever claim is read last.
   - A node already governed silently ignores a later, conflicting claim.
   - A structured edge can turn a hidden table into a "column" of a visible one, so the hidden table's facts are fetched under the wrong governance.
   Such claims now fail closed.
9. **TDB2 canonicalizes literal terms.**
   - `"0.1"^^xsd:double` comes back from Fuseki as `"0.1e0"`, which a separate throwaway container probe confirmed. The value is the same, but the RDF term differs.
   - Comparisons by term must therefore use a reference read through the same store; comparing against the in-memory fixture instead makes whole-model comparisons fail.
   - The tests read the unrestricted reference through the same source as the sanitized build.

## Proven vs not proven

**Supported by this evidence (four tables; 56 tests in-process, and the same 56 with retrieval from one memory-capped Fuseki 6.2.0 container built from this checkout):**
- A physically sanitized, request-local model gives the ADR answers for `COUNT`, `ASK`, inverse, transitive and cyclic paths, joins, subqueries and `EXISTS`, including hidden-only mutation invariance.
- Subject-keyed, budgeted retrieval from `graph/knowledge` avoids inferred and default graphs, and refuses to answer partially.
- An explicit predicate → field → operation map, with order-independent ownership, can fail closed on unknown or conflicting facts. It found real gaps (Findings 3–5).
- Tag-conditioned deny rules evaluated by OpenMetadata's `PolicyEvaluator` produce the visible set.
- The test query profile rejects every tested way of reading outside the model: `SERVICE`, `GRAPH`, `FROM`, property and extension functions, including inside `EXISTS`, aggregates, `GROUP BY`, `HAVING` and `ORDER BY`.

**Not proven (explicitly out of scope or not reached):**
- **The query profile as a security boundary.** It is a test helper, not reviewed as one. No endpoint uses it, and untested SPARQL forms are not covered by evidence.
- **Remote retrieval beyond one small run.** The remote evidence is a single run of 56 tests on four tables, against one arm64 image built locally. Query evaluation happened on the local sanitized model, not inside Fuseki.
- **Real policy integration end to end.** Not exercised: `SubjectCache` role/team/persona policy resolution, `DefaultAuthorizer` (admin, bot, domain and reviewer handling), `ResourceContext` entity loading, owner conditions such as `isOwner()`, and the search-side compiled RBAC filter. The catalog attributes (tags) are fixture values, not loaded from the database.
- **Field coverage** beyond the predicates this fixture emits. Also unproven: the documented map for glossary terms, domains, owners, data products, usage, sample data, tests, queries, custom properties, lifecycle and certification.
- **Candidate selection at scale.** The builder evaluates every catalog resource; a real system needs a pre-filter (for example the search RBAC compiler).
- **Remote consistency.** The three retrieval queries are not pinned to one dataset (ADR F8): no blue/green or in-place rebuild behavior (A9), and no snapshot.
- **Permission freshness and revocation** (A7), and cancellation of remote work (F9).
- **Memory, latency and scale.** Nothing beyond four tables, and no heap or per-request timing measurement.
- **Owned blank-node structures** (they fail closed by design, but no test covers them) and orphaned owned nodes.

## Proposed next step (needs approval)

Decide, with the #33224 owners, how two things are governed or re-projected: tag-application attributes on shared tag nodes (Finding 3) and edge-owned lineage details (Finding 4). Only then extend the map to the next field family, one family per commit. Scale, consistency and freshness measurements should wait until the map covers a representative asset.
