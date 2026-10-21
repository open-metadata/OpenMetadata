# Native concept bindings remain operational metadata

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Ontology Studio implementation review
- **Guard:** OntologyConceptBindingsIT, OntologyBindingRulesTest
- **Related:** ADR:2026-10-17-glossaries-do-not-own-ontology-models

## Context

Studio needs catalog asset links and property-to-column assignments. These links depend on current catalog permissions and structure, whereas semantic releases must remain immutable.

## Decision

Store bindings under the concept UUID in the `ontology.conceptBindings` entity extension, with an independent integer revision. Exclude them from generic custom properties, concept JSON, semantic working revisions, release digests, and RDF import/export.

The concept bindings API resolves asset UUIDs through canonical repositories and current target permissions. Reads omit inaccessible or deleted targets without exposing fallback names or counts. Writes require concept `EditAll` and target `ViewBasic`, compare the binding revision under the existing ontology lock, and update one asset association so hidden associations survive. Identical retries are no-ops. Reads do not take a write lock.

A successful association change also removes links to canonically deleted or missing assets under that lock. Permission-hidden live assets remain. Cleanup shares the mutation's single revision increment; a no-op does not perform cleanup. This reclaims capacity without a background job or a read-side write.

Column assignments use a native data-property UUID and exact column-name segments. Named superclass inheritance within the ontology determines applicable properties; SKOS hierarchy does not. Missing columns remain unresolved until explicitly rebound. The API caps a concept at 100 assets and 500 assignments, an asset at 100 assignments, and a column path at 32 segments of 256 characters. These bounds keep editing and selected-concept graph rendering interactive.

## Consequences

Catalog renames resolve through stable UUIDs. Catalog changes do not require semantic publication. Restoring an asset does not restore links already pruned by a later binding change. The Data graph shows the selected concept's authorized assets and columns; it does not infer lineage or aggregate every concept's catalog access.
