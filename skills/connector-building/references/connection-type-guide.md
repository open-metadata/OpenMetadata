# Connection Type Guide

## SQLAlchemy vs REST API vs SDK Client

This guide helps you choose the right connection type for database connectors. Non-database connectors always use REST API or SDK client.

## SQLAlchemy

**When to use**: The database has a SQLAlchemy dialect package available.

**What you get for free**:
- `CommonDbSourceService` auto-discovers databases, schemas, tables, columns, constraints
- `BaseConnection[Config, Engine]` handles connection caching and lifecycle
- `get_connection_url_common()` builds standard connection URLs
- `create_generic_db_connection()` creates pooled engines with query tracking
- Built-in profiler, sampler, and test suite support via `DefaultDatabaseSpec`
- Schema/table/column reflection via SQLAlchemy Inspector

**What you implement**:
- `connection.py`: `_get_client() → Engine` (often just call `get_connection_url_common`)
- `metadata.py`: Usually empty — `CommonDbSourceService` handles everything
- `queries.py`: SQL templates for query logs (if lineage/usage supported)

**Examples**: MySQL, PostgreSQL, Oracle, Snowflake, BigQuery, Redshift, Trino, ClickHouse

## REST API

**When to use**: The database exposes a REST API for metadata (no SQLAlchemy dialect).

**What you implement**:
- `client.py`: REST client with authentication, pagination, error handling
- `connection.py`: `get_connection()` returns client, `test_connection()` validates access
- `metadata.py`: Override `DatabaseServiceSource` methods to fetch metadata via API calls
- `service_spec.py`: `DefaultDatabaseSpec(metadata_source_class=...)` without `connection_class`

**Examples**: Salesforce, Domo

## SDK Client

**When to use**: The database has an official Python SDK (not SQLAlchemy).

**What you implement**:
- `connection.py`: `get_connection()` creates SDK client, `test_connection()` validates
- `metadata.py`: Use SDK to enumerate databases/schemas/tables
- `service_spec.py`: `DefaultDatabaseSpec(metadata_source_class=...)`

**Examples**: AWS Glue (boto3), MongoDB (pymongo), DynamoDB (boto3), Couchbase (couchbase SDK)

## Multi-Database Support

Add the `MultiDBSource` mixin when a single server connection can access multiple independent databases:

```python
class MyDbSource(CommonDbSourceService, MultiDBSource):
    def get_configured_database(self) -> Optional[str]:
        return self.service_connection.databaseName

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(GET_DATABASES_QUERY)
```

**Use MultiDBSource**: PostgreSQL, BigQuery, Snowflake, Redshift, MSSQL, Databricks
**Skip MultiDBSource**: MySQL, SQLite, Exasol, embedded databases
