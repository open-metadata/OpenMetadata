# Cloudberry

Ingest Apache Cloudberry tables, partitions, views, and materialized views. Run a lineage workflow after metadata ingestion to build lineage from view definitions.

Run the Profiler Agent after metadata ingestion to collect table and column statistics. Run `ANALYZE` in Cloudberry to refresh the estimated row counts.

## Requirements

Grant the ingestion role `CONNECT` on each target database, `USAGE` on the schemas, and `SELECT` on the relations to catalog or profile.

## Connection Details

$$section
### Host and Port $(id="hostPort")

Apache Cloudberry coordinator address and port, typically `5432`.
$$

$$section
### Database $(id="database")

Database to connect to. Enable Ingest All Databases to discover other databases accessible to the ingestion role.
$$

$$section
### Username $(id="username")

Login role used for metadata ingestion.
$$

$$section
### Password $(id="password")

Password for the ingestion role.
$$

$$section
### SSL Mode $(id="sslMode")

Select the TLS mode. For `verify-ca` or `verify-full`, provide the CA certificate in SSL Config.
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")

Include all databases the role can connect to. Use the database filter to narrow the scope.
$$
