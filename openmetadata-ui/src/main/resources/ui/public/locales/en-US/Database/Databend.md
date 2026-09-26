# Databend

Use this connector to ingest catalogs, databases, tables, views, columns, and descriptions from Databend. It also supports table and column profiling, sampling and sample data, data quality tests, and auto-classification.

Databend objects are represented in OpenMetadata as follows:

- Databend Catalog → OpenMetadata Database
- Databend Database → OpenMetadata Database Schema
- Databend Table or View → OpenMetadata Table

For example, the Databend table `customers` in Catalog `default` and Database `analytics` is ingested with the OpenMetadata FQN `local_databend.default.analytics.customers`.

## Requirements

The Databend user must be able to connect to the HTTP query service, list the Catalogs and Databases to ingest, and read their table, view, column, and comment metadata.

When Catalog is left blank, the user also needs permission to run `SHOW CATALOGS`. Catalogs that the user cannot access are skipped as long as at least one selected Catalog can be ingested.

### Profiler, Sampling, Data Quality, and Auto-Classification

The Databend user needs `SELECT` permission on every table or view where OpenMetadata runs profiling, sampling, sample-data extraction, data quality tests, or auto-classification. Percentage sampling uses Databend's `rand()` function and does not create temporary tables.

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
### Database $(id="database")

Databend Database used only to establish the initial SQLAlchemy connection. The default is `default`. This value is the Database component of the Databend DSN and does not determine the OpenMetadata Database name.
$$

$$section
### Catalog $(id="catalog")

Optional Databend Catalog to ingest. The Catalog is represented as an OpenMetadata Database. When left blank, the connector runs `SHOW CATALOGS` and scans all accessible Catalogs that pass the Database Filter Pattern.
$$

$$section
### Database Schema $(id="databaseSchema")

Optional Databend Database to ingest from each selected Catalog. The Databend Database is represented as an OpenMetadata Database Schema. When left blank, the connector scans all accessible Databend Databases except `information_schema`, `system`, and `system_history`. You can explicitly enter one of these system Databases if you need to ingest it.
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

Regular expressions used to include or exclude Databend Catalogs. Because Catalogs are represented as OpenMetadata Databases, this field is named Database Filter Pattern.
$$

$$section
### Default Schema Filter Pattern $(id="schemaFilterPattern")

Regular expressions used to include or exclude Databend Databases. Because Databend Databases are represented as OpenMetadata Database Schemas, this field is named Schema Filter Pattern. By default, `information_schema`, `system`, and `system_history` are excluded.
$$

$$section
### Default Table Filter Pattern $(id="tableFilterPattern")

Regular expressions used to include or exclude Databend tables and views.
$$
