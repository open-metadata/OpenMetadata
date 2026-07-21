# Ontology Studio 2.0

Ontology Studio is the governed modeling workspace for OpenMetadata 2.0. It keeps glossary terms as the relational source of truth for concepts and adds typed concept attributes, first-class relationship types, stable ontology relationships, OWL axioms, draft change sets, impact analysis, model layering, and RDF interchange.

Apache Jena Fuseki is an optional projection. Core authoring, versioning, review, import, export, bulk editing, and impact analysis continue to use the metadata database when RDF is unavailable. Query, materialized inference, RDF graph exploration, and dereferenceable RDF representations require RDF to be enabled.

## Product surfaces

The `/ontology-studio` workspace exposes five permission-aware modes:

- **View** provides model and data exploration, graph and accessible tree surfaces, glossary scope, search dimming, typed relation details, health summaries, and bounded graph paging.
- **Edit** provides graph relationship authoring, a structured term editor, QTT-style bulk authoring, IRI and prefix governance, pattern instantiation, subset creation, structural diff and merge, typed axioms, and inference explanations. A glossary edit requires a renewable database lease.
- **Query** provides glossary-scoped SPARQL, server-backed saved queries, a visual query builder, and table or read-only subgraph results.
- **Library** lists signed, checksummed ontology-pack manifests and supports dependency-aware dry runs and installation into a new read-only glossary. Installation is administrator-only.
- **AI** exposes relationship suggestions, standards mapping, natural-language SPARQL, and domain drafting only when `RDF_ASK_COLLATE_ENABLED=true`. AI output is always a proposal or dry run; it never writes directly.

## Modeling contract

A glossary is an ontology module. Its `ontologyConfiguration` defines:

- an absolute base IRI;
- layer `L1`, `L2`, or `L3`;
- imported glossary references;
- a unique prefix registry;
- an IRI pattern containing `{glossary}`, `{term}`, and/or `{uuid}`;
- read-only state and installed-pack provenance.

Imports must be acyclic and may point only to the same or a more foundational layer. For example, L3 may import L1 or L2, while L1 cannot import L3. Models remain separate modules; imports resolve references without merging their relational records.

Each logical relationship is stored once with a stable ID, authored direction, relationship-type ID, provenance, approval status, creator, and creation time. Inverse edges are derived. Domain/range, cardinality, cross-glossary policy, layer direction, and OWL characteristics are validated before persistence.

Unsupported imported RDF statements are canonicalized into an immutable annex revision. Export combines current relational entities, authored axioms, and annex statements, then removes duplicates. This is why import and export retain fidelity even when Fuseki is disabled.

## Configuration

The defaults in `conf/openmetadata.yaml` are conservative: RDF, materialized inference, LOD redirects, and Ontology AI are off; SHACL runs in report mode.

| Variable | Default | Effect |
| --- | --- | --- |
| `RDF_ENABLED` | `false` | Enables the RDF projection and RDF-dependent Studio capabilities. |
| `RDF_ENDPOINT` | `http://localhost:3030/openmetadata` | Fuseki dataset endpoint. |
| `RDF_BASE_URI` | `https://open-metadata.org/` | Root for OpenMetadata resource and graph IRIs. |
| `RDF_MATERIALIZED_INFERENCE_ENABLED` | `false` | Uses durable per-rule inferred graphs. |
| `RDF_INFERENCE_ENABLED` | `false` | Enables query-time inference selection. |
| `RDF_DEFAULT_INFERENCE_LEVEL` | `NONE` | Default of `NONE`, `RDFS`, `OWL_LITE`, `OWL_DL`, or `CUSTOM`. |
| `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` | `100000` | Hard guardrail for legacy bounded in-process inference. |
| `RDF_SHACL_VALIDATION_MODE` | `REPORT` | `OFF`, `REPORT`, or `ENFORCE_IMPORTS`. |
| `RDF_DEREFERENCEABLE_IRIS` | `false` | Enables authenticated content-negotiated LOD redirects. |
| `RDF_STRICT_OWL_PROFILE` | `true` | Rejects authored structures outside supported OWL 2 DL guardrails. |
| `RDF_ASK_COLLATE_ENABLED` | `false` | Enables Ontology AI endpoints and UI. |
| `RDF_FEDERATION_ENABLED` | `false` | Allows configured SPARQL `SERVICE` targets. |

