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
Unit tests for the Snowflake ACCESS_HISTORY lineage path (POC).

The path is selected via `connectionOptions.useAccessHistory = "true"` and is
gated by a runtime probe against `ACCOUNT_USAGE.ACCESS_HISTORY`. These tests
cover SQL rendering, connectionOptions parsing, probe behavior, table-edge
and column-edge yielding, COPY_HISTORY stage→container resolution, and the
critical regression that the client-side SQL parser is never invoked when
the flag is on.
"""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityLineage import Source as LineageEdgeSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.snowflake.lineage import (
    USE_ACCESS_HISTORY_OPTION_KEY,
    SnowflakeLineageSource,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_ACCESS_HISTORY_LINEAGE,
    SNOWFLAKE_ACCESS_HISTORY_PROBE,
    SNOWFLAKE_COPY_HISTORY_LINEAGE,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_table_entity(table_uuid: str, db: str, schema: str, table: str, columns=None) -> Table:
    """Build a minimal Table entity for column-lineage resolution tests."""
    table_fqn = f"test_service.{db}.{schema}.{table}"
    cols = [
        Column(
            name=c,
            dataType=DataType.STRING,
            fullyQualifiedName=FullyQualifiedEntityName(f"{table_fqn}.{c}"),
        )
        for c in (columns or [])
    ]
    return Table(
        id=Uuid(table_uuid),
        name=EntityName(table),
        fullyQualifiedName=FullyQualifiedEntityName(table_fqn),
        columns=cols,
    )


def _make_container_entity(container_uuid: str, full_path: str) -> Container:
    return Container(
        id=Uuid(container_uuid),
        name=EntityName("stage_bucket"),
        fullyQualifiedName=FullyQualifiedEntityName(f"storage_service.{full_path}"),
        fullPath=full_path,
        service=EntityReference(
            id=Uuid("99999999-9999-9999-9999-999999999999"),
            type="storageService",
        ),
    )


def _make_lineage_source(
    metadata=None,
    connection_options=None,
    rows_by_sql=None,
    service_name="test_service",
    account_usage="SNOWFLAKE.ACCOUNT_USAGE",
) -> SnowflakeLineageSource:
    """
    Instantiate SnowflakeLineageSource bypassing the heavy parent __init__.

    Tests inject `connectionOptions` (popped value semantics), the metadata
    client, and a `rows_by_sql` dict that maps a substring of the rendered
    SQL to the list of mock rows the connection should return.
    """
    src = SnowflakeLineageSource.__new__(SnowflakeLineageSource)
    src.metadata = metadata or MagicMock()
    src.config = MagicMock()
    src.config.serviceName = service_name
    src.service_connection = MagicMock()
    src.service_connection.accountUsageSchema = account_usage
    src.service_connection.connectionOptions = MagicMock()
    src.service_connection.connectionOptions.root = dict(connection_options or {})
    src.source_config = MagicMock()
    src.engine = _make_mock_engine(rows_by_sql or {})
    src.start = "2025-01-01 00:00:00"
    src.end = "2025-01-02 00:00:00"
    src._table_cache = {}
    src._container_cache = {}
    src._use_access_history = False
    return src


def _make_mock_engine(rows_by_sql):
    """
    Build a SQLAlchemy-engine-like mock whose `engine.connect()` context
    manager returns a connection whose `execute(...)` returns mock rows
    keyed by which SQL constant was rendered (matched by substring).
    """

    def _rows_for(sql_str: str):
        for marker, rows in rows_by_sql.items():
            if marker in sql_str:
                return iter(rows)
        return iter([])

    conn = MagicMock()
    conn.execute = MagicMock(side_effect=lambda statement: _rows_for(str(statement)))
    # execution_options(...).execute(...) needs to route through the same matcher.
    conn.execution_options = MagicMock(return_value=conn)
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)

    engine = MagicMock()
    engine.connect = MagicMock(return_value=conn)
    return engine


class _Row(dict):
    """A row mock that satisfies SQLAlchemy's row interface for our reader."""

    def _asdict(self):
        return dict(self)


