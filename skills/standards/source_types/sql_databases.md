# SQL Database Connector Standards

Covers traditional RDBMS connectors: MySQL, PostgreSQL, MariaDB, Oracle, MSSQL, DB2, SQLite, etc.

## Base Classes

- Source: `CommonDbSourceService`
- Connection: `BaseConnection[Config, Engine]`
- Spec: `DefaultDatabaseSpec` with `connection_class`

## Key Characteristics

- Standard `host:port` connection with username/password
- SQLAlchemy dialect handles schema/table/column reflection
- Single-database (MySQL, SQLite) or multi-database (PostgreSQL, MSSQL)
- Query logs available via slow query log or system views

## Typical connection.py

```python
class MyDbConnectionObj(BaseConnection[MyDbConnection, Engine]):
    def _get_client(self) -> Engine:
        url = get_connection_url_common(self.service_connection)
        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=lambda _: url,
            get_connection_args_fn=lambda _: init_empty_connection_arguments(
                self.service_connection
            ),
        )
```

## System Schema Exclusion

Each RDBMS has system schemas to exclude by default:

| Database | System Schemas |
|----------|---------------|
| MySQL | `information_schema`, `mysql`, `performance_schema`, `sys` |
| PostgreSQL | `information_schema`, `pg_catalog`, `pg_toast` |
| MSSQL | `INFORMATION_SCHEMA`, `sys`, `guest` |
| Oracle | `SYS`, `SYSTEM`, `DBSNMP`, `OUTLN` |

## Query Log Sources

| Database | Source | Config Flag |
|----------|--------|------------|
| MySQL | `mysql.general_log` or slow query log | `useSlowLogs` |
| PostgreSQL | `pg_stat_statements` | — |
| MSSQL | `sys.dm_exec_query_stats` | — |
| Oracle | `V$SQL` | — |

## Multi-Database Support

PostgreSQL and MSSQL host multiple databases per server. Add `MultiDBSource`:

```python
class PostgresSource(CommonDbSourceService, MultiDBSource):
    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(POSTGRES_GET_DATABASES)
```

MySQL does NOT typically use `MultiDBSource` — databases are treated as schemas.

## Reference Connectors

- **Simplest**: `mysql/` — single-database, standard auth, slow query lineage
- **Multi-DB**: `postgres/` — MultiDBSource, pg_stat_statements
- **Enterprise**: `oracle/` — complex auth (wallet, SID vs service name), RAC support
