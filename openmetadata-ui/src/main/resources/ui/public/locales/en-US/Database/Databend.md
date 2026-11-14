# Databend

Use this connector to ingest databases, tables, views, columns, and descriptions from the Databend `default` catalog. It also supports table and column profiling, sampling and sample data, data quality tests, auto-classification, and table and column lineage.

Databend objects are represented in OpenMetadata as follows:

- Databend Catalog `default` → OpenMetadata Database `default`
- Databend Database → OpenMetadata Database Schema
- Databend Table or View → OpenMetadata Table

For example, the Databend table `customers` in Database `analytics` is ingested with the OpenMetadata FQN `local_databend.default.analytics.customers`.

External catalogs, such as Iceberg or Hive catalogs, are not ingested by this connector. Ingest those tables with the OpenMetadata connector for the system that owns them.

## Requirements

The Databend user must be able to connect to the HTTP query service and read the table, view, column, and comment metadata of the Databases to ingest. Databend only lists the Databases and tables that the user has been granted access to.

### Profiler, Sampling, Data Quality, and Auto-Classification

The Databend user needs `SELECT` permission on every table or view where OpenMetadata runs profiling, sampling, sample-data extraction, data quality tests, or auto-classification. Percentage sampling uses Databend's `rand()` function and does not create temporary tables.

### Lineage

Lineage is read from Databend's own lineage records in `system_history.lineage_history`, so no SQL is parsed by OpenMetadata. This requires:

- Databend v1.2.933 or later.
- A Databend Enterprise license.
- Lineage and history tables enabled in the query configuration: `[lineage] on = true` and `[log.history] on = true`.
- `SELECT` permission on `system_history.lineage_history`.

These requirements only apply to lineage ingestion. Without them, the optional `GetLineage` test connection step fails and the lineage workflow reports the missing requirement, while metadata, profiler, and data quality workflows keep working.

View lineage comes from `CREATE VIEW` records. Query lineage comes from `CREATE TABLE ... AS SELECT` and DML records updated within the configured query log duration. Run the metadata workflow first: edges whose tables are not ingested yet are skipped and picked up by a later run. Edges that involve an external catalog are skipped.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme used to connect to Databend. Use the default value, `databend`, unless you are configuring a compatible custom driver.
$$

$$section
### Host and Port $(id="hostPort")

Host and port of the Databend HTTP query service. Self-hosted Databend uses port `8000` by default. Databend Cloud connection details provide the host and port for a warehouse.

If OpenMetadata ingestion runs in Docker while Databend runs directly on the host, use `host.docker.internal:8000` instead of `localhost:8000`.
$$

$$section
### Username $(id="username")

Username used to connect to Databend.
$$

$$section
### Password $(id="password")

Password used to connect to Databend.
$$

$$section
### Database Schema $(id="databaseSchema")

Optional Databend Database to ingest. The Databend Database is represented as an OpenMetadata Database Schema, and it is also used as the initial database of the connection, so it must exist.

When left blank, the connection starts in the `default` Database and the connector scans all accessible Databend Databases except `information_schema`, `system`, and `system_history`. You can explicitly enter one of these system Databases if you need to ingest it.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional options appended to the Databend SQLAlchemy connection URL. Databend Cloud connections commonly provide a `warehouse` value.

For a non-TLS HTTP endpoint, such as the default self-hosted port `8000`, set `sslmode` to `disable`. For a TLS/HTTPS endpoint, set `sslmode` to `enable`. With `databend-driver` 0.33.7, omitting this option for an HTTP endpoint can produce an unclear `InvalidContentType` login error; OpenMetadata adds a targeted hint for that error until the driver reports the protocol mismatch directly.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional arguments passed to the Databend SQLAlchemy engine when establishing the connection.
$$

$$section
### Default Database Filter Pattern $(id="databaseFilterPattern")

Regular expressions used to include or exclude Databend Catalogs, which are represented as OpenMetadata Databases. Only the `default` catalog is currently ingested.
$$

$$section
### Default Schema Filter Pattern $(id="schemaFilterPattern")

Regular expressions used to include or exclude Databend Databases. Because Databend Databases are represented as OpenMetadata Database Schemas, this field is named Schema Filter Pattern. By default, `information_schema`, `system`, and `system_history` are excluded.
$$

$$section
### Default Table Filter Pattern $(id="tableFilterPattern")

Regular expressions used to include or exclude Databend tables and views.
$$