# ---------------------------------------------------------------------------
# SQL rendering
# ---------------------------------------------------------------------------


def test_combined_lineage_sql_streams_one_row_per_edge():
    """
    The combined SQL must (a) dedupe table edges with MAX_BY, (b) aggregate
    column pairs into a per-edge VARIANT array via ARRAY_AGG, and (c) LEFT
    JOIN them so one row = one edge with column pairs attached.
    """
    rendered = SNOWFLAKE_ACCESS_HISTORY_LINEAGE.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_time="2025-01-01",
        end_time="2025-01-31",
    )
    # Server-side dedup for table edges
    assert "MAX_BY(ah.QUERY_ID, ah.QUERY_START_TIME)" in rendered
    # Column pairs aggregated server-side — no client map needed
    assert "ARRAY_AGG(DISTINCT OBJECT_CONSTRUCT(" in rendered
    assert "COLUMN_PAIRS" in rendered
    # Both flatten paths preserved
    assert "DIRECT_OBJECTS_ACCESSED" in rendered
    assert "directSources" in rendered
    # LEFT JOIN binds column array to its table edge
    assert "LEFT JOIN column_edges_grouped" in rendered
    assert "ARRAY_SLICE" not in rendered


def test_copy_history_sql_filters_loaded_status():
    rendered = SNOWFLAKE_COPY_HISTORY_LINEAGE.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_time="2025-01-01",
        end_time="2025-01-31",
    )
    assert "COPY_HISTORY" in rendered
    assert "STATUS = 'Loaded'" in rendered
    assert "STAGE_LOCATION" in rendered


def test_probe_sql_is_lightweight():
    rendered = SNOWFLAKE_ACCESS_HISTORY_PROBE.format(account_usage="SNOWFLAKE.ACCOUNT_USAGE")
    assert "ACCESS_HISTORY" in rendered
    assert "LIMIT 1" in rendered


# ---------------------------------------------------------------------------
# connectionOptions parsing
# ---------------------------------------------------------------------------


def test_use_access_history_flag_default_off():
    src = _make_lineage_source(connection_options={})
    assert src._read_access_history_flag() is False


def test_use_access_history_flag_parses_true():
    src = _make_lineage_source(connection_options={USE_ACCESS_HISTORY_OPTION_KEY: "true"})
    assert src._read_access_history_flag() is True


def test_use_access_history_flag_parses_case_insensitive():
    src = _make_lineage_source(connection_options={USE_ACCESS_HISTORY_OPTION_KEY: "TRUE"})
    assert src._read_access_history_flag() is True


def test_use_access_history_flag_ignores_unrelated_options():
    src = _make_lineage_source(connection_options={"otherOpt": "value"})
    assert src._read_access_history_flag() is False


def test_use_access_history_key_is_popped_from_options():
    """The OM-specific key must be removed so the Snowflake driver never sees it."""
    options = {USE_ACCESS_HISTORY_OPTION_KEY: "true", "OTHER": "keep"}
    src = _make_lineage_source(connection_options=options)
    src._read_access_history_flag()
    # The src has its own copy in service_connection.connectionOptions.root
    assert USE_ACCESS_HISTORY_OPTION_KEY not in src.service_connection.connectionOptions.root
    assert "OTHER" in src.service_connection.connectionOptions.root


# ---------------------------------------------------------------------------
# Probe demote behavior
# ---------------------------------------------------------------------------


def test_probe_failure_falls_back_to_legacy():
    """A failing probe must flip _use_access_history to False even if the flag was set."""
    with patch(
        "metadata.ingestion.source.database.snowflake.lineage.probe_access_history_available",
        return_value=False,
    ):
        # Re-run the init logic in isolation
        src = _make_lineage_source(connection_options={USE_ACCESS_HISTORY_OPTION_KEY: "true"})
        # Simulate the __init__ probe step
        src._use_access_history = src._read_access_history_flag()
        from metadata.ingestion.source.database.snowflake.lineage import (
            probe_access_history_available,
        )

        if (
            src._use_access_history
            and src.engine is not None
            and not probe_access_history_available(src.engine, src.service_connection.accountUsageSchema)
        ):
            src._use_access_history = False
        assert src._use_access_history is False


