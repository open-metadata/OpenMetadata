# Asserted-only RDF reads name every graph outside graph/inferred/ as their dataset

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `AssertedOnlyQueriesTest`, `AssertedGraphTrackingRdfStorageTest`, and
  `RdfInferenceMaterializationIT#inferenceLevelNoneLeavesOutMaterializedConclusions`
- **Related:** [#35200](https://github.com/open-metadata/OpenMetadata/issues/35200),
  [#35201](https://github.com/open-metadata/OpenMetadata/pull/35201),
  `docs/plans/2026-10-07-fuseki-native-reasoning.md` (phase 4 moves rule output off the serving
  dataset)

## Context

Fuseki serves the RDF dataset with `tdb2:unionDefaultGraph`, so the default graph holds every
named graph, including the rule graphs materialized inference writes under
`<baseUri>graph/inferred/`. The starter rules write the same predicates as asserted data
(`om:hasTag`, `om:belongsToDomain`), so `inferenceLevel=none` answered exactly like `custom`.

## Decision

- While materialized inference is enabled, asserted-only reads — the `none` level of
  `/v1/rdf/sparql` and the MCP SPARQL tool, the agent SPARQL endpoint, complete lineage,
  `LineagePathFinder`, and the centrality, community and co-occurrence insights — run with every
  graph whose IRI does not start with `<baseUri>graph/inferred/` as both `FROM` and `FROM NAMED`.
  That prefix is what marks a graph as derived. A query that declares its own dataset runs as
  written. With no asserted graph, the dataset is the sentinel
  `urn:openmetadata:rdf:no-asserted-graph`, which names no graph.
- The graph list is read from Fuseki and cached per server. A write by this server that names a
  graph missing from the list, or a SPARQL update whose target graphs cannot be read, drops it so
  the next read relists; a blue/green promotion drops it too. An empty list is never kept. A
  background refresh every two minutes picks up graphs created by another server or a direct
  Fuseki writer, because listing graph names walks the store's graph index and grows with it.
- Rejected: rewriting patterns to `GRAPH ?g` with a filter, which breaks property paths that
  cross graphs and returns a triple once per graph holding it; a second Fuseki dataset without
  rule graphs, which needs a deployment change and a fixed set of graphs; and a fixed list of the
  graphs OpenMetadata writes, which misses graphs created by SPARQL updates.

## Consequences

Asserted-only reads no longer see derived triples, and Jena evaluates several `FROM` graphs as a
de-duplicating union, so cross-graph paths behave as on the union default graph. These reads run
through Jena's union view instead of TDB2's native union, so they cost more on large datasets.
A graph created by another server can be missing from this server's asserted-only reads for up to
two minutes. Disabling materialized inference does not empty the rule graphs, so they must be
cleared or `none` reads include them again. Phase 4 moves rule output off the serving dataset;
this rule can then be retired.
