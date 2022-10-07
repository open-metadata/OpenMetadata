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
                "hostPort": "http://lolhost:3000",
            }
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


EXPECTED_DAGSTER_DETAILS = mock_data["assetNodes"]

EXPECTED_CREATED_PIPELINES = [
    CreatePipelineRequest(
        name="cereals",
        displayName=None,
        description="cereals",
        pipelineUrl=None,
        concurrency=None,
        pipelineLocation=None,
        startDate=None,
        tasks=[
            Task(
                name="__ASSET_JOB",
                displayName=None,
                fullyQualifiedName=None,
                description=None,
                taskUrl=None,
                downstreamTasks=None,
                taskType=None,
                taskSQL=None,
                startDate=None,
                endDate=None,
                tags=None,
            )
        ],
        tags=None,
        owner=None,
        service=EntityReference(
            id="86ff3c40-7c51-4ff5-9727-738cead28d9a", type="pipelineService"
        ),
    ),
]
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
    @patch("dagster_graphql.DagsterGraphQLClient")
    def __init__(self, methodName, graphql_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.parse_obj(mock_dagster_config)
        self.dagster = DagsterSource.create(
            mock_dagster_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.dagster.context.__dict__["pipeline"] = MOCK_PIPELINE
        self.dagster.context.__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE

    def test_pipeline_name(self):
        assert (
            self.dagster.get_pipeline_name(EXPECTED_DAGSTER_DETAILS)
            == mock_data["assetNodes"]["opName"]
        )

    def test_yield_pipeline(self):
        result = self.dagster.yield_pipeline(mock_data["assetNodes"])
        self.pipelines_list = []
        for r in result:
            self.pipelines_list.append(r)

        for i in range(len(self.pipelines_list)):
            assert self.pipelines_list[i] == EXPECTED_CREATED_PIPELINES[i]
