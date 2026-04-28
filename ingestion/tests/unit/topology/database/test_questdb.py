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

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    TableType,
)
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
from metadata.ingestion.source.database.questdb.lineage import QuestDBLineageSource
from metadata.ingestion.source.database.questdb.metadata import QuestDBSource
from metadata.ingestion.source.database.questdb.models import QuestDBTableRow
from metadata.ingestion.source.database.questdb.utils import (
    _get_columns,
    _get_view_definition_from_views,
    _query_tables,
    patch_questdb_dialect,
)

# ── Shared test helpers ───────────────────────────────────────────────────────


def _row(**kwargs):
    """Return a mock row whose ``_mapping`` exposes the given keyword args.

    Used to simulate SQLAlchemy ``Row`` objects returned by
    ``connection.execute()`` in functions that call ``dict(row._mapping)``.
    """
    m = MagicMock()
    m._mapping = kwargs
    return m


# ── Fixtures ──────────────────────────────────────────────────────────────────


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


# ── utils: _get_columns ───────────────────────────────────────────────────────


def test_get_columns_maps_native_questdb_types():
    """_get_columns must map QuestDB native type strings to SQLAlchemy types.

    Each column row comes from ``table_columns()`` with fields
    ``column``, ``type``, and ``designated``.
    """
    connection = MagicMock()
    connection.execute.return_value = [
        _row(column="ts", type="timestamp", designated=True),
        _row(column="sensor_id", type="symbol", designated=False),
        _row(column="temperature", type="double", designated=False),
        _row(column="battery_pct", type="float", designated=False),
        _row(column="request_count", type="long", designated=False),
        _row(column="error_count", type="int", designated=False),
        _row(column="blob_data", type="binary", designated=False),
    ]

    columns = _get_columns(connection, "sensor_readings", "public")

    by_name = {c["name"]: c for c in columns}
    assert type(by_name["ts"]["type"]).__name__ == "TIMESTAMP"
    assert type(by_name["sensor_id"]["type"]).__name__ == "VARCHAR"
    assert type(by_name["temperature"]["type"]).__name__ == "DOUBLE_PRECISION"
    assert type(by_name["battery_pct"]["type"]).__name__ == "FLOAT"
    assert type(by_name["request_count"]["type"]).__name__ == "BIGINT"
    assert type(by_name["error_count"]["type"]).__name__ == "INTEGER"
    assert type(by_name["blob_data"]["type"]).__name__ == "LargeBinary"
    # QuestDB does not enforce NOT NULL; all columns are always nullable
    for col in columns:
        assert col["nullable"] is True


def test_get_columns_marks_designated_timestamp_in_comment():
    """The designated timestamp column must have comment='designated timestamp'."""
    connection = MagicMock()
    connection.execute.return_value = [
        _row(column="ts", type="timestamp", designated=True),
        _row(column="value", type="double", designated=False),
    ]

    columns = _get_columns(connection, "trades", "public")
    by_name = {c["name"]: c for c in columns}

    assert by_name["ts"]["comment"] == "designated timestamp"
    assert by_name["value"]["comment"] is None


def test_get_columns_falls_back_to_nulltype_for_unknown_type():
    """Unknown data types must not raise — return NullType so SQLAlchemy
    can still reflect the column rather than failing the whole table."""
    connection = MagicMock()
    connection.execute.return_value = [_row(column="weird_col", type="magical_unknown_type", designated=False)]

    columns = _get_columns(connection, "t", "public")

    assert type(columns[0]["type"]).__name__ == "NullType"


# ── utils: _query_tables ──────────────────────────────────────────────────────


def test_query_tables_uses_table_type_for_categorization():
    """_query_tables must return all rows from tables() with table_type included,
    without a pre-flight query to views()."""
    connection = MagicMock()
    connection.execute.return_value = [
        _row(
            table_name="sensor_readings",
            partitionBy="DAY",
            designatedTimestamp="ts",
            table_type="T",
        ),
        _row(
            table_name="trades",
            partitionBy="NONE",
            designatedTimestamp=None,
            table_type="T",
        ),
        _row(
            table_name="daily_stats",
            partitionBy="NONE",
            designatedTimestamp=None,
            table_type="V",
        ),
    ]

    result = _query_tables(connection)
    names = [r.name for r in result]

    assert "sensor_readings" in names
    assert "trades" in names
    assert "daily_stats" in names

    by_name = {r.name: r for r in result}
    assert by_name["sensor_readings"].table_type == "T"
    assert by_name["daily_stats"].table_type == "V"

    query_text = str(connection.execute.call_args[0][0])
    assert "tables()" in query_text
    assert "views()" not in query_text


