# The Neptune connector computes a missing property graph schema by default and maps labels to tables

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** venkat22
- **Guard:** `ingestion/tests/unit/topology/database/test_neptune.py` (`TestSchemaLifecycle`, `TestSource`)
- **Related:** #37457; #34250 (Neo4j connector); #26002 (graph database connectors)

## Context
Neptune exposes property graph metadata only through `neptune.graph.pg_schema()`, which returns
empty fields until `neptune.graph.pg_schema.compute()` has run. Scanning the graph to infer
labels would be costly on large catalogs. `compute()` is a write-permission procedure
(`neptune-db:ReadDataViaQuery` and `WriteDataViaQuery`), runs asynchronously and is rejected on
read replicas.

## Decision
- `computeSchemaIfMissing` defaults to `true`: a `NotStarted`, `Stopped` or `Paused` schema is
  computed (or resumed) so ingestion works without a manual step. Set it to `false` for
  read-only IAM roles; the connector then fails with a message naming the option.
- `schemaComputeTimeoutSeconds` defaults to 900. Polling starts at 5 seconds and backs off to
  30 seconds. A timeout, `Failed` state, unknown state or an empty schema is an error; partial
  `InProgress` results are never ingested.
- Node labels become tables in a `nodes` schema and edge labels tables in a `relationships`
  schema (the latter optional through `includeRelationships`). Edge endpoints from `labelTriples`
  are written into the edge table description, as Neptune has no foreign keys.
- The test connection never starts a computation.

## Consequences
Default ingestion may trigger a schema computation on the writer instance and needs write IAM
permission; users who cannot grant it must opt out. Revisit if Neptune exposes a read-only way
to compute the schema.
