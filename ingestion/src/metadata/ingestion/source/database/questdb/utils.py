#  Copyright 2025 OpenMetadata
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
QuestDB dialect helpers.

QuestDB speaks the PostgreSQL wire protocol with a minimal ``pg_catalog``.
Column introspection queries ``information_schema.columns``.
Table and view enumeration uses the QuestDB-native ``tables()`` table function,
which exposes ``table_type``, ``partitionBy``, and ``designatedTimestamp``
metadata absent from ``information_schema.tables``.

Constraint and index introspection methods return empty collections, matching
QuestDB's schema model.

The dialect is patched on the per-engine ``Dialect`` instance returned by
``sqlalchemy.create_engine``, scoping the patch to that engine.
"""

import types
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.types import (
    BIGINT,
    BOOLEAN,
    CHAR,
    DATE,
    DOUBLE_PRECISION,
    FLOAT,
    INTEGER,
    SMALLINT,
    TIMESTAMP,
    VARCHAR,
    LargeBinary,
    NullType,
    TypeEngine,
)

from metadata.ingestion.source.database.questdb.models import (
    QuestDBColumnRow,
    QuestDBTableRow,
    QuestDBViewDefinitionRow,
)
from metadata.ingestion.source.database.questdb.queries import (
    QUESTDB_GET_COLUMNS,
    QUESTDB_GET_TABLES,
    QUESTDB_GET_VIEW_DEFINITION,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

QUESTDB_DEFAULT_SCHEMA = "public"

_QUESTDB_NATIVE_TYPE_MAP: dict[str, type[TypeEngine]] = {
    "boolean": BOOLEAN,
    "byte": SMALLINT,
    "short": SMALLINT,
    "int": INTEGER,
    "long": BIGINT,
    "float": FLOAT,
    "double": DOUBLE_PRECISION,
    "char": CHAR,
    "symbol": VARCHAR,
    "string": VARCHAR,
    "varchar": VARCHAR,
    "timestamp": TIMESTAMP,
    "date": DATE,
    "binary": LargeBinary,
    "long256": NullType,
    "uuid": VARCHAR,
    "ipv4": VARCHAR,
    "geohash": NullType,
}


def _questdb_native_type(data_type: str) -> type[TypeEngine]:
    return _QUESTDB_NATIVE_TYPE_MAP.get(data_type.lower(), NullType)


def _get_columns(
    connection: Connection,
    table_name: str,
    schema: str | None = None,
) -> list[dict[str, Any]]:
    result = connection.execute(text(QUESTDB_GET_COLUMNS.format(table_name=table_name)))
    columns: list[dict[str, Any]] = []
    for raw in result:
        row = QuestDBColumnRow.model_validate(dict(raw._mapping))
        columns.append(
            {
                "name": row.column,
                "type": _questdb_native_type(row.type)(),
                "nullable": True,
                "comment": "designated timestamp" if row.designated else None,
            }
        )
    return columns


def _empty_pk_constraint(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    return {"constrained_columns": [], "name": None}


def _empty_list(*_args: Any, **_kwargs: Any) -> list[Any]:
    return []


def _empty_table_comment(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    return {"text": None}


def _query_tables(connection: Connection) -> list[QuestDBTableRow]:
    """
    Return all rows from QuestDB's ``tables()`` function as ``QuestDBTableRow`` instances.
    """
    result = connection.execute(text(QUESTDB_GET_TABLES))
    return [QuestDBTableRow.model_validate(dict(row._mapping)) for row in result]


def _get_view_definition_from_views(
    connection: Connection,
    view_name: str,
    schema: str | None = None,
) -> str | None:
    result = connection.execute(
        text(QUESTDB_GET_VIEW_DEFINITION),
        {"name": view_name},
    )
    raw = result.fetchone()
    if not raw:
        return None
    return QuestDBViewDefinitionRow.model_validate(dict(raw._mapping)).view_sql


def patch_questdb_dialect(engine: Engine) -> Engine:
    """
    Replace the PostgreSQL dialect introspection methods on a given engine
    with QuestDB-safe equivalents backed by ``information_schema``.
    """
    dialect = engine.dialect
    logger.debug("Patching PostgreSQL dialect for QuestDB engine %s", engine.url)

    dialect.get_columns = types.MethodType(
        lambda self, connection, table_name, schema=None, **_kw: _get_columns(connection, table_name, schema),
        dialect,
    )
    dialect.get_pk_constraint = types.MethodType(lambda self, *a, **kw: _empty_pk_constraint(), dialect)
    dialect.get_foreign_keys = types.MethodType(lambda self, *a, **kw: _empty_list(), dialect)
    dialect.get_unique_constraints = types.MethodType(lambda self, *a, **kw: _empty_list(), dialect)
    dialect.get_indexes = types.MethodType(lambda self, *a, **kw: _empty_list(), dialect)
    dialect.get_check_constraints = types.MethodType(lambda self, *a, **kw: _empty_list(), dialect)
    dialect.get_table_comment = types.MethodType(lambda self, *a, **kw: _empty_table_comment(), dialect)
    dialect.get_view_definition = types.MethodType(
        lambda self, connection, view_name, schema=None, **_kw: _get_view_definition_from_views(
            connection, view_name, schema
        ),
        dialect,
    )
    return engine