def test_query_tables_identifies_materialized_views():
    """Rows with table_type 'M' must have table_type set correctly."""
    connection = MagicMock()
    connection.execute.return_value = [
        _row(
            table_name="sensor_daily",
            partitionBy="DAY",
            designatedTimestamp="ts",
            table_type="M",
        ),
        _row(
            table_name="sensor_readings",
            partitionBy="DAY",
            designatedTimestamp="ts",
            table_type="T",
        ),
    ]

    result = _query_tables(connection)
    by_name = {r.name: r for r in result}

    assert by_name["sensor_daily"].table_type == "M"
    assert by_name["sensor_readings"].table_type == "T"


def test_query_tables_sets_partition_by():
    """partition_by and designated_timestamp must be forwarded from tables()."""
    connection = MagicMock()
    connection.execute.return_value = [
        _row(
            table_name="orders",
            partitionBy="DAY",
            designatedTimestamp="created_at",
            table_type="T",
        ),
        _row(
            table_name="products",
            partitionBy="NONE",
            designatedTimestamp=None,
            table_type="T",
        ),
    ]

    result = _query_tables(connection)
    by_name = {r.name: r for r in result}

    assert by_name["orders"].partition_by == "DAY"
    assert by_name["orders"].designated_timestamp == "created_at"
    assert by_name["products"].partition_by == "NONE"
    assert by_name["products"].designated_timestamp is None


# ── utils: _get_view_definition_from_views ────────────────────────────────────


def test_get_view_definition_from_views_returns_sql():
    """Must return the view_sql string when the view exists in views()."""
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = _row(
        view_sql="SELECT ts, sensor_id FROM iot_alerts WHERE severity = 'critical'"
    )

    definition = _get_view_definition_from_views(connection, "iot_critical_alerts", "public")

    assert definition == "SELECT ts, sensor_id FROM iot_alerts WHERE severity = 'critical'"
    query_text = str(connection.execute.call_args[0][0])
    assert "views()" in query_text


def test_get_view_definition_from_views_returns_none_when_not_found():
    """Must return None when the view name does not exist in views()."""
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = None

    definition = _get_view_definition_from_views(connection, "nonexistent_view")

    assert definition is None


# ── metadata: helpers ─────────────────────────────────────────────────────────


def _make_source_with_cache(mock_tuples):
    """Create a QuestDBSource with __init__ bypassed and _tables_cache populated.

    Each entry in mock_tuples is a 4-tuple:
    (name, partition_by, designated_timestamp, table_type).
    """
    with patch(
        "metadata.ingestion.source.database.questdb.metadata.QuestDBSource.__init__",
        return_value=None,
    ):
        source = QuestDBSource.__new__(QuestDBSource)

    source._tables_cache = {
        name: QuestDBTableRow(
            name=name,
            partition_by=pb,
            designated_timestamp=dt,
            table_type=tt,
        )
        for name, pb, dt, tt in mock_tuples
    }
    return source


# ── metadata: query_table_names_and_types ─────────────────────────────────────


def test_query_table_names_types_regular():
    source = _make_source_with_cache(
        mock_tuples=[
            ("orders", "NONE", None, "T"),
            ("products", "NONE", None, "T"),
        ],
    )
    result = list(source.query_table_names_and_types("public"))
    types_map = {r.name: r.type_ for r in result}

    assert types_map["orders"] == TableType.Regular
    assert types_map["products"] == TableType.Regular


def test_query_table_names_types_partitioned():
    source = _make_source_with_cache(
        mock_tuples=[
            ("sensor_readings", "DAY", "ts", "T"),
            ("trades", "HOUR", "ts", "T"),
        ],
    )
    result = list(source.query_table_names_and_types("public"))
    types_map = {r.name: r.type_ for r in result}

    assert types_map["sensor_readings"] == TableType.Partitioned
    assert types_map["trades"] == TableType.Partitioned


def test_query_table_names_types_excludes_views_and_mat_views():
    """Objects with table_type 'V' or 'M' must not appear in table results."""
    source = _make_source_with_cache(
        mock_tuples=[
            ("orders", "NONE", None, "T"),
            ("sensor_daily", "DAY", "ts", "M"),
            ("daily_stats", "NONE", None, "V"),
        ],
    )
    result = list(source.query_table_names_and_types("public"))
    names = [r.name for r in result]

    assert "orders" in names
    assert "sensor_daily" not in names
    assert "daily_stats" not in names


# ── metadata: query_view_names_and_types ──────────────────────────────────────


