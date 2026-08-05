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
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock

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

from metadata.generated.schema.type.basic import DateTime  # noqa: E402
from metadata.ingestion.api.steps import InvalidSourceException  # noqa: E402
from metadata.ingestion.source.database.clickzetta.lineage import (  # noqa: E402
    ClickzettaLineageSource,
)
from metadata.ingestion.source.database.clickzetta.queries import (  # noqa: E402
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


def test_query_history_sql_is_bounded_and_uses_a_validated_table():
    sql = build_clickzetta_query_history_sql(
        query_history_table="seller_center.query_history",
        start_time=datetime(2026, 8, 5, tzinfo=timezone.utc),
        end_time=datetime(2026, 8, 6, tzinfo=timezone.utc),
        filters="AND schema_name = 'seller_center'",
        result_limit=2,
    )

    assert "FROM seller_center.query_history" in sql
    assert "start_time >= '2026-08-05 00:00:00+00:00'" in sql
    assert "start_time < '2026-08-06 00:00:00+00:00'" in sql
    assert "AND schema_name = 'seller_center'" in sql
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
            filters="",
            result_limit=2,
        )


def test_query_history_sql_rejects_an_unbounded_result_limit():
    with pytest.raises(ValueError, match="result limit"):
        build_clickzetta_query_history_sql(
            query_history_table="seller_center.query_history",
            start_time=datetime(2026, 8, 5),
            end_time=datetime(2026, 8, 6),
            filters="",
            result_limit=0,
        )


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

    batches = list(source.yield_table_queries())

    assert len(batches) == 1
    assert len(batches[0].queries) == 1
    executed_sql = connection.execute.call_args.args[0].text
    assert "FROM seller_center.query_history" in executed_sql
    assert "LIMIT 2" in executed_sql


def test_service_spec_registers_usage_and_lineage_sources():
    assert ServiceSpec.usage_source_class.endswith("ClickzettaUsageSource")
    assert ServiceSpec.lineage_source_class.endswith("ClickzettaLineageSource")
    assert ServiceSpec.profiler_class is None
    assert ServiceSpec.sampler_class is None


def test_lineage_source_is_distinct_from_usage_source():
    assert ClickzettaLineageSource is not ClickzettaUsageSource
    assert issubclass(ClickzettaUsageSource, ClickzettaLineageSource.__bases__[0])