Use the RDF compose profile for a complete local stack:

```bash
./docker/run_local_docker_rdf.sh -m ui -d postgresql -f true
```

The standard Docker startup intentionally leaves RDF disabled. Production sizing and Fuseki operations are documented in [RDF production setup](rdf-production-setup.md).

## Security model

- View mode, authenticated RDF status, and glossary exports use normal entity `VIEW` authorization.
- Edit mode and glossary edit leases require `EDIT_GLOSSARY_TERMS`, `EDIT_ENTITY_RELATIONSHIP`, or administrator access.
- Scoped SPARQL builds a server-owned dataset from glossaries the caller may view. It rejects updates, user-supplied dataset clauses, unsafe federation, and cross-glossary pair graphs unless both sides are authorized.
- `/api/v1/rdf/sparql` remains an unrestricted, administrator-only full-knowledge-graph endpoint.
- Relationship-type administration, pack installation, whole-graph SHACL validation, inference rule administration, and AI capability administration are administrator operations.
- LOD redirects are authenticated and still perform entity-level view authorization. Anonymous public LOD is not part of 2.0.
- Edit leases use a 60-second database record with a 20-second client heartbeat. A contending editor sees the holder and all mutation controls remain disabled.

## Import, validation, and export

Supported imports are Turtle, RDF/XML, N-Triples, and safe JSON-LD. JSON-LD may use inline or bundled classpath contexts; remote context retrieval is rejected. Payloads are bounded at 10 MiB, RDF/XML `DOCTYPE` declarations are rejected, and dry run is the default.

SHACL behavior is:

- `OFF`: committed imports skip SHACL; dry runs still report it.
- `REPORT`: imports return a bounded typed report and continue.
- `ENFORCE_IMPORTS`: a nonconforming committed import returns HTTP 400; dry runs return the report without writing.

Relational entity writes are never blocked by asynchronous projection validation. The database remains authoritative and a later RDF rebuild repairs projection failures.

Exports support Turtle, RDF/XML, N-Triples, and JSON-LD. OWL-XML is intentionally not supported; convert it to RDF/XML or Turtle with an external ontology tool before import.

## API groups

The public contracts are generated from `openmetadata-spec` JSON Schema. Principal endpoint groups are:

| Group | Path |
| --- | --- |
| Relationship types | `/api/v1/relationshipTypes` |
| Stable term relationships | `/api/v1/glossaryTerms/{termId}/relations` |
| Axioms and change sets | `/api/v1/ontology/axioms`, `/api/v1/ontology/changeSets` |
| Bulk jobs | `/api/v1/ontology/bulk` |
| Impacts | `/api/v1/ontology/impacts` |
| Edit leases | `/api/v1/ontologyEditLocks` |
| Packs, patterns, subsets, structure | `/api/v1/ontologyPacks`, `/api/v1/ontology/patterns`, `/api/v1/ontology/subsets`, `/api/v1/ontology/structure` |
| Modeling and reasoning | `/api/v1/ontology/modeling`, `/api/v1/ontology/reasoning` |
| Scoped glossary SPARQL | `/api/v1/glossaries/{id}/sparql` |
| Saved queries | `/api/v1/rdf/savedQueries` |
| RDF health and administration | `/api/v1/rdf/status`, `/api/v1/rdf/*` |
| Authenticated LOD | `/api/v1/lod/entity/{type}/{id}` |

The Java SDK exposes matching typed services through `OpenMetadataClient`.

## Library content and licensing

