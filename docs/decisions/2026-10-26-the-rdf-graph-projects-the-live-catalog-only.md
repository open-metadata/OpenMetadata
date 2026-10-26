# The RDF graph projects the live catalog only

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** OpenMetadata backend maintainers
- **Guard:** `RdfSoftDeleteIT`, `RdfSoftDeleteReindexIT`, `RdfRestorePlannerTest`
- **Related:** #36277, open-metadata/ai-platform#1913

## Context
Soft-deleted entities stayed in the knowledge graph with `om:isDeleted true`, so SPARQL answers
included assets that search hides. Search and SPARQL must agree on what is in the catalog. A
client-side `isDeleted` filter cannot do it: every client has to remember it, and it cannot apply to
the intermediate nodes of a property path, so in `?x om:upstream+ ?y` a deleted node still connects
its live neighbours.

## Decision
A soft-deleted entity and every edge to it are absent from the graph, as after a hard delete. This
holds for a cascade as for its root, and for the reindex, which reads live entities only.

A restore rebuilds the entity from the database: its own triples, its relationship rows (lineage
with its details), and the live entities whose triples point at it. An edge is added only when both
of its ends are live, checked again when the write is applied, so the result does not depend on
the order in which a cascade restores its entities.

## Consequences
Clients need no deleted-entity filter. A restore costs one live write per edge and per entity that
references the restored one.

No migration: a graph built before this rule keeps its soft-deleted entities until the next RDF
reindex, run with Recreate and Blue/Green on.

Known limit: soft-deleting a tag or glossary term on its own removes its labels from the database
(`TagRepository.postDelete`, `GlossaryTermRepository.postDelete`), so restoring it brings no labels
back, in the graph as in the API. A cascade from a classification or glossary keeps them.
