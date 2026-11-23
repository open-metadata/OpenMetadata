# Ontology terms have dedicated search indexes

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Pablo Brull
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
release. Refresh the concept's table and column references from the live binding store. Use current
owners for search access rules. Embed the label, synonyms, description, and property domain and
range labels. Binding changes leave embedding input intact.

## Consequences

Collate can query `/v1/search/query?index=ontologyTerms` and use the returned IRIs to resolve graph
nodes. Its hybrid query can target the same alias when embeddings are configured. Reindex both
types to populate the indexes from releases that were active before the upgrade.
