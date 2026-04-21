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

QuestDB speaks the PostgreSQL wire protocol but only implements a minimal
``pg_catalog`` — the standard PostgreSQL dialect queries fail because QuestDB
cannot evaluate the casts and joins against ``pg_class``/``pg_attribute``.

``information_schema`` is fully supported, so we route the SQLAlchemy Inspector
methods used by ``CommonDbSourceService`` there. Constraints and indexes always
return empty results: QuestDB has no primary keys, foreign keys, unique
constraints or secondary indexes (the designated timestamp is handled as
table partitioning, not an index).

The dialect is patched on the per-engine ``Dialect`` instance returned by
``sqlalchemy.create_engine``. Each ``create_engine`` call instantiates a fresh
dialect object, so the patch is isolated to the QuestDB engine and never
leaks to a concurrent real-PostgreSQL engine.
"""
import types
from typing import Any, Dict, List, Optional, Type

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
    NUMERIC,
    REAL,
    SMALLINT,
    TIMESTAMP,
    VARCHAR,
    LargeBinary,
    NullType,
    TypeEngine,
)

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

QUESTDB_DEFAULT_SCHEMA = "public"

_INFORMATION_SCHEMA_TYPE_MAP: Dict[str, Type[TypeEngine]] = {
    "bigint": BIGINT,
    "boolean": BOOLEAN,
    "bytea": LargeBinary,
    "character": CHAR,
    "character varying": VARCHAR,
    "date": DATE,
    "double precision": DOUBLE_PRECISION,
    "float": FLOAT,
    "integer": INTEGER,
    "numeric": NUMERIC,
    "real": REAL,
    "smallint": SMALLINT,
    "timestamp without time zone": TIMESTAMP,
    "timestamp with time zone": TIMESTAMP,
}


def _information_schema_type(data_type: str) -> Type[TypeEngine]:
    return _INFORMATION_SCHEMA_TYPE_MAP.get(data_type.lower(), NullType)


def _get_table_names(
    connection: Connection,
    schema: Optional[str] = None,
    table_type: str = "BASE TABLE",
) -> List[str]:
    result = connection.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = :schema AND table_type = :table_type "
            "ORDER BY table_name"
        ),
        {"schema": schema or QUESTDB_DEFAULT_SCHEMA, "table_type": table_type},
    )
    return [row[0] for row in result]


def _get_columns(
    connection: Connection,
    table_name: str,
    schema: Optional[str] = None,
) -> List[Dict[str, Any]]:
    result = connection.execute(
        text(
            "SELECT column_name, data_type, is_nullable, column_default "
            "FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = :table_name "
            "ORDER BY ordinal_position"
        ),
        {"schema": schema or QUESTDB_DEFAULT_SCHEMA, "table_name": table_name},
    )
    columns: List[Dict[str, Any]] = []
    for column_name, data_type, is_nullable, column_default in result:
        columns.append(
            {
                "name": column_name,
                "type": _information_schema_type(data_type)(),
                "nullable": (is_nullable or "YES").upper() == "YES",
                "default": column_default,
                "autoincrement": False,
                "comment": None,
            }
        )
    return columns


def _empty_pk_constraint(*_args: Any, **_kwargs: Any) -> Dict[str, Any]:
    return {"constrained_columns": [], "name": None}


def _empty_list(*_args: Any, **_kwargs: Any) -> List[Any]:
    return []


def _empty_table_comment(*_args: Any, **_kwargs: Any) -> Dict[str, Any]:
    return {"text": None}


def _none_view_definition(*_args: Any, **_kwargs: Any) -> Optional[str]:
    return None


def patch_questdb_dialect(engine: Engine) -> Engine:
    """
    Replace the PostgreSQL dialect introspection methods on a given engine
    with QuestDB-safe equivalents backed by ``information_schema``.
    """
    dialect = engine.dialect
    logger.debug("Patching PostgreSQL dialect for QuestDB engine %s", engine.url)

    dialect.get_table_names = types.MethodType(
        lambda self, connection, schema=None, **_kw: _get_table_names(
            connection, schema, table_type="BASE TABLE"
        ),
        dialect,
    )
    dialect.get_view_names = types.MethodType(
        lambda self, connection, schema=None, **_kw: _get_table_names(
            connection, schema, table_type="VIEW"
        ),
        dialect,
    )
    dialect.get_columns = types.MethodType(
        lambda self, connection, table_name, schema=None, **_kw: _get_columns(
            connection, table_name, schema
        ),
        dialect,
    )
    dialect.get_pk_constraint = types.MethodType(
        lambda self, *a, **kw: _empty_pk_constraint(), dialect
    )
    dialect.get_foreign_keys = types.MethodType(
        lambda self, *a, **kw: _empty_list(), dialect
    )
    dialect.get_unique_constraints = types.MethodType(
        lambda self, *a, **kw: _empty_list(), dialect
    )
    dialect.get_indexes = types.MethodType(
        lambda self, *a, **kw: _empty_list(), dialect
    )
    dialect.get_check_constraints = types.MethodType(
        lambda self, *a, **kw: _empty_list(), dialect
    )
    dialect.get_table_comment = types.MethodType(
        lambda self, *a, **kw: _empty_table_comment(), dialect
    )
    dialect.get_view_definition = types.MethodType(
        lambda self, *a, **kw: _none_view_definition(), dialect
    )
    return engine
