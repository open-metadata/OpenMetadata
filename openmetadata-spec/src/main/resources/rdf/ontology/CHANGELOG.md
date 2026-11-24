# OpenMetadata Ontology Changelog

The canonical ontology lives in `openmetadata.ttl`. The PROV-aligned extension lives in
`openmetadata-prov.ttl`. SHACL shapes live in `../shapes/openmetadata-shapes.ttl`. JSON-LD contexts
live in `../contexts/`.

The version recorded here is the value of `owl:versionInfo` on the `om:` ontology resource.

## 2.1.0 — 2026-11-18

Knowledge-graph reasoning pass: concept bindings, ordered constraint members, quality evidence as
facts, and agent-facing descriptions. Like 1.1.0 it adds terms and corrects domains; the predicates
it stops writing (DQV measurements, the `incidentStatus` literal) are read by no graph query in
this repository.

### Added — Ontology Studio concept bindings

- `om:boundAsset` (concept → asset) and `om:boundColumn` (concept property → `om:Column`) in the
  knowledge graph, projected from `ontology_concept_binding` for concepts and properties of an
  active release. The asset owns both edges: its writes replace them and its delete removes them.
  See ADR:2026-10-19-native-concept-bindings-remain-operational-metadata.

### Added — Test suite and test definition links

- `om:belongsToTestSuite` (test case → `om:TestSuite`) and `om:hasTestDefinition` (test case →
  the new class `om:TestDefinition`) were written from `quality.jsonld` without a declaration, so
  they carried no description. Both are now declared and described, and `om:TestSuite` has a
  comment.

### Added — Ordered constraint members

- `om:ConstraintMember`, `om:hasConstraintMember`, `om:memberPosition`, `om:memberColumn` and
  `om:memberReferredColumn`: each table constraint lists its columns in order, and a foreign key
  pairs each column with its referred column.

### Added — Status properties

- `om:statusProperty`, an annotation property on a class naming the property whose value says
  how a node of that class stands. It entails nothing; a reader of the graph can count the nodes on
  the other side of a relationship by it. Asserted as `om:TestCase om:statusProperty
  om:latestResultStatus`, `om:TestCase om:statusProperty om:hasOpenIncident` and
  `om:TestCaseIncident om:statusProperty om:incidentState`, `om:incidentSeverity` and
  `om:incidentAssignee`.

### Changed — Column-level composite primary keys

- PRIMARY_KEY markers on several columns project as one composite `om:TableConstraint` and no
  longer mark each column `om:isUnique`. See
  ADR:2026-11-13-column-uniqueness-means-the-column-alone-is-unique.

### Added — Quality evidence

See ADR:2026-11-18-the-rdf-graph-carries-the-latest-quality-evidence.


- Latest profile facts: `om:profiledAt`; on a table `om:profileRowCount`, `om:profileColumnCount`,
  `om:profileSizeInBytes`; on a column `om:profileValuesCount`, `om:profileNullCount`,
  `om:profileNullProportion`, `om:profileDistinctCount`, `om:profileUniqueCount`, `om:profileMin`,
  `om:profileMax`, `om:profileMean`, `om:profileMinLength`, `om:profileMaxLength`.
- `om:TestCaseResult`, `om:TestResultValue`, `om:TestCaseIncident` classes.
- `om:testsEntity` (test case → table, `owl:inverseOf om:testedBy`), `om:testsColumn`,
  `om:latestResultStatus`, `om:latestResultAt`, `om:hasTestResult`, `om:hasResultValue`.
- On a result: `om:testResultStatus`, `om:testResultMessage`, `om:passedRows`, `om:failedRows`,
  `om:minBound`, `om:maxBound`, with the run time as `prov:generatedAtTime`.
- `om:hasOpenIncident`, `om:incidentState`, `om:incidentSeverity`, `om:incidentAssignee`.
- Declared the already written `om:testsEntityFQN` and `om:hasParameterValue`.

### Changed — Quality evidence

- `dqv:hasQualityMeasurement`, `dqv:isMeasurementOf` and `dqv:computedOn` are `om:InferenceOnly`:
  profiles are facts on the profiled node, not measurement nodes.
- JSON-LD `quality.jsonld`: `testCaseResult` and `testResultValue` map to resources, not `@json`.
- The `incidentStatus` JSON literal on test cases is no longer written.

### Added — Agent-facing descriptions

The ontology describes what the projection writes, for a model reading it without other context.

- An `rdfs:comment` on every predicate the metadata projection stores and on every class it types
  nodes with. Fallback `om:<field>` literals take their wording from the field's JSON Schema
  description and say when the value is JSON text rather than a graph edge.
- `rdfs:domain` and `rdfs:range` where they hold for every use (347 domains, 396 ranges). A
  predicate shared by several entity types says so in its comment and leaves its domain open.
- `schema:domainIncludes` (an `owl:AnnotationProperty`, prefix `schema: <https://schema.org/>`) on
  193 stored predicates with an open domain, naming each class the projection writes them on. It
  entails nothing; `ontology_describe` uses it to list shared predicates in a class's entry.
- Agent-facing rewrites of short pre-existing comments that restated the name, among them
  `om:Entity`, `om:DataAsset`, `om:Column`, `om:upstream`, `om:downstream`, `om:fromColumn`,
  `om:toColumn` and `om:joinedWith`.
- `owl:Class` declarations for the 35 types the projection already wrote without one, among them
  `om:DashboardDataModel`, `om:IngestionPipeline`, `om:PipelineExecution`, `om:LifeCycle`,
  `om:AccessDetails`, `om:CustomProperty`, `om:Extension`, `om:ContextMemory`, `om:Persona` and the
  native ontology entity types.

### Changed — domains and ranges that contradicted the projection

- Domain removed: `om:appliedTo` (was `om:Tag`; personas, metrics and memories are its subjects),
  `om:belongsToDatabase`, `om:belongsToSchema` and `om:hasColumn` (were `om:Table`), `om:hasPolicy`,
  `om:format`, `om:service`, `om:checksum`, `om:provenance`, `om:source`, `om:endDate`.
- Domain narrowed: `om:lineageSource`, `om:sqlQuery` and `om:lineageCreatedBy` to
  `om:LineageDetails`; `om:title` to `om:ContextMemory`.
- `om:expert`: the edge runs from a domain, data product or metric to the user, so the domain
  `om:User` is removed and the range is `om:User`.
- `om:hasTag` range is `skos:Concept`: glossary terms applied as labels are its objects too.
- `om:hasPolicy` range is `om:Policy` (was `odrl:Policy`).
- `om:rowCount` and `om:columnCount` describe worksheets: domain `om:Worksheet` (was `om:Table`),
  `xsd:integer` range removed. Tables carry the profiled counts as `om:profileRowCount` and
  `om:profileColumnCount`.
- `om:memberOf` domain `om:User` removed: roles and policies also carry it, for the teams they
  serve. `om:relatedTo` domain and range `om:GlossaryTerm` removed: RELATED_TO links tables,
  metrics, test cases, pages and memories too.
- Domains and ranges declared for `om:isUnique`, `om:hasConstraint`, `om:constraintType`,
  `om:relationshipType`, `om:hasConstrainedColumn`, `om:hasReferredColumn` and `om:references`.
- Class ranges removed where the projection writes a literal: `om:format`, `om:service`,
  `om:checksum`, `om:provenance`, `om:source`, `om:lineageCreatedBy`, `om:consumesFrom`,
  `om:providesTo`, and `xsd:dateTime` on `om:endDate`.

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
