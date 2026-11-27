# The entity graph response is a shared contract

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Knowledge Graph maintainers
- **Guard:** `RdfGraphServiceTest#explorePreservesExactGraphJson`
- **Related:** CX137

## Context

The asset Knowledge Graph tab draws the RDF explore response. Collate's Knowledge Graph MCP tool
also needs to emit nodes and edges the renderer can use.

## Decision

Use `api/rdf/entityGraph.json` as the contract for `GET /v1/rdf/graph/explore`, including ontology
binding links. Collate can reference its `graphNode` and `graphEdge` definitions directly. Keep
layout, presentation and interaction state in the UI.
Absent node text fields mean there is no value for that field.

## Consequences

Changes to the explore response must account for consumers of the shared definitions. The
glossary graph retains its own response shape, including term IDs and glossary membership.
