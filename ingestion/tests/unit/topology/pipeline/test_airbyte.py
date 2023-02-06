#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Test Airbyte using the topology
"""
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.airbyte.metadata import (
    AirbytePipelineDetails,
    AirbyteSource,
)

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/airbyte_dataset.json"
)
with open(mock_file_path) as file:
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
            timestamp=1655482894,
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
            timestamp=1655393914,
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
    service="airbyte_source",
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="airbyte_source",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Airbyte,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
    fullyQualifiedName="airbyte_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
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
    service="airbyte_source",
)


class AirbyteUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.pipeline.airbyte.metadata.AirbyteClient")
    def __init__(self, methodName, airbyte_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.parse_obj(mock_airbyte_config)
        self.airbyte = AirbyteSource.create(
            mock_airbyte_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.airbyte.context.__dict__["pipeline"] = MOCK_PIPELINE
        self.airbyte.context.__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE
        self.client = airbyte_client.return_value
        self.client.list_jobs.return_value = mock_data.get("jobs")
        self.client.list_workspaces.return_value = mock_data.get("workspace")
        self.client.list_connections.return_value = mock_data.get("connection")

    def test_pipeline_list(self):
        assert list(self.airbyte.get_pipelines_list())[0] == EXPECTED_ARIBYTE_DETAILS

    def test_pipeline_name(self):
        assert self.airbyte.get_pipeline_name(
            EXPECTED_ARIBYTE_DETAILS
        ) == mock_data.get("connection")[0].get("connectionId")

    def test_pipelines(self):
        pipline = list(self.airbyte.yield_pipeline(EXPECTED_ARIBYTE_DETAILS))[0]
        assert pipline == EXPECTED_CREATED_PIPELINES

    def test_pipeline_status(self):
        assert (
            list(self.airbyte.yield_pipeline_status(EXPECTED_ARIBYTE_DETAILS))
            == EXPECTED_PIPELINE_STATUS
        )
