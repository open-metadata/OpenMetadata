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
Test Dagster using the topology
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.dagster import DagsterSource

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/dagster_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

mock_dagster_config = {
    "source": {
        "type": "dagster",
        "serviceName": "dagster_source",
        "serviceConnection": {
            "config": {
                "type": "Dagster",
                "hostPort": "http://localhost:3000",
                "dbConnection": {
                    "username": "dagster_user",
                    "password": "dagter_pass",
                    "databaseSchema": "dagster_db",
                    "hostPort": "localhost:3306",
                },
            }
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


EXPECTED_DAGSTER_DETAILS = mock_data[6]["pipeline_code_origin"]

MOCK_CONNECTION_URI_PATH = "/workspace/__repository__do_it_all_with_default_config@cereal.py/jobs/do_it_all_with_default_config/"
MOCK_LOG_URL = (
    "http://localhost:8080/instance/runs/a6ebb16c-505f-446d-8642-171c3320ccef"
)


EXPECTED_PIPELINE_STATUS = [
    OMetaPipelineStatus(
        pipeline_fqn="dagster_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Pending.value,
            taskStatus=[
                TaskStatus(
                    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
                    executionStatus=StatusType.Pending.value,
                    startTime=1659616627124,
                    endTime=1659616635858,
                    logLink=f"{MOCK_LOG_URL}/status",
                )
            ],
            timestamp=1659616635858,
        ),
    ),
    OMetaPipelineStatus(
        pipeline_fqn="dagster_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
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
    name="a6ebb16c-505f-446d-8642-171c3320ccef",
    displayName="do_it_all_with_default_configs",
    description="do_it_all_with_default_config",
    pipelineUrl=MOCK_CONNECTION_URI_PATH,
    tasks=[
        Task(
            name="do_it_all_with_default_config",
            displayName="",
            description="",
            taskUrl="",
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="86ff3c40-7c51-4ff5-9727-738cead28d9a",
    name="dagster_source_test",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Dagster,
)


MOCK_PIPELINE = Pipeline(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="do_it_all_with_default_config",
    fullyQualifiedName="dagster_source.do_it_all_with_default_config",
    displayName="do_it_all_with_default_config",
    description="",
    pipelineUrl=MOCK_CONNECTION_URI_PATH,
    tasks=[
        Task(
            name="a58b1856-729c-493b-bc87-6d2269b43ec0",
            displayName="do_it_all_with_default_config",
            description="",
            taskUrl="",
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)


class DagsterUnitTest(TestCase):
    @patch("metadata.ingestion.source.pipeline.pipeline_service.test_connection")
    @patch("sqlalchemy.engine.base.Engine.connect")
    def __init__(self, methodName, mock_connect, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        config = OpenMetadataWorkflowConfig.parse_obj(mock_dagster_config)

        self.dagster = DagsterSource.create(
            mock_dagster_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.engine = mock_connect.return_value
        self.dagster.context.__dict__["pipeline"] = MOCK_PIPELINE
        self.dagster.context.__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE

    def test_pipeline_name(self):

        assert (
            self.dagster.get_pipeline_name(EXPECTED_DAGSTER_DETAILS)
            == mock_data[6]["pipeline_code_origin"]["pipeline_name"]
        )
