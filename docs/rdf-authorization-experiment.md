# RDF authorization experiment: request-local sanitized model (candidate L)

- **Status:** test-only prototype evidence for the proposed ADR [`docs/adr/2026-09-14-authorized-sparql.md`](adr/2026-09-14-authorized-sparql.md), candidate **L** of [`docs/rdf-authorization-research.md`](rdf-authorization-research.md). No production code, endpoint, schema, POM, or configuration changed. Not an approved architecture.
- **Date / base:** 2026-09-14, on top of `9c2f27a7682`.
- **Question:** On real projected triples, does a request-local model that physically contains only admitted facts give the ADR's answers for `COUNT`, `ASK`, paths, joins and `EXISTS`? Can a bounded retrieval from `graph/knowledge` build that model without guessing?
- **Scope:** the core model, its fixture and the semantic tests, plus a test-only query profile that confines queries to the sanitized model. Local tests run on in-process Jena. An opt-in subclass reruns the same tests with every retrieval sent to an isolated, memory-capped Fuseki 6.2.0 container built from `docker/rdf-store`. An integration test checks decisions against OpenMetadata's real authorization on API-created entities, and that live projections are rejected where the map has no reviewed rule.

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

The integration test lives in `openmetadata-integration-tests/src/test/java/org/openmetadata/service/rdf/RdfAuthorizationAlignmentIT.java`, in the builder's package so it can use the package-private experiment classes. The builder also gained the domain field family (`om:domains` on tables; domain type, label and FQN) that its catalog entries need.

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

| table | `om:domains` | domains → `VIEW_BASIC`; the domain object must be visible | `EntityResource` constructor |
| table | `dct:hasVersion`, `om:hasServiceType`, `om:entityStatus`, `om:processedLineage` | core → `VIEW_BASIC` | see "Scalar attribute evidence" |
| domain | `rdf:type`, `rdfs:label`, `om:fullyQualifiedName`, `dct:description`, `dct:modified`, `dcat:version`, `dct:hasVersion`, `om:domainType`, `om:entityStatus` | core → `VIEW_BASIC` on the **domain** resource | see "Scalar attribute evidence" |
| table, domain | `om:isDeleted`, admitted only as `false` on a candidate | core → `VIEW_BASIC`, under the local non-deleted scope experiment (Finding 12) | [`rdf-authorization-scope-proposal.md`](rdf-authorization-scope-proposal.md) |

Approved `rdf:type` objects: `om:Table`, `om:Tag`, `om:Domain`, `om:Column`, `om:Extension`, `om:ExtensionProperty`, `dcat:Dataset`, `skos:Concept`, `skos:Collection`, `prov:Entity`.

### Scalar attribute evidence

A predicate is mapped to core only when both links below are traced in code. `EntityResource.getViewOperations` requires only `VIEW_BASIC` for a GET without a fields parameter. None of these fields is stripped from storage (`TableRepository` strips `service`, `DomainRepository` strips `parent`), and none is cleared on read: `EntityRepository.clearFieldsInternal`, `TableRepository.clearFields` and `DomainRepository.clearFields` leave them alone. The only response maskers, `PIIMasker` and `EntityMasker`, act on column/sample data and service secrets.

| Predicate | Source | Field and schema type |
| --- | --- | --- |
| `dct:hasVersion` | `base.jsonld` `version` | `version`, entity version number |
| `dcat:version` | `RdfPropertyMapper` from `entity.getVersion()` | `version` |
| `dct:modified` | `base.jsonld` `updatedAt` | `updatedAt`, timestamp |
| `dct:description` | `base.jsonld` `description` | `description`, markdown |
| `om:hasServiceType` | `dataAsset.jsonld` `serviceType` | table `serviceType`, database service type enum |
| `om:domainType` | `governance.jsonld` `domainType` | domain `domainType` enum |
| `om:entityStatus` | `RdfPropertyMapper` unmapped-field path, `om:` + field name | `entityStatus`, `EntityStatus` enum |
| `om:processedLineage` | same unmapped-field path | table `processedLineage`, boolean |
| `rdf:type om:Domain`, `rdf:type skos:Collection` | `JsonLdTranslator` via `RdfUtils.getOpenMetadataType` and `getRdfType` | entity type |

