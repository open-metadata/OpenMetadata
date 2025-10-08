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
Unity Catalog lineage unit tests
"""

from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
)
from metadata.ingestion.source.database.unitycatalog.models import (
    DatabricksTable,
    LineageTableStreams,
)

mock_unitycatalog_lineage_config = {
    "source": {
        "type": "unitycatalog-lineage",
        "serviceName": "local_unitycatalog",
        "serviceConnection": {
            "config": {
                "type": "UnityCatalog",
                "catalog": "main_dev",
                "databaseSchema": "default",
                "authType": {"token": "test_token"},
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/test",
                "connectionTimeout": 120,
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

MOCK_DATABASE_SERVICE = DatabaseService(
    id=uuid4(),
    name=EntityName("local_unitycatalog"),
    serviceType=DatabaseServiceType.UnityCatalog,
)

MOCK_DATABASE = Database(
    id=uuid4(),
    name=EntityName("main_dev"),
    fullyQualifiedName=FullyQualifiedEntityName("local_unitycatalog.main_dev"),
    service=EntityReference(id=MOCK_DATABASE_SERVICE.id, type="databaseService"),
)

MOCK_SCHEMA_RAW = DatabaseSchema(
    id=uuid4(),
    name=EntityName("clientstate_raw"),
    fullyQualifiedName=FullyQualifiedEntityName(
        "local_unitycatalog.main_dev.clientstate_raw"
    ),
    service=EntityReference(id=MOCK_DATABASE_SERVICE.id, type="databaseService"),
    database=EntityReference(id=MOCK_DATABASE.id, type="database"),
)

MOCK_SCHEMA_PROCESSED = DatabaseSchema(
    id=uuid4(),
    name=EntityName("clientstate"),
    fullyQualifiedName=FullyQualifiedEntityName(
        "local_unitycatalog.main_dev.clientstate"
    ),
    service=EntityReference(id=MOCK_DATABASE_SERVICE.id, type="databaseService"),
    database=EntityReference(id=MOCK_DATABASE.id, type="database"),
)

MOCK_TABLE_RAW = Table(
    id=uuid4(),
    name=EntityName("full_locations"),
    fullyQualifiedName=FullyQualifiedEntityName(
        "local_unitycatalog.main_dev.clientstate_raw.full_locations"
    ),
    columns=[
        Column(
            name="id",
            dataType=DataType.INT,
        ),
        Column(
            name="location",
            dataType=DataType.STRING,
        ),
    ],
    database=EntityReference(id=MOCK_DATABASE.id, name="main_dev", type="database"),
    databaseSchema=EntityReference(
        id=MOCK_SCHEMA_RAW.id, name="clientstate_raw", type="databaseSchema"
    ),
)

MOCK_TABLE_PROCESSED = Table(
    id=uuid4(),
    name=EntityName("full_locations"),
    fullyQualifiedName=FullyQualifiedEntityName(
        "local_unitycatalog.main_dev.clientstate.full_locations"
    ),
    columns=[
        Column(
            name="id",
            dataType=DataType.INT,
        ),
        Column(
            name="location",
            dataType=DataType.STRING,
        ),
    ],
    database=EntityReference(id=MOCK_DATABASE.id, name="main_dev", type="database"),
    databaseSchema=EntityReference(
        id=MOCK_SCHEMA_PROCESSED.id, name="clientstate", type="databaseSchema"
    ),
)


class UnityCatalogLineageTests(TestCase):
    """
    Unity Catalog lineage unit tests
    """

    @patch(
        "metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"
    )
    def setUp(self, mock_test_connection):
        """Set up test fixtures"""
        mock_test_connection.return_value = None

        config = OpenMetadataWorkflowConfig.model_validate(
            mock_unitycatalog_lineage_config
        )

        self.lineage_source = UnitycatalogLineageSource.create(
            mock_unitycatalog_lineage_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    def test_upstream_lineage_only(self):
        """Test normal case: upstream lineage exists, downstream not processed"""

        # Create lineage table streams with upstream tables
        table_streams = LineageTableStreams(
            upstream_tables=[
                DatabricksTable(
                    name="full_locations",
                    catalog_name="main_dev",
                    schema_name="clientstate_raw",
                )
            ],
            downstream_tables=[],
        )

        # Mock metadata.get_by_name to return the raw table
        with patch.object(
            self.lineage_source.metadata, "get_by_name", return_value=MOCK_TABLE_RAW
        ) as mock_get_by_name:
            with patch.object(
                self.lineage_source, "_get_lineage_details", return_value=None
            ) as mock_get_lineage_details:

                # Process lineage for processed table
                lineage_requests = list(
                    self.lineage_source._handle_upstream_table(
                        table_streams=table_streams,
                        table=MOCK_TABLE_PROCESSED,
                        databricks_table_fqn="main_dev.clientstate.full_locations",
                    )
                )

                # Verify lineage was created from raw to processed
                assert (
                    len(lineage_requests) == 1
                ), f"Expected 1 lineage request, got {len(lineage_requests)}"
                lineage_req = lineage_requests[0].right
                assert isinstance(lineage_req, AddLineageRequest)
                assert lineage_req.edge.fromEntity.id == MOCK_TABLE_RAW.id
                assert lineage_req.edge.toEntity.id == MOCK_TABLE_PROCESSED.id

    def test_downstream_fallback_when_no_upstream(self):
        """Test fallback: no upstream but downstream exists (UC inconsistency)"""

        # Create lineage table streams with NO upstream but HAS downstream
        table_streams = LineageTableStreams(
            upstream_tables=[],
            downstream_tables=[
                DatabricksTable(
                    name="full_locations",
                    catalog_name="main_dev",
                    schema_name="clientstate",
                )
            ],
        )

        # Mock metadata.get_by_name to return the processed table
        with patch.object(
            self.lineage_source.metadata,
            "get_by_name",
            return_value=MOCK_TABLE_PROCESSED,
        ):
            with patch.object(
                self.lineage_source, "_get_lineage_details", return_value=None
            ):

                # Process lineage for raw table
                lineage_requests = list(
                    self.lineage_source._handle_downstream_table(
                        table_streams=table_streams,
                        table=MOCK_TABLE_RAW,
                        databricks_table_fqn="main_dev.clientstate_raw.full_locations",
                    )
                )

                # Verify lineage was created from raw to processed using downstream
                assert len(lineage_requests) == 1
                lineage_req = lineage_requests[0].right
                assert isinstance(lineage_req, AddLineageRequest)
                assert lineage_req.edge.fromEntity.id == MOCK_TABLE_RAW.id
                assert lineage_req.edge.toEntity.id == MOCK_TABLE_PROCESSED.id

    @patch(
        "metadata.ingestion.source.database.unitycatalog.client.UnityCatalogClient.get_table_lineage"
    )
    def test_no_lineage_when_both_empty(self, mock_get_lineage):
        """Test no lineage created when both upstream and downstream are empty"""

        # Mock UC API response with no lineage
        mock_get_lineage.return_value = LineageTableStreams(
            upstream_tables=[],
            downstream_tables=[],
        )

        # Process lineage
        upstream_requests = list(
            self.lineage_source._handle_upstream_table(
                table_streams=mock_get_lineage.return_value,
                table=MOCK_TABLE_PROCESSED,
                databricks_table_fqn="main_dev.clientstate.full_locations",
            )
        )

        downstream_requests = list(
            self.lineage_source._handle_downstream_table(
                table_streams=mock_get_lineage.return_value,
                table=MOCK_TABLE_RAW,
                databricks_table_fqn="main_dev.clientstate_raw.full_locations",
            )
        )

        # Verify no lineage was created
        assert len(upstream_requests) == 0
        assert len(downstream_requests) == 0

    def test_skip_downstream_when_entity_not_found(self):
        """Test downstream skipped when target entity not found in OpenMetadata"""

        # Create lineage table streams with downstream
        table_streams = LineageTableStreams(
            upstream_tables=[],
            downstream_tables=[
                DatabricksTable(
                    name="full_locations",
                    catalog_name="main_dev",
                    schema_name="clientstate",
                )
            ],
        )

        # Mock metadata.get_by_name to return None (entity not found)
        with patch.object(
            self.lineage_source.metadata, "get_by_name", return_value=None
        ):
            # Process lineage
            lineage_requests = list(
                self.lineage_source._handle_downstream_table(
                    table_streams=table_streams,
                    table=MOCK_TABLE_RAW,
                    databricks_table_fqn="main_dev.clientstate_raw.full_locations",
                )
            )

            # Verify no lineage was created
            assert len(lineage_requests) == 0
