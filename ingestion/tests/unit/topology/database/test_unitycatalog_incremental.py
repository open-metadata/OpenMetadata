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
Unit tests for Unity Catalog incremental metadata extraction.
"""

from threading import RLock
from types import MethodType, SimpleNamespace
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.incremental_metadata_extraction import (
    IncrementalConfig,
)
from metadata.ingestion.source.database.unitycatalog.incremental_table_processor import (
    UnityCatalogIncrementalTableProcessor,
)
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

UC_METADATA_MODULE = "metadata.ingestion.source.database.unitycatalog.metadata"

CHANGED_ROWS = [
    ("schema1", "tbl_a"),
    ("schema1", "tbl_b"),
    ("schema2", "tbl_c"),
]
DELETED_ROWS = [
    ("cat.schema1.dropped",),
    ("cat.schema2.gone",),
]


class TestUnityCatalogIncrementalTableProcessor:
    """Tests for the changed/deleted table detection processor."""

    def test_set_table_map_buckets_changed_and_deleted(self):
        connection = Mock()
        connection.execute.side_effect = [CHANGED_ROWS, DELETED_ROWS]

        processor = UnityCatalogIncrementalTableProcessor.create(connection)
        processor.set_table_map(catalog="cat", start_timestamp=1000)

        assert processor.get_changed("schema1") == {"tbl_a", "tbl_b"}
        assert processor.get_changed("schema2") == {"tbl_c"}
        assert processor.get_changed("unknown") == set()
        assert processor.get_deleted("schema1") == {"dropped"}
        assert processor.get_deleted("schema2") == {"gone"}
        assert processor.get_deleted("unknown") == set()

    def test_set_table_map_degrades_when_both_queries_fail(self):
        connection = Mock()
        connection.execute.side_effect = Exception("system schema not enabled")

        processor = UnityCatalogIncrementalTableProcessor.create(connection)
        processor.set_table_map(catalog="cat", start_timestamp=1000)

        assert processor.get_changed("schema1") == set()
        assert processor.get_deleted("schema1") == set()

    def test_set_table_map_degrades_only_for_failing_query(self):
        connection = Mock()
        connection.execute.side_effect = [CHANGED_ROWS, Exception("no audit access")]

        processor = UnityCatalogIncrementalTableProcessor.create(connection)
        processor.set_table_map(catalog="cat", start_timestamp=1000)

        assert processor.get_changed("schema1") == {"tbl_a", "tbl_b"}
        assert processor.get_deleted("schema1") == set()

    def test_split_full_name(self):
        assert UnityCatalogIncrementalTableProcessor._split_full_name("cat.sch.tbl") == (
            "sch",
            "tbl",
        )
        assert UnityCatalogIncrementalTableProcessor._split_full_name("only.two") is None
        assert UnityCatalogIncrementalTableProcessor._split_full_name("a.b.c.d") is None
        assert UnityCatalogIncrementalTableProcessor._split_full_name(None) is None
        assert UnityCatalogIncrementalTableProcessor._split_full_name("") is None

    def test_set_table_map_rejects_unsafe_catalog_name(self):
        connection = Mock()

        processor = UnityCatalogIncrementalTableProcessor.create(connection)
        processor.set_table_map(catalog="bad'; DROP TABLE x", start_timestamp=1000)

        connection.execute.assert_not_called()
        assert processor.get_changed("schema1") == set()
        assert processor.get_deleted("schema1") == set()

    def test_set_table_map_uses_exact_catalog_match_for_deletes(self):
        connection = Mock()
        connection.execute.side_effect = [CHANGED_ROWS, DELETED_ROWS]

        processor = UnityCatalogIncrementalTableProcessor.create(connection)
        processor.set_table_map(catalog="cat", start_timestamp=1000)

        deleted_sql = str(connection.execute.call_args_list[1].args[0])
        assert "substring_index(request_params.full_name_arg, '.', 1) = 'cat'" in deleted_sql
        assert "LIKE" not in deleted_sql


class TestUnityCatalogIncrementalSource:
    """Tests for the incremental hooks on the Unity Catalog source."""

    def _make_source(self):
        """A plain Mock used as `self`.

        We cannot use Mock(spec=UnitycatalogSource) here because the methods
        under test read instance attributes (config, context, client, status,
        incremental, ...) that are assigned in __init__ and are therefore not
        part of the class spec.
        """
        source = Mock()
        source._state_lock = RLock()
        # Listing methods iterate through the real failure-isolation wrapper
        source._iterate_listing = MethodType(UnitycatalogSource._iterate_listing, source)
        return source

    def test_init_configures_threads_from_source_config(self):
        config = Mock()
        config.sourceConfig.config.threads = 4
        config.serviceConnection.root.config = Mock(spec=UnityCatalogConnection)
        metadata = Mock()
        incremental = SimpleNamespace(enabled=False)
        previous_threads = UnitycatalogSource.context.threads

        try:
            with (
                patch(f"{UC_METADATA_MODULE}.get_connection", return_value=Mock()),
                patch(f"{UC_METADATA_MODULE}.DatabricksClient", return_value=Mock()),
                patch(f"{UC_METADATA_MODULE}.get_sqlalchemy_connection", return_value=Mock()),
                patch.object(UnitycatalogSource, "test_connection", return_value=None),
            ):
                source = UnitycatalogSource(config, metadata, incremental)

            assert source.context.threads == 4
        finally:
            UnitycatalogSource.context.set_threads(previous_threads)

    def test_process_table_yields_regular_table(self):
        source = self._make_source()
        source.config.sourceConfig.config.useFqnForFiltering = False
        table = SimpleNamespace(name="tbl_a", table_type=None)

        with (
            patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
            patch(f"{UC_METADATA_MODULE}.filter_by_table", return_value=False),
        ):
            fqn_mock.build.return_value = "svc.cat.schema1.tbl_a"
            result = list(UnitycatalogSource._process_table(source, table, "cat", "schema1"))

        assert result == [("tbl_a", TableType.Regular)]
        assert source.context.get().table_data is table

    def test_process_table_detects_view(self):
        source = self._make_source()
        source.config.sourceConfig.config.useFqnForFiltering = False
        table = SimpleNamespace(name="v_a", table_type=SimpleNamespace(value="VIEW"))

        with (
            patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
            patch(f"{UC_METADATA_MODULE}.filter_by_table", return_value=False),
        ):
            fqn_mock.build.return_value = "svc.cat.schema1.v_a"
            result = list(UnitycatalogSource._process_table(source, table, "cat", "schema1"))

        assert result == [("v_a", TableType.View)]

    def test_process_table_skips_filtered_table(self):
        source = self._make_source()
        source.config.sourceConfig.config.useFqnForFiltering = False
        table = SimpleNamespace(name="tbl_a", table_type=None)

        with (
            patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
            patch(f"{UC_METADATA_MODULE}.filter_by_table", return_value=True),
        ):
            fqn_mock.build.return_value = "svc.cat.schema1.tbl_a"
            result = list(UnitycatalogSource._process_table(source, table, "cat", "schema1"))

        assert result == []
        source.status.filter.assert_called_once()

    def test_process_table_failure_uses_safe_identifier(self):
        source = self._make_source()
        table = SimpleNamespace(table_type=None)

        result = list(UnitycatalogSource._process_table(source, table, "cat", "schema1"))

        assert result == []
        source.status.failed.assert_called_once()
        assert source.status.failed.call_args.args[0].name == "<unknown>"

    def test_get_incremental_tables_records_deletes_and_yields_changes(self):
        source = self._make_source()
        processor = Mock()
        processor.get_deleted.return_value = {"dropped"}
        processor.get_changed.return_value = {"chg"}
        source.incremental_table_processor = processor
        source.context.get_global.return_value = SimpleNamespace(deleted_tables=[])
        changed_table = SimpleNamespace(name="chg", table_type=None)
        source.client.tables.get.return_value = changed_table
        source._process_table.return_value = iter([("chg", TableType.Regular)])

        with patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock:
            fqn_mock.build.return_value = "svc.cat.schema1.dropped"
            result = list(UnitycatalogSource._get_incremental_tables(source, "cat", "schema1"))

        assert result == [("chg", TableType.Regular)]
        assert source.context.get_global().deleted_tables == ["svc.cat.schema1.dropped"]
        source.client.tables.get.assert_called_once_with("cat.schema1.chg")
        source._process_table.assert_called_once_with(changed_table, "cat", "schema1")

    def test_yield_database_schema_removes_handoff_cache_entry(self):
        source = self._make_source()
        source.context.get.return_value = SimpleNamespace(database="cat", database_service="svc")
        schema = SimpleNamespace(name="schema1", comment="schema description", owner="owner@example.com")
        source._schema_cache = {("cat", "schema1"): schema}
        source.get_owner_ref.return_value = None
        source.get_schema_tag_labels.return_value = []

        with patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock:
            fqn_mock.build.return_value = "svc.cat"
            result = list(UnitycatalogSource.yield_database_schema(source, "schema1"))

        assert len(result) == 1
        assert result[0].right.description.root == "schema description"
        assert ("cat", "schema1") not in source._schema_cache

    def test_yield_database_schema_only_removes_current_schema_entry(self):
        source = self._make_source()
        source.context.get.return_value = SimpleNamespace(database="cat", database_service="svc")
        schema1 = SimpleNamespace(name="schema1", comment="schema 1", owner="owner1@example.com")
        schema2 = SimpleNamespace(name="schema2", comment="schema 2", owner="owner2@example.com")
        source._schema_cache = {
            ("cat", "schema1"): schema1,
            ("cat", "schema2"): schema2,
        }
        source.get_owner_ref.return_value = None
        source.get_schema_tag_labels.return_value = []

        with patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock:
            fqn_mock.build.return_value = "svc.cat"
            list(UnitycatalogSource.yield_database_schema(source, "schema1"))

        assert source._schema_cache == {
            ("cat", "schema2"): schema2,
        }

    def test_get_database_schema_names_does_not_cache_filtered_schema(self):
        source = self._make_source()
        source.context.get.return_value = SimpleNamespace(database="cat", database_service="svc")
        source.client.schemas.list.return_value = [SimpleNamespace(name="schema1")]
        source.config.sourceConfig.config.useFqnForFiltering = False
        source._schema_cache = {}

        with (
            patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
            patch(f"{UC_METADATA_MODULE}.filter_by_schema", return_value=True),
        ):
            fqn_mock.build.return_value = "svc.cat.schema1"
            result = list(UnitycatalogSource.get_database_schema_names(source))

        assert result == []
        assert source._schema_cache == {}

    def test_get_incremental_tables_excludes_recreated_from_deletes(self):
        """A table dropped AND recreated within the window exists now (it shows up
        in information_schema), so it must be processed, not marked deleted."""
        source = self._make_source()
        processor = Mock()
        processor.get_deleted.return_value = {"keep_deleted", "recreated"}
        processor.get_changed.return_value = {"recreated", "new_change"}
        source.incremental_table_processor = processor
        source.context.get_global.return_value = SimpleNamespace(deleted_tables=[])
        source.client.tables.get.return_value = SimpleNamespace(name="x", table_type=None)
        source._process_table.return_value = iter([])

        with patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock:
            fqn_mock.build.side_effect = lambda **kw: kw["table_name"]
            list(UnitycatalogSource._get_incremental_tables(source, "cat", "schema1"))

        assert source.context.get_global().deleted_tables == ["keep_deleted"]
        fetched = {c.args[0] for c in source.client.tables.get.call_args_list}
        assert fetched == {"cat.schema1.recreated", "cat.schema1.new_change"}

    def test_get_incremental_tables_handles_get_failure(self):
        source = self._make_source()
        processor = Mock()
        processor.get_deleted.return_value = set()
        processor.get_changed.return_value = {"chg"}
        source.incremental_table_processor = processor
        source.context.get_global.return_value = SimpleNamespace(deleted_tables=[])
        source.client.tables.get.side_effect = Exception("boom")

        result = list(UnitycatalogSource._get_incremental_tables(source, "cat", "schema1"))

        assert result == []
        source.status.failed.assert_called_once()

    def test_get_incremental_tables_noop_without_processor(self):
        source = self._make_source()
        source.incremental_table_processor = None

        result = list(UnitycatalogSource._get_incremental_tables(source, "cat", "schema1"))

        assert result == []

    def test_get_tables_uses_incremental_path_when_enabled(self):
        source = self._make_source()
        source.incremental.enabled = True
        source.incremental_table_processor = Mock()
        source.context.get.return_value = SimpleNamespace(database="cat", database_schema="schema1")
        source._get_incremental_tables.return_value = iter([("x", TableType.Regular)])

        result = list(UnitycatalogSource.get_tables_name_and_type(source))

        assert result == [("x", TableType.Regular)]
        source._get_incremental_tables.assert_called_once_with("cat", "schema1")
        source.client.tables.list.assert_not_called()

    def test_get_tables_uses_full_path_when_disabled(self):
        source = self._make_source()
        source.incremental.enabled = False
        source.context.get.return_value = SimpleNamespace(database="cat", database_schema="schema1")
        tables = [SimpleNamespace(name="t1"), SimpleNamespace(name="t2")]
        source.client.tables.list.return_value = tables
        source._process_table.side_effect = lambda table, catalog, schema: iter([(table.name, TableType.Regular)])

        result = list(UnitycatalogSource.get_tables_name_and_type(source))

        assert result == [("t1", TableType.Regular), ("t2", TableType.Regular)]
        source.client.tables.list.assert_called_once_with(catalog_name="cat", schema_name="schema1", max_results=0)
        source._get_incremental_tables.assert_not_called()

    def test_mark_tables_as_deleted_incremental_uses_explicit_list(self):
        source = self._make_source()
        source.incremental.enabled = True
        source.source_config.markDeletedTables = True
        source.context.get.return_value = SimpleNamespace(database="cat")
        source.context.get_global.return_value = SimpleNamespace(deleted_tables=["svc.cat.schema1.dropped"])

        with patch(
            f"{UC_METADATA_MODULE}.delete_entity_by_name",
            return_value=iter(["deleted"]),
        ) as delete_mock:
            result = list(UnitycatalogSource.mark_tables_as_deleted(source))

        assert result == ["deleted"]
        _, kwargs = delete_mock.call_args
        assert kwargs["entity_names"] == ["svc.cat.schema1.dropped"]

    def test_mark_tables_as_deleted_drains_global_list(self):
        source = self._make_source()
        source.incremental.enabled = True
        source.source_config.markDeletedTables = True
        source.context.get.return_value = SimpleNamespace(database="cat")
        deleted_tables = ["svc.cat.schema1.dropped", "svc.cat.schema2.dropped"]
        source.context.get_global.return_value = SimpleNamespace(deleted_tables=deleted_tables)

        with patch(
            f"{UC_METADATA_MODULE}.delete_entity_by_name",
            return_value=iter(["deleted"]),
        ) as delete_mock:
            result = list(UnitycatalogSource.mark_tables_as_deleted(source))

        assert result == ["deleted"]
        _, kwargs = delete_mock.call_args
        assert kwargs["entity_names"] == ["svc.cat.schema1.dropped", "svc.cat.schema2.dropped"]
        assert deleted_tables == []

    def test_mark_tables_as_deleted_incremental_respects_mark_flag(self):
        source = self._make_source()
        source.incremental.enabled = True
        source.source_config.markDeletedTables = False
        source.context.get.return_value = SimpleNamespace(database="cat")

        with patch(f"{UC_METADATA_MODULE}.delete_entity_by_name") as delete_mock:
            result = list(UnitycatalogSource.mark_tables_as_deleted(source))

        assert result == []
        delete_mock.assert_not_called()

    def test_mark_tables_as_deleted_full_mode_delegates_to_super(self):
        instance = UnitycatalogSource.__new__(UnitycatalogSource)
        instance.incremental = SimpleNamespace(enabled=False)

        with patch.object(
            DatabaseServiceSource,
            "mark_tables_as_deleted",
            return_value=iter(["base"]),
        ) as base_mark:
            result = list(instance.mark_tables_as_deleted())

        assert result == ["base"]
        base_mark.assert_called_once()

    def test_create_builds_and_forwards_incremental_config(self):
        config = Mock()
        config.serviceConnection.root.config = Mock(spec=UnityCatalogConnection)
        metadata = Mock()
        sentinel = object()

        with (
            patch.object(WorkflowSource, "model_validate", return_value=config),
            patch.object(IncrementalConfig, "create", return_value=sentinel) as incremental_create,
            patch.object(UnitycatalogSource, "__init__", return_value=None) as init_mock,
        ):
            UnitycatalogSource.create({"k": "v"}, metadata, pipeline_name="pipe")

        incremental_create.assert_called_once_with(config.sourceConfig.config.incremental, "pipe", metadata)
        init_args = init_mock.call_args.args
        assert config in init_args
        assert metadata in init_args
        assert sentinel in init_args

    def test_get_owner_ref_delegates_to_owner_resolver(self):
        source = self._make_source()
        source.owner_resolver.get_owner_ref.return_value = "owner-ref"

        result = UnitycatalogSource.get_owner_ref(source, "owner@example.com")

        assert result == "owner-ref"
        source.owner_resolver.get_owner_ref.assert_called_once_with("owner@example.com")

    def test_get_owner_ref_returns_none_when_resolver_fails(self):
        source = self._make_source()
        source.owner_resolver.get_owner_ref.side_effect = Exception("lookup failed")

        result = UnitycatalogSource.get_owner_ref(source, "owner@example.com")

        assert result is None