The bundled FIBO starter and terminology-safe FHIR R5 starter contain only the pinned modules declared by their manifests. Every bundled module has a SHA-256 checksum and installation records the pack ID, version, source URL, license, selected modules, checksums, installer, and timestamp.

HR Open, ISA-95, GS1, and EPCIS are catalogue entries only. Their standards content is not redistributed by OpenMetadata; operators must obtain and convert content under their own license. FHIR third-party terminologies are excluded from the bundled starter.

## Operations and release health

After enabling RDF, verify:

```bash
curl -H 'Authorization: Bearer <token>' \
  http://localhost:8585/api/v1/rdf/status
```

The response must report `enabled: true`, a reachable storage type, projection state, and inference capability. Trigger `RdfIndexApp` with `recreateIndex: true` after a 2.0 upgrade. Run `RdfInferenceApp` after the asserted graph is current when materialized inference is enabled.

Monitor HTTP/RDF latency, RDF index job state and failed records, projection degradation, rejected SPARQL requests, SHACL violations, inference rule dirty/error state, lock conflicts, pack import failures, and AI provider failures. Treat the following as release blockers:

- a disabled or unreachable RDF store in an RDF-enabled deployment;
- a nonterminal or failed required full rebuild;
- dropped or persistently failing projection updates;
- unexpected SHACL regressions in the configured policy;
- dirty inference rules that cannot materialize;
- sustained lease conflicts after the holder expires;
- pack checksum or dependency failures;
- any AI request while the feature flag is disabled.

The admin Prometheus endpoint exposes the bounded-cardinality release signals below. All counters use only the fixed `result` values registered at startup; no glossary, user, pack, rule, or query text is used as a metric tag.

| Metric | Release use |
| --- | --- |
| `ontology.rdf.queue.pending`, `ontology.rdf.queue.lag`, `ontology.rdf.queue.dropped` | Projection pressure, latency, and data-loss repair trigger. |
| `ontology.query.rejected` | Scoped-query and federation boundary rejection. |
| `ontology.rdf.rebuild{result=...}` | Required rebuild started/completed/failed state. |
| `ontology.shacl.validation{result=...}` | Conforming, violating, and skipped validation totals. |
| `ontology.inference.run{result=...}` | Materialization completion/failure. |
| `ontology.lock.contention` | Active foreign lease conflicts. |
| `ontology.pack.import{result=...}` | Pack import completion/failure. |
| `ontology.ai.request{result=...}` | Completed, failed, and disabled AI calls. |

Graph responses are bounded by default to 500 nodes and 1,000 edges, SPARQL results to 10,000 rows/triples, and scoped query time to 10 seconds. Data-mode assets page in groups of 20. Do not remove these bounds to accommodate a large model; use search, graph slices, and lazy tree expansion.

The external scale profile includes an Ontology Studio gate. Its daily 100,000-concept smoke test requires indexed exact-name search p95 below one second and verifies that a densely connected relation slice respects explicit node and edge limits. Run the one-million-concept release benchmark with:

```bash
mvn verify -P scale-it -pl :openmetadata-integration-tests \
  -Dskip.embedded.bootstrap=true \
  -Djpw.ontology.concepts=1000000 \
  -Djpw.data.mode=ingest
```

The workflow accepts `scaleSeeds: [1000000]` for the corresponding external-cluster release gate and uploads `ontology-scale-1000000.json` with ingestion, search, and bounded-graph measurements.

## Explicit 2.0 limits

Multilingual SKOS label storage, public anonymous LOD, OWL-XML, raw triple editing, real-time co-editing, endpoint dragging, a first-class `parents[]` replacement for structural parent, permission-filtered full-KG SPARQL, QLever completion, and a second graph library are deferred. Import selects one canonical literal for display while preserving unsupported language-tagged statements in the annex.

Upgrade and rollback procedures are in [Ontology Studio 2.0 migration](ontology-studio-2.0-migration.md). The release capability statement is in [Ontology Studio 2.0 capability matrix](ontology-studio-2.0-capability-matrix.md).
