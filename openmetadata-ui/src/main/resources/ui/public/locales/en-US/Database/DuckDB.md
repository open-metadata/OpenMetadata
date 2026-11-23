# DuckDB

Use this connector to ingest schemas, tables, views, columns, and constraints from a DuckDB database file. It also supports profiling, sampling, data quality tests, auto-classification, view lineage, and, when the database keeps a query log table, usage and query lineage.

DuckDB objects are represented in OpenMetadata as follows:

- DuckDB database file (catalog) → OpenMetadata Database, named after the file unless `Database Name` is set
- DuckDB Schema → OpenMetadata Database Schema
- DuckDB Table or View → OpenMetadata Table

For example, the table `customers` in schema `main` of `/data/shop.duckdb` is ingested with the OpenMetadata FQN `local_duckdb.shop.main.customers`.

Column types are ingested as DuckDB reports them, including nested `STRUCT`, `LIST`, `ARRAY`, and `MAP` types, whose fields appear as child columns. Catalogs attached to the same connection are not ingested.

## Requirements

DuckDB is an embedded database: the ingestion opens the database file directly, so the file must be readable at the configured path on the machine where the ingestion runs. When ingestion runs in Docker or Airflow, mount the file into that container.

OpenMetadata opens the file in read-only mode. DuckDB does not let a second process open a file that another process holds open for writing, so run the ingestion when no application has the file open read-write, or point it at a copy.

### Usage and Query Lineage

DuckDB keeps no query history in the database file. Usage and query lineage read a table named `main.duckdb_query_log` that your application or a scheduled job populates:

```sql
CREATE TABLE main.duckdb_query_log (
    query_text   VARCHAR,
    user_name    VARCHAR,
    schema_name  VARCHAR,
    start_time   TIMESTAMP,
    duration_ms  DOUBLE,
    aborted      BOOLEAN
);
```

The table must have all of these columns. Each row needs `query_text` and `start_time`; the other values may be `NULL`. A `NULL` `schema_name` means the query ran against `main`, DuckDB's default schema. Queries are attributed to this service's database. Rows without a `start_time` in the configured query log duration are not read.

Without this table, usage and query lineage find no queries and the optional `GetQueries` test connection step fails. Metadata, view lineage, profiling, and data quality do not need it.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme. Only `duckdb` is supported.
$$

$$section
### Database File Path $(id="databaseFilePath")

Path to the DuckDB database file, for example `/data/shop.duckdb`, as seen from the machine or container running the ingestion.
$$

$$section
### Database Name $(id="databaseName")

Optional name of the database in OpenMetadata. If left blank, the DuckDB catalog name is used, which is the file name without its extension.
$$

$$section
### Database Schema $(id="databaseSchema")

Optional. Restrict ingestion to a single schema. Leave blank to ingest all schemas.
$$

$$section
### Connection Options $(id="connectionOptions")

DuckDB configuration options applied when the file is opened, for example `threads` or `memory_limit`. See the [DuckDB configuration reference](https://duckdb.org/docs/stable/configuration/overview).
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional arguments passed to the DuckDB SQLAlchemy engine when establishing the connection.
$$

$$section
### Default Database Filter Pattern $(id="databaseFilterPattern")

Regular expressions used to include or exclude the database.
$$

$$section
### Default Schema Filter Pattern $(id="schemaFilterPattern")

Regular expressions used to include or exclude DuckDB schemas.
$$

$$section
### Default Table Filter Pattern $(id="tableFilterPattern")

Regular expressions used to include or exclude DuckDB tables and views.
$$
