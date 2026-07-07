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
"""Snowflake uses the inherited lazy progress path; no COUNT pass remains."""

import inspect
from types import SimpleNamespace
from unittest.mock import MagicMock

from metadata.ingestion.source.database import database_service
from metadata.ingestion.source.database.snowflake import metadata as snowflake_metadata
from metadata.utils.progress_registry import ProgressRegistry


class _ConcreteSource(database_service.DatabaseServiceSource):
    """Minimal concrete subclass so object.__new__ works on the abstract base."""

    close = create = get_database_names = get_database_schema_names = None  # type: ignore[assignment]
    get_stored_procedures = get_tables_name_and_type = yield_database = None  # type: ignore[assignment]
    yield_database_schema = yield_stored_procedure = yield_table = yield_tag = None  # type: ignore[assignment]


def _path_for(database, schema, entity_type_name):
    source = object.__new__(_ConcreteSource)
    ctx = SimpleNamespace(database=database, database_schema=schema)
    source.context = MagicMock()
    source.context.get.return_value = ctx
    return source.current_progress_path(entity_type_name)


class TestSnowflakeProgressPath:
    def test_database_node_opens_at_root(self):
        assert _path_for("db", None, "Database") == []

    def test_schema_node_opens_under_its_database(self):
        assert _path_for("db", None, "DatabaseSchema") == ["db"]

    def test_table_node_opens_under_database_and_schema(self):
        assert _path_for("db", "sales", "Table") == ["db", "sales"]

    def test_stored_procedure_node_opens_under_database_and_schema(self):
        assert _path_for("db", "sales", "StoredProcedure") == ["db", "sales"]

    def test_schema_node_ignores_stale_sibling_schema_context(self):
        # database_schema still holds the previous database's last schema; the
        # schema level must NOT inherit it, or the new database's schema-count
        # open lands one level too deep and the database never completes.
        assert _path_for("db2", "stale_schema_from_db1", "DatabaseSchema") == ["db2"]

    def test_no_declare_totals_on_snowflake_source(self):
        assert not hasattr(snowflake_metadata.SnowflakeSource, "declare_totals")

    def test_connector_references_no_count_constants(self):
        source = inspect.getsource(snowflake_metadata)
        assert "SNOWFLAKE_COUNT" not in source
        assert "TotalsRunner" not in source
        assert "declare_totals" not in source


class TestProgressOptIn:
    def test_database_family_is_off_by_default(self):
        assert database_service.DatabaseServiceSource.progress_tracking_enabled is False

    def test_concrete_db_source_inherits_off(self):
        assert _ConcreteSource.progress_tracking_enabled is False

    def test_snowflake_is_opted_in(self):
        assert snowflake_metadata.SnowflakeSource.progress_tracking_enabled is True


class TestStaleContextDoesNotStrandDatabases:
    """End-to-end: drive the registry through the real path logic across two
    single-threaded databases, with database_schema left stale when the second
    database starts (exactly the runner's behaviour). Every database must reach
    completion and prune; before the fix the second one stranded as 'live'."""

    def _path(self, source, ctx, entity_type_name):
        source.context.get.return_value = ctx
        return source.current_progress_path(entity_type_name)

    def test_second_database_completes_and_prunes(self):
        source = object.__new__(_ConcreteSource)
        source.context = MagicMock()
        registry = ProgressRegistry()
        ctx = SimpleNamespace(database=None, database_schema=None)

        registry.open(self._path(source, ctx, "Database"), "Database", 2)

        ctx.database, ctx.database_schema = "db1", None
        registry.open(self._path(source, ctx, "DatabaseSchema"), "DatabaseSchema", 1)
        ctx.database_schema = "s1"
        registry.open(self._path(source, ctx, "Table"), "Table", 1)
        registry.advance(self._path(source, ctx, "Table"))  # db1 fully done

        ctx.database = "db2"  # database_schema is left as the stale "s1"
        registry.open(self._path(source, ctx, "DatabaseSchema"), "DatabaseSchema", 1)
        ctx.database_schema = "x1"
        registry.open(self._path(source, ctx, "Table"), "Table", 1)
        registry.advance(self._path(source, ctx, "Table"))  # db2 fully done

        snapshot = registry.snapshot()
        assert snapshot.child_type == "Database"
        assert snapshot.processed == 2
        assert snapshot.expected == 2
        assert snapshot.active is False
        assert snapshot.children == ()  # both databases completed and pruned
