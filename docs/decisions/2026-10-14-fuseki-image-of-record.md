# OpenMetadata runs and tests the published openmetadata/fuseki image, pinned by commit

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial) · v2 2026-11-23 (the image no longer carries a reasoner) · v3 2026-11-27 (OpenMetadata requires the Graph Store extension)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** the RDF integration-test lane (`-DintegrationTests.lane=rdf`), which starts
  `FusekiTestImage.DEFAULT_IMAGE`; `RdfFusekiAuthorizationIT` and `RdfStorageReadinessIT` pin its
  access and readiness contract, and `RdfStorageReadinessIT#fusekiWithoutTheExtensionFailsNamingIt`,
  `RdfStorageReadinessIT#ontologyActivationWithoutTheExtensionFailsNamingItAndWritesNothing` and
  `FusekiWriteCapabilitiesTest` pin that readiness and activation refuse a dataset without the
  extension; `RdfLiveWriteRecoveryIT#aStoreThatCannotServeTheWriteDeadLettersItAtOnceAndDeliversTheNext`
  pins that the queue does not retry that refusal
- **Related:** [Fuseki-native reasoning plan](../plans/2026-10-07-fuseki-native-reasoning.md)
  (phase 1, task 4; open decision 6), [rdf-fuseki-image-release.md](../rdf-fuseki-image-release.md)

## Context

Two Fuseki images had diverged. `docker/rdf-store/` built one from the Fuseki tarball with a fixed
assembler (three datasets, union default graph, 50 s deadlines, Lucene text indexes), an
`openmetadata` writer account, and anonymous `/sparql` and `/query`. The open-metadata/jena fork
publishes `openmetadata/fuseki` with the same Graph Store extension, environment-driven datasets
and settings, admin-only access, `tini`, a `/fuseki` volume, and the reasoner worker the reasoning
plan builds on. Integration tests, Compose files and the Kubernetes manifest used the in-repo
build, so nothing in this repository exercised the image reasoning ships in, and every RDF test
run downloaded Fuseki from `archive.apache.org`.

## Decision

- The published `openmetadata/fuseki` image is the only Fuseki image OpenMetadata runs, tests and
  documents. `docker/rdf-store/` no longer builds one; only its Kubernetes example remains.
- Everything pins the immutable `<version>-<commit>` tag, today `6.2.0-600514c` (index digest
  `sha256:5db427d91c1fcd4482b0d10d372699aeeda45cf019867791a31a81d968ceab7e`), never the moving
  `<version>` tag. `FusekiTestImage.DEFAULT_IMAGE` is the reference; Compose files, the manifest and
  the docs repeat it and move with it in one change.
- OpenMetadata configures the image only through its environment: `ADMIN_PASSWORD`,
  `FUSEKI_DATASETS=openmetadata,openmetadata_a,openmetadata_b`, `FUSEKI_UNION_DEFAULT_GRAPH=true`,
  `FUSEKI_QUERY_TIMEOUT_MS=50000`, `FUSEKI_UPDATE_TIMEOUT_MS=50000`,
  `OPENMETADATA_EXTENSION_ENABLED=true`, and the heap.
- `-DrdfContainerImage` still overrides the test image, for a local build of the fork.

## Consequences

- The RDF lane tests the image reasoning will run in, and no longer depends on
  `archive.apache.org`.
- Anonymous reads are refused, the `openmetadata` writer account is gone (OpenMetadata already
  connects as `admin`), and there is no Lucene text index; no OpenMetadata or MCP code used either.
  Scoped accounts need `FUSEKI_MANAGE_SHIRO=false` and an operator `shiro.ini`.
- The union default graph is server-wide, so a dataset created through `POST /$/datasets` passes
  readiness too.
- Existing volumes keep TDB2 under `/fuseki-data/<dataset>`; the published image reads
  `/fuseki/databases/<dataset>`, so upgrades copy the datasets or rebuild
  ([cut-over steps](../rdf-fuseki-image-release.md#cutting-over-an-existing-deployment)).
- Image changes now land in the fork first and reach OpenMetadata by moving the pin after the RDF
  lane passes against the new tag. Revisit only if OpenMetadata needs an image the fork cannot
  publish.

## Amendment: the image no longer carries a reasoner (v2, 2026-11-23)

Reasoning moved out of the `openmetadata/fuseki` image into a `ReasoningProvider`
(ADR:2026-11-23-reasoning-runs-in-an-external-provider-that-publishes-into-jena). The reasoner
worker is no longer a reason to run this image, and the v1 consequence that the RDF lane tests the
image reasoning runs in no longer applies. The image is still the only one OpenMetadata runs,
tests and documents, for its Graph Store extension and its operational guards: the bounded upload,
`GuardedUpdate`, the free-space write guard and the storage report. The commit-pinned tag and the
environment contract above are unchanged.

## Amendment: OpenMetadata requires the Graph Store extension (v3, 2026-11-27)

Until now the extension was optional. Without it, readiness logged the guarantees it could not see
and indexing went on. Jena 6.3.0 makes that unsafe: stock Fuseki refuses an RDF Thrift row over
100 KB (apache/jena GH-4377), and OpenMetadata uploads rebuilds and ontology releases as Thrift. On
a server without the extension, a rebuild loses every entity with a description or query over that
size and still reports success, and an ontology release holding such a literal fails to activate.
The extension reads Thrift uploads with its upload bound as the row cap (open-metadata/jena#24).

- `FusekiWriteCapabilities.negotiate` refuses a dataset whose `OPTIONS /<dataset>/data` response
  carries no `X-OpenMetadata-*` header, so `ensureStorageReady` fails before any data is cleared.
  The message names the dataset and `OPENMETADATA_EXTENSION_ENABLED=true`. The dataset, credential
  and read-only checks run first, so their messages are unchanged.
- A guarantee the extension leaves unmet, such as an unset `arq:queryTimeout`, is still logged and
  does not fail readiness.
- Ontology activation (`replaceGraph`) checks the same capabilities before it uploads, so a
  release fails with the same message instead of Fuseki's HTTP 500. The refusal is an
  `RdfStorageUnsupportedException`: the live-write queue dead-letters it on the first attempt and
  marks the projection degraded, instead of retrying it for minutes ahead of every later write.
- The pinned image loads the extension only when `OPENMETADATA_EXTENSION_ENABLED=true`, which
  every Compose file and the Kubernetes example set. A deployment that supplies its own
  environment must set it too.
- An operator's own Fuseki must put the extension jar on its classpath and start through a main
  class that loads Fuseki modules, such as `FusekiServerPlainCmd`. `FusekiMainCmd` loads none, so
  the jar does nothing there. Apache's Fuseki distribution alone is no longer a supported store.
- The free-space record's consequence for a store without the extension
  (ADR:2026-10-28-the-fuseki-image-refuses-writes-below-a-free-space-reserve-and-reports-its-volume)
  no longer arises, because such a store does not pass readiness.

Alternatives considered:
- **Upload N-Triples to a server without the extension.** N-Triples has no row cap, so stock
  Fuseki would work. It was rejected because it keeps a second upload path in the indexing code
  that the RDF lane never runs, and stock Fuseki would still hold TDB2's writer for the whole
  transfer of each upload.
- **Document the requirement and keep the warning.** It was rejected because the failure is silent:
  a rebuild that drops entities reports COMPLETED.
