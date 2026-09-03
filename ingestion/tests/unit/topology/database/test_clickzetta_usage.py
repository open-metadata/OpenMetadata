#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import importlib
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, call

import pytest

import metadata.ingestion.source.database as database_source_package

database_source_package.__path__.append(
    str(Path(__file__).resolve().parents[4] / "src/metadata/ingestion/source/database")
)

_CLICKZETTA_CONFIG_MODULE = "metadata.generated.schema.entity.services.connections.database.clickzettaConnection"
try:
    importlib.import_module(_CLICKZETTA_CONFIG_MODULE)
except ModuleNotFoundError:
    generated_module = ModuleType(_CLICKZETTA_CONFIG_MODULE)

    class ClickzettaConnection:
        pass

    generated_module.ClickzettaConnection = ClickzettaConnection
    sys.modules[_CLICKZETTA_CONFIG_MODULE] = generated_module

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (  # noqa: E402
    SQATestSuiteInterface,
)
from metadata.generated.schema.type.basic import DateTime  # noqa: E402
from metadata.ingestion.api.steps import InvalidSourceException  # noqa: E402
from metadata.ingestion.source.database.clickzetta.lineage import (  # noqa: E402
    ClickzettaLineageSource,
)
from metadata.ingestion.source.database.clickzetta.queries import (  # noqa: E402
    ClickzettaQueryHistoryMode,
    build_clickzetta_query_history_sql,
)
from metadata.ingestion.source.database.clickzetta.query_parser import (  # noqa: E402
    normalize_clickzetta_query_row,
)
from metadata.ingestion.source.database.clickzetta.service_spec import (  # noqa: E402
    ServiceSpec,
)
from metadata.ingestion.source.database.clickzetta.usage import (  # noqa: E402
    ClickzettaUsageSource,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (  # noqa: E402
    SQAProfilerInterface,
)
from metadata.sampler.sqlalchemy.clickzetta.sampler import ClickzettaSampler  # noqa: E402
from metadata.utils.importer import get_class_path  # noqa: E402


def test_query_history_sql_is_bounded_and_uses_a_validated_table():
    sql = build_clickzetta_query_history_sql(
        query_history_table="seller_center.query_history",
        start_time=datetime(2026, 8, 5, tzinfo=timezone.utc),
        end_time=datetime(2026, 8, 6, tzinfo=timezone.utc),
        query_history_mode=ClickzettaQueryHistoryMode.USAGE,
        filter_condition="schema_name = 'seller_center'",
        result_limit=2,
    )

    assert "FROM seller_center.query_history" in sql
    assert "start_time >= '2026-08-05 00:00:00+00:00'" in sql
    assert "start_time < '2026-08-06 00:00:00+00:00'" in sql
    assert "AND (schema_name = 'seller_center')" in sql
    assert "ORDER BY start_time" in sql
    assert "LIMIT 2" in sql
    assert "OpenMetadata" in sql
    assert "dbt" in sql


def test_query_history_sql_rejects_an_unsafe_table_identifier():
    with pytest.raises(ValueError, match="query history table"):
        build_clickzetta_query_history_sql(
            query_history_table="seller_center.query_history; DROP TABLE users",
            start_time=datetime(2026, 8, 5),
            end_time=datetime(2026, 8, 6),
            query_history_mode=ClickzettaQueryHistoryMode.USAGE,
            result_limit=2,
        )


def test_query_history_sql_rejects_an_unbounded_result_limit():
    with pytest.raises(ValueError, match="result limit"):
        build_clickzetta_query_history_sql(
            query_history_table="seller_center.query_history",
            start_time=datetime(2026, 8, 5),
            end_time=datetime(2026, 8, 6),
            query_history_mode=ClickzettaQueryHistoryMode.USAGE,
            result_limit=0,
        )


def test_canonical_query_history_sql_scopes_service_database_and_schema():
    sql = build_clickzetta_query_history_sql(
        query_history_table="seller_center.query_history",
        start_time=datetime(2026, 8, 5, tzinfo=timezone.utc),
        end_time=datetime(2026, 8, 6, tzinfo=timezone.utc),
        database_name="quick_start",
        database_schema="seller_center",
        query_history_mode=ClickzettaQueryHistoryMode.USAGE,
        result_limit=1,
    )

    assert "database_name = 'quick_start'" in sql
    assert "schema_name = 'seller_center'" in sql


@pytest.mark.parametrize(
    "query_history_table",
    [
        "information_schema.job_history",
        "sys.information_schema.job_history",
    ],
)
def test_native_job_history_sql_maps_columns_and_scopes_seller_center(
    query_history_table: str,
):
    sql = build_clickzetta_query_history_sql(
        query_history_table=query_history_table,
        start_time=datetime(2026, 8, 5, tzinfo=timezone.utc),
        end_time=datetime(2026, 8, 6, tzinfo=timezone.utc),
        database_name="quick_start",
        database_schema="seller_center",
        query_history_mode=ClickzettaQueryHistoryMode.USAGE,
        result_limit=1,
    )

    assert f"FROM {query_history_table}" in sql
    assert "job_text AS query_text" in sql
    assert "job_type AS query_type" in sql
    assert "job_creator AS user_name" in sql
    assert "workspace_name AS database_name" in sql
    assert "GET_JSON_OBJECT(input_tables, '$.table[0].namespace[1]') AS schema_name" in sql
    assert "execution_time AS duration" in sql
    assert "status" in sql
    assert "database_name = 'quick_start'" in sql
    assert "schema_name = 'seller_center'" in sql
    assert "LIMIT 1" in sql


def test_normalize_clickzetta_query_row_maps_usage_fields():
    started = datetime(2026, 8, 5, 1, 2, 3, tzinfo=timezone.utc)
    ended = datetime(2026, 8, 5, 1, 2, 4, tzinfo=timezone.utc)

    table_query = normalize_clickzetta_query_row(
        {
            "QUERY_TEXT": "select *\\nfrom orders",
            "QUERY_TYPE": "SELECT",
            "USER_NAME": "catalog_reader",
            "DATABASE_NAME": "quick_start",
            "SCHEMA_NAME": "seller_center",
            "START_TIME": started,
            "END_TIME": ended,
            "DURATION": "1.25",
            "ABORTED": "false",
            "COST": 0.0,
        },
        service_name="clickzetta",
        include_usage=True,
    )

    assert table_query.query == "select *\nfrom orders"
    assert table_query.query_type == "SELECT"
    assert table_query.userName == "catalog_reader"
    assert table_query.databaseName == "quick_start"
    assert table_query.databaseSchema == "seller_center"
    assert table_query.startTime == str(started)
    assert table_query.endTime == str(ended)
    assert table_query.duration == 1.25
    assert table_query.cost == 0.0
    assert table_query.aborted is False
    assert table_query.exclude_usage is False
    assert table_query.dialect == "ansi"
    assert table_query.analysisDate == DateTime(started)


def test_normalize_clickzetta_query_row_marks_lifecycle_usage_rows():
    table_query = normalize_clickzetta_query_row(
        {
            "query_text": "insert into target select * from source",
            "query_type": "INSERT",
            "start_time": datetime(2026, 8, 5, tzinfo=timezone.utc),
        },
        service_name="clickzetta",
        include_usage=True,
    )

    assert table_query.exclude_usage is True


def test_normalize_clickzetta_query_row_skips_rows_without_query_text():
    assert (
        normalize_clickzetta_query_row(
            {"query_type": "SELECT"},
            service_name="clickzetta",
            include_usage=False,
        )
        is None
    )


def test_query_parser_applies_the_configured_seller_center_scope_and_limit():
    source = object.__new__(ClickzettaUsageSource)
    source.service_connection = SimpleNamespace(
        queryHistoryTable="seller_center.query_history",
        databaseName="quick_start",
        databaseSchema="seller_center",
    )
    source.config = SimpleNamespace(serviceName="clickzetta")
    source.source_config = SimpleNamespace(
        filterCondition="schema_name = 'seller_center'",
        resultLimit=2,
    )

    sql = source.get_sql_statement(
        datetime(2026, 8, 5, tzinfo=timezone.utc),
        datetime(2026, 8, 6, tzinfo=timezone.utc),
    )

    assert "FROM seller_center.query_history" in sql
    assert "schema_name = 'seller_center'" in sql
    assert "LIMIT 2" in sql


@pytest.mark.parametrize(
    "filter_condition",
    [
        "schema_name = 'seller_center'; DROP TABLE query_history",
        "schema_name = 'seller_center' OR 1 = 1",
        "LOWER(schema_name) = 'seller_center'",
    ],
)
def test_query_parser_rejects_unsafe_filter_condition(filter_condition):
    source = object.__new__(ClickzettaUsageSource)
    source.service_connection = SimpleNamespace(
        queryHistoryTable="seller_center.query_history",
        databaseName="quick_start",
        databaseSchema="seller_center",
    )
    source.source_config = SimpleNamespace(
        filterCondition=filter_condition,
        resultLimit=2,
    )

    with pytest.raises(InvalidSourceException, match="filterCondition"):
        source.get_sql_statement(
            datetime(2026, 8, 5, tzinfo=timezone.utc),
            datetime(2026, 8, 6, tzinfo=timezone.utc),
        )


def test_query_parser_requires_a_query_history_table():
    source = object.__new__(ClickzettaUsageSource)
    source.service_connection = SimpleNamespace(queryHistoryTable=None)

    with pytest.raises(InvalidSourceException, match="queryHistoryTable"):
        _ = source.query_history_table


def test_usage_source_uses_one_bounded_window_with_a_fake_engine():
    source = object.__new__(ClickzettaUsageSource)
    source.start = datetime(2026, 8, 5, tzinfo=timezone.utc)
    source.end = datetime(2026, 8, 5, 1, tzinfo=timezone.utc)
    source.service_connection = SimpleNamespace(
        queryHistoryTable="seller_center.query_history",
        databaseName="quick_start",
        databaseSchema="seller_center",
    )
    source.config = SimpleNamespace(serviceName="clickzetta")
    source.source_config = SimpleNamespace(
        filterCondition="schema_name = 'seller_center'",
        resultLimit=2,
    )

    row = {
        "query_text": "select 1",
        "query_type": "SELECT",
        "schema_name": "seller_center",
        "start_time": source.start,
    }
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.execute.return_value = [row]
    engine = MagicMock()
    engine.connect.return_value = connection
    source.get_engine = lambda: iter([engine])
    source.warn_if_query_log_truncated = MagicMock()

    batches = list(source.yield_table_queries())

    assert len(batches) == 1
    assert len(batches[0].queries) == 1
    executed_sql = connection.execute.call_args.args[0].text
    assert "FROM seller_center.query_history" in executed_sql
    assert "LIMIT 2" in executed_sql
    source.warn_if_query_log_truncated.assert_called_once_with(1, "usage")


def test_usage_source_scans_full_daily_windows_without_duplicate_rows():
    source = object.__new__(ClickzettaUsageSource)
    source.start = datetime(2026, 8, 5, tzinfo=timezone.utc)
    source.end = source.start + timedelta(days=2, hours=3)
    source.service_connection = SimpleNamespace(
        queryHistoryTable="seller_center.query_history", databaseName="quick_start", databaseSchema="seller_center"
    )
    source.config = SimpleNamespace(serviceName="clickzetta")
    source.source_config = SimpleNamespace(filterCondition=None, resultLimit=2)
    source.warn_if_query_log_truncated = MagicMock()
    rows = iter(
        [
            [{"query_text": "select 1", "query_type": "SELECT", "start_time": source.start}],
            [{"query_text": "select 2", "query_type": "SELECT", "start_time": source.start + timedelta(days=1)}],
            [{"query_text": "select 3", "query_type": "SELECT", "start_time": source.start + timedelta(days=2)}],
        ]
    )
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.execute.side_effect = lambda _: next(rows)
    engine = MagicMock()
    engine.connect.return_value = connection
    source.get_engine = lambda: iter([engine])

    batches = list(source.yield_table_queries())

    assert [query.query for batch in batches for query in batch.queries] == ["select 1", "select 2", "select 3"]
    assert connection.execute.call_count == 3
    source.warn_if_query_log_truncated.assert_has_calls([call(1, "usage")] * 3)


def test_lineage_source_warns_when_query_log_reaches_limit():
    source = object.__new__(ClickzettaLineageSource)
    source.start = datetime(2026, 8, 5, tzinfo=timezone.utc)
    source.end = source.start + timedelta(hours=1)
    source.service_connection = SimpleNamespace(
        queryHistoryTable="seller_center.query_history", databaseName="quick_start", databaseSchema="seller_center"
    )
    source.config = SimpleNamespace(serviceName="clickzetta")
    source.source_config = SimpleNamespace(filterCondition=None, resultLimit=2)
    source.warn_if_query_log_truncated = MagicMock()
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.execute.return_value = [
        {"query_text": "select 1", "query_type": "SELECT", "start_time": source.start},
        {"query_text": "select 2", "query_type": "SELECT", "start_time": source.start},
    ]
    engine = MagicMock()
    engine.connect.return_value = connection
    source.get_engine = lambda: iter([engine])

    assert len(list(source.yield_table_query())) == 2
    source.warn_if_query_log_truncated.assert_called_once_with(2, "lineage")


def test_usage_source_propagates_query_history_errors():
    source = object.__new__(ClickzettaUsageSource)
    source.start = datetime(2026, 8, 5, tzinfo=timezone.utc)
    source.end = datetime(2026, 8, 5, 1, tzinfo=timezone.utc)
    source.service_connection = SimpleNamespace(
        queryHistoryTable="seller_center.query_history",
        databaseName="quick_start",
        databaseSchema="seller_center",
    )
    source.config = SimpleNamespace(serviceName="clickzetta")
    source.source_config = SimpleNamespace(filterCondition=None, resultLimit=2)
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.execute.side_effect = PermissionError("missing SELECT permission")
    engine = MagicMock()
    engine.connect.return_value = connection
    source.get_engine = lambda: iter([engine])

    with pytest.raises(RuntimeError, match="ClickZetta usage query failed"):
        list(source.yield_table_queries())


def test_lineage_source_propagates_query_history_errors():
    source = object.__new__(ClickzettaLineageSource)
    source.start = datetime(2026, 8, 5, tzinfo=timezone.utc)
    source.end = datetime(2026, 8, 5, 1, tzinfo=timezone.utc)
    source.service_connection = SimpleNamespace(
        queryHistoryTable="seller_center.query_history",
        databaseName="quick_start",
        databaseSchema="seller_center",
    )
    source.config = SimpleNamespace(serviceName="clickzetta")
    source.source_config = SimpleNamespace(filterCondition=None, resultLimit=2)
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.execute.side_effect = PermissionError("missing SELECT permission")
    engine = MagicMock()
    engine.connect.return_value = connection
    source.get_engine = lambda: iter([engine])

    with pytest.raises(RuntimeError, match="ClickZetta lineage query failed"):
        list(source.yield_table_query())


def test_service_spec_registers_usage_and_lineage_sources():
    assert ServiceSpec.usage_source_class.endswith("ClickzettaUsageSource")
    assert ServiceSpec.lineage_source_class.endswith("ClickzettaLineageSource")
    assert ServiceSpec.profiler_class == get_class_path(SQAProfilerInterface)
    assert ServiceSpec.sampler_class == get_class_path(ClickzettaSampler)
    assert ServiceSpec.test_suite_class == get_class_path(SQATestSuiteInterface)


def test_lineage_source_is_distinct_from_usage_source():
    assert ClickzettaLineageSource is not ClickzettaUsageSource
    assert issubclass(ClickzettaUsageSource, ClickzettaLineageSource.__bases__[0])
