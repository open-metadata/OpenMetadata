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
Test Airbyte using the topology
"""
# pylint: disable=line-too-long
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.airbyte.metadata import (
    AirbytePipelineDetails,
    AirbyteSource,
)
from metadata.utils.constants import UTF_8

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/airbyte_dataset.json"
)
with open(mock_file_path, encoding=UTF_8) as file:
    mock_data: dict = json.load(file)

mock_airbyte_config = {
    "source": {
        "type": "airbyte",
        "serviceName": "airbyte_source",
        "serviceConnection": {
            "config": {"type": "Airbyte", "hostPort": "http://localhost:1234"}
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}


EXPECTED_AIRBYTE_DETAILS = AirbytePipelineDetails(
    workspace=mock_data["workspace"][0], connection=mock_data["connection"][0]
)

MOCK_CONNECTION_URI_PATH = (
    "http://localhost:1234/workspaces/af5680ec-2687-4fe0-bd55-5ad5f020a603/"
    "connections/a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f"
)


EXPECTED_PIPELINE_STATUS = [
    OMetaPipelineStatus(
        pipeline_fqn="airbyte_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Pending.value,
            taskStatus=[
                TaskStatus(
                    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
                    executionStatus=StatusType.Pending.value,
                    startTime=1655482894000,
                    endTime=None,
                    logLink=f"{MOCK_CONNECTION_URI_PATH}/status",
                )
            ],
            timestamp=1655482894000,
        ),
    ),
    OMetaPipelineStatus(
        pipeline_fqn="airbyte_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Successful.value,
            taskStatus=[
                TaskStatus(
                    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
                    executionStatus=StatusType.Successful.value,
                    startTime=1655393914000,
                    endTime=1655394054000,
                    logLink=f"{MOCK_CONNECTION_URI_PATH}/status",
                )
            ],
            timestamp=1655393914000,
        ),
    ),
]


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
    displayName="MSSQL <> Postgres",
    sourceUrl=MOCK_CONNECTION_URI_PATH,
    tasks=[
        Task(
            name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
            displayName="MSSQL <> Postgres",
            sourceUrl=f"{MOCK_CONNECTION_URI_PATH}/status",
        )
    ],
    service=FullyQualifiedEntityName("airbyte_source"),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="airbyte_source",
    fullyQualifiedName=FullyQualifiedEntityName("airbyte_source"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Airbyte,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
    fullyQualifiedName="airbyte_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
    displayName="MSSQL <> Postgres",
    sourceUrl=MOCK_CONNECTION_URI_PATH,
    tasks=[
        Task(
            name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
            displayName="MSSQL <> Postgres",
            sourceUrl=f"{MOCK_CONNECTION_URI_PATH}/status",
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

# Mock data for lineage testing
MOCK_POSTGRES_SOURCE_TABLE = Table(
    id="69fc8906-4a4a-45ab-9a54-9cc2d399e10e",
    name="mock_table_name",
    fullyQualifiedName="mock_source_service.mock_source_db.mock_source_schema.mock_table_name",
    columns=[{"name": "id", "dataType": "INT"}, {"name": "name", "dataType": "STRING"}],
)

MOCK_POSTGRES_DESTINATION_TABLE = Table(
    id="59fc8906-4a4a-45ab-9a54-9cc2d399e10e",
    name="mock_table_name",
    fullyQualifiedName=(
        "mock_destination_service.mock_destination_db"
        ".mock_destination_schema.mock_table_name"
    ),
    columns=[{"name": "id", "dataType": "INT"}, {"name": "name", "dataType": "STRING"}],
)

EXPECTED_LINEAGE = AddLineageRequest(
    edge=EntitiesEdge(
        fromEntity=EntityReference(
            id="69fc8906-4a4a-45ab-9a54-9cc2d399e10e", type="table"
        ),
        toEntity=EntityReference(
            id="59fc8906-4a4a-45ab-9a54-9cc2d399e10e", type="table"
        ),
        lineageDetails=LineageDetails(
            pipeline=EntityReference(
                id="2aaa012e-099a-11ed-861d-0242ac120002", type="pipeline"
            ),
            source=LineageSource.PipelineLineage,
        ),
    )
)

MOCK_SOURCE_TABLE_FQN = (
    "mock_source_service.mock_source_db.mock_source_schema.mock_table_name"
)
MOCK_DESTINATION_TABLE_FQN = "mock_destination_service.mock_destination_db.mock_destination_schema.mock_table_name"


# Configure mock for _get_table_fqn to return FQNs for source and destination tables
def mock_get_table_fqn(self, table_details):  # pylint: disable=unused-argument
    if table_details.name != "mock_table_name":
        return None

    if table_details.schema == "mock_source_schema":
        return MOCK_SOURCE_TABLE_FQN
    if table_details.schema == "mock_destination_schema":
        return MOCK_DESTINATION_TABLE_FQN
    if table_details.schema == "mock_source_db":
        return MOCK_SOURCE_TABLE_FQN
    if table_details.schema == "mock_destination_db":
        return MOCK_DESTINATION_TABLE_FQN

    return None


# Configure the mock to return our test tables and pipeline
def mock_get_by_name(entity, fqn):
    if entity == Table:
        if fqn == MOCK_SOURCE_TABLE_FQN:
            return MOCK_POSTGRES_SOURCE_TABLE
        if fqn == MOCK_DESTINATION_TABLE_FQN:
            return MOCK_POSTGRES_DESTINATION_TABLE
    if entity == Pipeline:
        return MOCK_PIPELINE
    return None


class AirbyteUnitTest(TestCase):
    """Test class for Airbyte source module."""

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.pipeline.airbyte.connection.get_connection")
    def __init__(self, methodName, airbyte_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_airbyte_config)
        self.airbyte = AirbyteSource.create(
            mock_airbyte_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.airbyte.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.airbyte.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.client = airbyte_client.return_value
        self.client.list_jobs.return_value = mock_data.get("jobs")
        self.client.list_workspaces.return_value = mock_data.get("workspace")
        self.client.list_connections.return_value = mock_data.get("connection")

    def test_pipeline_list(self):
        assert list(self.airbyte.get_pipelines_list())[0] == EXPECTED_AIRBYTE_DETAILS

    def test_pipeline_name(self):
        assert self.airbyte.get_pipeline_name(
            EXPECTED_AIRBYTE_DETAILS
        ) == mock_data.get("connection")[0].get("name")

    def test_pipelines(self):
        pipeline = list(self.airbyte.yield_pipeline(EXPECTED_AIRBYTE_DETAILS))[0].right
        assert pipeline == EXPECTED_CREATED_PIPELINES

    def test_pipeline_status(self):
        status = [
            either.right
            for either in self.airbyte.yield_pipeline_status(EXPECTED_AIRBYTE_DETAILS)
        ]
        assert status == EXPECTED_PIPELINE_STATUS

    @patch.object(AirbyteSource, "_get_table_fqn", mock_get_table_fqn)
    def test_yield_pipeline_lineage_details(self):
        """Test the Airbyte lineage generation functionality."""
        # Mock the client methods needed for lineage with supported source and destination types
        self.client.get_source.return_value = {
            "sourceName": "Postgres",
            "connectionConfiguration": {
                "database": "mock_source_db",
                "schema": "mock_source_schema",
            },
        }

        self.client.get_destination.return_value = {
            "destinationName": "Postgres",
            "connectionConfiguration": {
                "database": "mock_destination_db",
                "schema": "mock_destination_schema",
            },
        }

        # Mock connection with stream data for lineage test
        test_connection = {
            "connectionId": "test-connection-id",
            "sourceId": "test-source-id",
            "destinationId": "test-destination-id",
            "name": "Test Connection",
            "syncCatalog": {
                "streams": [
                    {
                        "stream": {
                            "name": "mock_table_name",
                            "namespace": "mock_source_schema",
                            "jsonSchema": {},
                        }
                    }
                ]
            },
        }

        test_workspace = {"workspaceId": "test-workspace-id"}
        test_pipeline_details = AirbytePipelineDetails(
            workspace=test_workspace, connection=test_connection
        )

        # Mock the metadata object directly in the Airbyte source
        with patch.object(self.airbyte, "metadata") as mock_metadata:
            mock_metadata.get_by_name.side_effect = mock_get_by_name

            # Test yield_pipeline_lineage_details
            lineage_results = list(
                self.airbyte.yield_pipeline_lineage_details(test_pipeline_details)
            )

            # Check that we get at least one lineage result
            assert len(lineage_results) > 0

            # Extract the lineage details
            lineage = lineage_results[0].right

            # Verify the lineage structure
            assert lineage.edge.fromEntity.id == MOCK_POSTGRES_SOURCE_TABLE.id
            assert lineage.edge.toEntity.id == MOCK_POSTGRES_DESTINATION_TABLE.id
            # Compare just the UUID string value from both sides
            assert lineage.edge.lineageDetails.pipeline.id.root == MOCK_PIPELINE.id.root
            assert lineage.edge.lineageDetails.source == LineageSource.PipelineLineage
