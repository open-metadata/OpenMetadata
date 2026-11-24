# Ontology terms have dedicated search indexes

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `OntologyTermSearchIT`, `OntologyTermIndexTest`, `AvailableEntityTypesConsistencyTest`
- **Related:** ADR:2026-10-15-fuseki-holds-only-the-active-ontology-release, ADR:2026-10-19-native-concept-bindings-remain-operational-metadata

## Context

Grounding a question in the ontology requires discovering a concept or property when the question
uses the description or a synonym. The serving graph holds the active release. Ontology Studio
edits working definitions and keeps the mappings to catalog assets in a separate binding store.

## Decision

Index `ontologyConcept` and `ontologyProperty` independently and expose them together via
`ontologyTerms`. The two indexes let the standard reindex job replace each type independently.
Both indexes sit outside the catalog asset aliases and Data Insights.

Read semantic fields from the active release. Exclude deleted terms and terms deprecated in that
release. Index current owners and the opaque IDs of live bound tables. Admin REST search
responses resolve table and column FQNs from the live binding store. Other consumers should
resolve bindings through the authorized ontology bindings API.

Write term documents synchronously and submit embedding work to the ordered lifecycle queue.
Activation refreshes the union of the previous and current release members in bounded batches.
Live writes and reindex hold the same term row locks from the active-state read through the search
write. Embedding calls run outside the locks, and their results are written only while the
published fingerprint still matches. Ontology owner changes refresh active members. Binding edits
and table deletion or restoration refresh the affected concepts. Table and column names are resolved
at query time and do not trigger term writes. Manual entity reindexing uses the same published-term
writer. Bulk creates pass their terms to that writer together, which batches release membership,
binding rows, and table reads, and shares resolved property labels with the embedding builder.

Embed the label, synonyms, description, and property domain and range labels. OpenSearch stores
chunks in `ontology_embeddings_chunks`, and Elasticsearch serves vectors from the term indexes.
Term writes delete chunks for inactive terms and chunks with a superseded fingerprint. With
embeddings disabled, reconciliation skips the refresh and deletion when the chunk index is absent,
but still cleans up an existing index from an earlier configuration. A
successful ontology reindex also sweeps chunks whose parents are absent from the catalog.
The data-asset chunk generation tracks the entity types that write to it, including for saved
reindex configurations with explicit entity lists.

## Consequences

Collate can query `/v1/search/query?index=ontologyTerms` and use the returned IRIs to resolve graph
nodes. Its hybrid query can target the same alias when embeddings are configured. Reindex both
types to populate the indexes from releases that were active before the upgrade.
