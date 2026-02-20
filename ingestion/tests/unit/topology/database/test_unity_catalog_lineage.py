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
from metadata.ingestion.source.database.unitycatalog.models import (
    DatabricksTable,
    FileInfo,
    LineageEntity,
    LineageTableStreams,
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


@pytest.fixture
def lineage_source():
    with patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    ), patch("metadata.ingestion.ometa.ometa_api.OpenMetadata") as mock_metadata, patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.get_sqlalchemy_connection"
    ) as mock_engine, patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.get_connection"
    ):
        config = WorkflowSource.model_validate(MOCK_CONFIG["source"])
        source = UnitycatalogLineageSource(config, mock_metadata)
        source.engine = mock_engine.return_value
        yield source


class TestCacheLineage:
    def test_cache_table_lineage(self, lineage_source):
        TableRow = namedtuple(
            "TableRow", ["source_table_full_name", "target_table_full_name"]
        )
        mock_rows = [
            TableRow("cat.schema.source1", "cat.schema.target1"),
            TableRow("cat.schema.source2", "cat.schema.target1"),
            TableRow("cat.schema.source1", "cat.schema.target2"),
        ]

        mock_conn = MagicMock()
        mock_conn.execute.return_value = mock_rows
        lineage_source.engine.connect.return_value.__enter__ = Mock(
            return_value=mock_conn
        )
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
        TableRow = namedtuple(
            "TableRow", ["source_table_full_name", "target_table_full_name"]
        )
        ColumnRow = namedtuple(
            "ColumnRow",
            [
                "source_table_full_name",
                "source_column_name",
                "target_table_full_name",
                "target_column_name",
            ],
        )

        call_count = 0

        def mock_execute(query):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [TableRow("cat.schema.src", "cat.schema.tgt")]
            return [
                ColumnRow("cat.schema.src", "col_a", "cat.schema.tgt", "col_x"),
                ColumnRow("cat.schema.src", "col_b", "cat.schema.tgt", "col_y"),
            ]

        mock_conn = MagicMock()
        mock_conn.execute.side_effect = mock_execute
        lineage_source.engine.connect.return_value.__enter__ = Mock(
            return_value=mock_conn
        )
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
        lineage_source.engine.connect.return_value.__enter__ = Mock(
            return_value=mock_conn
        )
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
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.target"
            ),
            columns=[],
        )

        source_table = Table(
            id=uuid4(),
            name=EntityName(root="source"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.source"
            ),
            columns=[],
        )

        lineage_source.metadata.get_by_name.return_value = source_table

        results = list(
            lineage_source._process_table_lineage(target_table, "cat.schema.target")
        )

        assert len(results) == 1
        assert isinstance(results[0], Either)
        assert isinstance(results[0].right, AddLineageRequest)
        assert results[0].right.edge.fromEntity.id == source_table.id
        assert results[0].right.edge.toEntity.id == target_table.id

    def test_process_table_lineage_with_column_lineage(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {
            ("cat.schema.source", "cat.schema.target"): [("col_a", "col_x")]
        }

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.target"
            ),
            columns=[
                Column(
                    name=ColumnName(root="col_x"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="local_unitycatalog.cat.schema.target.col_x"
                    ),
                )
            ],
        )

        source_table = Table(
            id=uuid4(),
            name=EntityName(root="source"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.source"
            ),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="local_unitycatalog.cat.schema.source.col_a"
                    ),
                )
            ],
        )

        lineage_source.metadata.get_by_name.return_value = source_table

        results = list(
            lineage_source._process_table_lineage(target_table, "cat.schema.target")
        )

        assert len(results) == 1
        lineage_details = results[0].right.edge.lineageDetails
        assert lineage_details is not None
        assert len(lineage_details.columnsLineage) == 1
        assert (
            lineage_details.columnsLineage[0].fromColumns[0].root
            == "local_unitycatalog.cat.schema.source.col_a"
        )
        assert (
            lineage_details.columnsLineage[0].toColumn.root
            == "local_unitycatalog.cat.schema.target.col_x"
        )

    def test_process_table_lineage_skips_malformed_names(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"malformed_name"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.target"
            ),
            columns=[],
        )

        results = list(
            lineage_source._process_table_lineage(target_table, "cat.schema.target")
        )

        assert len(results) == 0

    def test_process_table_lineage_skips_missing_entity(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.target"
            ),
            columns=[],
        )

        lineage_source.metadata.get_by_name.return_value = None

        results = list(
            lineage_source._process_table_lineage(target_table, "cat.schema.target")
        )

        assert len(results) == 0


