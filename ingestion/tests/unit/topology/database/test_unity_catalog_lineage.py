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

from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

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

mock_unitycatalog_lineage_config = {
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


class TestUnityCatalogLineage(TestCase):
    """
    Unity Catalog lineage unit tests
    """

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def setUp(self, mock_metadata, mock_test_connection):
        mock_test_connection.return_value = None
        self.mock_metadata = mock_metadata
        self.config = WorkflowSource.model_validate(
            mock_unitycatalog_lineage_config["source"]
        )
        self.lineage_source = UnitycatalogLineageSource(self.config, self.mock_metadata)

    def test_lineage_table_streams_with_table_info(self):
        """Test LineageTableStreams model with tableInfo"""
        upstream_table = DatabricksTable(
            name="source_table",
            catalog_name="demo-test-cat",
            schema_name="test-schema",
            table_type="TABLE",
            lineage_timestamp="2025-10-08 11:16:26.0",
        )

        downstream_table = DatabricksTable(
            name="target_table",
            catalog_name="demo-test-cat",
            schema_name="test-schema",
            table_type="TABLE",
            lineage_timestamp="2025-10-08 11:16:26.0",
        )

        lineage_streams = LineageTableStreams(
            upstreams=[LineageEntity(tableInfo=upstream_table)],
            downstreams=[LineageEntity(tableInfo=downstream_table)],
        )

        self.assertEqual(len(lineage_streams.upstreams), 1)
        self.assertEqual(len(lineage_streams.downstreams), 1)
        self.assertEqual(lineage_streams.upstreams[0].tableInfo.name, "source_table")
        self.assertEqual(lineage_streams.downstreams[0].tableInfo.name, "target_table")
        self.assertIsNone(lineage_streams.upstreams[0].fileInfo)
        self.assertIsNone(lineage_streams.downstreams[0].fileInfo)

    def test_lineage_table_streams_with_file_info(self):
        """Test LineageTableStreams model with fileInfo"""
        file_info = FileInfo(
            path="s3://bucket/path/file.parquet",
            has_permission=True,
            securable_name="test_location",
            storage_location="s3://bucket/path",
            securable_type="EXTERNAL_LOCATION",
            lineage_timestamp="2025-10-08 10:37:42.0",
        )

        lineage_streams = LineageTableStreams(
            upstreams=[LineageEntity(fileInfo=file_info)], downstreams=[]
        )

        self.assertEqual(len(lineage_streams.upstreams), 1)
        self.assertEqual(
            lineage_streams.upstreams[0].fileInfo.path, "s3://bucket/path/file.parquet"
        )
        self.assertEqual(
            lineage_streams.upstreams[0].fileInfo.storage_location, "s3://bucket/path"
        )
        self.assertIsNone(lineage_streams.upstreams[0].tableInfo)

    def test_lineage_table_streams_mixed(self):
        """Test LineageTableStreams with both tableInfo and fileInfo"""
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

        self.assertEqual(len(lineage_streams.upstreams), 2)
        self.assertIsNotNone(lineage_streams.upstreams[0].tableInfo)
        self.assertIsNone(lineage_streams.upstreams[0].fileInfo)
        self.assertIsNone(lineage_streams.upstreams[1].tableInfo)
        self.assertIsNotNone(lineage_streams.upstreams[1].fileInfo)

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_get_data_model_column_fqn(self, mock_metadata, mock_test_connection):
        """Test _get_data_model_column_fqn method"""
        mock_test_connection.return_value = None

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

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        result = lineage_source._get_data_model_column_fqn(data_model, "id")
        self.assertEqual(result, "service.container.id")

        result = lineage_source._get_data_model_column_fqn(data_model, "name")
        self.assertEqual(result, "service.container.name")

        result = lineage_source._get_data_model_column_fqn(data_model, "nonexistent")
        self.assertIsNone(result)

        result = lineage_source._get_data_model_column_fqn(None, "id")
        self.assertIsNone(result)

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_get_container_column_lineage(self, mock_metadata, mock_test_connection):
        """Test _get_container_column_lineage method"""
        mock_test_connection.return_value = None

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

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        result = lineage_source._get_container_column_lineage(data_model, table_entity)

        self.assertIsNotNone(result)
        self.assertEqual(len(result.columnsLineage), 2)
        self.assertEqual(result.source, LineageSource.ExternalTableLineage)
        self.assertEqual(
            result.columnsLineage[0].fromColumns[0].root, "service.container.id"
        )
        self.assertEqual(
            result.columnsLineage[0].toColumn.root, "service.db.schema.test_table.id"
        )
        self.assertEqual(
            result.columnsLineage[1].fromColumns[0].root, "service.container.name"
        )
        self.assertEqual(
            result.columnsLineage[1].toColumn.root, "service.db.schema.test_table.name"
        )

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_handle_external_location_lineage_upstream(
        self, mock_metadata, mock_test_connection
    ):
        """Test _handle_external_location_lineage for upstream"""
        mock_test_connection.return_value = None

        file_info = FileInfo(
            path="s3://bucket/path/file.parquet",
            storage_location="s3://bucket/path",
            securable_type="EXTERNAL_LOCATION",
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        mock_metadata.es_search_container_by_path.return_value = [container_entity]

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        results = list(
            lineage_source._handle_external_location_lineage(
                file_info, table_entity, is_upstream=True
            )
        )

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)
        self.assertIsInstance(results[0].right, AddLineageRequest)
        self.assertEqual(results[0].right.edge.fromEntity.id, container_entity.id)
        self.assertEqual(results[0].right.edge.fromEntity.type, "container")
        self.assertEqual(results[0].right.edge.toEntity.id, table_entity.id)
        self.assertEqual(results[0].right.edge.toEntity.type, "table")

        mock_metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://bucket/path", fields="dataModel"
        )

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_handle_external_location_lineage_with_trailing_slash(
        self, mock_metadata, mock_test_connection
    ):
        """Test _handle_external_location_lineage strips trailing slash from storage location"""
        mock_test_connection.return_value = None

        file_info = FileInfo(
            path="s3://test-bucket/data/file.parquet",
            storage_location="s3://test-bucket/data/",
            securable_type="EXTERNAL_LOCATION",
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        mock_metadata.es_search_container_by_path.return_value = [container_entity]

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        results = list(
            lineage_source._handle_external_location_lineage(
                file_info, table_entity, is_upstream=True
            )
        )

        self.assertEqual(len(results), 1)
        mock_metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://test-bucket/data", fields="dataModel"
        )

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_handle_external_location_lineage_without_trailing_slash(
        self, mock_metadata, mock_test_connection
    ):
        """Test _handle_external_location_lineage handles path without trailing slash"""
        mock_test_connection.return_value = None

        file_info = FileInfo(
            path="s3://test-bucket/data/file.parquet",
            storage_location="s3://test-bucket/data",
            securable_type="EXTERNAL_LOCATION",
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        mock_metadata.es_search_container_by_path.return_value = [container_entity]

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        results = list(
            lineage_source._handle_external_location_lineage(
                file_info, table_entity, is_upstream=True
            )
        )

        self.assertEqual(len(results), 1)
        mock_metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://test-bucket/data", fields="dataModel"
        )

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_handle_external_location_lineage_downstream(
        self, mock_metadata, mock_test_connection
    ):
        """Test _handle_external_location_lineage for downstream"""
        mock_test_connection.return_value = None

        file_info = FileInfo(
            path="s3://bucket/path/file.parquet",
            storage_location="s3://bucket/path",
            securable_type="EXTERNAL_LOCATION",
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        mock_metadata.es_search_container_by_path.return_value = [container_entity]

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        results = list(
            lineage_source._handle_external_location_lineage(
                file_info, table_entity, is_upstream=False
            )
        )

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)
        self.assertIsInstance(results[0].right, AddLineageRequest)
        self.assertEqual(results[0].right.edge.fromEntity.id, table_entity.id)
        self.assertEqual(results[0].right.edge.fromEntity.type, "table")
        self.assertEqual(results[0].right.edge.toEntity.id, container_entity.id)
        self.assertEqual(results[0].right.edge.toEntity.type, "container")

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_handle_external_location_lineage_no_container(
        self, mock_metadata, mock_test_connection
    ):
        """Test _handle_external_location_lineage when container is not found"""
        mock_test_connection.return_value = None

        file_info = FileInfo(
            path="s3://bucket/path/file.parquet",
            storage_location="s3://bucket/path",
            securable_type="EXTERNAL_LOCATION",
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            columns=[],
        )

        mock_metadata.es_search_container_by_path.return_value = []

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        results = list(
            lineage_source._handle_external_location_lineage(
                file_info, table_entity, is_upstream=True
            )
        )

        self.assertEqual(len(results), 0)

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_handle_upstream_table_with_table_info(
        self, mock_metadata, mock_test_connection
    ):
        """Test _handle_upstream_table with tableInfo"""
        mock_test_connection.return_value = None

        upstream_table_info = DatabricksTable(
            name="source_table",
            catalog_name="demo-test-cat",
            schema_name="test-schema",
            table_type="TABLE",
        )

        table_streams = LineageTableStreams(
            upstreams=[LineageEntity(tableInfo=upstream_table_info)], downstreams=[]
        )

        current_table = Table(
            id=uuid4(),
            name=EntityName(root="current_table"),
            columns=[],
        )

        upstream_table = Table(
            id=uuid4(),
            name=EntityName(root="source_table"),
            columns=[],
        )

        mock_metadata.get_by_name.return_value = upstream_table

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)
        lineage_source.client = Mock()
        lineage_source.client.get_column_lineage.return_value = Mock(upstream_cols=[])

        results = list(
            lineage_source._handle_upstream_table(
                table_streams, current_table, "demo-test-cat.test-schema.current_table"
            )
        )

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)
        self.assertEqual(results[0].right.edge.fromEntity.id, upstream_table.id)
        self.assertEqual(results[0].right.edge.toEntity.id, current_table.id)

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def test_handle_upstream_table_with_file_info(
        self, mock_metadata, mock_test_connection
    ):
        """Test _handle_upstream_table with fileInfo"""
        mock_test_connection.return_value = None

        file_info = FileInfo(
            path="s3://bucket/path/file.parquet",
            storage_location="s3://bucket/path",
            securable_type="EXTERNAL_LOCATION",
        )

        table_streams = LineageTableStreams(
            upstreams=[LineageEntity(fileInfo=file_info)], downstreams=[]
        )

        current_table = Table(
            id=uuid4(),
            name=EntityName(root="current_table"),
            columns=[],
        )

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        mock_metadata.es_search_container_by_path.return_value = [container_entity]

        lineage_source = UnitycatalogLineageSource(self.config, mock_metadata)

        results = list(
            lineage_source._handle_upstream_table(
                table_streams, current_table, "demo-test-cat.test-schema.current_table"
            )
        )

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)
        self.assertEqual(results[0].right.edge.fromEntity.id, container_entity.id)
        self.assertEqual(results[0].right.edge.toEntity.id, current_table.id)
