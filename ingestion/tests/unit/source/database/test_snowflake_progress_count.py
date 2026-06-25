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
        # Pre-populate the schema cache so _push_progress_totals does not trigger
        # _account_schema_names / _per_database_schema_names (and extra set_inspector
        # calls), letting us assert exactly 2 calls — one per kept database.
        source.__dict__["_schema_names_by_db_cache"] = {"A": [], "B": []}
        source.__dict__["_progress_registry"] = ProgressRegistry()
        with patch.object(snowflake_metadata, "filter_by_database", return_value=False):
            source._filtered_database_names()  # warms the database names cache
            yielded = list(source.get_database_names())
        assert yielded == ["A", "B"]
        assert source.set_inspector.call_count == 2  # setup ran per database, lazily
        source.get_database_names_raw.assert_called_once()  # enumeration reused from cache


@pytest.fixture
def make_snowflake_source():
    """Build a SnowflakeSource stub for schema-cache tests.

    The fixture factory accepts:
      - databases: list of database names (pre-filtered; skips filter pass)
      - schemas_by_db: mapping of database name -> list of schema names returned
        by inspector.get_schema_names() for that database
    """

    def _factory(databases, schemas_by_db, account_query_fails=False):
        source = object.__new__(SnowflakeSource)

        # Minimal config shape — only fields accessed by the methods under test
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

        # Context: database_service is always "svc"; .database is set per test
        ctx = SimpleNamespace(database=None, database_service="svc")
        source.context = MagicMock()
        source.context.get.return_value = ctx

        # Pre-populate the database names cache so _filtered_database_names()
        # returns `databases` without touching get_database_names_raw / status.
        source.__dict__["_filtered_database_names_cache"] = list(databases)

        # connection.execute("SHOW SCHEMAS IN ACCOUNT").fetchall() -> account-wide
        # rows. Each row mimics a SQLAlchemy Row with a `_mapping` of the SHOW
        # columns (database_name + name). Includes every db in schemas_by_db so
        # tests can verify database-level filtering excludes the extras.
        rows = [
            SimpleNamespace(_mapping={"database_name": database, "name": schema})
            for database, schemas in schemas_by_db.items()
            for schema in schemas
        ]
        result = MagicMock()
        result.fetchall.return_value = rows
        connection = MagicMock()
        if account_query_fails:
            connection.execute.side_effect = Exception("insufficient privileges")
        else:
            connection.execute.return_value = result
        source.connection_mock = connection  # exposed for call-count assertions

        # `connection` and `inspector` are @property objects backed by the
        # per-thread maps; inject at thread_id 0 (the MagicMock context's id).
        source.context.get_current_thread_id.return_value = 0
        source.__dict__["_connection_map"] = {0: connection}

        # Track which databases set_inspector was called with (the slow fallback)
        source.inspector_calls = []

        mock_inspector = MagicMock()
        source.__dict__["_inspector_map"] = {0: mock_inspector}

        def _set_inspector(database_name):
            source.inspector_calls.append(database_name)
            mock_inspector.get_schema_names.return_value = schemas_by_db.get(database_name, [])

        source.set_inspector = _set_inspector

        return source

    return _factory


class TestSnowflakeSchemaCache:
    def test_schema_names_uses_single_account_query_no_per_db_reconnect(self, make_snowflake_source):
        source = make_snowflake_source(
            databases=["DB1", "DB2"],
            schemas_by_db={"DB1": ["public", "raw"], "DB2": ["analytics"]},
        )
        cache = source._schema_names_by_database()
        assert sum(len(schemas) for schemas in cache.values()) == 3
        source._schema_names_by_database()  # cached: must not re-query
        assert source.inspector_calls == []  # no per-database connection rebuilds
        assert source.connection_mock.execute.call_count == 1  # one account-wide query

    def test_account_query_excludes_database_filtered_out(self, make_snowflake_source):
        # DB2 is not in `databases` (filtered at the database level), so its
        # account-query rows must be dropped.
        source = make_snowflake_source(
            databases=["DB1"],
            schemas_by_db={"DB1": ["public"], "DB2": ["x", "y"]},
        )
        cache = source._schema_names_by_database()
        assert sum(len(schemas) for schemas in cache.values()) == 1
        assert "DB2" not in cache

    def test_schema_cache_falls_back_to_per_database_when_account_query_fails(self, make_snowflake_source):
        source = make_snowflake_source(
            databases=["DB1", "DB2"],
            schemas_by_db={"DB1": ["public", "raw"], "DB2": ["analytics"]},
            account_query_fails=True,
        )
        cache = source._schema_names_by_database()
        assert sum(len(schemas) for schemas in cache.values()) == 3
        assert source.inspector_calls == ["DB1", "DB2"]  # fell back to per-database

    def test_schema_cache_is_per_database_addressable(self, make_snowflake_source):
        source = make_snowflake_source(
            databases=["DB1", "DB2"],
            schemas_by_db={"DB1": ["public", "raw"], "DB2": ["analytics"]},
        )
        cache = source._schema_names_by_database()
        assert len(cache["DB1"]) == 2
        assert len(cache["DB2"]) == 1


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


def test_get_database_names_pushes_totals(snowflake_source):
    snowflake_source.__dict__["_schema_names_by_db_cache"] = {
        "db1": ["s1", "s2"],
        "db2": ["s3"],
    }
    snowflake_source._filtered_database_names = lambda: ["db1", "db2"]
    snowflake_source.set_inspector = lambda **_: None
    snowflake_source.set_session_query_tag = lambda: None
    snowflake_source.set_partition_details = lambda: None
    snowflake_source.set_schema_description_map = lambda: None
    snowflake_source.set_database_description_map = lambda: None
    snowflake_source.set_external_location_map = lambda *_: None
    snowflake_source.set_schema_tags_map = lambda *_: None
    snowflake_source.set_database_tags_map = lambda *_: None

    list(snowflake_source.get_database_names())

    rollup = {t: e for t, _, e in snowflake_source.progress.rollup_by_type()}
    assert rollup["Database"] == 2
    assert rollup["DatabaseSchema"] == 3  # 2 + 1 across db1, db2