class TestColumnLineageDetails:
    def test_self_loop_prevention(self, lineage_source):
        lineage_source.column_lineage_map = {
            ("cat.schema.src", "cat.schema.tgt"): [("col_a", "col_a")]
        }

        table = Table(
            id=uuid4(),
            name=EntityName(root="tgt"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.tgt"
            ),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="local_unitycatalog.cat.schema.tgt.col_a"
                    ),
                )
            ],
        )

        same_table_as_source = Table(
            id=uuid4(),
            name=EntityName(root="src"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.src"
            ),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="local_unitycatalog.cat.schema.src.col_a"
                    ),
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
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.tgt"
            ),
            columns=[],
        )
        from_table = Table(
            id=uuid4(),
            name=EntityName(root="src"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="local_unitycatalog.cat.schema.src"
            ),
            columns=[],
        )

        result = lineage_source._get_column_lineage_details(
            from_table, table, "cat.schema.src", "cat.schema.tgt"
        )

        assert result is None


class TestExternalLocationLineage:
    def test_cache_external_locations(self, lineage_source):
        ExternalRow = namedtuple(
            "ExternalRow",
            ["table_catalog", "table_schema", "table_name", "storage_path"],
        )
        mock_rows = [
            ExternalRow("cat", "schema", "ext_table1", "s3://bucket/path1"),
            ExternalRow("cat", "schema", "ext_table2", "s3://bucket/path2/"),
        ]

        mock_conn = MagicMock()
        mock_conn.execute.return_value = mock_rows
        lineage_source.engine.connect.return_value.__enter__ = Mock(
            return_value=mock_conn
        )
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 2
        assert (
            lineage_source.external_location_map["cat.schema.ext_table1"]
            == "s3://bucket/path1"
        )
        assert (
            lineage_source.external_location_map["cat.schema.ext_table2"]
            == "s3://bucket/path2/"
        )

    def test_cache_external_locations_handles_failure(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(
            return_value=mock_conn
        )
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 0

    def test_process_external_location_lineage_from_cache(self, lineage_source):
        lineage_source.external_location_map = {
            "cat.schema.test_table": "s3://bucket/path"
        }

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="service.db.schema.test_table"
            ),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        lineage_source.metadata.es_search_container_by_path.return_value = [
            container_entity
        ]

        results = list(
            lineage_source._process_external_location_lineage(
                table_entity, "cat.schema.test_table"
            )
        )

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
        lineage_source.external_location_map = {
            "cat.schema.test_table": "s3://test-bucket/data/"
        }

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="service.db.schema.test_table"
            ),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        lineage_source.metadata.es_search_container_by_path.return_value = [
            container_entity
        ]

        results = list(
            lineage_source._process_external_location_lineage(
                table_entity, "cat.schema.test_table"
            )
        )

        assert len(results) == 1
        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://test-bucket/data", fields="dataModel"
        )

    def test_process_external_location_no_cache_entry(self, lineage_source):
        lineage_source.external_location_map = {}

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="service.db.schema.test_table"
            ),
            columns=[],
        )

        results = list(
            lineage_source._process_external_location_lineage(
                table_entity, "cat.schema.test_table"
            )
        )

        assert len(results) == 0

    def test_process_external_location_no_container_found(self, lineage_source):
        lineage_source.external_location_map = {
            "cat.schema.test_table": "s3://bucket/path"
        }

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="service.db.schema.test_table"
            ),
            columns=[],
        )

        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(
            lineage_source._process_external_location_lineage(
                table_entity, "cat.schema.test_table"
            )
        )

        assert len(results) == 0


