import json
import uuid
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.airbyte import AirbytePipelineDetails

mock_data_file = open("ingestion/tests/unit/resources/datasets/airbyte_dataset.json")
mock_data: dict = json.load(mock_data_file)

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
            "authProvider": "no-auth",
        }
    },
}


EXPECTED_ARIBYTE_DETAILS = AirbytePipelineDetails(
    workspace=mock_data["workspace"][0], connection=mock_data["connection"][0]
)

MOCK_CONNECTION_URI_PATH = "/workspaces/af5680ec-2687-4fe0-bd55-5ad5f020a603/connections/a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f"
MOCK_LOG_URL = f"http://localhost:1234{MOCK_CONNECTION_URI_PATH}"


EXPECTED_PIPELINE_STATUS = [
    OMetaPipelineStatus(
        pipeline_fqn="airbyte_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Pending.value,
            taskStatus=[
                TaskStatus(
                    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
                    executionStatus=StatusType.Pending.value,
                    startTime=1655482894,
                    endTime=None,
                    logLink=f"{MOCK_LOG_URL}/status",
                )
            ],
            executionDate=1655482894,
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
                    startTime=1655393914,
                    endTime=1655394054,
                    logLink=f"{MOCK_LOG_URL}/status",
                )
            ],
            executionDate=1655393914,
        ),
    ),
]


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
    displayName="MSSQL <> Postgres",
    description="",
    pipelineUrl=MOCK_CONNECTION_URI_PATH,
    tasks=[
        Task(
            name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
            displayName="MSSQL <> Postgres",
            description="",
            taskUrl=f"{MOCK_CONNECTION_URI_PATH}/status",
        )
    ],
    service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
)


class AirbyteUnitTest(TestCase):
    def __init__(self, methodName: str = ...) -> None:
        super().__init__(methodName)
        self.init_workflow()

    @patch("metadata.ingestion.source.pipeline.pipeline_service.test_connection")
    @patch("metadata.ingestion.source.pipeline.airbyte.AirbyteClient")
    def init_workflow(self, airbyte_client, test_connection):
        test_connection.return_value = False
        self.client = airbyte_client.return_value
        self.client.list_jobs.return_value = mock_data.get("jobs")
        self.client.list_workspaces.return_value = mock_data.get("workspace")
        self.client.list_connections.return_value = mock_data.get("connection")
        self.workflow = Workflow.create(mock_airbyte_config)
        self.workflow.execute()
        self.workflow.stop()

    def test_pipeline_list(self):
        assert (
            list(self.workflow.source.get_pipelines_list())[0]
            == EXPECTED_ARIBYTE_DETAILS
        )

    def test_pipeline_name(self):
        assert self.workflow.source.get_pipeline_name(
            EXPECTED_ARIBYTE_DETAILS
        ) == mock_data.get("connection")[0].get("connectionId")

    def test_pipelines(self):
        pipline = list(self.workflow.source.yield_pipeline(EXPECTED_ARIBYTE_DETAILS))[0]
        EXPECTED_CREATED_PIPELINES.service = pipline.service
        assert pipline == EXPECTED_CREATED_PIPELINES

    def test_pipeline_status(self):
        assert (
            list(self.workflow.source.yield_pipeline_status(EXPECTED_ARIBYTE_DETAILS))
            == EXPECTED_PIPELINE_STATUS
        )