Open semantics, not resolved by this mapping:
- **Free text:** `description` is markdown and can embed entity links. It is admitted with the same `VIEW_BASIC` the REST GET needs, which reproduces what REST returns; whether SPARQL should follow that is undecided.
- **Explicitly requested fields:** a GET that names one of these fields in `fields=` asks `getViewOperations` for `VIEW_ALL`, because the resources do not register them. The mapping follows the default GET response instead.
- **Deleted flag:** `om:isDeleted` (from `deleted`) is mapped only within the local non-deleted scope experiment (Finding 12), not as a production decision.
- **Deferred:** `om:childrenCount` stays unmapped because `DomainRepository.clearFields` returns it only when requested.

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

### Integration run against OpenMetadata authorization

`RdfAuthorizationAlignmentIT` runs in the integration-test application: Postgres 15, OpenSearch 3.4.0, and Fuseki 6.2.0 built from this checkout, capped at 1 GiB with a 384 MiB heap.
- **When it runs:** the class carries `@EnabledIfSystemProperty(named = "enableRdf", matches = "true")`, which the `postgres-rdf-tests` profile sets. The generic integration profiles include every `*IT` but start no Fuseki. No CI workflow runs `postgres-rdf-tests` today.
- **Skip check without RDF (2026-09-15):** `mvn -pl openmetadata-integration-tests -am verify -Ppostgres-opensearch -Dskip.embedded.bootstrap=true -DintegrationTests.skipIsolated=true -Dit.test=RdfAuthorizationAlignmentIT -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoSuchUnitTest -Dsurefire.failIfNoSpecifiedTests=false -DfailIfNoTests=false -Dspotless.check.skip=true`, with `enableRdf` unset.
  - Failsafe: 2 tests, 0 failures, 0 errors, 2 skipped, each with the reason "RDF is disabled for this run; use the postgres-rdf-tests profile". Maven exit 0.
  - Docker recorded no container event during the Maven run.
  - A first version guarded the class with an assumption in `@BeforeAll`. Failsafe reported that as 0 tests run, not as skipped, and `verify` failed with "No tests were executed". The class-level condition replaced it.
- **Image:** that profile defaults to `secoresearch/fuseki:5.5.0`. All evidence below used `-DrdfContainerImage` with the 6.2.0 image; 5.5.0 was not tested.

**Fixture.** Domains *visible* and *hidden*. A user with the built-in `DomainOnlyAccessRole` and the visible domain. Tables A, C and D in the visible domain, B in the hidden one. API lineage A←B, B←C, A←D.

**`authorizationFollowsDomainAndRoleChanges`.** Each phase has a predetermined visible set. REST GETs by the user (403 means hidden) must equal it, and in-process `DefaultAuthorizer` decisions must equal REST.
- In-process checks use the REST GET's context shape: no requested fields, `NON_DELETED`, `VIEW_BASIC`.
- All checks of a phase run together on one new thread, so request-scoped thread-local state starts empty, as it does behind the request filters. No cache is invalidated by the test.
- Every role change first asserts that the caller is not an admin, holds exactly the assigned roles, and keeps the inherited roles it had at creation.

| Phase | Visible |
| --- | --- |
| Initial | A, C, D |
| B moved to the visible domain | A, B, C, D |
| B moved back to the hidden domain | A, C, D |
| Role with an unconditional deny on all table operations assigned (allowed → revoked) | none |
| That role removed | A, C, D |
| `DomainOnlyAccessRole` removed; its `!hasDomain()` deny goes, `OrganizationPolicy` still allows | A, B, C, D |

Result: all six phases passed, in four separate runs on 2026-09-15. The last two used the final authorization test code: the verification run below, and a run with the scalar slice.

**Request-lifecycle finding (test harness, not production).** A first version made in-process decisions on the long-lived JUnit thread. `RequestEntityCache` is thread-local and cleared only by the request filters, so that thread kept the entity it loaded first. All four passing runs also recorded, without asserting, decisions on a reused thread:
- In all four, after B moved into the visible domain, the reused thread still denied B, with the REST context shape and with a cache-backed one. Fresh-request decisions matched REST, and every other recorded cell matched REST.
- In a separate run, where the reused thread first loaded B after that move, it kept allowing B after B moved back.

