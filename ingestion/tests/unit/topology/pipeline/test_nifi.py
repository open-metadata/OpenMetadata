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
Test nifi using the topology
"""
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import PropertyMock, patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.nifi.metadata import (
    NifiPipelineDetails,
    NifiProcessor,
    NifiProcessorConnections,
    NifiSource,
)

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/nifi_process_group.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

resources_mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/nifi_resources.json"
)
with open(mock_file_path) as file:
    resources_mock_data: dict = json.load(file)

mock_nifi_config = {
    "source": {
        "type": "nifi",
        "serviceName": "nifi_source",
        "serviceConnection": {
            "config": {
                "type": "Nifi",
                "hostPort": "https://localhost:8443",
                "nifiConfig": {
                    "username": "username",
                    "password": "password",
                    "verifySSL": False,
                },
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


EXPECTED_NIFI_DETAILS = NifiPipelineDetails(
    id_="d3d6b945-0182-1000-d7e4-d81b8f79f310",
    name="NiFi Flow",
    uri="/nifi-api/flow/process-groups/d3d6b945-0182-1000-d7e4-d81b8f79f310",
    processors=[
        NifiProcessor(
            id_="d3f023ac-0182-1000-8bbe-e2b00347fff8",
            name="FetchFile",
            type_="org.apache.nifi.processors.standard.FetchFile",
            uri="/nifi-api/processors/d3f023ac-0182-1000-8bbe-e2b00347fff8",
        ),
        NifiProcessor(
            id_="d3f1304d-0182-1000-f0f5-9a6927976941",
            name="ListFile",
            type_="org.apache.nifi.processors.standard.ListFile",
            uri="/nifi-api/processors/d3f1304d-0182-1000-f0f5-9a6927976941",
        ),
    ],
    connections=[
        NifiProcessorConnections(
            id_="d3f17ef8-0182-1000-61da-c996721cf425",
            source_id="d3f1304d-0182-1000-f0f5-9a6927976941",
            destination_id="d3f023ac-0182-1000-8bbe-e2b00347fff8",
        )
    ],
)


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="d3d6b945-0182-1000-d7e4-d81b8f79f310",
    displayName="NiFi Flow",
    pipelineUrl="/nifi-api/flow/process-groups/d3d6b945-0182-1000-d7e4-d81b8f79f310",
    tasks=[
        Task(
            name="d3f023ac-0182-1000-8bbe-e2b00347fff8",
            displayName="FetchFile",
            taskUrl="/nifi-api/processors/d3f023ac-0182-1000-8bbe-e2b00347fff8",
            taskType="org.apache.nifi.processors.standard.FetchFile",
            downstreamTasks=[],
        ),
        Task(
            name="d3f1304d-0182-1000-f0f5-9a6927976941",
            displayName="ListFile",
            taskUrl="/nifi-api/processors/d3f1304d-0182-1000-f0f5-9a6927976941",
            taskType="org.apache.nifi.processors.standard.ListFile",
            downstreamTasks=["d3f023ac-0182-1000-8bbe-e2b00347fff8"],
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="nifi_source",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Nifi,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="d3d6b945-0182-1000-d7e4-d81b8f79f310",
    fullyQualifiedName="nifi_source.d3d6b945-0182-1000-d7e4-d81b8f79f310",
    displayName="NiFi Flow",
    pipelineUrl="/nifi-api/flow/process-groups/d3d6b945-0182-1000-d7e4-d81b8f79f310",
    tasks=[
        Task(
            name="d3f023ac-0182-1000-8bbe-e2b00347fff8",
            displayName="FetchFile",
            taskUrl="/nifi-api/processors/d3f023ac-0182-1000-8bbe-e2b00347fff8",
            taskType="org.apache.nifi.processors.standard.FetchFile",
            downstreamTasks=[],
        ),
        Task(
            name="d3f1304d-0182-1000-f0f5-9a6927976941",
            displayName="ListFile",
            taskUrl="/nifi-api/processors/d3f1304d-0182-1000-f0f5-9a6927976941",
            taskType="org.apache.nifi.processors.standard.ListFile",
            downstreamTasks=["d3f023ac-0182-1000-8bbe-e2b00347fff8"],
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)


class NifiUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch(
        "metadata.ingestion.source.pipeline.nifi.client.NifiClient.token",
        new_callable=PropertyMock,
    )
    def __init__(self, methodName, nifi_token_prop, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        nifi_token_prop.return_value.token.return_value = "token"

        config = OpenMetadataWorkflowConfig.parse_obj(mock_nifi_config)
        self.nifi = NifiSource.create(
            mock_nifi_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.nifi.context.__dict__["pipeline"] = MOCK_PIPELINE
        self.nifi.context.__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE

    def test_pipeline_name(self):
        assert (
            self.nifi.get_pipeline_name(EXPECTED_NIFI_DETAILS)
            == mock_data["processGroupFlow"]["breadcrumb"]["breadcrumb"]["name"]
        )

    def test_pipelines(self):
        pipline = list(self.nifi.yield_pipeline(EXPECTED_NIFI_DETAILS))[0]
        assert pipline == EXPECTED_CREATED_PIPELINES
