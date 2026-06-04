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
Unit tests for the Snowflake ACCESS_HISTORY lineage path.

The path is enabled by default via the `useAccessHistory` connection field and
is gated by a runtime probe against `ACCOUNT_USAGE.ACCESS_HISTORY`. These tests
cover SQL rendering, connection-field parsing, probe behavior, table-edge
and column-edge yielding, COPY_HISTORY stage→container resolution, and the
critical regression that the client-side SQL parser is never invoked when
the flag is on.
"""

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityLineage import Source as LineageEdgeSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.snowflake.lineage import (
    DEFAULT_ACCESS_HISTORY_CHUNK_DAYS,
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
    rows_by_sql=None,
    service_name="test_service",
    account_usage="SNOWFLAKE.ACCOUNT_USAGE",
    chunk_days=DEFAULT_ACCESS_HISTORY_CHUNK_DAYS,
) -> SnowflakeLineageSource:
    """
    Instantiate SnowflakeLineageSource bypassing the heavy parent __init__.

    Tests inject the metadata client and a `rows_by_sql` dict that maps a
    substring of the rendered SQL to the list of mock rows the connection
    should return.
    """
    src = SnowflakeLineageSource.__new__(SnowflakeLineageSource)
    src.metadata = metadata or MagicMock()
    src.config = MagicMock()
    src.config.serviceName = service_name
    src.service_connection = MagicMock()
    src.service_connection.accountUsageSchema = account_usage
    src.source_config = MagicMock()
    src.source_config.filterCondition = None
    src.engine = _make_mock_engine(rows_by_sql or {})
    src.start = datetime(2025, 1, 1)
    src.end = datetime(2025, 1, 2)
    src._table_cache = {}
    src._access_history_chunk_days = chunk_days
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
        filter_condition="",
    )
    # Server-side dedup for table edges (both QUERY_ID and QUERY_TEXT pinned to the same row)
    assert "MAX_BY(ah.QUERY_ID, ah.QUERY_START_TIME)" in rendered
    assert "MAX_BY(ah.QUERY_TEXT, ah.QUERY_START_TIME)" in rendered
    # Column pairs aggregated server-side — no client map needed
    assert "ARRAY_AGG(DISTINCT OBJECT_CONSTRUCT(" in rendered
    assert "COLUMN_PAIRS" in rendered
    # Both flatten paths preserved
    assert "DIRECT_OBJECTS_ACCESSED" in rendered
    assert "directSources" in rendered
    # LEFT JOIN binds column array to its table edge
    assert "LEFT JOIN column_edges_grouped" in rendered
    # QUERY_TEXT now flows from the single inner JOIN inside access_history_filtered,
    # not a second LEFT JOIN to QUERY_HISTORY — drop the qh_repr indirection.
    assert "te.QUERY_TEXT" in rendered
    assert "qh_repr" not in rendered
    # No per-downstream array caps
    assert "ARRAY_SLICE" not in rendered


def test_combined_sql_injects_filter_condition_at_final_select():
    """
    sourceConfig.filterCondition scopes the final edge result by table FQN
    (database/schema), so it must land on the outer SELECT — after the source
    CTE, not inside it.
    """
    predicate = "WHERE (DOWNSTREAM_TABLE LIKE 'MYDB.%')"
    rendered = SNOWFLAKE_ACCESS_HISTORY_LINEAGE.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_time="2025-01-01",
        end_time="2025-01-31",
        filter_condition=predicate,
    )
    cte_section = rendered.partition("table_edges AS")[0]
    assert "DOWNSTREAM_TABLE LIKE 'MYDB.%'" not in cte_section
    after_final_from = rendered.partition("FROM table_edges te")[2]
    assert predicate in after_final_from


def test_combined_sql_wraps_final_select_so_filter_columns_are_unambiguous():
    """
    Both table_edges and column_edges_grouped expose UPSTREAM_TABLE/DOWNSTREAM_TABLE,
    so the filter must apply to a wrapping derived table — otherwise an unqualified
    `DOWNSTREAM_TABLE LIKE ...` predicate is an ambiguous column reference in Snowflake.
    """
    predicate = "WHERE (DOWNSTREAM_TABLE LIKE 'MYDB.%')"
    rendered = SNOWFLAKE_ACCESS_HISTORY_LINEAGE.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_time="2025-01-01",
        end_time="2025-01-31",
        filter_condition=predicate,
    )
    wrapper_open = rendered.index("SELECT * FROM (")
    join_pos = rendered.index("LEFT JOIN column_edges_grouped ce")
    filter_pos = rendered.index(predicate)
    assert wrapper_open < join_pos < filter_pos
    closing_paren = rendered.rindex(")", 0, filter_pos)
    assert closing_paren > join_pos


def test_combined_lineage_sql_prunes_query_history_by_date():
    """
    The QUERY_HISTORY side of the join must also be date-bounded so Snowflake can
    prune its micro-partitions instead of scanning the full table to satisfy the
    QUERY_ID join.
    """
    rendered = SNOWFLAKE_ACCESS_HISTORY_LINEAGE.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_time="2025-01-01",
        end_time="2025-01-31",
        filter_condition="",
    )
    cte_section, _, _ = rendered.partition("table_edges AS")
    assert "qh.START_TIME" in cte_section
    assert "ah.QUERY_START_TIME" in cte_section


def test_combined_lineage_left_joins_query_history_for_text_only():
    """
    ACCESS_HISTORY is the authoritative lineage source; QUERY_HISTORY only
    enriches with query text. Every qh predicate (time prune + success) lives in
    the LEFT JOIN ON clause, so an absent/failed/boundary qh row yields null text
    but never drops the edge — no post-join WHERE guard needed. The
    dbt/OpenMetadata noise filters are dropped — ACCESS_HISTORY only surfaces
    queries that actually modified objects.
    """
    rendered = SNOWFLAKE_ACCESS_HISTORY_LINEAGE.format(
        account_usage="SNOWFLAKE.ACCOUNT_USAGE",
        start_time="2025-01-01",
        end_time="2025-01-31",
        filter_condition="",
    )
    assert "LEFT JOIN SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY" in rendered
    on_clause, _, where_clause = rendered.partition("table_edges AS")[0].partition("WHERE ah.QUERY_START_TIME")
    assert "qh.EXECUTION_STATUS = 'SUCCESS'" in on_clause
    assert "qh.EXECUTION_STATUS" not in where_clause
    assert "qh.QUERY_ID IS NULL" not in rendered
    assert '"app": "dbt"' not in rendered
    assert '"app": "OpenMetadata"' not in rendered


def test_build_filter_condition_clause_empty_when_unset():
    src = _make_lineage_source()
    src.source_config.filterCondition = None
    assert src._build_filter_condition_clause() == ""


def test_build_filter_condition_clause_wraps_user_predicate():
    src = _make_lineage_source()
    src.source_config.filterCondition = "DOWNSTREAM_TABLE LIKE 'MYDB.%'"
    assert src._build_filter_condition_clause() == "WHERE (DOWNSTREAM_TABLE LIKE 'MYDB.%')"


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
# Connection-field parsing (useAccessHistory / accessHistoryChunkSize)
# ---------------------------------------------------------------------------

_PROBE_TARGET = "metadata.ingestion.source.database.snowflake.lineage.probe_access_history_available"


def _source_with_connection(**service_connection_attrs) -> SnowflakeLineageSource:
    """
    Build a bare source whose `service_connection` is a real namespace (not a
    MagicMock) so `getattr(..., default)` resolves missing fields to the default
    rather than to an auto-created attribute.
    """
    src = SnowflakeLineageSource.__new__(SnowflakeLineageSource)
    src.service_connection = SimpleNamespace(
        accountUsageSchema="SNOWFLAKE.ACCOUNT_USAGE",
        **service_connection_attrs,
    )
    src.engine = MagicMock()
    return src


def test_resolve_chunk_days_default_when_unset():
    src = _source_with_connection(accessHistoryChunkSize=None)
    assert src._resolve_chunk_days() == DEFAULT_ACCESS_HISTORY_CHUNK_DAYS


def test_resolve_chunk_days_reads_configured_value():
    src = _source_with_connection(accessHistoryChunkSize=7)
    assert src._resolve_chunk_days() == 7


def test_resolve_chunk_days_clamps_to_minimum_one():
    src = _source_with_connection(accessHistoryChunkSize=0)
    assert src._resolve_chunk_days() == 1


def test_use_access_history_enabled_by_default():
    src = _source_with_connection()
    with patch(_PROBE_TARGET, return_value=True):
        assert src._resolve_use_access_history() is True


def test_use_access_history_disabled_when_flag_false():
    src = _source_with_connection(useAccessHistory=False)
    with patch(_PROBE_TARGET) as probe:
        assert src._resolve_use_access_history() is False
        probe.assert_not_called()


def test_use_access_history_probe_failure_falls_back_to_legacy():
    """A failing probe must demote the path to legacy even when the flag is on."""
    src = _source_with_connection(useAccessHistory=True)
    with patch(_PROBE_TARGET, return_value=False):
        assert src._resolve_use_access_history() is False


def test_use_access_history_skips_probe_when_engine_unavailable():
    src = _source_with_connection(useAccessHistory=True)
    src.engine = None
    with patch(_PROBE_TARGET) as probe:
        assert src._resolve_use_access_history() is True
        probe.assert_not_called()


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
    # Row had no query_text → sqlQuery stays unset
    assert request.edge.lineageDetails.sqlQuery is None


def test_sql_query_text_attaches_when_present_in_row():
    """The representative QUERY_TEXT from QUERY_HISTORY should land on LineageDetails.sqlQuery."""
    upstream_entity = _make_table_entity("11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS")
    downstream_entity = _make_table_entity("22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE")
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(
        side_effect=lambda entity, fqn: {
            "test_service.DB.SCHEMA.ORDERS": upstream_entity,
            "test_service.DB.SCHEMA.REVENUE": downstream_entity,
        }.get(fqn)
    )
    representative_sql = "INSERT INTO REVENUE (total_amount) SELECT amount FROM ORDERS WHERE active = true"
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
                    query_text=representative_sql,
                    column_pairs=None,
                ),
            ],
        },
    )
    edges = list(src._yield_combined_access_history())
    assert len(edges) == 1
    details = edges[0].right.edge.lineageDetails
    assert details.sqlQuery is not None
    assert str(details.sqlQuery.root) == representative_sql


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
    with patch("metadata.ingestion.source.database.snowflake.lineage.logger") as mock_logger:
        edges = list(src._yield_combined_access_history())
        assert edges == []
        debug_messages = [str(call.args) for call in mock_logger.debug.call_args_list]
        assert any("table not found in OpenMetadata" in msg for msg in debug_messages)
        assert any("DB.SCHEMA.ORDERS" in msg for msg in debug_messages)
        assert any("DB.SCHEMA.REVENUE" in msg for msg in debug_messages)


def test_access_history_chunks_window_into_slices():
    """A multi-day window is split into one combined query per chunk-size slice."""
    upstream_entity = _make_table_entity("11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS")
    downstream_entity = _make_table_entity("22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE")
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
                    column_pairs=None,
                ),
            ],
        },
    )
    chunk = timedelta(days=src._access_history_chunk_days)
    src.start = datetime(2025, 1, 1)
    src.end = src.start + chunk * 3

    edges = list(src._yield_combined_access_history())

    assert len(edges) == 3
    conn = src.engine.connect.return_value
    executed = [str(call.args[0]) for call in conn.execute.call_args_list]
    assert len(executed) == 3
    for slice_index in range(3):
        window_start = src.start + chunk * slice_index
        window_end = src.start + chunk * (slice_index + 1)
        assert any(str(window_start) in sql and str(window_end) in sql for sql in executed)


def test_window_count_follows_configured_chunk_size():
    """A custom accessHistoryChunkSize controls how many queries the window splits into."""
    src = _make_lineage_source(rows_by_sql={}, chunk_days=1)
    src.start = datetime(2025, 1, 1)
    src.end = src.start + timedelta(days=3)

    windows = list(src._iter_lineage_date_windows())

    assert windows == [
        (datetime(2025, 1, 1), datetime(2025, 1, 2)),
        (datetime(2025, 1, 2), datetime(2025, 1, 3)),
        (datetime(2025, 1, 3), datetime(2025, 1, 4)),
    ]


def test_window_split_with_default_chunk_size():
    """The default 2-day chunk splits a 3-day window into a 2-day and a 1-day slice."""
    src = _make_lineage_source(rows_by_sql={})
    src.start = datetime(2025, 1, 1)
    src.end = src.start + timedelta(days=3)

    windows = list(src._iter_lineage_date_windows())

    assert windows == [
        (datetime(2025, 1, 1), datetime(2025, 1, 3)),
        (datetime(2025, 1, 3), datetime(2025, 1, 4)),
    ]


def test_access_history_window_failure_does_not_abort_run():
    """A failure on one date window must not stop the remaining windows."""
    upstream_entity = _make_table_entity("11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS")
    downstream_entity = _make_table_entity("22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE")
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
                    column_pairs=None,
                ),
            ],
        },
    )
    src.start = datetime(2025, 1, 1)
    src.end = src.start + timedelta(days=src._access_history_chunk_days) * 2

    conn = src.engine.connect.return_value
    healthy_side_effect = conn.execute.side_effect
    call_state = {"count": 0}

    def _flaky_execute(statement):
        call_state["count"] += 1
        if call_state["count"] == 1:
            raise RuntimeError("simulated snowflake timeout")
        return healthy_side_effect(statement)

    conn.execute.side_effect = _flaky_execute

    edges = list(src._yield_combined_access_history())

    assert call_state["count"] == 2
    assert len(edges) == 1


def test_access_history_skips_malformed_row_and_keeps_rest():
    """A single unparseable row must be skipped without dropping the rest of the window."""
    upstream_entity = _make_table_entity("11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS")
    downstream_entity = _make_table_entity("22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE")
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
                _Row({1: "boom"}),  # non-string key fails lower-casing → row skipped
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
    assert str(edges[0].right.edge.toEntity.id.root) == "22222222-2222-2222-2222-222222222222"


def test_access_history_edge_failure_isolated_to_single_row():
    """A row that raises during edge building is skipped; later rows still emit."""
    upstream_entity = _make_table_entity("11111111-1111-1111-1111-111111111111", "DB", "SCHEMA", "ORDERS")
    downstream_entity = _make_table_entity("22222222-2222-2222-2222-222222222222", "DB", "SCHEMA", "REVENUE")
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(
        side_effect=lambda entity, fqn: {
            "test_service.DB.SCHEMA.ORDERS": upstream_entity,
            "test_service.DB.SCHEMA.REVENUE": downstream_entity,
        }.get(fqn)
    )
    row = _Row(
        upstream_table="DB.SCHEMA.ORDERS",
        upstream_domain="Table",
        downstream_table="DB.SCHEMA.REVENUE",
        downstream_domain="Table",
        query_id="abc",
        column_pairs=None,
    )
    src = _make_lineage_source(metadata=metadata, rows_by_sql={"ACCESS_HISTORY": [row, row]})

    real_build = src._build_access_history_edge
    call_state = {"count": 0}

    def _flaky_build(edge_row):
        call_state["count"] += 1
        if call_state["count"] == 1:
            raise RuntimeError("simulated edge build failure")
        return real_build(edge_row)

    src._build_access_history_edge = _flaky_build

    edges = list(src._yield_combined_access_history())

    assert call_state["count"] == 2
    assert len(edges) == 1


def test_access_history_phase_failure_does_not_block_copy_history():
    """A catastrophic failure in the combined phase must not stop the COPY_HISTORY phase."""
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

    def _boom():
        if True:
            raise RuntimeError("combined phase exploded")
        yield  # the unreachable yield makes _boom a generator, matching the real method

    src._yield_combined_access_history = _boom

    edges = list(src._yield_access_history_lineage())

    assert len(edges) == 1
    assert edges[0].right.edge.fromEntity.type == "container"


def test_split_snowflake_fqn_handles_three_part_name():
    assert SnowflakeLineageSource._split_snowflake_fqn("DB.SCHEMA.TABLE") == ("DB", "SCHEMA", "TABLE")


def test_split_snowflake_fqn_rejects_malformed():
    assert SnowflakeLineageSource._split_snowflake_fqn(None) is None
    assert SnowflakeLineageSource._split_snowflake_fqn("") is None
    assert SnowflakeLineageSource._split_snowflake_fqn("DB.SCHEMA") is None
    assert SnowflakeLineageSource._split_snowflake_fqn("DB.SCHEMA.TABLE.EXTRA") is None


def test_split_snowflake_fqn_strips_quoted_identifiers():
    assert SnowflakeLineageSource._split_snowflake_fqn('"DB"."SCHEMA"."TABLE"') == (
        "DB",
        "SCHEMA",
        "TABLE",
    )
    assert SnowflakeLineageSource._split_snowflake_fqn('"My DB".PUBLIC."My Table"') == (
        "My DB",
        "PUBLIC",
        "My Table",
    )


def test_split_snowflake_fqn_handles_embedded_dots_in_quoted_parts():
    assert SnowflakeLineageSource._split_snowflake_fqn('"My.DB"."My.Schema"."My.Table"') == (
        "My.DB",
        "My.Schema",
        "My.Table",
    )


def test_split_snowflake_fqn_unescapes_doubled_quotes():
    assert SnowflakeLineageSource._split_snowflake_fqn('DB.SCHEMA."weird""name"') == (
        "DB",
        "SCHEMA",
        'weird"name',
    )


def test_split_snowflake_fqn_logs_debug_for_skips():
    from unittest.mock import patch

    with patch("metadata.ingestion.source.database.snowflake.lineage.logger") as mock_logger:
        assert SnowflakeLineageSource._split_snowflake_fqn("DB.SCHEMA") is None
        debug_messages = [call.args[0] for call in mock_logger.debug.call_args_list]
        assert any("unexpected part count" in msg for msg in debug_messages)


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


def test_copy_history_malformed_row_isolated_to_single_row():
    """A malformed COPY_HISTORY row must be skipped without dropping the rest."""
    downstream_entity = _make_table_entity("33333333-3333-3333-3333-333333333333", "DB", "SCHEMA", "STAGE_TBL")
    container_entity = _make_container_entity("44444444-4444-4444-4444-444444444444", "s3://my-bucket/path/")
    metadata = MagicMock()
    metadata.get_by_name = MagicMock(return_value=downstream_entity)
    metadata.es_search_container_by_path = MagicMock(return_value=[container_entity])

    src = _make_lineage_source(
        metadata=metadata,
        rows_by_sql={
            "COPY_HISTORY": [
                _Row({1: "boom"}),  # non-string key fails lower-casing → row skipped
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
    assert str(edges[0].right.edge.toEntity.id.root) == "33333333-3333-3333-3333-333333333333"


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