# ---------------------------------------------------------------------------
# Table edge yielding
# ---------------------------------------------------------------------------


def test_table_edges_resolve_and_emit_lineage_requests():
    upstream_entity = _make_table_entity("11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS")
    downstream_entity = _make_table_entity("22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE")
    metadata = MagicMock()

    def _get_by_name(entity, fqn):
        if fqn == "test_service.DB.SCHEMA.ORDERS":
            return upstream_entity
        if fqn == "test_service.DB.SCHEMA.REVENUE":
            return downstream_entity
        return None

    metadata.get_by_name = MagicMock(side_effect=_get_by_name)

    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "ACCESS_HISTORY": [
                _Row(
                    upstream_table="DB.SCHEMA.ORDERS",
                    upstream_domain="Table",
                    downstream_table="DB.SCHEMA.REVENUE",
                    downstream_domain="Table",
                    query_id="abc",
                    column_pairs=None,
                ),
            ],
        },
    )

    edges = list(src._yield_combined_access_history())
    assert len(edges) == 1
    request = edges[0].right
    assert isinstance(request, AddLineageRequest)
    assert str(request.edge.fromEntity.id.root) == "11111111-1111-1111-1111-111111111111"
    assert str(request.edge.toEntity.id.root) == "22222222-2222-2222-2222-222222222222"
    assert request.edge.lineageDetails.source == LineageEdgeSource.QueryLineage
    assert request.edge.lineageDetails.columnsLineage is None


def test_table_edges_skip_when_either_side_unresolvable():
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(return_value=None)
    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "ACCESS_HISTORY": [
                _Row(
                    upstream_table="DB.SCHEMA.ORDERS",
                    upstream_domain="Table",
                    downstream_table="DB.SCHEMA.REVENUE",
                    downstream_domain="Table",
                    query_id="abc",
                    column_pairs=None,
                ),
            ],
        },
    )
    edges = list(src._yield_combined_access_history())
    assert edges == []


def test_split_snowflake_fqn_handles_three_part_name():
    assert SnowflakeLineageSource._split_snowflake_fqn("DB.SCHEMA.TABLE") == ("DB", "SCHEMA", "TABLE")


def test_split_snowflake_fqn_rejects_quoted_or_malformed():
    assert SnowflakeLineageSource._split_snowflake_fqn(None) is None
    assert SnowflakeLineageSource._split_snowflake_fqn("") is None
    assert SnowflakeLineageSource._split_snowflake_fqn("DB.SCHEMA") is None
    assert SnowflakeLineageSource._split_snowflake_fqn('"DB".SCHEMA.TABLE') is None
    assert SnowflakeLineageSource._split_snowflake_fqn("DB.SCHEMA.TABLE.EXTRA") is None


# ---------------------------------------------------------------------------
# Column lineage attachment
# ---------------------------------------------------------------------------


def test_column_lineage_attaches_to_table_edge():
    """Column pairs arrive pre-aggregated in the row's VARIANT column."""
    upstream_entity = _make_table_entity(
        "11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS", columns=["AMOUNT", "ID"]
    )
    downstream_entity = _make_table_entity(
        "22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE", columns=["TOTAL_AMOUNT", "ID"]
    )
    metadata = MagicMock()

    def _get_by_name(entity, fqn):
        return {
            "test_service.DB.SCHEMA.ORDERS": upstream_entity,
            "test_service.DB.SCHEMA.REVENUE": downstream_entity,
        }.get(fqn)

    metadata.get_by_name = MagicMock(side_effect=_get_by_name)

    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "ACCESS_HISTORY": [
                _Row(
                    upstream_table="DB.SCHEMA.ORDERS",
                    upstream_domain="Table",
                    downstream_table="DB.SCHEMA.REVENUE",
                    downstream_domain="Table",
                    query_id="abc",
                    column_pairs=[{"d": "TOTAL_AMOUNT", "u": "AMOUNT"}],
                ),
            ],
        },
    )

    edges = list(src._yield_combined_access_history())
    assert len(edges) == 1
    details = edges[0].right.edge.lineageDetails
    assert details.columnsLineage is not None
    assert len(details.columnsLineage) == 1
    cl = details.columnsLineage[0]
    # ColumnLineage shape matches today's parser output (sql_lineage.py:614).
    assert str(cl.toColumn.root) == "test_service.DB.SCHEMA.REVENUE.TOTAL_AMOUNT"
    assert [str(c.root) for c in cl.fromColumns] == ["test_service.DB.SCHEMA.ORDERS.AMOUNT"]


