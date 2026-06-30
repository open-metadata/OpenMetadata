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
"""Snowflake supplies cheap progress denominators by enumerating + filtering
names, without running the heavy per-database/per-schema setup."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.snowflake import metadata as snowflake_metadata

SnowflakeSource = snowflake_metadata.SnowflakeSource


def _source(raw_databases, configured_db=None):
    source = object.__new__(SnowflakeSource)
    source.config = SimpleNamespace(
        serviceConnection=SimpleNamespace(root=SimpleNamespace(config=SimpleNamespace(database=configured_db)))
    )
    source.source_config = SimpleNamespace(useFqnForFiltering=False, databaseFilterPattern=None)
    source.metadata = MagicMock()
    source.status = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database_service="svc")
    source.get_database_names_raw = MagicMock(return_value=iter(raw_databases))
    return source


class TestSnowflakeDatabaseCount:
    def test_count_is_the_filtered_name_count(self):
        source = _source(["A", "B", "C"])
        with patch.object(snowflake_metadata, "filter_by_database", return_value=False):
            assert len(source._filtered_database_names()) == 3

    def test_filtered_out_databases_are_excluded_from_count(self):
        source = _source(["KEEP", "DROP"])
        with patch.object(snowflake_metadata, "filter_by_database", side_effect=lambda _pattern, name: name == "DROP"):
            assert len(source._filtered_database_names()) == 1
            source.status.filter.assert_called_once()

    def test_configured_database_counts_as_one(self):
        source = _source([], configured_db="ONLY_DB")
        assert len(source._filtered_database_names()) == 1
        source.get_database_names_raw.assert_not_called()

    def test_filtered_names_are_cached_so_status_is_not_double_emitted(self):
        source = _source(["A", "DROP"])
        with patch.object(snowflake_metadata, "filter_by_database", side_effect=lambda _pattern, name: name == "DROP"):
            source._filtered_database_names()
            source._filtered_database_names()
        source.get_database_names_raw.assert_called_once()
        source.status.filter.assert_called_once()

    def test_producer_setup_runs_per_kept_database_without_re_filtering(self):
        from metadata.utils.progress_registry import ProgressRegistry

        source = _source(["A", "B"])
        for setup in (
            "set_inspector",
            "set_session_query_tag",
            "set_partition_details",
            "set_schema_description_map",
            "set_database_description_map",
            "set_external_location_map",
            "set_schema_tags_map",
            "set_database_tags_map",
        ):
            setattr(source, setup, MagicMock())
        source.__dict__["_progress_registry"] = ProgressRegistry()
        with patch.object(snowflake_metadata, "filter_by_database", return_value=False):
            source._filtered_database_names()  # warms the database names cache
            yielded = list(source.get_database_names())
        assert yielded == ["A", "B"]
        assert source.set_inspector.call_count == 2  # setup ran per database, lazily
        source.get_database_names_raw.assert_called_once()  # enumeration reused from cache


@pytest.fixture
def snowflake_source():
    """Minimal SnowflakeSource stub for push-totals tests."""
    from metadata.utils.progress_registry import ProgressRegistry

    source = object.__new__(SnowflakeSource)
    source.config = SimpleNamespace(
        serviceConnection=SimpleNamespace(root=SimpleNamespace(config=SimpleNamespace(database=None)))
    )
    source.source_config = SimpleNamespace(
        useFqnForFiltering=False,
        databaseFilterPattern=None,
        schemaFilterPattern=None,
    )
    source.metadata = MagicMock()
    source.status = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database=None, database_service="svc")
    source.__dict__["_progress_registry"] = ProgressRegistry()
    return source


def test_declare_progress_totals_seeds_database_and_schema(snowflake_source):
    snowflake_source._filtered_database_names = lambda: ["db1", "db2"]
    snowflake_source._schema_names_by_database = lambda: {"db1": ["s1", "s2"], "db2": ["s3"]}
    snowflake_source._is_schema_filtered = lambda db, sch: False
    snowflake_source._declare_progress_totals()
    counters = {t: (d, total) for t, d, total in snowflake_source.progress.global_counters()}
    assert counters["Database"] == (0, 2)
    assert counters["DatabaseSchema"] == (0, 3)


def test_declare_progress_totals_applies_schema_filter(snowflake_source):
    snowflake_source._filtered_database_names = lambda: ["db1"]
    snowflake_source._schema_names_by_database = lambda: {"db1": ["keep", "drop"]}
    snowflake_source._is_schema_filtered = lambda db, sch: sch == "drop"
    snowflake_source._declare_progress_totals()
    counters = {t: (d, total) for t, d, total in snowflake_source.progress.global_counters()}
    assert counters["DatabaseSchema"] == (0, 1)


def test_declare_progress_totals_falls_back_when_account_show_unavailable(snowflake_source):
    snowflake_source._filtered_database_names = lambda: ["db1"]
    snowflake_source._schema_names_by_database = lambda: None
    snowflake_source._declare_progress_totals()
    assert snowflake_source.progress.is_reconcilable("DatabaseSchema") is True
    counters = {t: (d, total) for t, d, total in snowflake_source.progress.global_counters()}
    assert counters["Database"] == (0, 1)
    assert counters["DatabaseSchema"] == (0, None)