This concerns thread reuse in the test only. Production request threads, the shared entity cache and cross-pod invalidation were not examined.

**`sanitizedModelBuildRejectsUnmappedLiveFacts`: a fail-closed regression, not model construction.** Building the model for the same user on API-created entities is rejected as a whole. The last run with the build as a plain test reported 22 violations: 20 predicates without a permission mapping and 2 unapproved types.
- Tables: `om:belongsToService`, `om:belongsToDatabase`, `om:belongsToSchema`, `om:hasServiceType`, `om:entityStatus`, `om:isDeleted`, `om:joins`, `om:processedLineage`, `dct:hasVersion`.
- Domains: `dct:description`, `dct:hasVersion`, `dct:modified`, `dcat:version`, `om:domainType`, `om:entityStatus`, `om:childrenCount`, `om:has`, `om:upstream`, `om:downstream`, `prov:wasDerivedFrom`.
- Types: `om:Domain`, `skos:Collection`.

The test asserts the rejection and that every violation is a mapping gap (no ownership or retrieval error). It also asserts that four deferred facts are among the violations: domain membership (`om:has`), domain lineage (`om:upstream`), a container link (`om:belongsToSchema`) and the soft-delete flag (`om:isDeleted`). Finally, no violation may name a scalar term the builder maps. The `om:isDeleted` and mapped-scalar assertions came with the scalar slice. They passed on 2026-09-15 with the verification command and image below: `RdfAuthorizationAlignmentIT` 2 tests, 0 failures, 0 errors, 0 skipped; `SanitizedModelExperimentTest` 59 tests, 0 failures, 0 errors, 0 skipped; Maven exit 0. It proves that unsupported live facts are rejected. It does not show that a sanitized model can be built from live projections.

**Verification run, 2026-09-15, with the final test code.**

```bash
mvn -pl openmetadata-integration-tests -am verify -Ppostgres-rdf-tests \
  -DintegrationTests.skipIsolated=true -Dit.test=RdfAuthorizationAlignmentIT \
  -Dtest=SanitizedModelExperimentTest -Dsurefire.failIfNoSpecifiedTests=false -DfailIfNoTests=false \
  -Dfailsafe.failIfNoSpecifiedTests=false \
  -DsearchType=opensearch -DsearchImage=opensearchproject/opensearch:3.4.0 \
  -DrdfContainerImage=openmetadata-fuseki:6.2.0-rbac-it -DrdfContainerMemoryBytes=1073741824 \
  -DrdfContainerTmpfsSize=512m "-DrdfContainerJvmArgs=-Xms384m -Xmx384m" \
  -Dspotless.check.skip=true
```

- **Image:** `openmetadata-fuseki:6.2.0-rbac-it` (`sha256:81dd896eb4a1…`), built from `docker/rdf-store` at `4e409314cd7` (tree `ed6684dfd7f5`).
- **Failsafe:** `RdfAuthorizationAlignmentIT` 2 tests, 0 failures, 0 errors, 0 skipped. Both `authorizationFollowsDomainAndRoleChanges` (all six phases) and `sanitizedModelBuildRejectsUnmappedLiveFacts` passed. Surefire: `SanitizedModelExperimentTest` 56 tests, 0 failures, 0 errors, 0 skipped. Maven exit 0.
- **Earlier run of the same command:** it also reported 2 tests, 0 failures, 0 errors, 0 skipped. That was before the class-level RDF condition replaced a `@BeforeAll` assumption.
- **What the passing rejection test shows:** the build was rejected, the four selected violations were among those reported, and every violation was a mapping gap. Neither passing run of this test recorded the full violation list, so the 22 above come from the run in which the build was still a plain test.

