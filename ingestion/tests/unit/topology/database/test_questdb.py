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
Unit tests for the QuestDB connector — no live cluster required.
"""
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.questdbConnection import (
    QuestDBConnection as QuestDBConnectionConfig,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.questdb.connection import (
    QUESTDB_DEFAULT_DATABASE,
    get_connection_url,
)
from metadata.ingestion.source.database.questdb.metadata import QuestDBSource
from metadata.ingestion.source.database.questdb.utils import (
    _get_columns,
    _get_table_names,
    patch_questdb_dialect,
)


@pytest.fixture
def minimal_connection():
    return QuestDBConnectionConfig(
        username="admin",
        authType=BasicAuth(password="quest"),
        hostPort="localhost:8812",
    )


@pytest.fixture
def named_connection():
    return QuestDBConnectionConfig(
        username="admin",
        authType=BasicAuth(password="quest"),
        hostPort="localhost:8812",
        databaseName="production-questdb",
    )


# ── get_connection_url ────────────────────────────────────────────────────────


def test_url_always_targets_qdb_database(minimal_connection):
    """QuestDB exposes a single database (qdb); URL must hardcode it regardless
    of what the user sets in databaseName (which is the OpenMetadata display
    name, not the psycopg2 connection target)."""
    url = get_connection_url(minimal_connection)
    assert url == "postgresql+psycopg2://admin:quest@localhost:8812/qdb"


def test_url_still_targets_qdb_when_database_name_set(named_connection):
    url = get_connection_url(named_connection)
    assert url.endswith("/qdb")
    assert "production-questdb" not in url


def test_url_omits_password_segment_when_password_empty():
    connection = QuestDBConnectionConfig(
        username="admin",
        authType=BasicAuth(password=""),
        hostPort="localhost:8812",
    )
    url = get_connection_url(connection)
    assert url == "postgresql+psycopg2://admin@localhost:8812/qdb"


def test_url_percent_encodes_special_characters():
    connection = QuestDBConnectionConfig(
        username="admin@corp",
        authType=BasicAuth(password="p@ss/word"),
        hostPort="localhost:8812",
    )
    url = get_connection_url(connection)
    assert "admin%40corp" in url
    assert "p%40ss%2Fword" in url


# ── QuestDBSource.create ──────────────────────────────────────────────────────

MOCK_WORKFLOW_CONFIG = {
    "source": {
        "type": "questdb",
        "serviceName": "questdb_test",
        "serviceConnection": {
            "config": {
                "type": "QuestDB",
                "hostPort": "localhost:8812",
                "username": "admin",
                "authType": {"password": "quest"},
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test-token"},
        }
    },
}


def test_create_raises_for_wrong_connection_type():
    mock_metadata = MagicMock()
    bad_config = dict(MOCK_WORKFLOW_CONFIG)
    bad_config["source"] = dict(bad_config["source"])
    bad_config["source"]["serviceConnection"] = {
        "config": {"type": "Mysql", "hostPort": "localhost:3306", "username": "root"}
    }
    with pytest.raises(InvalidSourceException):
        QuestDBSource.create(bad_config["source"], mock_metadata)


# ── get_database_names ────────────────────────────────────────────────────────


def test_get_database_names_defaults_to_qdb(minimal_connection):
    """Without databaseName, the display name must default to ``qdb`` (the
    actual QuestDB database) rather than the generic ``default`` from the
    base class."""
    with patch(
        "metadata.ingestion.source.database.questdb.metadata.QuestDBSource.__init__",
        return_value=None,
    ):
        source = QuestDBSource.__new__(QuestDBSource)
        source.service_connection = minimal_connection

    assert list(source.get_database_names()) == [QUESTDB_DEFAULT_DATABASE]


def test_get_database_names_uses_configured_name(named_connection):
    with patch(
        "metadata.ingestion.source.database.questdb.metadata.QuestDBSource.__init__",
        return_value=None,
    ):
        source = QuestDBSource.__new__(QuestDBSource)
        source.service_connection = named_connection

    assert list(source.get_database_names()) == ["production-questdb"]


# ── utils: information_schema-backed inspector methods ────────────────────────


def test_get_table_names_filters_by_schema_and_type():
    """_get_table_names must query information_schema with schema +
    table_type parameters so views and tables are cleanly separated."""
    connection = MagicMock()
    connection.execute.return_value = [("sensor_readings",), ("trades",)]

    result = _get_table_names(connection, schema="public", table_type="BASE TABLE")

    assert result == ["sensor_readings", "trades"]
    call_args = connection.execute.call_args
    params = call_args[0][1]
    assert params == {"schema": "public", "table_type": "BASE TABLE"}


def test_get_table_names_defaults_schema_to_public():
    connection = MagicMock()
    connection.execute.return_value = []

    _get_table_names(connection, schema=None)

    params = connection.execute.call_args[0][1]
    assert params["schema"] == "public"


def test_get_columns_maps_information_schema_types_to_sqlalchemy():
    """Core type mappings we rely on for the demo dataset: SYMBOL→VARCHAR,
    DOUBLE→DOUBLE_PRECISION, TIMESTAMP→TIMESTAMP, LONG→BIGINT, FLOAT→REAL.
    Also covers BINARY→LargeBinary (bytea) which QuestDB normalizes."""
    connection = MagicMock()
    connection.execute.return_value = [
        ("ts", "timestamp without time zone", "YES", None),
        ("sensor_id", "character varying", "YES", None),
        ("temperature", "double precision", "YES", None),
        ("battery_pct", "real", "YES", None),
        ("request_count", "bigint", "YES", None),
        ("error_count", "integer", "NO", None),
        ("blob", "bytea", "YES", None),
    ]

    columns = _get_columns(connection, "sensor_readings", "public")

    by_name = {c["name"]: c for c in columns}
    assert type(by_name["ts"]["type"]).__name__ == "TIMESTAMP"
    assert type(by_name["sensor_id"]["type"]).__name__ == "VARCHAR"
    assert type(by_name["temperature"]["type"]).__name__ == "DOUBLE_PRECISION"
    assert type(by_name["battery_pct"]["type"]).__name__ == "REAL"
    assert type(by_name["request_count"]["type"]).__name__ == "BIGINT"
    assert type(by_name["error_count"]["type"]).__name__ == "INTEGER"
    assert type(by_name["blob"]["type"]).__name__ == "LargeBinary"
    assert by_name["error_count"]["nullable"] is False
    assert by_name["ts"]["nullable"] is True


def test_get_columns_falls_back_to_nulltype_for_unknown_type():
    """Unknown data types must not raise — return NullType so SQLAlchemy
    can still reflect the column rather than failing the whole table."""
    connection = MagicMock()
    connection.execute.return_value = [
        ("weird_col", "magical_unknown_type", "YES", None)
    ]

    columns = _get_columns(connection, "t", "public")

    assert type(columns[0]["type"]).__name__ == "NullType"


# ── utils: dialect patching against a real PGDialect_psycopg2 ─────────────────


def test_patch_questdb_dialect_binds_on_real_pg_dialect():
    """The patch must survive on a genuine psycopg2 dialect — not just a
    MagicMock. This catches signature drift against the real SQLAlchemy
    Inspector contract."""
    engine = MagicMock(spec=["dialect", "url"])
    engine.dialect = PGDialect_psycopg2()
    engine.url = "postgresql+psycopg2://admin:quest@localhost:8812/qdb"

    patch_questdb_dialect(engine)
    connection = MagicMock()

    assert engine.dialect.get_pk_constraint(connection, "t", schema="public") == {
        "constrained_columns": [],
        "name": None,
    }
    assert engine.dialect.get_foreign_keys(connection, "t", schema="public") == []
    assert engine.dialect.get_unique_constraints(connection, "t", schema="public") == []
    assert engine.dialect.get_indexes(connection, "t", schema="public") == []
    assert engine.dialect.get_check_constraints(connection, "t", schema="public") == []
    assert engine.dialect.get_table_comment(connection, "t", schema="public") == {
        "text": None
    }
    assert engine.dialect.get_view_definition(connection, "v", schema="public") is None


def test_patch_questdb_dialect_routes_table_lookup_to_information_schema():
    """The patched get_table_names must emit a query against
    information_schema.tables (not pg_catalog.pg_class) when called through
    the SQLAlchemy Inspector contract."""
    engine = MagicMock(spec=["dialect", "url"])
    engine.dialect = PGDialect_psycopg2()
    engine.url = "postgresql+psycopg2://admin:quest@localhost:8812/qdb"
    connection = MagicMock()
    connection.execute.return_value = [("sensor_readings",)]

    patch_questdb_dialect(engine)
    tables = engine.dialect.get_table_names(connection, schema="public")

    assert tables == ["sensor_readings"]
    query_text = str(connection.execute.call_args[0][0])
    assert "information_schema.tables" in query_text
    assert "pg_catalog" not in query_text
