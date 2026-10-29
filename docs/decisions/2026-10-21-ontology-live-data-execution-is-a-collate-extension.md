# Ontology live data is generated SQL in OpenMetadata and executed by a Collate extension

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyConceptSqlGeneratorTest`, `OntologyConceptQueryServiceTest`, `OntologyConceptQueryIT`, `OntologyConceptLiveData.test.tsx` ("renders the preview only when the class base returns an extension"), reviewer
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
`SELECT` over the concept's bound columns limited to 50 rows, one `JOIN` per search-around hop
commented with the relation label, and the service, service type and dialect.

- The dialect decides the quoting and the row limit. A service type is listed only when its engine
  accepts the SQL generated for it: `ansi` (Postgres, Timescale, Redshift, Trino, Presto, Athena),
  `snowflake`, `bigquery`, `mysql` (Mysql, MariaDB, SingleStore, Doris, StarRocks, Clickhouse),
  `spark` (Databricks, UnityCatalog, Hive, Impala, Iomete) and `tsql` (Mssql, AzureSQL, Synapse,
  MicrosoftFabric). T-SQL limits with `SELECT TOP 50`, the others with `LIMIT 50`. Every other
  service type is a 400, "SQL generation does not support <serviceType>".

- A hop follows its property's object-property binding whenever the previous table or a candidate
  table binds it; `OntologyBindingRules` accepts OBJECT properties for that reason. The previous
  table's binding wins over the candidate's. The hop joins through a `FOREIGN_KEY` constraint on
  the binding table whose columns equal the bound column and that refers to the other table, and
  without one it joins the bound column to the other concept's identifier column (a bound DATA
  property with `isIdentifier`). A foreign key on any other column never counts, even when it is
  the only one. A hop whose property no candidate binds joins through the one foreign key between
  the previous table and a candidate, in either direction, trying candidates in asset-id order.
  Several foreign keys between the two tables, in either direction, are a 400 that names both
  tables and asks for the property to be bound to one column.
- A hop followed from its relation's range back to its domain is labelled with the relation's
  declared inverse when that inverse is a live object property the reader may view, the same label
  as the rail's hop chip. The server knows only the declared domain and range, so a relation that
  comes only from a restriction or an assertion, or whose property has the start concept in both
  its domain and its range, can read the forward label while the chip reads the inverse, with the
  same joins, until the request carries the direction the rail chose.
- The endpoint authorizes like the binding read: `VIEW_BASIC` on the concepts and hop properties.
  A bound table the caller may not view is treated as unbound, so its columns never appear in the
  SQL or an error. A concept or hop without a viewable bound table, or a hop with no join, is a
  400 that names the concept and the hop.
- Reads are batched, whatever the hop count: one statement for every concept's first 100 table
  bindings, one table batch with only the fields the `VIEW_BASIC` check reads, one table batch with
  columns and constraints for each concept's first ten visible tables in asset-id order, and one
  property batch. A concept none of whose first 100 bound tables is visible is a 400 that says so.
  At most five hops per request, and the rail stops offering search-around at five.
- The backtick and bracket dialects (`mysql`, `spark`, `bigquery`, `tsql`) quote every identifier,
  because quoting never changes how those engines resolve a name. `snowflake` double-quotes every
  identifier too: the Snowflake connector stores each name in the case Snowflake reports, so a name
  created without quotes is stored in upper case, a lowercase stored name was created quoted, and
  the quoted stored name always resolves to the ingested object. `ansi` quotes only a name that is
  not lowercase `[a-z_][a-z0-9_]*` or that is in its reserved-word list, because its engines store
  and fold names in lowercase. That list is the union of the vendor lists of every engine mapped
  to it. `FROM` names `schema.table`, so every table in one
  query belongs to the root table's service and database.
- The Studio rail shows the SQL, a copy control, search-around and a `not stored` badge.
  `OntologyExplorerClassBase.getConceptLiveDataExtension()` returns no component in OSS; Collate's
  override supplies `Preview 3 rows` and **Open in SQL Studio** through its query runner.

## Consequences

No source credential or query engine enters OpenMetadata, and the call writes nothing. The
extension's props (`conceptId` and the generated `OntologyConceptQuery`) are shared by both
repositories, so changing them needs a paired Collate change, and this OSS change merges before
the Collate override that depends on it. A concept bound to more than ten tables uses the first
ten its reader may view among its first 100, in asset-id order, so two readers may get different
tables. A service type outside the list gets no SQL until its dialect is verified and added. Running queries in OpenMetadata itself would need source credentials on the
server and is a separate program.
