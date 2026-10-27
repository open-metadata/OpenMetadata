# Native concept bindings remain operational metadata

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial) · v2 2026-10-23 (binding rows, bounded paging, the ontology data graph) · v3 2026-10-24 (write confirmation and complete read recovery) · v4 2026-10-26 (paged cleanup under the lock, lineage between returned assets) · v5 2026-10-26 (stateless combined graph pages)
- **Deciders:** Ontology Studio implementation review
- **Guard:** OntologyConceptBindingsIT, OntologyConceptBindingCleanupIT, NativeOntologyDataGraphIT, NativeOntologyDataGraphEdgeScanIT, NativeOntologyDataGraphBindingScanIT, NativeOntologyDataGraphPageIT, NativeOntologyDataGraphContextIT, NativeOntologyDataGraphPagerTest, NativeOntologyDataGraphPagerRequestTest, NativeOntologyTopologyCursorCodecTest, OntologyPrefixLineageDaoTest, OntologyBindingRulesTest, OntologyConceptBindingMigrationTest, ontologyAPI.test.ts, useOntologyConceptBindings.test.tsx, OntologyConceptAssets.test.tsx, OntologyColumnBindingEditor.test.tsx, OntologyPropertyBindings.test.tsx, OntologyConceptDataGraph.test.tsx, OntologyConceptInspector.test.tsx
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

The binding editor's REST adapter collects all pages for reads, including pages after an empty result. Its asset picker must know every linked asset before deciding that a selection is new; otherwise it could replace an off-page asset's column assignments with an empty list. The collected result retains the first page's revision so an intervening mutation causes the next write to conflict.

Mutation transport confirms HTTP success and discards the response page and revision. The hook then collects a new complete read before permitting dependent edits. A successful write stays confirmed if that read fails. The last complete snapshot remains available for display, but cannot authorize editing until a complete read succeeds. All mounted editors share this admission check through the existing concept query and pending mutation. The pending mutation survives unmount and owns reconciliation for its originating concept. A competing write, an active read, or a stale expected revision is refused before transport.

Conflicts and uncertain responses stop the picker batch. Earlier confirmed selections remain completed, and later selections remain unattempted. Read recovery performs GETs only and never resumes the batch. A deliberate new Save compares the remaining selections against the refreshed complete snapshot. Writes have retries disabled and cannot wait offline for a delayed send after reconnection. Switching concepts stops the unsent remainder and cannot redirect an old completion into the new editor.

`GET /ontologies/{id}/dataGraph` pages an ontology's bound concepts by offset, ranked by stored binding count, so every reader sees the same order and `paging.total`. Each cluster's `assetCount` and its first assets are only what the reader may view, and a concept with nothing viewable is left out. Edges join returned concepts through object property assertions and class restrictions. Axiom `ViewBasic` permission is required before emitting an edge, including one with a local-name label. The property reference and its display name appear only when the reader may view the property. Lineage edges join returned assets. The Data graph shows the concepts the reader may view with their viewable assets and the observed lineage between the returned assets.

Each graph response contains at most 12 concept clusters, four preview assets per cluster, and 500 concept edges. Internal scans use bounded batches while preserving exact visible asset counts and continuing through denied or irrelevant candidates. These response bounds do not limit the total number of bound concepts. Preview continuation starts after the last returned preview asset. Clients advance through stored ranks by the requested page size, including after a short page.

## Amendment — 2026-10-26: paged cleanup under the lock and lineage between returned assets

The cleanup that a successful mutation performs reads the concept's rows in asset id order, 500 per statement, and deletes the dead rows of each page before reading the next. The page cursor is the last asset id examined, so deleting rows already examined never moves it. The capacity check adds up the column assignments of the live rows across every page, so the 500-assignment bound still counts each surviving link. The data graph's binding scan reads pages of the same size. A write therefore holds one page of rows in memory however many assets the concept binds; it holds the ontology lock for the whole cleanup, as before.

Lineage edges in the data graph are selected with both endpoints restricted to the returned assets before the edge limit applies. An asset's edges to assets outside the page cannot consume the limit and hide an edge between two returned assets.

## Amendment 2026-10-26. Stateless combined graph pages

`POST /ontologies/{id}/dataGraph/pages` returns a selected cluster or binding page together with topology over the canonical loaded prefixes. A topology-only selection continues that generation. The existing graph GET and bindings read, write and recovery contracts retain their meanings.

A request carries at most 60 concept prefixes, matching the renderer limit. A prefix consists of a readable same-ontology concept UUID, its binding revision and an optional inclusive asset UUID high-water mark. An absent mark means no loaded assets. The mark includes hidden scan tails from empty binding pages. The server does not check that the mark identifies a binding row, because that check would tell a caller whether an asset they cannot view is bound to a concept. A forged mark only widens the lineage window over rows the caller named, and every endpoint in that window is reauthorized. A bindings selection still requires the mark to equal its decoded cursor. The server reauthorizes concepts and emitted endpoints on each request, rejects invalid context and context-mismatched cursors with 400, and rejects a changed binding revision, a loaded concept that is missing or hidden, and a cursor axiom that no longer qualifies with 412 so a client refreshes instead of reading it as a forged request. Reads take no ontology write lock.

One selection returns at most 12 clusters with four preview assets each, or 100 bindings. A cluster page asks for no more concepts than the context has room for, and it omits clusters already loaded. Once the context holds 60 concepts the response sets `contextFull` and no longer advertises `nextClusterOffset`, so clusters past the 60th are not reachable through that context. Each request examines at most 500 semantic candidates and 500 lineage candidates. Semantic edges join actual axiom targets between loaded concepts. A cursor preserves the target offset within a large axiom. The cursor is opaque. The server encrypts and authenticates it with the Fernet key that every server shares, so it shows no concept, axiom, asset or relation type, even when the last candidate it scanned is one the reader cannot view. A cursor that fails authentication, is malformed, uses the earlier unsigned format or was issued for another context returns 400 before any read. Without a configured Fernet key, a page that needs a continuation cursor fails instead of issuing a readable one. Continuation resolves the name internally after same-ontology and loaded-subject membership checks. That position lookup consumes one of the 500 semantic candidate reads. Lineage membership is read from the loaded binding rows, which probe the relationship table by source asset, and requires both endpoints inside the loaded prefixes before the SQL limit. It pages by the full relationship key, then reauthorizes live asset endpoints and deduplicates emitted pairs. This keeps unrelated outgoing lineage from hiding an edge inside the loaded window. The glossary path is unchanged.

Changing the loaded context starts a replacement topology generation. Continuation cursors include its digest and independent semantic and lineage positions. A non-null topology cursor means incomplete topology, including after an empty page. Clients stage and deduplicate pages, retain only edges between currently loaded nodes, and replace the generation when both streams end. No asset snapshot or fabricated concept-to-asset cross-product is part of this API. One page selection is one HTTP request; topology-only continuations are explicit requests.

Binding revisions detect binding changes. They do not freeze axiom, lineage or permission changes across requests. This is a live read, not a snapshot. Exact authorized cluster totals still scan binding rows and require measured performance; candidate bounds are not a constant-time count guarantee.

