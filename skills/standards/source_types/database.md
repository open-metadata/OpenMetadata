# Database Connector Standards

## Base Classes

| Connection Type | Source Base Class | Connection Base |
|---|---|---|
| SQLAlchemy | `CommonDbSourceService` | `BaseConnection[Config, Engine]` |
| REST API | `DatabaseServiceSource` | `get_connection()` / `test_connection()` |
| SDK client | `DatabaseServiceSource` | `get_connection()` / `test_connection()` |

## SQLAlchemy Connectors

### Entity Hierarchy
```
DatabaseService → Database → Schema → Table → Column
                                    → StoredProcedure
```

`CommonDbSourceService` handles this topology automatically. Override methods only for custom behavior.

### connection.py
```python
class MyDbConnectionObj(BaseConnection[MyDbConnection, Engine]):
    def _get_client(self) -> Engine:
        return get_connection(self.service_connection)
```

### metadata.py
Usually requires no overrides:
```python
class MyDbSource(CommonDbSourceService):
    @classmethod
    def create(cls, config_dict, metadata, pipeline_name=None):
        config = WorkflowSource.model_validate(config_dict)
        connection: MyDbConnection = config.serviceConnection.root.config
        if not isinstance(connection, MyDbConnection):
            raise InvalidSourceException(f"Expected MyDbConnection, got {connection}")
        return cls(config, metadata)
```

### queries.py
SQL templates for metadata and query log extraction:
```python
MY_DB_GET_DATABASES = """
SELECT database_name FROM information_schema.databases
"""

MY_DB_QUERY_LOG = """
SELECT query_text, user_name, start_time, duration
FROM system.query_log
WHERE start_time > '{start_time}'
"""
```

### Lineage and Usage
Requires query log access. Implement:
- `lineage.py`: `LineageSource` mixin with `get_table_query()` override
- `usage.py`: `UsageSource` mixin
- `query_parser.py`: `QueryParserSource` with `create()` and `get_sql_statement()`

## Non-SQLAlchemy Database Connectors

Reference: `salesforce/` (uses `DatabaseServiceSource` + `DefaultDatabaseSpec`)

These connectors use the `DatabaseServiceSource` base class and implement `get_connection()` / `test_connection()` functions instead of `BaseConnection`.

The `service_spec.py` still uses `DefaultDatabaseSpec` but without `connection_class`.

## System Schemas to Exclude

Most databases have system schemas that should be excluded by default. Add them to the source:

```python
def get_default_schema_filter(self):
    return ["information_schema", "pg_catalog", "sys", "mysql"]
```
