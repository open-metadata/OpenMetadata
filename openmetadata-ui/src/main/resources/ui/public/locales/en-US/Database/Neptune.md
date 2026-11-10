# Neptune
In this section, we provide guides and references to use the Amazon Neptune connector for openCypher property graphs and RDF graphs queried with SPARQL.

For openCypher property graphs, the connector reads the schema from `neptune.graph.pg_schema()`. For RDF, it uses Neptune's read-only RDF graph summary and bounded SPARQL samples. Both map onto the OpenMetadata database hierarchy:
```
Database Service > Database > Schema > Table
```
- **Database**: the configured database name, or `default`.
- For property graphs, schemas are `nodes` and `relationships`; each node or edge label becomes a table with its properties as columns. Edge descriptions list their `(from)-[type]->(to)` endpoints.
- With **Graph Model** set to `rdf`, the schema is `classes` and each RDF class becomes a table. Predicates become columns; the full class and predicate IRIs are recorded in descriptions.

## Requirements
The identity needs `neptune-db:ReadDataViaQuery`; RDF also requires `neptune-db:GetGraphSummary`. RDF summary requires Neptune engine 1.2.1.0 or later and available DFE statistics. Statistics are disabled on `db.t3.medium` and `db.t4g.medium`; the connector reports this rather than returning empty metadata and never triggers statistics recomputation.

Property-graph schema computation is unchanged: if no schema has been computed and **Compute Schema If Missing** is enabled, the connector runs `CALL neptune.graph.pg_schema.compute()`, which also needs `neptune-db:WriteDataViaQuery`, and waits for it to finish. It does not scan the property graph.

## Connection Details

$$section
### AWS Config $(id="awsConfig")
AWS credentials and region. When no keys are provided, the standard AWS credential provider chain is used and requests are signed with SigV4.
$$

$$section
### Graph Model $(id="graphModel")
Select `propertyGraph` (the default, queried with openCypher) or `rdf` (queried with SPARQL).
$$

$$section
### Host and Port $(id="hostPort")
Neptune cluster endpoint, for example `my-cluster.cluster-xxxx.us-east-1.neptune.amazonaws.com:8182`. The port defaults to `8182`.
$$

$$section
### Database Name $(id="databaseName")
Name used for the database entity. Defaults to `default`.
$$

$$section
### Include Relationships $(id="includeRelationships")
Ingest edge labels in the `relationships` schema.
$$

$$section
### Compute Schema If Missing $(id="computeSchemaIfMissing")
Start `neptune.graph.pg_schema.compute()` when no schema is available. Requires write permission. If disabled and no schema exists, ingestion fails with a clear error.
$$

$$section
### Schema Compute Timeout Seconds $(id="schemaComputeTimeoutSeconds")
Maximum time to wait for the schema computation. Ingestion fails if it is exceeded.
$$

$$section
### Property Filter Pattern $(id="propertyFilterPattern")
Regex to include or exclude properties.
$$

$$section
### Maximum RDF Classes $(id="rdfMaxClasses")
Maximum classes to ingest as tables (default 100). Classes are selected deterministically by IRI; truncation is reported in ingestion status.
$$

$$section
### Maximum RDF Predicates Per Class $(id="rdfMaxPredicatesPerClass")
Maximum predicates to ingest as columns for each class (default 100). Truncation is reported in ingestion status.
$$

$$section
### RDF Subject Sample Size $(id="rdfSampleSize")
Maximum subjects sampled per class when discovering predicates and value types (default 1000). Types are inferred conservatively from sampled literal datatypes and IRI values.
$$

$$section
### RDF Query Timeout Seconds $(id="rdfQueryTimeoutSeconds")
Maximum runtime for each bounded RDF SPARQL query (default 30 seconds). This must be lower than the Neptune `neptune_query_timeout` database parameter.
$$