def test_query_view_names_types_regular_view():
    """Objects with table_type 'V' from tables() must be typed as TableType.View."""
    source = _make_source_with_cache(
        mock_tuples=[
            ("iot_critical_alerts", "NONE", None, "V"),
            ("sensor_readings", "DAY", "ts", "T"),
        ],
    )
    result = list(source.query_view_names_and_types("public"))
    types_map = {r.name: r.type_ for r in result}

    assert types_map["iot_critical_alerts"] == TableType.View
    assert "sensor_readings" not in types_map


def test_query_view_names_types_materialized_view():
    """Objects with table_type 'M' from tables() must be typed as MaterializedView."""
    source = _make_source_with_cache(
        mock_tuples=[
            ("sensor_daily", "DAY", "ts", "M"),
            ("sensor_readings", "DAY", "ts", "T"),
        ],
    )
    result = list(source.query_view_names_and_types("public"))
    types_map = {r.name: r.type_ for r in result}

    assert types_map["sensor_daily"] == TableType.MaterializedView
    assert "sensor_readings" not in types_map


# ── metadata: get_table_partition_details ────────────────────────────────────


def test_get_table_partition_details_returns_partition():
    """Partitioned tables must return (True, TablePartition) with correct interval."""
    source = _make_source_with_cache(
        mock_tuples=[("sensor_readings", "DAY", "ts", "T")],
    )
    is_partitioned, partition = source.get_table_partition_details("sensor_readings", "public", MagicMock())

    assert is_partitioned is True
    assert partition is not None
    assert partition.columns[0].intervalType == PartitionIntervalTypes.TIME_UNIT
    assert partition.columns[0].interval == "DAY"


def test_get_table_partition_details_includes_column_name():
    """The designated timestamp column must be surfaced as columnName."""
    source = _make_source_with_cache(
        mock_tuples=[("sensor_readings", "DAY", "created_at", "T")],
    )
    _, partition = source.get_table_partition_details("sensor_readings", "public", MagicMock())

    assert partition.columns[0].columnName == "created_at"


def test_get_table_partition_details_returns_false_for_none():
    """Tables with partitionBy=NONE must return (False, None)."""
    source = _make_source_with_cache(
        mock_tuples=[("orders", "NONE", None, "T")],
    )
    is_partitioned, partition = source.get_table_partition_details("orders", "public", MagicMock())

    assert is_partitioned is False
    assert partition is None


def test_get_table_partition_details_returns_false_for_missing_table():
    """Unknown table names must return (False, None) gracefully."""
    source = _make_source_with_cache(mock_tuples=[])
    is_partitioned, partition = source.get_table_partition_details("ghost_table", "public", MagicMock())

    assert is_partitioned is False
    assert partition is None


def test_get_table_partition_details_hour_interval():
    source = _make_source_with_cache(
        mock_tuples=[("trades", "HOUR", "ts", "T")],
    )
    is_partitioned, partition = source.get_table_partition_details("trades", "public", MagicMock())

    assert is_partitioned is True
    assert partition.columns[0].interval == "HOUR"


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
    assert engine.dialect.get_table_comment(connection, "t", schema="public") == {"text": None}


def test_patch_questdb_dialect_view_definition_queries_views_func():
    """The patched get_view_definition must call views() not return None."""
    engine = MagicMock(spec=["dialect", "url"])
    engine.dialect = PGDialect_psycopg2()
    engine.url = "postgresql+psycopg2://admin:quest@localhost:8812/qdb"

    patch_questdb_dialect(engine)
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = _row(view_sql="SELECT 1")

    result = engine.dialect.get_view_definition(connection, "my_view", schema="public")

    assert result == "SELECT 1"
    query_text = str(connection.execute.call_args[0][0])
    assert "views()" in query_text


# ── lineage: QuestDBLineageSource.create ─────────────────────────────────────