**Diagnostics, not latency evidence.** Across the four passing runs, REST checks took 50–104 ms per phase for four tables, and fresh-request checks 13–20 ms. Container peaks: OpenSearch 2,571–2,755 MiB, Fuseki 557–728 MiB (1 GiB limit), Postgres 199–271 MiB. The host recorded no swap-outs.

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
5. **Soft-deleted projection.** A deleted entity emits `prov:invalidatedAtTime`. Whether deleted entities appear is an include-semantics question, not a field permission. Finding 12 experiments locally with a non-deleted-only scope; that is not the production contract.
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
10. **Live projections carry facts outside the map (blocking).** On API-created tables and domains the build failed closed with 22 violations (see "Integration run"). The scalar slice resolves 12 of them, traced in "Scalar attribute evidence": 10 predicate violations (4 on tables, 6 on domains) and the 2 domain-type violations. Still rejected at that point: the container links, `om:joins`, `om:isDeleted`, `om:childrenCount`, domain membership and domain lineage. Finding 12 later maps `om:isDeleted` locally. An integration run on 2026-09-15 confirmed this on live data. No violation named a mapped term, the four asserted deferred facts were still rejected, and every violation was a mapping gap. That run did not record the full remaining list.
11. **Relationship and shared facts need target-aware rules, not field mappings.** Domain membership (`om:has`) and domain-level lineage, which `LineageRepository.addDomainLineage` derives from asset lineage, both reference other assets. `om:joins` is a JSON literal naming other tables. Container links point at service, database and schema entities. A visible domain must not reveal hidden members. These rules are undecided.
12. **Non-deleted scope (local experiment, not the production contract).** Proposed in [`rdf-authorization-scope-proposal.md`](rdf-authorization-scope-proposal.md).
    - **Candidates** are catalog entities loaded as non-deleted, readable or not.
    - **References outside the candidates.** A catalog entity that a retrieved fact references but that is not a candidate is resolved through one catalog lookup, bounded at 1,000 entities; above the bound the build fails. Its state decides the result:
      - soft-deleted: the entity leaves the dataset together with the edges to it;
      - missing: consistency failure;
      - live but not readable: dropped as hidden;
      - live and readable: scope error, because absence from the candidates is not denial.
    - **Reference identity** is validated before any lookup. An `entity/<type>/<id>` object must name a type the catalog registers and carry a canonical lower-case UUID; otherwise the build fails with a consistency failure. A catalog answer that does not establish deletion state is also a consistency failure.
    - **Error order (accepted):** references are collected from every retrieved fact, including facts the mapping later rejects. An over-limit or invalid reference therefore fails the build before any mapping violation is reported.
    - **Database adapter in the integration test:**
      - It makes one `Entity.getEntityReferencesByIds(type, ids, Include.ALL)` call per referenced type.
      - An id the batch omits is classified as missing; `EntityDAO.findReferencesByIds` returns only the rows it finds.
      - The deleted flag comes from `EntityReferenceRow`, where it is a primitive `boolean`. A reference without a flag is inconsistent, not live; the time-series branch of `getEntityReferencesByIds` builds such references.
      - Live resources carry no tags. That is safe only because this test's permission check reloads every authorization attribute.
    - **`om:isDeleted`** is admitted only as `false` on a candidate. `om:isDeleted true` or `prov:invalidatedAtTime` on a candidate is a consistency failure.
    - **Literals, vocabulary terms and owned structures** get no deletion check.
    - **Tests:**
      - `edgesToADeletedEntityLeaveTheNonDeletedDataset`
      - `nonDeletedFlagOnACandidateIsAdmitted`
      - `candidateDeletedInTheProjectionIsAConsistencyFailure`
      - `readableEntityOutsideTheCandidatesIsAScopeErrorNotHidden`
      - `unreadableEntityOutsideTheCandidatesIsHidden`
      - `referenceToAMissingEntityIsAConsistencyFailure`
      - `eachStaleProjectionSignalAloneRejectsANonDeletedCandidate`: `om:isDeleted true` alone, and `prov:invalidatedAtTime` alone
      - `referenceLookupAcceptsExactlyTheLimitOfDistinctEntities`: 1,000 distinct references, one lookup of 1,000
      - `referenceLookupBeyondTheLimitFailsWithoutAPartialModel`: 1,001 fail before any lookup runs
      - `repeatedReferencesToOneEntityUseOneLookupSlot`: 1,000 entities referenced from two tables, one lookup of 1,000
      - `invalidReferenceIdentityFailsBeforeAnyLookup`: an unregistered type, an upper-case UUID and a non-canonical UUID each fail before any lookup
      - `inconsistentCatalogAnswerIsAConsistencyFailure`
    - **Local result:** `SanitizedModelExperimentTest` 72 tests, 0 failures, 0 errors, 0 skipped.
    - **Not covered:**
      - a successful complete model on real data, and the two-second target;
      - deletion or restoration during a build, where version comparison remains an unverified hypothesis;
      - container targets, which stay deferred;
      - latency or scale of any kind;
      - identity-only container exposure, which this fixture cannot exercise because its containers are readable;
      - the time-series branch of `getEntityReferencesByIds`, which builds references without a deleted flag.
    - **Caller-facing errors:** translating them to generic reasons is a production requirement; the builder keeps detailed test diagnostics.
    - **Live run, 2026-09-16** (one guarded run, same command and 6.2.0 image as the verification run): `RdfAuthorizationAlignmentIT` 2 tests, 0 failures, 0 errors, 0 skipped; `SanitizedModelExperimentTest` 72 tests, 0 failures, 0 errors, 0 skipped; Maven exit 0.
      - **Soft-deleted reference:** a table E was created upstream of A and soft-deleted. The lineage edge stayed projected, the batch API reported `deleted=true` for E and `deleted=false` for A, and the adapter classified E as deleted and A as live. No violation named E, so the edge left the dataset by scope rather than by rejection.
      - **Deletion-state contract:** confirmed live for regular entities. The time-series branch of `getEntityReferencesByIds`, which builds references without a flag, is still untested.
      - **Six authorization phases:** all passed, with REST matching the expected result and fresh-request decisions matching REST.
      - **Container permissions (recorded, not asserted):** the caller could read the service, database and schema in every phase, through REST and in-process alike, including the phase where an unconditional deny hid every table. This matches the code-level expectation in [`rdf-authorization-scope-proposal.md`](rdf-authorization-scope-proposal.md), so this fixture exercises readable containers only.
      - **Diagnostics, not latency evidence:** REST checks took 52–88 ms per phase, fresh-request checks 13–18 ms. Container peaks: OpenSearch 2,744 MiB, Fuseki 721 MiB, Postgres 267 MiB. Free RAM stayed at or above 43%, with no swap-outs.

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
- **Real policy integration end to end.** The integration test exercises `DefaultAuthorizer`, role policies resolved through `SubjectCache`, `ResourceContext` entity loading and the `hasDomain()` condition, for one user on four tables. Not exercised: team and persona policies, bot and reviewer handling, owner conditions such as `isOwner()`, and the search-side compiled RBAC filter. In the in-process semantic tests the catalog attributes (tags) are fixture values, not loaded from the database.
- **A sanitized model built from live projections.** It is always rejected today (Findings 10 and 11).
- **Field coverage** beyond the predicates this fixture emits. Also unproven: the documented map for glossary terms, domains, owners, data products, usage, sample data, tests, queries, custom properties, lifecycle and certification.
- **Candidate selection at scale.** The builder evaluates every catalog resource; a real system needs a pre-filter (for example the search RBAC compiler).
- **Remote consistency.** The three retrieval queries are not pinned to one dataset (ADR F8): no blue/green or in-place rebuild behavior (A9), and no snapshot.
- **Permission freshness and revocation** (A7) beyond one JVM: the integration test shows REST and in-process decisions following a domain move and an assigned or removed deny role in the same application. Cross-pod invalidation, in-flight requests and policy edits are not covered. Cancellation of remote work (F9) is not covered either.
- **Memory, latency and scale.** Nothing beyond four tables, and no heap or per-request timing measurement.
- **Owned blank-node structures** (they fail closed by design, but no test covers them) and orphaned owned nodes.

## Proposed next step (needs approval)

Decide, with the #33224 owners, how two things are governed or re-projected: tag-application attributes on shared tag nodes (Finding 3) and edge-owned lineage details (Finding 4). Map the scalar live facts of Finding 10 in small groups, deriving each operation from the resource's registered view operations. Review the relationship and shared-fact rules of Finding 11 separately. Scale, consistency and freshness measurements should wait until the map covers a representative asset.
