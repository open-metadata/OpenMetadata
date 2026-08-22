# OpenMetadata Ontology Changelog

The canonical ontology lives in `openmetadata.ttl`. The PROV-aligned extension lives in
`openmetadata-prov.ttl`. SHACL shapes live in `../shapes/openmetadata-shapes.ttl`. JSON-LD contexts
live in `../contexts/`.

The version recorded here is the value of `owl:versionInfo` on the `om:` ontology resource.

## 1.1.0 — 2026-04-28

Knowledge-graph fidelity pass. All changes are additive or domain corrections; existing consumers
that referenced the corrected domains were not actually relying on them, since the prior
declaration did not match what the mapper emitted.

### Added — Column resources and column lineage

- `om:Column` resources are now first-class named resources at FQN-derived URIs
  (`baseUri + "entity/column/" + URLEncoded(FQN)`). Previously columns were blank nodes,
  unreachable from SPARQL.
- `om:fromColumn` and `om:toColumn` (column lineage) are now URI references to `om:Column`
  resources, not FQN string literals. The original FQN strings are retained as
  `om:fromColumnFqn` / `om:toColumnFqn` for back-compatibility with consumers that match
  by string.
- `om:LineageDetails` class declared (was used by the mapper but undeclared).
- `om:hasColumnLineage`, `om:transformFunction` declared.
- `om:hasChildColumn` (subproperty of `om:hasColumn`) for nested struct/map/union columns.
- Domain of `om:fromColumn` / `om:toColumn` corrected from `om:Column` to `om:ColumnLineage`.

### Added — Table constraints

- `om:TableConstraint` class.
- `om:hasConstraint` (`om:Table` → `om:TableConstraint`).
- `om:constraintType`, `om:relationshipType` (datatype properties).
- `om:hasConstrainedColumn`, `om:hasReferredColumn` (object properties on the constraint).
- `om:references` (`om:Column` → `om:Column`) — direct FK edges between source and referred
  columns, paired positionally from `TableConstraint.columns` and `referredColumns`.
- `om:isUnique` datatype property on columns.
- Per-column `constraint` enum (`PRIMARY_KEY`, `UNIQUE`, `NOT_NULL`, `NULL`) now maps to the
  corresponding `om:isPrimaryKey` / `om:isUnique` / `om:isNullable` triples.

### Changed — SKOS hierarchy

JSON-LD context `governance.jsonld`:

- `glossary` (on a glossary term) now maps to `skos:inScheme` (was `om:belongsToGlossary`).
- `classification` (on a tag) now maps to `skos:inScheme` (was `om:belongsToClassification`).
- `parent` (on a glossary term or tag) now maps to `skos:broader` (previously unmapped).
- `children` now maps to `skos:narrower`. The prior `childTerms` alias has been removed; it
  referenced a JSON field that does not exist on `GlossaryTerm`, so the mapping never fired.

The OpenMetadata-specific predicates `om:belongsToGlossary` and `om:belongsToClassification`
were not used outside this single context file; no SPARQL queries reference them.

### Changed — JSON-LD lineage context

- `fromColumns` and `toColumn` in `lineage.jsonld` now map to `om:fromColumnFqn` /
  `om:toColumnFqn` (datatype properties), not to `om:fromColumns` / `om:toColumn` (which
  collided with the new object-typed predicates).

## 1.0.0 — 2025-08-24

Initial ontology release.