MOCK_LINEAGE_WORKFLOW_CONFIG = {
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
        "sourceConfig": {"config": {"type": "DatabaseLineage"}},
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


def _make_lineage_source(database_name=None):
    """Create a QuestDBLineageSource with __init__ bypassed."""
    with patch(
        "metadata.ingestion.source.database.questdb.lineage.QuestDBLineageSource.__init__",
        return_value=None,
    ):
        source = QuestDBLineageSource.__new__(QuestDBLineageSource)
    source.service_connection = MagicMock()
    source.service_connection.databaseName = database_name
    source.metadata = MagicMock()
    source.config = MagicMock()
    source.config.serviceName = "questdb_test"
    return source


def test_lineage_create_raises_for_wrong_connection_type():
    """QuestDBLineageSource.create must reject non-QuestDB connection configs."""
    mock_metadata = MagicMock()
    bad_config = dict(MOCK_LINEAGE_WORKFLOW_CONFIG)
    bad_config["source"] = dict(bad_config["source"])
    bad_config["source"]["serviceConnection"] = {
        "config": {"type": "Mysql", "hostPort": "localhost:3306", "username": "root"}
    }
    with pytest.raises(InvalidSourceException):
        QuestDBLineageSource.create(bad_config["source"], mock_metadata)


# ── lineage: _yield_materialized_view_lineage ─────────────────────────────────


def test_yield_materialized_view_lineage_yields_lineage():
    """Must emit lineage for each materialized view row returned by the DB."""
    source = _make_lineage_source()

    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    source.get_engine = MagicMock(return_value=iter([mock_engine]))

    mat_row = _row(
        view_name="sensor_daily",
        base_table_name="sensor_readings",
        view_sql="SELECT ts FROM sensor_readings",
    )
    mock_conn.execute.return_value = [mat_row]

    mock_lineage = MagicMock()
    with patch(
        "metadata.ingestion.source.database.questdb.lineage._create_lineage_by_table_name",
        return_value=iter([mock_lineage]),
    ):
        results = list(source._yield_materialized_view_lineage())

    assert results == [mock_lineage]


def test_yield_materialized_view_lineage_empty_result():
    """No rows from materialized_views() → no lineage yielded."""
    source = _make_lineage_source()
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    source.get_engine = MagicMock(return_value=iter([mock_engine]))
    mock_conn.execute.return_value = []

    results = list(source._yield_materialized_view_lineage())

    assert results == []


def test_yield_materialized_view_lineage_skips_row_on_lineage_error():
    """A lineage creation failure on one row must be swallowed; subsequent
    rows must still produce lineage."""
    source = _make_lineage_source()
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    source.get_engine = MagicMock(return_value=iter([mock_engine]))

    bad_row = _row(view_name="bad_mv", base_table_name="src", view_sql=None)
    good_row = _row(view_name="good_mv", base_table_name="sensor_readings", view_sql=None)
    mock_conn.execute.return_value = [bad_row, good_row]

    good_lineage = MagicMock()
    with patch(
        "metadata.ingestion.source.database.questdb.lineage._create_lineage_by_table_name",
        side_effect=[Exception("lineage error"), iter([good_lineage])],
    ):
        results = list(source._yield_materialized_view_lineage())

    assert len(results) == 1
    assert results[0] is good_lineage


def test_yield_materialized_view_lineage_uses_config_database_name():
    """When databaseName is set, it must be forwarded to _create_lineage_by_table_name."""
    source = _make_lineage_source(database_name="prod-questdb")
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    source.get_engine = MagicMock(return_value=iter([mock_engine]))
    mock_conn.execute.return_value = [_row(view_name="mv", base_table_name="t", view_sql="SELECT 1")]

    with patch(
        "metadata.ingestion.source.database.questdb.lineage._create_lineage_by_table_name",
        return_value=iter([]),
    ) as mock_create:
        list(source._yield_materialized_view_lineage())

    call_kwargs = mock_create.call_args[1]
    assert call_kwargs["database_name"] == "prod-questdb"


def test_yield_materialized_view_lineage_defaults_database_to_qdb():
    """When databaseName is not configured, the call must use ``qdb``."""
    source = _make_lineage_source(database_name=None)
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    source.get_engine = MagicMock(return_value=iter([mock_engine]))
    mock_conn.execute.return_value = [_row(view_name="mv", base_table_name="t", view_sql=None)]

    with patch(
        "metadata.ingestion.source.database.questdb.lineage._create_lineage_by_table_name",
        return_value=iter([]),
    ) as mock_create:
        list(source._yield_materialized_view_lineage())

    call_kwargs = mock_create.call_args[1]
    assert call_kwargs["database_name"] == QUESTDB_DEFAULT_DATABASE


def test_yield_materialized_view_lineage_handles_engine_error():
    """An exception from get_engine() must be caught and not propagate."""
    source = _make_lineage_source()
    source.get_engine = MagicMock(side_effect=Exception("engine failure"))

    results = list(source._yield_materialized_view_lineage())

    assert results == []


# ── lineage: yield_view_lineage ───────────────────────────────────────────────


def test_yield_view_lineage_chains_parent_and_materialized():
    """yield_view_lineage must emit results from both the parent class
    (regular views) and _yield_materialized_view_lineage."""
    source = _make_lineage_source()
    parent_item = MagicMock()
    mat_item = MagicMock()

    with (
        patch.object(
            QuestDBLineageSource.__bases__[0],
            "yield_view_lineage",
            return_value=iter([parent_item]),
        ),
        patch.object(source, "_yield_materialized_view_lineage", return_value=iter([mat_item])),
    ):
        results = list(source.yield_view_lineage())

    assert parent_item in results
    assert mat_item in results
