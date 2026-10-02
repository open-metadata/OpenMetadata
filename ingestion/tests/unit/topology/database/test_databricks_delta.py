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
Tests for Databricks Delta Lake detection: the connector must classify a table
from its ``information_schema.tables.data_source_format`` so managed/partitioned/
UniForm Delta tables surface as DeltaLake while native Iceberg tables stay Iceberg.

The oracle values are the real ``data_source_format`` strings observed on a live
Unity Catalog schema (managed/partitioned/UniForm Delta all report ``DELTA``;
native Iceberg reports ``ICEBERG``; views report ``UNKNOWN_DATA_SOURCE_FORMAT``).
"""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.databricks.metadata import (
    DatabricksSource,
    _table_type_from_data_source_format,
    get_table_type,
)

_CACHE_KEY = "databricks_table_types"


def test_delta_formats_map_to_delta_lake():
    """Managed, partitioned and UniForm(Iceberg) Delta tables all report ``DELTA``
    in information_schema and must classify as DeltaLake."""
    assert _table_type_from_data_source_format("DELTA") == TableType.DeltaLake


@pytest.mark.parametrize("data_source_format", ["DELTASHARING", "DELTA_UNIFORM_ICEBERG", "DELTA_LIVE_TABLE"])
def test_only_the_exact_delta_format_is_delta_lake(data_source_format):
    """Sharing the "DELTA" prefix is not evidence of Delta Lake storage --
    DELTASHARING is a Delta Sharing table -- so the match is exact, not a prefix."""
    assert _table_type_from_data_source_format(data_source_format) is None


def test_iceberg_format_maps_to_iceberg_not_delta():
    """Native Iceberg tables report ``ICEBERG`` and must not be misread as Delta."""
    assert _table_type_from_data_source_format("ICEBERG") == TableType.Iceberg


def test_unknown_or_missing_format_keeps_default():
    """Views (``UNKNOWN_DATA_SOURCE_FORMAT``), NULL and empty formats fall back to
    the caller's default (Regular) — the helper returns None so it can't override."""
    assert _table_type_from_data_source_format("UNKNOWN_DATA_SOURCE_FORMAT") is None
    assert _table_type_from_data_source_format(None) is None
    assert _table_type_from_data_source_format("") is None
    assert _table_type_from_data_source_format("CSV") is None


def test_format_matching_is_case_insensitive():
    assert _table_type_from_data_source_format("delta") == TableType.DeltaLake
    assert _table_type_from_data_source_format(" Iceberg ") == TableType.Iceberg


def _seeded_source(table_formats):
    """Build a DatabricksSource-shaped stub whose per-schema table-type cache is
    pre-populated, so query_table_names_and_types reuses it without querying."""
    fake_self = SimpleNamespace()
    fake_self.context = SimpleNamespace(get=lambda: SimpleNamespace(database="main_prod"))
    inspector = Mock()
    inspector.get_table_names.return_value = list(table_formats)
    fake_self.inspector = inspector
    connection = Mock()
    connection.info = {_CACHE_KEY: {("main_prod", "sales"): dict(table_formats)}}
    fake_self.connection = connection
    return fake_self, connection


def test_query_table_names_and_types_classifies_from_format():
    """The real query_table_names_and_types path stamps each table's type from the
    cached data_source_format using the live oracle values."""
    table_formats = {
        "managed_delta": ("MANAGED", "DELTA"),
        "partitioned_delta": ("MANAGED", "DELTA"),
        "uniform_delta": ("MANAGED", "DELTA"),
        "native_iceberg": ("MANAGED", "ICEBERG"),
        "unknown_table": ("MANAGED", "UNKNOWN_DATA_SOURCE_FORMAT"),
        "null_format": ("MANAGED", None),
    }
    fake_self, connection = _seeded_source(table_formats)

    result = {t.name: t.type_ for t in DatabricksSource.query_table_names_and_types(fake_self, "sales")}

    assert result == {
        "managed_delta": TableType.DeltaLake,
        "partitioned_delta": TableType.DeltaLake,
        "uniform_delta": TableType.DeltaLake,
        "native_iceberg": TableType.Iceberg,
        "unknown_table": TableType.Regular,
        "null_format": TableType.Regular,
    }
    # The seeded cache is reused — no extra information_schema query is issued.
    connection.execute.assert_not_called()


def test_query_table_names_and_types_defaults_regular_when_name_absent():
    """A table returned by SHOW TABLES but missing from the format map keeps the
    Regular default rather than raising."""
    fake_self, _ = _seeded_source({"managed_delta": ("MANAGED", "DELTA")})
    fake_self.inspector.get_table_names.return_value = ["managed_delta", "orphan"]

    result = {t.name: t.type_ for t in DatabricksSource.query_table_names_and_types(fake_self, "sales")}

    assert result["managed_delta"] == TableType.DeltaLake
    assert result["orphan"] == TableType.Regular


def test_get_table_type_still_returns_type_string_for_foreign_skip():
    """get_table_type must keep returning the raw table_type string (now carried
    alongside data_source_format) so the FOREIGN skip in get_table_names is intact."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.return_value = [
        ("orders", "MANAGED", "DELTA"),
        ("legacy_feed", "FOREIGN", "UNKNOWN_DATA_SOURCE_FORMAT"),
    ]

    assert get_table_type(dialect, connection, "main_prod", "sales", "orders") == "MANAGED"
    assert get_table_type(dialect, connection, "main_prod", "sales", "legacy_feed") == "FOREIGN"
    assert connection.execute.call_count == 1
