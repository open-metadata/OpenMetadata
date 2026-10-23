# Native concept bindings remain operational metadata

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial) · v2 2026-10-23 (binding rows, bounded paging, the ontology data graph)
- **Deciders:** Ontology Studio implementation review
- **Guard:** OntologyConceptBindingsIT, NativeOntologyDataGraphIT, OntologyBindingRulesTest, OntologyConceptBindingMigrationTest
- **Related:** ADR:2026-10-17-glossaries-do-not-own-ontology-models,
  [#35984](https://github.com/open-metadata/OpenMetadata/issues/35984)

## Context

Studio needs catalog asset links and property-to-column assignments. These links depend on current catalog permissions and structure, whereas semantic releases must remain immutable.

## Decision

Store bindings under the concept UUID in the `ontology.conceptBindings` entity extension, with an independent integer revision. Exclude them from generic custom properties, concept JSON, semantic working revisions, release digests, and RDF import/export.

The concept bindings API resolves asset UUIDs through canonical repositories and current target permissions. Reads omit inaccessible or deleted targets without exposing fallback names or counts. Writes require concept `EditAll` and target `ViewBasic`, compare the binding revision under the existing ontology lock, and update one asset association so hidden associations survive. Identical retries are no-ops. Reads do not take a write lock.

A successful association change also removes links to canonically deleted or missing assets under that lock. Permission-hidden live assets remain. Cleanup shares the mutation's single revision increment; a no-op does not perform cleanup. This reclaims capacity without a background job or a read-side write.

Column assignments use a native data-property UUID and exact column-name segments. Named superclass inheritance within the ontology determines applicable properties; SKOS hierarchy does not. Missing columns remain unresolved until explicitly rebound. The API caps a concept at 100 assets and 500 assignments, an asset at 100 assignments, and a column path at 32 segments of 256 characters. These bounds keep editing and selected-concept graph rendering interactive.

## Consequences

Catalog renames resolve through stable UUIDs. Catalog changes do not require semantic publication. Restoring an asset does not restore links already pruned by a later binding change. The Data graph shows the selected concept's authorized assets and columns; it does not infer lineage or aggregate every concept's catalog access.

## Amendment — 2026-10-23: binding rows, bounded paging, and the ontology data graph

Each association is one row of `ontology_concept_binding`, keyed by concept and asset id and indexed by asset id. The binding revision stays in the `ontology.conceptBindings` extension and is still compared under the ontology lock, so the write contract above is unchanged. The 2.1.0 migration copies every existing document into rows once and leaves the documents in place.

The cap of 100 assets per concept is removed. The 500-assignment, 100-per-asset, and column path bounds stay. `GET /ontologyConcepts/{id}/bindings` pages viewable assets in asset id order with a `limit` of at most 100 and an opaque `after` cursor. One request examines at most ten times `limit` rows, so a reader hidden from most of a large concept gets short pages and a cursor instead of a slow request. A page may hold fewer than `limit` assets while a cursor follows, and the last page may be empty. The cursor names the last row examined, which can be an asset the reader cannot view; it carries that asset's id and nothing else.

`GET /ontologies/{id}/dataGraph` pages an ontology's bound concepts by offset, ranked by stored binding count, so every reader sees the same order and `paging.total`. Each cluster's `assetCount` and its first assets are only what the reader may view, and a concept with nothing viewable is left out. Edges join returned concepts through object property assertions and class restrictions; the property reference and its display name appear only when the reader may view the property. Lineage edges join returned assets. The Data graph now shows every concept the reader may view with its viewable assets and the observed lineage between the returned assets.
