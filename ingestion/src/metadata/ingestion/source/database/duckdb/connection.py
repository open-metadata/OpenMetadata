#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
DuckDB connection handler.

``duckdb-engine`` reflects through SQLAlchemy's Postgres dialect. Against DuckDB that
reflection fails or misleads: column reflection joins ``pg_catalog.pg_collation``, which
DuckDB does not expose; schema and table listings mix every attached catalog
(``system``, ``temp`` and any ATTACHed file); primary keys and unique constraints come
back empty on DuckDB 1.x, and all constraint reflection fails on 2.x (``REGCLASS`` is not
a DuckDB type), aborting the transaction it ran in. The dialect methods OpenMetadata relies on are therefore replaced with
queries on DuckDB's own catalog, scoped to the database the connection opened.
"""

from typing import Any

from duckdb_engine import Dialect as DuckDBDialect
from sqlalchemy.engine import URL, Connection, Engine, Row

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.duckDBConnection import (
    DuckDBConnection as DuckDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.duckDBConnection import (
    DuckDBScheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.duckdb.queries import (
    DUCKDB_COLUMNS,
    DUCKDB_CONSTRAINTS,
    DUCKDB_CURRENT_DATABASE,
    DUCKDB_QUERY_LOG_TEST,
    DUCKDB_SCHEMA_NAMES,
    DUCKDB_TABLE_COMMENT,
    DUCKDB_TABLE_NAMES,
    DUCKDB_VIEW_DEFINITION,
)
from metadata.ingestion.source.database.duckdb.types import sqla_type_for
from metadata.utils.constants import THREE_MIN

IN_MEMORY_DATABASE = ":memory:"


def _unqualified(schema: str | None) -> str:
    """OpenMetadata may pass ``<catalog>.<schema>``; DuckDB's catalog views key on the schema alone."""
    return (schema or "main").rsplit(".", 1)[-1]


def _get_schema_names(self: DuckDBDialect, connection: Connection, **_) -> list[str]:
    return list(connection.execute(DUCKDB_SCHEMA_NAMES).scalars())


def _get_relation_names(connection: Connection, schema: str | None, table_type: str) -> list[str]:
    result = connection.execute(DUCKDB_TABLE_NAMES, {"schema_name": _unqualified(schema), "table_type": table_type})
    return list(result.scalars())


def _get_table_names(self: DuckDBDialect, connection: Connection, schema: str | None = None, **_) -> list[str]:
    return _get_relation_names(connection, schema, "BASE TABLE")


def _get_view_names(
    self: DuckDBDialect, connection: Connection, schema: str | None = None, include: Any = None, **_
) -> list[str]:
    return _get_relation_names(connection, schema, "VIEW")


def _get_columns(
    self: DuckDBDialect, connection: Connection, table_name: str, schema: str | None = None, **_
) -> list[dict[str, Any]]:
    result = connection.execute(DUCKDB_COLUMNS, {"schema_name": _unqualified(schema), "table_name": table_name})
    return [
        {
            "name": row.column_name,
            "type": sqla_type_for(row.data_type),
            "nullable": row.is_nullable,
            "default": row.column_default,
            "autoincrement": False,
            "comment": row.comment,
        }
        for row in result
    ]


def _get_view_definition(
    self: DuckDBDialect, connection: Connection, view_name: str, schema: str | None = None, **_
) -> str | None:
    return connection.execute(
        DUCKDB_VIEW_DEFINITION, {"schema_name": _unqualified(schema), "view_name": view_name}
    ).scalar()


def _get_table_comment(
    self: DuckDBDialect, connection: Connection, table_name: str, schema: str | None = None, **_
) -> dict[str, str | None]:
    comment = connection.execute(
        DUCKDB_TABLE_COMMENT, {"schema_name": _unqualified(schema), "table_name": table_name}
    ).scalar()
    return {"text": comment}


