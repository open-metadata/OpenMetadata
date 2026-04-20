# SQL & SQLAlchemy Standards

## Connection URL Building

Use `get_connection_url_common` for standard `scheme://user:pass@host:port/db` patterns:

```python
from metadata.ingestion.connections.builders import (
    get_connection_url_common,
    create_generic_db_connection,
    init_empty_connection_arguments,
)

def get_connection(connection: MyDbConnection) -> Engine:
    url = get_connection_url_common(connection)
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=lambda _: url,
        get_connection_args_fn=lambda _: init_empty_connection_arguments(connection),
    )
```

Override `get_connection_url_common` only when the database has non-standard URL structure (BigQuery project IDs, Databricks workspaces, etc.).

## Password and Secret Handling

Passwords are extracted through `get_password_secret()` which handles:
- Direct `password` field
- `authType.password` from `BasicAuth`
- AWS IAM token generation from `IamAuthConfigurationSource`

Passwords are URL-quoted via `quote_plus()` before inclusion in the connection string. Never log or print connection URLs with credentials.

```python
# CORRECT — framework handles quoting
url = get_connection_url_common(connection)

# WRONG — manual password handling
url = f"{scheme}://{user}:{password}@{host}"  # No quoting, leaks secrets
```

## Engine Creation

`create_generic_db_connection` creates a SQLAlchemy Engine with:
- `QueuePool` for connection pooling
- Query tracking via `attach_query_tracker`
- Optional query comment injection (`supportsQueryComment`)
- `max_overflow=-1` (unlimited overflow connections)

```python
engine = create_generic_db_connection(
    connection=connection,
    get_connection_url_fn=get_connection_url_fn,
    get_connection_args_fn=get_connection_args_fn,
)
```

## Time Window Standardization

Query log extraction uses `get_start_and_end()` to compute time ranges from config:

```python
from metadata.ingestion.source.database.query_parser_source import QueryParserSource

class MyDbQueryParserSource(QueryParserSource):
    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )
```

Always parameterize time windows — never hardcode durations.

## Auth Patterns for SQL Databases

### BasicAuth (username/password)
Standard pattern. `get_connection_url_common` handles it automatically.

### IAM Auth (AWS RDS/Redshift)
Uses `IamAuthConfigurationSource` to generate temporary tokens:

```python
# Framework handles this in builders.py
aws_client = AWSClient(config=connection.authType.awsConfig).get_rds_client()
password = aws_client.generate_db_auth_token(
    DBHostname=host, Port=port,
    DBUsername=connection.username,
    Region=connection.authType.awsConfig.awsRegion,
)
```

Connector-specific IAM logic belongs in the connector's `connection.py`, not in shared `builders.py`.

### Azure AD Auth
Uses `AzureConfig` with service principal credentials.

### Kerberos
Some databases (Hive, Impala) use Kerberos. Handle in `connect_args`:

```python
def get_connection_args(connection) -> dict:
    args = init_empty_connection_arguments(connection)
    if connection.authMechanism == AuthMechanism.GSSAPI:
        args["auth_mechanism"] = "GSSAPI"
        args["kerberos_service_name"] = connection.kerberosServiceName
    return args
```

## Schema and Table Filtering

Use framework filter utilities — do not implement custom filtering:

```python
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table

# Applied automatically by CommonDbSourceService:
if filter_by_table(self.source_config.tableFilterPattern, table_name):
    self.status.filter(table_name, "Table filtered out")
    continue
```

## System Schema Exclusion

Most databases have system schemas to skip. Override in the source:

```python
def get_default_schema_filter(self):
    return ["information_schema", "pg_catalog", "sys", "mysql", "performance_schema"]
```

## Multi-Database vs Single-Database

### When to Use MultiDBSource

Add `MultiDBSource` mixin when the database server hosts multiple independent databases (Postgres, Snowflake, BigQuery projects, etc.):

```python
class MyDbSource(CommonDbSourceService, MultiDBSource):
    def get_configured_database(self) -> Optional[str]:
        return self.service_connection.databaseName

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(MY_DB_GET_DATABASES)
```

### When NOT to Use MultiDBSource

Skip it when the database has a flat namespace (MySQL without cross-DB queries, SQLite, embedded databases).

## Decision Tree: Architecture Selection

```
Is it a SQL database with a SQLAlchemy dialect?
├── YES → CommonDbSourceService + BaseConnection[Config, Engine]
│   ├── Multiple databases? → Add MultiDBSource mixin
│   ├── Query logs available? → Add LineageSource + UsageSource
│   └── Stored procedures? → Framework handles via Inspector
└── NO → Does it have a proprietary API/SDK?
    ├── YES → DatabaseServiceSource + get_connection()/test_connection()
    │   ├── Document store? → CommonNoSQLSource (MongoDB, Couchbase, DynamoDB)
    │   └── Cloud catalog? → DatabaseServiceSource directly (Glue, Unity Catalog)
    └── NO → Consider if it belongs as a database connector at all
```