class TestContainerColumnLineage:
    def test_get_data_model_column_fqn(self, lineage_source):
        data_model = ContainerDataModel(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    displayName="id",
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="service.container.id"
                    ),
                ),
                Column(
                    name=ColumnName(root="name"),
                    displayName="name",
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="service.container.name"
                    ),
                ),
            ]
        )

        assert (
            lineage_source._get_data_model_column_fqn(data_model, "id")
            == "service.container.id"
        )
        assert (
            lineage_source._get_data_model_column_fqn(data_model, "name")
            == "service.container.name"
        )
        assert (
            lineage_source._get_data_model_column_fqn(data_model, "nonexistent") is None
        )
        assert lineage_source._get_data_model_column_fqn(None, "id") is None

    def test_get_container_column_lineage(self, lineage_source):
        data_model = ContainerDataModel(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    displayName="id",
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="service.container.id"
                    ),
                ),
                Column(
                    name=ColumnName(root="name"),
                    displayName="name",
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="service.container.name"
                    ),
                ),
            ]
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="service.db.schema.test_table"
            ),
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="service.db.schema.test_table.id"
                    ),
                ),
                Column(
                    name=ColumnName(root="name"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        root="service.db.schema.test_table.name"
                    ),
                ),
            ],
        )

        result = lineage_source._get_container_column_lineage(data_model, table_entity)

        assert result is not None
        assert len(result.columnsLineage) == 2
        assert result.source == LineageSource.ExternalTableLineage
        assert result.columnsLineage[0].fromColumns[0].root == "service.container.id"
        assert (
            result.columnsLineage[0].toColumn.root == "service.db.schema.test_table.id"
        )


class TestLineageTableStreamsModel:
    def test_with_table_info(self):
        upstream_table = DatabricksTable(
            name="source_table",
            catalog_name="demo-test-cat",
            schema_name="test-schema",
            table_type="TABLE",
            lineage_timestamp="2025-10-08 11:16:26.0",
        )

        lineage_streams = LineageTableStreams(
            upstreams=[LineageEntity(tableInfo=upstream_table)],
            downstreams=[],
        )

        assert len(lineage_streams.upstreams) == 1
        assert lineage_streams.upstreams[0].tableInfo.name == "source_table"
        assert lineage_streams.upstreams[0].fileInfo is None

    def test_with_file_info(self):
        file_info = FileInfo(
            path="s3://bucket/path/file.parquet",
            has_permission=True,
            securable_name="test_location",
            storage_location="s3://bucket/path",
            securable_type="EXTERNAL_LOCATION",
        )

        lineage_streams = LineageTableStreams(
            upstreams=[LineageEntity(fileInfo=file_info)], downstreams=[]
        )

        assert len(lineage_streams.upstreams) == 1
        assert (
            lineage_streams.upstreams[0].fileInfo.path
            == "s3://bucket/path/file.parquet"
        )
        assert lineage_streams.upstreams[0].tableInfo is None

    def test_mixed(self):
        table_info = DatabricksTable(
            name="table1",
            catalog_name="demo-test-cat",
            schema_name="test-schema",
            table_type="TABLE",
        )

        file_info = FileInfo(
            path="s3://bucket/path/file.parquet",
            storage_location="s3://bucket/path",
            securable_type="EXTERNAL_LOCATION",
        )

        lineage_streams = LineageTableStreams(
            upstreams=[
                LineageEntity(tableInfo=table_info),
                LineageEntity(fileInfo=file_info),
            ],
            downstreams=[],
        )

        assert len(lineage_streams.upstreams) == 2
        assert lineage_streams.upstreams[0].tableInfo is not None
        assert lineage_streams.upstreams[0].fileInfo is None
        assert lineage_streams.upstreams[1].tableInfo is None
        assert lineage_streams.upstreams[1].fileInfo is not None
