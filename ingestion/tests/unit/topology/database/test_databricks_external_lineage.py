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
Test Databricks external table lineage functionality
"""
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.databricks.metadata import DatabricksSource

mock_databricks_config = {
    "source": {
        "type": "databricks",
        "serviceName": "test_databricks",
        "serviceConnection": {
            "config": {
                "type": "Databricks",
                "catalog": "main",
                "authType": {
                    "token": "test_token",
                },
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/test",
                "enableExternalLocationLineage": True,
                "enableSystemTableLineage": True,
                "enableExternalMetadataEnrichment": True,
                "externalLineageLookbackDays": 90,
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
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

MOCK_DATABASE_SERVICE = DatabaseService(
    id=Uuid("85811038-099a-11ed-861d-0242ac120002"),
    name=EntityName("test_databricks"),
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Databricks,
)

MOCK_CONTAINER_WITH_DATAMODEL = Container(
    id=Uuid("c1a11111-1111-1111-1111-111111111111"),
    name=EntityName("clientstate_raw"),
    fullyQualifiedName=FullyQualifiedEntityName(
        "s3_storage.earnin-dev-us-west-2-clientstate.clientstate_raw"
    ),
    service=EntityReference(
        id=Uuid("a1a11111-1111-1111-1111-111111111111"), type="storageService"
    ),
    fullPath="s3://earnin-dev-us-west-2-clientstate/json/clientstate_raw",
    dataModel=ContainerDataModel(
        isPartitioned=False,
        columns=[
            Column(
                name="userid",
                displayName="userid",
                dataType=DataType.INT,
                fullyQualifiedName=FullyQualifiedEntityName(
                    "s3_storage.earnin-dev-us-west-2-clientstate.clientstate_raw.userid"
                ),
            ),
            Column(
                name="timestamp",
                displayName="timestamp",
                dataType=DataType.TIMESTAMP,
                fullyQualifiedName=FullyQualifiedEntityName(
                    "s3_storage.earnin-dev-us-west-2-clientstate.clientstate_raw.timestamp"
                ),
            ),
            Column(
                name="appversion",
                displayName="appversion",
                dataType=DataType.STRING,
                fullyQualifiedName=FullyQualifiedEntityName(
                    "s3_storage.earnin-dev-us-west-2-clientstate.clientstate_raw.appversion"
                ),
            ),
        ],
    ),
)

MOCK_CONTAINER_WITHOUT_DATAMODEL = Container(
    id=Uuid("c2a22222-2222-2222-2222-222222222222"),
    name=EntityName("clientstate_raw"),
    fullyQualifiedName=FullyQualifiedEntityName(
        "s3_storage.earnin-dev-us-west-2-clientstate.clientstate_raw"
    ),
    service=EntityReference(
        id=Uuid("a1a11111-1111-1111-1111-111111111111"), type="storageService"
    ),
    fullPath="s3://earnin-dev-us-west-2-clientstate/json/clientstate_raw",
    dataModel=None,
)

MOCK_TABLE = Table(
    id=Uuid("a1b11111-1111-1111-1111-111111111111"),
    name=EntityName("full_locations"),
    fullyQualifiedName=FullyQualifiedEntityName(
        "test_databricks.main.dev.full_locations"
    ),
    columns=[
        Column(
            name="userid",
            dataType=DataType.INT,
            fullyQualifiedName=FullyQualifiedEntityName(
                "test_databricks.main.dev.full_locations.userid"
            ),
        ),
        Column(
            name="timestamp",
            dataType=DataType.TIMESTAMP,
            fullyQualifiedName=FullyQualifiedEntityName(
                "test_databricks.main.dev.full_locations.timestamp"
            ),
        ),
        Column(
            name="appversion",
            dataType=DataType.STRING,
            fullyQualifiedName=FullyQualifiedEntityName(
                "test_databricks.main.dev.full_locations.appversion"
            ),
        ),
    ],
    service=EntityReference(
        id=Uuid("85811038-099a-11ed-861d-0242ac120002"), type="databaseService"
    ),
)


class TestDatabricksExternalLineage(TestCase):
    """Test external table lineage for Databricks"""

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    @patch(
        "metadata.ingestion.source.database.databricks.metadata.DatabricksSource._init_version"
    )
    def setUp(self, mock_init_version, mock_test_connection):
        """Set up test fixtures"""
        mock_test_connection.return_value = False
        mock_init_version.return_value = None

        self.config = OpenMetadataWorkflowConfig.model_validate(mock_databricks_config)
        self.databricks_source = DatabricksSource.create(
            mock_databricks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.databricks_source.context.get().__dict__["database"] = "main"
        self.databricks_source.context.get().__dict__[
            "database_service"
        ] = "test_databricks"
        self.databricks_source.context.get().__dict__["database_schema"] = "dev"

    def test_external_location_extraction_dbfs_filtered(self):
        """Test DBFS paths are filtered out"""
        schema_name = "dev"
        table_name = "dbfs_table"

        class MockRow:
            def __init__(self, col_name, data_type):
                self.col_name = col_name
                self.data_type = data_type

            def values(self):
                return [self.col_name, self.data_type]

        mock_cursor = [
            MockRow("id", "int"),
            MockRow("Location", "dbfs:/user/hive/warehouse/table"),
        ]

        mock_inspector = Mock()
        mock_inspector.dialect.get_table_comment_result = Mock(return_value=mock_cursor)

        self.databricks_source.get_table_description(
            schema_name=schema_name,
            table_name=table_name,
            inspector=mock_inspector,
        )

        actual_location = self.databricks_source.external_location_map.get(
            ("main", schema_name, table_name)
        )

        self.assertIsNone(actual_location)

    def test_external_location_extraction_empty_location(self):
        """Test empty location is handled"""
        schema_name = "dev"
        table_name = "empty_location"

        class MockRow:
            def __init__(self, col_name, data_type):
                self.col_name = col_name
                self.data_type = data_type

            def values(self):
                return [self.col_name, self.data_type]

        mock_cursor = [
            MockRow("id", "int"),
            MockRow("Location", None),
        ]

        mock_inspector = Mock()
        mock_inspector.dialect.get_table_comment_result = Mock(return_value=mock_cursor)

        self.databricks_source.get_table_description(
            schema_name=schema_name,
            table_name=table_name,
            inspector=mock_inspector,
        )

        actual_location = self.databricks_source.external_location_map.get(
            ("main", schema_name, table_name)
        )

        self.assertIsNone(actual_location)

    def test_yield_external_table_lineage_success_with_datamodel(self):
        """Test lineage creation when container exists with dataModel"""
        self.databricks_source.external_location_map = {
            (
                "main",
                "dev",
                "full_locations",
            ): "s3://earnin-dev-us-west-2-clientstate/json/clientstate_raw"
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITH_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(1, len(lineage_requests))
        lineage = lineage_requests[0].right
        self.assertIsInstance(lineage, AddLineageRequest)

        self.assertEqual(MOCK_CONTAINER_WITH_DATAMODEL.id, lineage.edge.fromEntity.id)
        self.assertEqual("container", lineage.edge.fromEntity.type)
        self.assertEqual(MOCK_TABLE.id, lineage.edge.toEntity.id)
        self.assertEqual("table", lineage.edge.toEntity.type)

        self.assertIsNotNone(lineage.edge.lineageDetails.columnsLineage)
        self.assertEqual(3, len(lineage.edge.lineageDetails.columnsLineage))

        column_lineage = lineage.edge.lineageDetails.columnsLineage
        self.assertEqual(
            [
                FullyQualifiedEntityName(
                    "s3_storage.earnin-dev-us-west-2-clientstate.clientstate_raw.userid"
                )
            ],
            column_lineage[0].fromColumns,
        )
        self.assertEqual(
            FullyQualifiedEntityName("test_databricks.main.dev.full_locations.userid"),
            column_lineage[0].toColumn,
        )

    def test_yield_external_table_lineage_success_without_datamodel(self):
        """Test lineage creation when container exists without dataModel"""
        self.databricks_source.external_location_map = {
            (
                "main",
                "dev",
                "full_locations",
            ): "s3://earnin-dev-us-west-2-clientstate/json/clientstate_raw"
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITHOUT_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(1, len(lineage_requests))
        lineage = lineage_requests[0].right
        self.assertIsInstance(lineage, AddLineageRequest)

        self.assertEqual(
            MOCK_CONTAINER_WITHOUT_DATAMODEL.id, lineage.edge.fromEntity.id
        )
        self.assertEqual(MOCK_TABLE.id, lineage.edge.toEntity.id)

        self.assertEqual([], lineage.edge.lineageDetails.columnsLineage)

    def test_yield_external_table_lineage_no_container_found(self):
        """Test when container is not found"""
        self.databricks_source.external_location_map = {
            ("main", "dev", "full_locations"): "s3://bucket/path/not/found"
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(return_value=None)
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(0, len(lineage_requests))

    def test_yield_external_table_lineage_empty_container_list(self):
        """Test when container search returns empty list"""
        self.databricks_source.external_location_map = {
            ("main", "dev", "full_locations"): "s3://bucket/path/empty"
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(return_value=[])
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(0, len(lineage_requests))

    def test_yield_external_table_lineage_no_table_found(self):
        """Test when table entity is not found in ES"""
        self.databricks_source.external_location_map = {
            (
                "main",
                "dev",
                "missing_table",
            ): "s3://earnin-dev-us-west-2-clientstate/json/clientstate_raw"
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITH_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=None)
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(0, len(lineage_requests))

    def test_yield_external_table_lineage_empty_table_list(self):
        """Test when table search returns empty list"""
        self.databricks_source.external_location_map = {
            (
                "main",
                "dev",
                "full_locations",
            ): "s3://earnin-dev-us-west-2-clientstate/json/clientstate_raw"
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITH_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=[])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(0, len(lineage_requests))

    def test_yield_external_table_lineage_multiple_tables(self):
        """Test lineage creation for multiple tables"""
        self.databricks_source.external_location_map = {
            ("main", "dev", "table1"): "s3://bucket/path1",
            ("main", "dev", "table2"): "s3://bucket/path2",
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITH_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(2, len(lineage_requests))

    def test_yield_external_table_lineage_partial_column_match(self):
        """Test column lineage when only some columns match"""
        table_with_extra_columns = Table(
            id=Uuid("a2b22222-2222-2222-2222-222222222222"),
            name=EntityName("full_locations"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "test_databricks.main.dev.full_locations"
            ),
            columns=[
                Column(
                    name="userid",
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        "test_databricks.main.dev.full_locations.userid"
                    ),
                ),
                Column(
                    name="timestamp",
                    dataType=DataType.TIMESTAMP,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        "test_databricks.main.dev.full_locations.timestamp"
                    ),
                ),
                Column(
                    name="new_column",
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        "test_databricks.main.dev.full_locations.new_column"
                    ),
                ),
            ],
            service=EntityReference(
                id=Uuid("85811038-099a-11ed-861d-0242ac120002"),
                type="databaseService",
            ),
        )

        self.databricks_source.external_location_map = {
            (
                "main",
                "dev",
                "full_locations",
            ): "s3://earnin-dev-us-west-2-clientstate/json/clientstate_raw"
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITH_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=[table_with_extra_columns])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(1, len(lineage_requests))
        lineage = lineage_requests[0].right

        self.assertEqual(2, len(lineage.edge.lineageDetails.columnsLineage))

    def test_get_location_path(self):
        """Test get_location_path method"""
        self.databricks_source.external_location_map = {
            ("main", "dev", "table1"): "s3://bucket/path1"
        }

        location = self.databricks_source.get_location_path(
            table_name="table1", schema_name="dev"
        )
        self.assertEqual("s3://bucket/path1", location)

        location = self.databricks_source.get_location_path(
            table_name="nonexistent", schema_name="dev"
        )
        self.assertIsNone(location)

    def test_yield_external_table_lineage_empty_map(self):
        """Test when external_location_map is empty"""
        self.databricks_source.external_location_map = {}

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(0, len(lineage_requests))

    def test_normalize_storage_path(self):
        """Test path normalization"""
        from metadata.ingestion.source.database.databricks.metadata import (
            normalize_storage_path,
        )

        self.assertEqual(
            "s3://bucket/path", normalize_storage_path("s3://bucket/path/")
        )
        self.assertEqual(
            "s3://bucket/path", normalize_storage_path("s3://bucket/path///")
        )
        self.assertEqual("s3://bucket/path", normalize_storage_path("s3://bucket/path"))
        self.assertIsNone(normalize_storage_path(""))
        self.assertIsNone(normalize_storage_path(None))

    def test_get_base_path_from_partitioned_path(self):
        """Test extraction of base path from partitioned paths"""
        from metadata.ingestion.source.database.databricks.metadata import (
            get_base_path_from_partitioned_path,
        )

        self.assertEqual(
            "s3://bucket/data",
            get_base_path_from_partitioned_path("s3://bucket/data/year=2025/month=10/"),
        )
        self.assertEqual(
            "s3://bucket/data",
            get_base_path_from_partitioned_path("s3://bucket/data/dt=2025-10-07/"),
        )
        self.assertEqual(
            "abfss://container@account.dfs.core.windows.net/data",
            get_base_path_from_partitioned_path(
                "abfss://container@account.dfs.core.windows.net/data/year=2025/"
            ),
        )
        self.assertIsNone(
            get_base_path_from_partitioned_path("s3://bucket/data/no/partitions/")
        )
        self.assertIsNone(get_base_path_from_partitioned_path(""))
        self.assertIsNone(get_base_path_from_partitioned_path(None))

    def test_yield_external_table_lineage_partitioned_path_fallback(self):
        """Test lineage creation with partitioned path fallback"""
        self.databricks_source.external_location_map = {
            ("main", "dev", "partitioned_table"): "s3://bucket/data/year=2025/month=10/"
        }

        mock_metadata = Mock()

        def mock_search_by_path(full_path, fields=None):
            if full_path == "s3://bucket/data/year=2025/month=10":
                return []
            elif full_path == "s3://bucket/data":
                return [MOCK_CONTAINER_WITH_DATAMODEL]
            return []

        mock_metadata.es_search_container_by_path = mock_search_by_path
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(1, len(lineage_requests))
        lineage = lineage_requests[0].right
        self.assertIsNotNone(lineage.edge.lineageDetails.columnsLineage)

    def test_populate_external_location_lineage_cache(self):
        """Test populating external location lineage cache from system tables"""
        from unittest.mock import MagicMock, PropertyMock

        mock_result = [
            MagicMock(
                source_type="PATH",
                source_path="s3://bucket/data/",
                target_table_catalog="main",
                target_table_schema="dev",
                target_table_name="table1",
            ),
            MagicMock(
                source_type="PATH",
                source_path="dbfs:/internal/path",
                target_table_catalog="main",
                target_table_schema="dev",
                target_table_name="table2",
            ),
        ]

        mock_connection = Mock()
        mock_connection.execute = Mock(return_value=mock_result)

        with patch.object(
            type(self.databricks_source), "connection", new_callable=PropertyMock
        ) as mock_conn_prop:
            mock_conn_prop.return_value = mock_connection

            self.databricks_source.populate_external_location_lineage_cache(
                catalog_name="main"
            )

            self.assertEqual(
                1, len(self.databricks_source.external_location_lineage_map)
            )
            self.assertEqual(
                "s3://bucket/data",
                self.databricks_source.external_location_lineage_map[
                    ("main", "dev", "table1")
                ],
            )

    def test_populate_external_locations_metadata(self):
        """Test populating external locations metadata from information schema"""
        from unittest.mock import MagicMock, PropertyMock

        mock_result = [
            MagicMock(
                external_location_name="s3_location",
                url="s3://bucket/data/",
                storage_credential_name="s3_cred",
                external_location_owner="admin",
                comment="Test location",
            )
        ]

        mock_connection = Mock()
        mock_connection.execute = Mock(return_value=mock_result)

        with patch.object(
            type(self.databricks_source), "connection", new_callable=PropertyMock
        ) as mock_conn_prop:
            mock_conn_prop.return_value = mock_connection

            self.databricks_source.populate_external_locations_metadata()

            self.assertEqual(1, len(self.databricks_source.external_locations_metadata))
            metadata = self.databricks_source.external_locations_metadata[
                "s3://bucket/data"
            ]
            self.assertEqual("s3_location", metadata["name"])
            self.assertEqual("admin", metadata["owner"])
            self.assertEqual("s3_cred", metadata["credential"])

    def test_yield_external_table_lineage_merged_sources(self):
        """Test lineage creation with merged sources (system tables + DESCRIBE TABLE)"""
        self.databricks_source.external_location_map = {
            ("main", "dev", "table1"): "s3://bucket/path1"
        }
        self.databricks_source.external_location_lineage_map = {
            ("main", "dev", "table2"): "s3://bucket/path2",
            ("main", "dev", "table1"): "s3://bucket/path1",
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITH_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(2, len(lineage_requests))

    def test_yield_external_table_lineage_with_metadata_enrichment(self):
        """Test lineage creation with external location metadata enrichment"""
        self.databricks_source.external_location_map = {
            ("main", "dev", "table1"): "s3://bucket/path"
        }
        self.databricks_source.external_locations_metadata = {
            "s3://bucket/path": {
                "name": "s3_location",
                "url": "s3://bucket/path",
                "credential": "s3_cred",
                "owner": "admin",
                "comment": "Test",
            }
        }

        mock_metadata = Mock()
        mock_metadata.es_search_container_by_path = Mock(
            return_value=[MOCK_CONTAINER_WITH_DATAMODEL]
        )
        mock_metadata.es_search_from_fqn = Mock(return_value=[MOCK_TABLE])
        self.databricks_source.metadata = mock_metadata

        lineage_requests = list(self.databricks_source.yield_external_table_lineage())

        self.assertEqual(1, len(lineage_requests))