def test_column_lineage_attaches_multiple_column_pairs():
    """Multiple column pairs from the same edge should all attach."""
    upstream_entity = _make_table_entity(
        "11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS", columns=["AMOUNT", "ID"]
    )
    downstream_entity = _make_table_entity(
        "22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE", columns=["TOTAL_AMOUNT", "ID"]
    )
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(
        side_effect=lambda entity, fqn: {
            "test_service.DB.SCHEMA.ORDERS": upstream_entity,
            "test_service.DB.SCHEMA.REVENUE": downstream_entity,
        }.get(fqn)
    )

    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "ACCESS_HISTORY": [
                _Row(
                    upstream_table="DB.SCHEMA.ORDERS",
                    upstream_domain="Table",
                    downstream_table="DB.SCHEMA.REVENUE",
                    downstream_domain="Table",
                    query_id="abc",
                    column_pairs=[
                        {"d": "TOTAL_AMOUNT", "u": "AMOUNT"},
                        {"d": "ID", "u": "ID"},
                    ],
                ),
            ],
        },
    )
    edges = list(src._yield_combined_access_history())
    assert len(edges) == 1
    cls = edges[0].right.edge.lineageDetails.columnsLineage
    assert len(cls) == 2


# ---------------------------------------------------------------------------
# _parse_column_pairs — VARIANT decoding robustness
# ---------------------------------------------------------------------------


def test_parse_column_pairs_accepts_python_list():
    assert SnowflakeLineageSource._parse_column_pairs([{"d": "x", "u": "y"}]) == [("x", "y")]


def test_parse_column_pairs_accepts_json_string():
    """snowflake-sqlalchemy can return VARIANTs as JSON strings depending on cursor config."""
    assert SnowflakeLineageSource._parse_column_pairs('[{"d": "x", "u": "y"}]') == [("x", "y")]


def test_parse_column_pairs_handles_none_and_empty():
    assert SnowflakeLineageSource._parse_column_pairs(None) == []
    assert SnowflakeLineageSource._parse_column_pairs([]) == []
    assert SnowflakeLineageSource._parse_column_pairs("") == []


def test_parse_column_pairs_handles_malformed():
    """Unparseable JSON or non-list inputs degrade silently — never raise."""
    assert SnowflakeLineageSource._parse_column_pairs("not json") == []
    assert SnowflakeLineageSource._parse_column_pairs({"not": "a list"}) == []
    assert SnowflakeLineageSource._parse_column_pairs([{"d": "x"}]) == []  # missing 'u'
    assert SnowflakeLineageSource._parse_column_pairs([{"u": "y"}]) == []  # missing 'd'


# ---------------------------------------------------------------------------
# COPY_HISTORY → Container resolution
# ---------------------------------------------------------------------------


def test_copy_edge_emitted_when_container_resolves():
    downstream_entity = _make_table_entity("33333333-3333-3333-3333-333333333333", "DB", "SCHEMA", "STAGE_TBL")
    container_entity = _make_container_entity("44444444-4444-4444-4444-444444444444", "s3://my-bucket/path/")
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(return_value=downstream_entity)
    metadata.es_search_container_by_path = MagicMock(return_value=[container_entity])

    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "COPY_HISTORY": [
                _Row(
                    downstream_database="DB",
                    downstream_schema="SCHEMA",
                    downstream_table="STAGE_TBL",
                    stage_location="s3://my-bucket/path/",
                    last_load_time="2025-01-15",
                    load_count=5,
                ),
            ],
        },
    )
    edges = list(src._yield_copy_history_lineage())
    assert len(edges) == 1
    request = edges[0].right
    assert request.edge.fromEntity.type == "container"
    assert str(request.edge.fromEntity.id.root) == "44444444-4444-4444-4444-444444444444"
    assert str(request.edge.toEntity.id.root) == "33333333-3333-3333-3333-333333333333"


