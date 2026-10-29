# Ontology live data is generated SQL in OpenMetadata and executed by a Collate extension

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyConceptSqlGeneratorTest`, `OntologyConceptQueryIT`, `OntologyConceptLiveData.test.tsx` ("renders the preview only when the class base returns an extension"), reviewer
- **Related:** ADR:2026-10-16-ontology-ai-proposal-review-is-a-collate-extension, ADR:2026-10-19-native-concept-bindings-remain-operational-metadata, Collate `OntologyExplorerClassCollate`

## Context

The Ontology Studio spec shows a concept's records live: the SQL its column bindings describe, a
three-row preview labelled "Live result · not cached", and a hand-off to SQL Studio, with
search-around adding one JOIN per relation hop. Records stay in the source and nothing is stored.
Running a query needs the source's credentials and a query engine. OpenMetadata ships the
QueryRunner request schema and its websocket channel, but the engine that runs queries and the
SQL Studio tab are Collate plugins.

## Decision

OpenMetadata generates the SQL and never runs it. `POST /v1/ontologyConcepts/{id}/query` returns a
`SELECT` over the concept's bound columns with `LIMIT 50`, one `JOIN` per search-around hop
commented with the relation label, and the service, service type and identifier-quoting dialect.

- A hop's join columns come from a `FOREIGN_KEY` table constraint between the two tables, in either
  direction. Without one, the hop's object property may be bound to a foreign-key column on either
  concept's table, which joins to the other concept's identifier column (a bound DATA property with
  `isIdentifier`). `OntologyBindingRules` accepts OBJECT properties for that reason.
- The endpoint authorizes like the binding read: `VIEW_BASIC` on the concepts and hop properties.
  A bound table the caller may not view is treated as unbound, so its columns never appear in the
  SQL or an error. A concept or hop without a viewable bound table, or a hop with no join, is a
  400 that names the concept and the hop.
- Reads are batched: one statement for every concept's first ten table bindings, one table batch,
  one property batch, whatever the hop count. At most five hops per request.
- Identifiers are quoted only when the dialect would misread them, so a lowercase catalog name
  stays unquoted and keeps the source's case folding. `FROM` names `schema.table`, and every table
  in one query belongs to the root table's service.
- The Studio rail shows the SQL, a copy control, search-around and a `not stored` badge.
  `OntologyExplorerClassBase.getConceptLiveDataExtension()` returns no component in OSS; Collate's
  override supplies `Preview 3 rows` and **Open in SQL Studio** through its query runner.

## Consequences

No source credential or query engine enters OpenMetadata, and the call writes nothing. The
extension's props (`conceptId` and the generated `OntologyConceptQuery`) are shared by both
repositories, so changing them needs a paired Collate change, and this OSS change merges before
the Collate override that depends on it. A concept bound to more than ten tables uses the first
ten in asset-id order. Running queries in OpenMetadata itself would need source credentials on the
server and is a separate program.
