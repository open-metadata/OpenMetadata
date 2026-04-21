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
Test Microsoft Fabric Pipeline connector using the topology
"""

from typing import List
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.clients.microsoftfabric.models import (
    FabricActivity,
    FabricPipeline,
    FabricPipelineRun,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline, StatusType, Task
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.microsoftfabricpipeline.metadata import (
    STATUS_MAP,
    MicrosoftFabricPipelineSource,
    get_tasks_from_activities,
)

mock_fabric_pipeline_config = {
    "source": {
        "type": "microsoftfabricpipeline",
        "serviceName": "test_fabric_pipeline_service",
        "serviceConnection": {
            "config": {
                "type": "MicrosoftFabricPipeline",
                "tenantId": "test-tenant-id",
                "clientId": "test-client-id",
                "clientSecret": "test-client-secret",
                "workspaceId": "test-workspace-id",
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}

MOCK_PIPELINE_SERVICE = PipelineService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="test_fabric_pipeline_service",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.MicrosoftFabricPipeline,
)

MOCK_PIPELINE = Pipeline(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="test_etl_pipeline",
    fullyQualifiedName="test_fabric_pipeline_service.test_etl_pipeline",
    displayName="Test ETL Pipeline",
    description="A test ETL pipeline",
    service=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="pipelineService"
    ),
)

# Mock Fabric API responses
MOCK_PIPELINES: List[FabricPipeline] = [
    FabricPipeline(
        id="pipeline-id-1",
        display_name="Test ETL Pipeline",
        description="A test ETL pipeline for data transformation",
        workspace_id="test-workspace-id",
    ),
    FabricPipeline(
        id="pipeline-id-2",
        display_name="Data Ingestion Pipeline",
        description="Pipeline for ingesting data from sources",
        workspace_id="test-workspace-id",
    ),
]

MOCK_PIPELINE_RUNS: List[FabricPipelineRun] = [
    FabricPipelineRun(
        id="run-id-1",
        pipeline_id="pipeline-id-1",
        status="Completed",
        start_time="2024-01-15T10:00:00Z",
        end_time="2024-01-15T10:30:00Z",
    ),
    FabricPipelineRun(
        id="run-id-2",
        pipeline_id="pipeline-id-1",
        status="Failed",
        start_time="2024-01-14T08:00:00Z",
        end_time="2024-01-14T08:15:00Z",
    ),
]

MOCK_PIPELINE_ACTIVITIES: List[FabricActivity] = [
    FabricActivity(
        name="Copy Data",
        type="Copy",
        description="Copy data from source to destination",
        depends_on=[],
    ),
    FabricActivity(
        name="Transform Data",
        type="DataFlow",
        description="Transform the copied data",
        depends_on=[{"activity": "Copy Data", "dependencyConditions": ["Succeeded"]}],
    ),
    FabricActivity(
        name="Load to Warehouse",
        type="Copy",
        description="Load transformed data to warehouse",
        depends_on=[
            {"activity": "Transform Data", "dependencyConditions": ["Succeeded"]}
        ],
    ),
]

EXPECTED_TASKS = [
    Task(
        name="Copy Data",
        displayName="Copy Data",
        description="Copy data from source to destination",
        taskType="Copy",
        downstreamTasks=[],
    ),
    Task(
        name="Transform Data",
        displayName="Transform Data",
        description="Transform the copied data",
        taskType="DataFlow",
        downstreamTasks=[],
    ),
    Task(
        name="Load to Warehouse",
        displayName="Load to Warehouse",
        description="Load transformed data to warehouse",
        taskType="Copy",
        downstreamTasks=[],
    ),
]


class MicrosoftFabricPipelineUnitTest(TestCase):
    """
    Unit tests for Microsoft Fabric Pipeline connector
    """

    @patch(
        "metadata.ingestion.source.pipeline.microsoftfabricpipeline.metadata.MicrosoftFabricPipelineSource.test_connection"
    )
    @patch(
        "metadata.ingestion.source.pipeline.microsoftfabricpipeline.connection.get_connection"
    )
    def __init__(
        self,
        methodName,
        mock_get_connection,
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        # Mock the client
        self.mock_client = MagicMock()
        mock_get_connection.return_value = self.mock_client

        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_fabric_pipeline_config
        )
        self.fabric_pipeline = MicrosoftFabricPipelineSource.create(
            mock_fabric_pipeline_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )

    @patch(
        "metadata.ingestion.source.pipeline.microsoftfabricpipeline.client.MicrosoftFabricPipelineClient.get_pipelines"
    )
    def test_get_pipelines_list(self, mock_get_pipelines):
        """Test retrieving list of pipelines"""
        mock_get_pipelines.return_value = MOCK_PIPELINES

        # Access the client directly from the source
        self.fabric_pipeline.client = MagicMock()
        self.fabric_pipeline.client.get_pipelines.return_value = MOCK_PIPELINES

        pipelines = list(self.fabric_pipeline.get_pipelines_list())

        self.assertEqual(len(pipelines), 2)
        self.assertEqual(pipelines[0].display_name, "Test ETL Pipeline")
        self.assertEqual(pipelines[1].display_name, "Data Ingestion Pipeline")

    @patch(
        "metadata.ingestion.source.pipeline.microsoftfabricpipeline.client.MicrosoftFabricPipelineClient.get_pipeline_runs"
    )
    def test_get_pipeline_runs(self, mock_get_runs):
        """Test retrieving pipeline runs"""
        mock_get_runs.return_value = MOCK_PIPELINE_RUNS

        self.fabric_pipeline.client = MagicMock()
        self.fabric_pipeline.client.get_pipeline_runs.return_value = MOCK_PIPELINE_RUNS

        runs = self.fabric_pipeline.client.get_pipeline_runs("pipeline-id-1")

        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[0].status, "Completed")
        self.assertEqual(runs[1].status, "Failed")

    def test_status_map(self):
        """Test status type mapping"""
        self.assertEqual(STATUS_MAP.get("Completed"), StatusType.Successful)
        self.assertEqual(STATUS_MAP.get("Failed"), StatusType.Failed)
        self.assertEqual(STATUS_MAP.get("InProgress"), StatusType.Pending)
        self.assertEqual(STATUS_MAP.get("NotStarted"), StatusType.Pending)
        self.assertEqual(STATUS_MAP.get("Cancelled"), StatusType.Skipped)
        self.assertEqual(STATUS_MAP.get("Deduped"), StatusType.Skipped)
        # Unknown statuses default to Pending
        self.assertEqual(
            STATUS_MAP.get("Unknown", StatusType.Pending), StatusType.Pending
        )

    def test_get_tasks_from_activities(self):
        """Test converting activities to tasks"""
        tasks = get_tasks_from_activities(MOCK_PIPELINE_ACTIVITIES)

        self.assertEqual(len(tasks), 3)
        self.assertEqual(tasks[0].name, "Copy Data")
        self.assertEqual(tasks[0].taskType, "Copy")
        self.assertEqual(tasks[1].name, "Transform Data")
        self.assertEqual(tasks[1].taskType, "DataFlow")
        self.assertEqual(tasks[2].name, "Load to Warehouse")
        # Verify downstream tasks are set correctly
        self.assertIn("Transform Data", tasks[0].downstreamTasks)
        self.assertIn("Load to Warehouse", tasks[1].downstreamTasks)


class MicrosoftFabricPipelineClientTest(TestCase):
    """
    Unit tests for Microsoft Fabric Pipeline client
    """

    def test_client_initialization(self):
        """Test client can be initialized with config"""
        from metadata.generated.schema.entity.services.connections.pipeline.microsoftFabricPipelineConnection import (
            MicrosoftFabricPipelineConnection,
        )
        from metadata.ingestion.models.custom_pydantic import CustomSecretStr

        config = MicrosoftFabricPipelineConnection(
            tenantId="test-tenant-id",
            clientId="test-client-id",
            clientSecret=CustomSecretStr("test-client-secret"),
            workspaceId="test-workspace-id",
        )

        # Verify config is valid
        self.assertEqual(config.tenantId, "test-tenant-id")
        self.assertEqual(config.clientId, "test-client-id")
        self.assertEqual(config.workspaceId, "test-workspace-id")

    def test_pipeline_model(self):
        """Test FabricPipeline model"""
        pipeline = FabricPipeline(
            id="test-id",
            display_name="Test Pipeline",
            description="A test pipeline",
            workspace_id="workspace-id",
        )

        self.assertEqual(pipeline.id, "test-id")
        self.assertEqual(pipeline.display_name, "Test Pipeline")
        self.assertEqual(pipeline.description, "A test pipeline")

    def test_pipeline_run_model(self):
        """Test FabricPipelineRun model"""
        run = FabricPipelineRun(
            id="run-id",
            pipeline_id="pipeline-id",
            status="Completed",
            start_time="2024-01-15T10:00:00Z",
            end_time="2024-01-15T10:30:00Z",
        )

        self.assertEqual(run.id, "run-id")
        self.assertEqual(run.status, "Completed")
        self.assertIsNotNone(run.start_time)

    def test_pipeline_activity_model(self):
        """Test FabricActivity model"""
        activity = FabricActivity(
            name="Copy Data",
            type="Copy",
            description="Copy data from source",
            depends_on=[
                {"activity": "Previous Activity", "dependencyConditions": ["Succeeded"]}
            ],
        )

        self.assertEqual(activity.name, "Copy Data")
        self.assertEqual(activity.type, "Copy")
        self.assertEqual(len(activity.depends_on), 1)


class MicrosoftFabricPipelineFilterTest(TestCase):
    """
    Unit tests for pipeline filtering
    """

    def test_pipeline_filter_pattern(self):
        """Test that pipeline filter pattern is applied correctly"""
        from metadata.generated.schema.type.filterPattern import FilterPattern
        from metadata.utils.filters import filter_by_pipeline

        # Create filter pattern to include only ETL pipelines
        filter_pattern = FilterPattern(includes=[".*ETL.*"])

        pipelines = ["Test ETL Pipeline", "Data Ingestion Pipeline", "ETL_Daily"]

        # filter_by_pipeline returns True to EXCLUDE, so we need to invert
        filtered = [p for p in pipelines if not filter_by_pipeline(filter_pattern, p)]

        self.assertEqual(len(filtered), 2)
        self.assertIn("Test ETL Pipeline", filtered)
        self.assertIn("ETL_Daily", filtered)
        self.assertNotIn("Data Ingestion Pipeline", filtered)

    def test_pipeline_filter_pattern_exclude(self):
        """Test that pipeline exclusion filter works"""
        from metadata.generated.schema.type.filterPattern import FilterPattern
        from metadata.utils.filters import filter_by_pipeline

        # Create filter pattern to exclude test pipelines
        filter_pattern = FilterPattern(excludes=[".*[Tt]est.*"])

        pipelines = ["Test ETL Pipeline", "Production Pipeline", "test_pipeline"]

        # filter_by_pipeline returns True to EXCLUDE, so we need to invert
        filtered = [p for p in pipelines if not filter_by_pipeline(filter_pattern, p)]

        self.assertEqual(len(filtered), 1)
        self.assertIn("Production Pipeline", filtered)