def _constraints(connection: Connection, table_name: str, schema: str | None, constraint_type: str) -> list[Row]:
    return list(
        connection.execute(
            DUCKDB_CONSTRAINTS,
            {"schema_name": _unqualified(schema), "table_name": table_name, "constraint_type": constraint_type},
        )
    )


def _get_pk_constraint(
    self: DuckDBDialect, connection: Connection, table_name: str, schema: str | None = None, **_
) -> dict:
    primary_keys = _constraints(connection, table_name, schema, "PRIMARY KEY")
    columns = list(primary_keys[0].constraint_column_names) if primary_keys else []
    return {"name": None, "constrained_columns": columns}


def _get_unique_constraints(
    self: DuckDBDialect, connection: Connection, table_name: str, schema: str | None = None, **_
) -> list[dict[str, Any]]:
    return [
        {"name": None, "column_names": list(row.constraint_column_names)}
        for row in _constraints(connection, table_name, schema, "UNIQUE")
    ]


def _get_foreign_keys(
    self: DuckDBDialect, connection: Connection, table_name: str, schema: str | None = None, **_
) -> list[dict[str, Any]]:
    """DuckDB foreign keys cannot cross schemas, so the referred schema is the table's own."""
    return [
        {
            "name": None,
            "constrained_columns": list(row.constraint_column_names),
            "referred_schema": _unqualified(schema),
            "referred_table": row.referenced_table,
            "referred_columns": list(row.referenced_column_names),
            "options": {},
        }
        for row in _constraints(connection, table_name, schema, "FOREIGN KEY")
    ]


def _get_isolation_level_values(self: DuckDBDialect, dbapi_connection: Any) -> list[str]:
    """duckdb-engine inherits Postgres' isolation levels but cannot set any, AUTOCOMMIT included.

    Reporting none keeps ``create_generic_db_connection`` from requesting AUTOCOMMIT, which
    it does to release Postgres table locks; a read-only DuckDB file holds no such locks.
    """
    return []


def _install_dialect_patches() -> None:
    DuckDBDialect.get_isolation_level_values = _get_isolation_level_values  # pyright: ignore[reportAttributeAccessIssue]
    DuckDBDialect.get_schema_names = _get_schema_names
    DuckDBDialect.get_table_names = _get_table_names
    DuckDBDialect.get_view_names = _get_view_names
    DuckDBDialect.get_columns = _get_columns
    DuckDBDialect.get_view_definition = _get_view_definition
    DuckDBDialect.get_table_comment = _get_table_comment
    DuckDBDialect.get_pk_constraint = _get_pk_constraint
    DuckDBDialect.get_unique_constraints = _get_unique_constraints
    DuckDBDialect.get_foreign_keys = _get_foreign_keys  # pyright: ignore[reportAttributeAccessIssue]


_install_dialect_patches()


def get_connection_url(connection: DuckDBConnectionConfig) -> str:
    """Build the duckdb-engine URL; files open read-only so concurrent workflows do not contend for the write lock.

    duckdb-engine passes URL query parameters to DuckDB as configuration options,
    which is how ``connectionOptions`` reach the database.
    See https://duckdb.org/docs/stable/connect/concurrency for the locking model.
    """
    options = get_connection_options_dict(connection) or {}
    if connection.databaseFilePath != IN_MEMORY_DATABASE:
        options = {**options, "access_mode": "read_only"}
    scheme = connection.scheme.value if connection.scheme else DuckDBScheme.duckdb.value
    url = URL.create(scheme, database=connection.databaseFilePath, query=options)
    return url.render_as_string(hide_password=False)


def get_database_name(engine: Engine, connection: DuckDBConnectionConfig) -> str:
    """The OpenMetadata database name: the configured one, else the DuckDB catalog name."""
    if connection.databaseName:
        return connection.databaseName
    with engine.connect() as conn:
        return conn.execute(DUCKDB_CURRENT_DATABASE).scalar_one()


class DuckDBConnection(BaseConnection[DuckDBConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries={"GetQueries": DUCKDB_QUERY_LOG_TEST},
            timeout_seconds=timeout_seconds,
        )
