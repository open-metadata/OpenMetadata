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
Test Unity Catalog lineage functionality
"""

from collections import namedtuple
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
)

MOCK_CONFIG = {
    "source": {
        "type": "unitycatalog-lineage",
        "serviceName": "local_unitycatalog",
        "serviceConnection": {
            "config": {
                "type": "UnityCatalog",
                "catalog": "demo-test-cat",
                "databaseSchema": "test-schema",
                "authType": {"token": "test_token"},
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/test",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseLineage"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test_token"},
        }
    },
}


TableRow = namedtuple(
    "TableRow",
    ["source_table_full_name", "source_path", "target_table_full_name", "target_path"],
)
ColumnRow = namedtuple(
    "ColumnRow",
    [
        "source_table_full_name",
        "source_path",
        "source_column_name",
        "target_table_full_name",
        "target_path",
        "target_column_name",
    ],
)
ExternalRow = namedtuple("ExternalRow", ["table_catalog", "table_schema", "table_name", "storage_path"])


def table_row(source=None, target=None, source_path=None, target_path=None):
    """A system.access.table_lineage row, named or path based on either side"""
    return TableRow(source, source_path, target, target_path)


def column_row(source, source_column, target, target_column, source_path=None, target_path=None):
    """A system.access.column_lineage row"""
    return ColumnRow(source, source_path, source_column, target, target_path, target_column)


def a_table(name="test_table", columns=None):
    return Table(
        id=uuid4(),
        name=EntityName(root=name),
        fullyQualifiedName=FullyQualifiedEntityName(root=f"service.db.schema.{name}"),
        columns=columns or [],
    )


def a_container(name="test_container", data_model=None):
    return Container(
        id=uuid4(),
        name=EntityName(root=name),
        service=EntityReference(id=uuid4(), type="storageService"),
        dataModel=data_model,
    )


@pytest.fixture
def lineage_source():
    with (
        patch("metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"),
        patch("metadata.ingestion.ometa.ometa_api.OpenMetadata") as mock_metadata,
        patch("metadata.ingestion.source.database.unitycatalog.lineage.create_connection") as mock_create_connection,
    ):
        config = WorkflowSource.model_validate(MOCK_CONFIG["source"])
        source = UnitycatalogLineageSource(config, mock_metadata)
        source.engine = mock_create_connection.return_value.sql.client
        yield source


class TestCacheLineage:
    def test_cache_table_lineage(self, lineage_source):
        mock_rows = [
            table_row("cat.schema.source1", "cat.schema.target1"),
            table_row("cat.schema.source2", "cat.schema.target1"),
            table_row("cat.schema.source1", "cat.schema.target2"),
        ]

        mock_conn = MagicMock()
        mock_conn.execute.return_value = mock_rows
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_lineage()

        assert "cat.schema.target1" in lineage_source.table_lineage_map
        assert lineage_source.table_lineage_map["cat.schema.target1"] == {
            "cat.schema.source1",
            "cat.schema.source2",
        }
        assert lineage_source.table_lineage_map["cat.schema.target2"] == {
            "cat.schema.source1",
        }

    def test_cache_column_lineage(self, lineage_source):
        call_count = 0

        def mock_execute(query):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [table_row("cat.schema.src", "cat.schema.tgt")]
            return [
                column_row("cat.schema.src", "col_a", "cat.schema.tgt", "col_x"),
                column_row("cat.schema.src", "col_b", "cat.schema.tgt", "col_y"),
            ]

        mock_conn = MagicMock()
        mock_conn.execute.side_effect = mock_execute
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_lineage()

        key = ("cat.schema.src", "cat.schema.tgt")
        assert key in lineage_source.column_lineage_map
        assert lineage_source.column_lineage_map[key] == [
            ("col_a", "col_x"),
            ("col_b", "col_y"),
        ]

    def test_cache_lineage_handles_query_failure(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_lineage()

        assert len(lineage_source.table_lineage_map) == 0
        assert len(lineage_source.column_lineage_map) == 0


class TestProcessTableLineage:
    def test_process_table_lineage_from_cache(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[],
        )

        source_table = Table(
            id=uuid4(),
            name=EntityName(root="source"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.source"),
            columns=[],
        )

        lineage_source.metadata.get_by_name.return_value = source_table

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 1
        assert isinstance(results[0], Either)
        assert isinstance(results[0].right, AddLineageRequest)
        assert results[0].right.edge.fromEntity.id == source_table.id
        assert results[0].right.edge.toEntity.id == target_table.id

    def test_process_table_lineage_with_column_lineage(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {("cat.schema.source", "cat.schema.target"): [("col_a", "col_x")]}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[
                Column(
                    name=ColumnName(root="col_x"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target.col_x"),
                )
            ],
        )

        source_table = Table(
            id=uuid4(),
            name=EntityName(root="source"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.source"),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.source.col_a"),
                )
            ],
        )

        lineage_source.metadata.get_by_name.return_value = source_table

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 1
        lineage_details = results[0].right.edge.lineageDetails
        assert lineage_details is not None
        assert len(lineage_details.columnsLineage) == 1
        assert lineage_details.columnsLineage[0].fromColumns[0].root == "local_unitycatalog.cat.schema.source.col_a"
        assert lineage_details.columnsLineage[0].toColumn.root == "local_unitycatalog.cat.schema.target.col_x"

    def test_process_table_lineage_skips_malformed_names(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"malformed_name"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[],
        )

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 0

    def test_process_table_lineage_skips_missing_entity(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[],
        )

        lineage_source.metadata.get_by_name.return_value = None

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 0


class TestColumnLineageDetails:
    def test_self_loop_prevention(self, lineage_source):
        lineage_source.column_lineage_map = {("cat.schema.src", "cat.schema.tgt"): [("col_a", "col_a")]}

        table = Table(
            id=uuid4(),
            name=EntityName(root="tgt"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.tgt"),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.tgt.col_a"),
                )
            ],
        )

        same_table_as_source = Table(
            id=uuid4(),
            name=EntityName(root="src"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.src"),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.src.col_a"),
                )
            ],
        )

        result = lineage_source._get_column_lineage_details(
            same_table_as_source, table, "cat.schema.src", "cat.schema.tgt"
        )

        assert result is not None
        assert len(result.columnsLineage) == 1

    def test_no_column_lineage_returns_none(self, lineage_source):
        lineage_source.column_lineage_map = {}

        table = Table(
            id=uuid4(),
            name=EntityName(root="tgt"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.tgt"),
            columns=[],
        )
        from_table = Table(
            id=uuid4(),
            name=EntityName(root="src"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.src"),
            columns=[],
        )

        result = lineage_source._get_column_lineage_details(from_table, table, "cat.schema.src", "cat.schema.tgt")

        assert result is None


class TestExternalLocationLineage:
    def test_cache_external_locations(self, lineage_source):
        mock_rows = [
            ExternalRow("cat", "schema", "ext_table1", "s3://bucket/path1"),
            ExternalRow("cat", "schema", "ext_table2", "s3://bucket/path2/"),
        ]

        mock_conn = MagicMock()
        mock_conn.execute.return_value = mock_rows
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 2
        assert lineage_source.external_location_map["cat.schema.ext_table1"] == "s3://bucket/path1"
        assert lineage_source.external_location_map["cat.schema.ext_table2"] == "s3://bucket/path2/"

    def test_cache_external_locations_handles_failure(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 0

    def test_process_external_location_lineage_from_cache(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://bucket/path"}

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table"),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_external_location_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        assert isinstance(results[0], Either)
        assert isinstance(results[0].right, AddLineageRequest)
        assert results[0].right.edge.fromEntity.id == container_entity.id
        assert results[0].right.edge.fromEntity.type == "container"
        assert results[0].right.edge.toEntity.id == table_entity.id
        assert results[0].right.edge.toEntity.type == "table"

        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://bucket/path", fields="dataModel"
        )

    def test_process_external_location_strips_trailing_slash(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://test-bucket/data/"}

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table"),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_external_location_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://test-bucket/data", fields="dataModel"
        )

    def test_process_external_location_no_cache_entry(self, lineage_source):
        lineage_source.external_location_map = {}

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table"),
            columns=[],
        )

        results = list(lineage_source._process_external_location_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 0

    def test_process_external_location_no_container_found(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://bucket/path"}

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table"),
            columns=[],
        )

        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(lineage_source._process_external_location_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 0


class TestContainerColumnLineage:
    def test_get_data_model_column_fqn(self, lineage_source):
        data_model = ContainerDataModel(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    displayName="id",
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.id"),
                ),
                Column(
                    name=ColumnName(root="name"),
                    displayName="name",
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.name"),
                ),
            ]
        )

        assert lineage_source._get_data_model_column_fqn(data_model, "id") == "service.container.id"
        assert lineage_source._get_data_model_column_fqn(data_model, "name") == "service.container.name"
        assert lineage_source._get_data_model_column_fqn(data_model, "nonexistent") is None
        assert lineage_source._get_data_model_column_fqn(None, "id") is None

    def test_get_container_column_lineage(self, lineage_source):
        data_model = ContainerDataModel(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    displayName="id",
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.id"),
                ),
                Column(
                    name=ColumnName(root="name"),
                    displayName="name",
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.name"),
                ),
            ]
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table"),
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table.id"),
                ),
                Column(
                    name=ColumnName(root="name"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table.name"),
                ),
            ],
        )

        result = lineage_source._get_container_column_lineage(data_model, table_entity)

        assert result is not None
        assert len(result.columnsLineage) == 2
        assert result.source == LineageSource.ExternalTableLineage
        assert result.columnsLineage[0].fromColumns[0].root == "service.container.id"
        assert result.columnsLineage[0].toColumn.root == "service.db.schema.test_table.id"


class TestPathBasedLineage:
    """
    Databricks records a location read through `delta.`abfss://...`` with no table name
    at all, only source_path. Issue #27561.
    """

    @staticmethod
    def _cache_rows(lineage_source, table_rows, column_rows=None):
        call_count = 0

        def mock_execute(query):
            nonlocal call_count
            call_count += 1
            return table_rows if call_count == 1 else (column_rows or [])

        mock_conn = MagicMock()
        mock_conn.execute.side_effect = mock_execute
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)
        lineage_source._cache_lineage()

    def test_path_source_resolves_to_external_table(self, lineage_source):
        """The scenario reported in the issue"""
        raw_path = "abfss://raw@storage.dfs.core.windows.net/external_table"
        lineage_source.path_to_table_map[raw_path] = {"bronze_ns.deltalake_ns.external_table"}

        self._cache_rows(
            lineage_source,
            [table_row(target="bronze_ns.deltalake_ns.managed_table_ns", source_path=raw_path)],
        )

        assert lineage_source.table_lineage_map["bronze_ns.deltalake_ns.managed_table_ns"] == {
            "bronze_ns.deltalake_ns.external_table"
        }
        assert len(lineage_source.path_lineage_map) == 0

    def test_path_source_matches_despite_trailing_slash_and_scheme_alias(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [
                table_row(target="cat.schema.tgt1", source_path="s3://bucket/data/"),
                table_row(target="cat.schema.tgt2", source_path="s3a://bucket/data"),
            ],
        )

        assert lineage_source.table_lineage_map["cat.schema.tgt1"] == {"cat.schema.ext"}
        assert lineage_source.table_lineage_map["cat.schema.tgt2"] == {"cat.schema.ext"}

    def test_path_shared_by_two_external_tables_yields_both_upstreams(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/shared"] = {
            "cat.schema.ext_a",
            "cat.schema.ext_b",
        }

        self._cache_rows(
            lineage_source,
            [table_row(target="cat.schema.tgt", source_path="s3://bucket/shared")],
        )

        assert lineage_source.table_lineage_map["cat.schema.tgt"] == {
            "cat.schema.ext_a",
            "cat.schema.ext_b",
        }

    def test_unresolved_path_is_kept_for_container_lookup(self, lineage_source):
        self._cache_rows(
            lineage_source,
            [table_row(target="cat.schema.tgt", source_path="s3a://bucket/unregistered/")],
        )

        assert len(lineage_source.table_lineage_map) == 0
        assert lineage_source.path_lineage_map["cat.schema.tgt"] == {"s3://bucket/unregistered"}

    def test_target_path_resolves_to_external_table(self, lineage_source):
        """A write addressed by location, e.g. CREATE TABLE ... LOCATION"""
        lineage_source.path_to_table_map["s3://bucket/gold"] = {"cat.schema.gold_ext"}

        self._cache_rows(
            lineage_source,
            [table_row(source="cat.schema.src", target_path="s3://bucket/gold")],
        )

        assert lineage_source.table_lineage_map["cat.schema.gold_ext"] == {"cat.schema.src"}

    def test_path_resolving_back_to_the_target_is_not_a_self_loop(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [table_row(target="cat.schema.ext", source_path="s3://bucket/data")],
        )

        assert len(lineage_source.table_lineage_map) == 0
        assert len(lineage_source.path_lineage_map) == 0

    def test_row_with_neither_name_nor_path_is_ignored(self, lineage_source):
        self._cache_rows(lineage_source, [table_row(target="cat.schema.tgt")])

        assert len(lineage_source.table_lineage_map) == 0
        assert len(lineage_source.path_lineage_map) == 0

    def test_column_lineage_keyed_by_path_resolved_table(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [table_row(target="cat.schema.tgt", source_path="s3://bucket/data")],
            [
                column_row(None, "col_a", "cat.schema.tgt", "col_x", source_path="s3://bucket/data"),
                column_row(None, "col_b", "cat.schema.tgt", "col_y", source_path="s3://bucket/data/"),
            ],
        )

        assert lineage_source.column_lineage_map[("cat.schema.ext", "cat.schema.tgt")] == [
            ("col_a", "col_x"),
            ("col_b", "col_y"),
        ]

    def test_column_pair_reported_by_both_name_and_path_is_not_duplicated(self, lineage_source):
        """Widening the GROUP BY lets one edge arrive twice"""
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [table_row("cat.schema.ext", "cat.schema.tgt")],
            [
                column_row("cat.schema.ext", "col_a", "cat.schema.tgt", "col_x"),
                column_row(None, "col_a", "cat.schema.tgt", "col_x", source_path="s3://bucket/data"),
            ],
        )

        assert lineage_source.column_lineage_map[("cat.schema.ext", "cat.schema.tgt")] == [("col_a", "col_x")]

    def test_cache_external_locations_builds_the_inverse_map(self, lineage_source):
        mock_rows = [
            ExternalRow("cat", "schema", "ext1", "s3://bucket/path1"),
            ExternalRow("cat", "schema", "ext2", "s3a://bucket/path2/"),
            ExternalRow("cat", "schema", "ext3", "s3://bucket/path1"),
            ExternalRow("cat", "schema", "no_path", None),
        ]

        mock_conn = MagicMock()
        mock_conn.execute.return_value = mock_rows
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert lineage_source.path_to_table_map["s3://bucket/path1"] == {
            "cat.schema.ext1",
            "cat.schema.ext3",
        }
        assert lineage_source.path_to_table_map["s3://bucket/path2"] == {"cat.schema.ext2"}
        assert "cat.schema.no_path" not in {
            table for tables in lineage_source.path_to_table_map.values() for table in tables
        }

    def test_process_path_lineage_emits_container_edge(self, lineage_source):
        table_entity = a_table()
        container_entity = a_container()
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3://bucket/unregistered"}
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_path_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        assert results[0].right.edge.fromEntity.id == container_entity.id
        assert results[0].right.edge.fromEntity.type == "container"
        assert results[0].right.edge.toEntity.id == table_entity.id
        assert results[0].right.edge.lineageDetails.source == LineageSource.ExternalTableLineage
        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://bucket/unregistered", fields="dataModel"
        )

    def test_process_path_lineage_falls_back_to_the_de_aliased_scheme(self, lineage_source):
        """A container ingested by the S3 connector is stored as s3://, never s3a://"""
        table_entity = a_table()
        container_entity = a_container()
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3a://bucket/data"}
        lineage_source.metadata.es_search_container_by_path.side_effect = [[], [container_entity]]

        results = list(lineage_source._process_path_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        assert [
            call.kwargs["full_path"] for call in lineage_source.metadata.es_search_container_by_path.call_args_list
        ] == ["s3a://bucket/data", "s3://bucket/data"]

    def test_process_path_lineage_without_a_container_yields_nothing(self, lineage_source):
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"abfss://raw@storage.dfs.core.windows.net/t"}
        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table"))

        assert len(results) == 0

    def test_process_path_lineage_no_paths_for_table(self, lineage_source):
        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table"))

        assert len(results) == 0
        lineage_source.metadata.es_search_container_by_path.assert_not_called()

    def test_external_locations_are_cached_before_lineage(self, lineage_source):
        """
        Resolving a path to the table declared over it reads the location map, so
        filling it after the lineage rows would silently resolve nothing.
        """
        calls = []
        lineage_source._cache_external_locations = lambda: calls.append("locations")
        lineage_source._cache_lineage = lambda: calls.append("lineage")
        lineage_source.metadata.list_all_entities.return_value = []

        list(lineage_source._iter())

        assert calls == ["locations", "lineage"]

    def test_process_path_lineage_carries_container_column_lineage(self, lineage_source):
        table_entity = a_table(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table.id"),
                )
            ]
        )
        container_entity = a_container(
            data_model=ContainerDataModel(
                columns=[
                    Column(
                        name=ColumnName(root="id"),
                        displayName="id",
                        dataType=DataType.INT,
                        fullyQualifiedName=FullyQualifiedEntityName(root="service.container.id"),
                    )
                ]
            )
        )
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3://bucket/data"}
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_path_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        details = results[0].right.edge.lineageDetails
        assert details.source == LineageSource.ExternalTableLineage
        assert len(details.columnsLineage) == 1
        assert details.columnsLineage[0].fromColumns[0].root == "service.container.id"
        assert details.columnsLineage[0].toColumn.root == "service.db.schema.test_table.id"

    def test_process_path_lineage_survives_a_failing_container_lookup(self, lineage_source):
        """One unreachable path must not take the rest of the table's lineage down."""
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3://bucket/boom"}
        lineage_source.metadata.es_search_container_by_path.side_effect = RuntimeError("elasticsearch down")

        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table"))

        assert len(results) == 0

    def test_iter_emits_a_path_resolved_edge_end_to_end(self, lineage_source):
        """
        From system-table rows to an AddLineageRequest, the way the workflow runs
        it: the path source resolves to the external table declared over it.
        """
        raw_path = "abfss://raw@storage.dfs.core.windows.net/external_table"
        external_table = "bronze_ns.deltalake_ns.external_table"
        managed_table = "bronze_ns.deltalake_ns.managed_table_ns"

        def mock_execute(statement):
            sql = str(statement)
            if "information_schema.tables" in sql:
                return [ExternalRow("bronze_ns", "deltalake_ns", "external_table", raw_path)]
            if "table_lineage" in sql:
                return [table_row(target=managed_table, source_path=raw_path)]
            return [column_row(None, "id", managed_table, "id", source_path=raw_path)]

        mock_conn = MagicMock()
        mock_conn.execute.side_effect = mock_execute
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        target_entity = Table(
            id=uuid4(),
            name=EntityName(root="managed_table_ns"),
            fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{managed_table}"),
            database=EntityReference(id=uuid4(), type="database", name="bronze_ns"),
            databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="deltalake_ns"),
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{managed_table}.id"),
                )
            ],
        )
        upstream_entity = Table(
            id=uuid4(),
            name=EntityName(root="external_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{external_table}"),
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{external_table}.id"),
                )
            ],
        )

        database = SimpleNamespace(
            name=SimpleNamespace(root="bronze_ns"),
            fullyQualifiedName=SimpleNamespace(root="svc.bronze_ns"),
        )
        schema = SimpleNamespace(
            name=SimpleNamespace(root="deltalake_ns"),
            fullyQualifiedName=SimpleNamespace(root="svc.bronze_ns.deltalake_ns"),
        )
        lineage_source.metadata.list_all_entities.side_effect = [[database], [schema], [target_entity]]
        lineage_source.metadata.get_by_name.return_value = upstream_entity
        lineage_source.metadata.es_search_container_by_path.return_value = []
        lineage_source.source_config.databaseFilterPattern = None
        lineage_source.source_config.schemaFilterPattern = None
        lineage_source.source_config.tableFilterPattern = None

        results = list(lineage_source._iter())

        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.id == upstream_entity.id
        assert edge.toEntity.id == target_entity.id
        assert edge.lineageDetails.columnsLineage[0].fromColumns[0].root == f"svc.{external_table}.id"
        assert edge.lineageDetails.columnsLineage[0].toColumn.root == f"svc.{managed_table}.id"
