# Neptune
In this section, we provide guides and references to use the Amazon Neptune connector for openCypher property graphs.

The connector reads the property graph schema from `neptune.graph.pg_schema()` and maps it onto the OpenMetadata database hierarchy:
```
Database Service > Database > Schema > Table
```
- **Database**: the configured database name, or `default`.
- **Schema**: `nodes` for node labels and `relationships` for edge labels.
- **Table**: one per node label or edge label, with its properties as columns. Edge labels list their `(from)-[type]->(to)` endpoints in the description.

## Requirements
The identity needs `neptune-db:ReadDataViaQuery` on the cluster. If no schema has been computed and **Compute Schema If Missing** is enabled, the connector runs `CALL neptune.graph.pg_schema.compute()`, which also needs `neptune-db:WriteDataViaQuery`, and waits for it to finish. No graph data is scanned.

## Connection Details

$$section
### AWS Config $(id="awsConfig")
AWS credentials and region. When no keys are provided, the standard AWS credential provider chain is used and requests are signed with SigV4.
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
