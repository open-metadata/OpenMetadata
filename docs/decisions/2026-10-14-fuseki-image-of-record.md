# OpenMetadata runs and tests the published openmetadata/fuseki image, pinned by commit

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** the RDF integration-test lane (`-DintegrationTests.lane=rdf`), which starts
  `FusekiTestImage.DEFAULT_IMAGE`; `RdfFusekiAuthorizationIT` and `RdfStorageReadinessIT` pin its
  access and readiness contract
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