def test_copy_edge_skipped_when_container_not_ingested():
    downstream_entity = _make_table_entity("33333333-3333-3333-3333-333333333333", "DB", "SCHEMA", "STAGE_TBL")
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(return_value=downstream_entity)
    metadata.es_search_container_by_path = MagicMock(return_value=[])

    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "COPY_HISTORY": [
                _Row(
                    downstream_database="DB",
                    downstream_schema="SCHEMA",
                    downstream_table="STAGE_TBL",
                    stage_location="s3://my-bucket/path/",
                    last_load_time="2025-01-15",
                    load_count=5,
                ),
            ],
        },
    )
    edges = list(src._yield_copy_history_lineage())
    assert edges == []


def test_copy_edge_skips_internal_stage_silently():
    metadata = MagicMock()
    metadata.es_search_container_by_path = MagicMock()  # should never be called
    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "COPY_HISTORY": [
                _Row(
                    downstream_database="DB",
                    downstream_schema="SCHEMA",
                    downstream_table="STAGE_TBL",
                    stage_location="@MY_DB.MY_SCHEMA.INT_STAGE/path/",
                    last_load_time="2025-01-15",
                    load_count=5,
                ),
                _Row(
                    downstream_database="DB",
                    downstream_schema="SCHEMA",
                    downstream_table="STAGE_TBL",
                    stage_location="@~/userstage/",
                    last_load_time="2025-01-15",
                    load_count=5,
                ),
            ],
        },
    )
    edges = list(src._yield_copy_history_lineage())
    assert edges == []
    metadata.es_search_container_by_path.assert_not_called()


def test_is_external_stage_classifier():
    assert SnowflakeLineageSource._is_external_stage("s3://bucket/path/") is True
    assert SnowflakeLineageSource._is_external_stage("S3://bucket/path/") is True
    assert SnowflakeLineageSource._is_external_stage("azure://account.blob.core.windows.net/c/path/") is True
    assert SnowflakeLineageSource._is_external_stage("gcs://bucket/path/") is True
    assert SnowflakeLineageSource._is_external_stage("@~/path") is False
    assert SnowflakeLineageSource._is_external_stage("@%mytable/") is False
    assert SnowflakeLineageSource._is_external_stage("@DB.SCHEMA.STAGE/") is False
    assert SnowflakeLineageSource._is_external_stage("") is False
    assert SnowflakeLineageSource._is_external_stage(None) is False


# ---------------------------------------------------------------------------
# Parser bypass regression — the load-bearing safety net
# ---------------------------------------------------------------------------


def test_access_history_path_does_not_call_legacy_parser():
    """
    When _use_access_history is True, yield_query_lineage must NOT descend into
    the legacy parser chain (get_lineage_by_query / query_lineage_processor).
    Patch those to raise; the test passes iff they are never called.
    """
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(return_value=None)
    metadata.es_search_container_by_path = MagicMock(return_value=[])

    src = _make_lineage_source(metadata=metadata, rows_by_sql={})
    src._use_access_history = True

    with patch(
        "metadata.ingestion.lineage.sql_lineage.get_lineage_by_query",
        side_effect=AssertionError("legacy parser must not be called on the ACCESS_HISTORY path"),
    ):
        # Consume the generator; we don't care about output, only that no exception fires.
        list(src.yield_query_lineage())


def test_access_history_flag_off_falls_through_to_super():
    """When the flag is off, yield_query_lineage delegates to super() (LineageSource)."""
    src = _make_lineage_source(rows_by_sql={})
    src._use_access_history = False

    with patch.object(LineageSource, "yield_query_lineage", return_value=iter([])) as mocked:
        list(src.yield_query_lineage())
        mocked.assert_called_once()
