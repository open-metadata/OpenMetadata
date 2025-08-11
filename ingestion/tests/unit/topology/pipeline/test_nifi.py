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
Test nifi using the topology
"""
# pylint: disable=line-too-long
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import PropertyMock, patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
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
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.nifi.metadata import (
    NifiPipelineDetails,
    NifiProcessor,
    NifiProcessorConnections,
    NifiSource,
)
from metadata.utils.constants import UTF_8

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/nifi_process_group.json"
)
with open(mock_file_path, encoding=UTF_8) as file:
    mock_data: dict = json.load(file)

resources_mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/nifi_resources.json"
)
with open(mock_file_path, encoding=UTF_8) as file:
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

EXPECTED_PARENT_NIFI_DETAILS = NifiPipelineDetails(
    id_="affe20b6-b5b6-47fb-8dd3-ff53cd4aee4a",
    name="Parent NiFi Flow",
    uri="/nifi-api/flow/process-groups/affe20b6-b5b6-47fb-8dd3-ff53cd4aee4a",
    processors=[
        NifiProcessor(
            id_="ec8246b3-d740-4d8e-8571-7059a9f615e7",
            name="Wait",
            type_="org.apache.nifi.processors.standard.Wait",
            uri="/nifi-api/processors/ec8246b3-d740-4d8e-8571-7059a9f615e7",
        ),
        NifiProcessor(
            id_="be1ecb80-3c73-46ec-8e3f-6b90a14f91c7",
            name="ValidateJson",
            type_="org.apache.nifi.processors.standard.ValidateJson",
            uri="/nifi-api/processors/be1ecb80-3c73-46ec-8e3f-6b90a14f91c7",
        ),
    ],
    connections=[],
)


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
    parent_pipeline_id="affe20b6-b5b6-47fb-8dd3-ff53cd4aee4a",
)

EXPECTED_NIFI_DETAILS_2 = NifiPipelineDetails(
    id_="364e6ed1-feab-403c-a0c7-0003a55ea8aa",
    name="NiFi Flow 2",
    uri="/nifi-api/flow/process-groups/364e6ed1-feab-403c-a0c7-0003a55ea8aa",
    processors=[],
    connections=[],
)


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="d3d6b945-0182-1000-d7e4-d81b8f79f310",
    displayName="NiFi Flow",
    sourceUrl=(
        "https://localhost:8443/nifi-api/flow/"
        "process-groups/d3d6b945-0182-1000-d7e4-d81b8f79f310"
    ),
    tasks=[
        Task(
            name="d3f023ac-0182-1000-8bbe-e2b00347fff8",
            displayName="FetchFile",
            sourceUrl=(
                "https://localhost:8443/nifi-api/"
                "processors/d3f023ac-0182-1000-8bbe-e2b00347fff8"
            ),
            taskType="org.apache.nifi.processors.standard.FetchFile",
            downstreamTasks=[],
        ),
        Task(
            name="d3f1304d-0182-1000-f0f5-9a6927976941",
            displayName="ListFile",
            sourceUrl=(
                "https://localhost:8443/nifi-api/"
                "processors/d3f1304d-0182-1000-f0f5-9a6927976941"
            ),
            taskType="org.apache.nifi.processors.standard.ListFile",
            downstreamTasks=["d3f023ac-0182-1000-8bbe-e2b00347fff8"],
        ),
    ],
    service="nifi_source",
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="nifi_source",
    fullyQualifiedName=FullyQualifiedEntityName("nifi_source"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Nifi,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="d3d6b945-0182-1000-d7e4-d81b8f79f310",
    fullyQualifiedName="nifi_source.d3d6b945-0182-1000-d7e4-d81b8f79f310",
    displayName="NiFi Flow",
    sourceUrl=(
        "https://localhost:8443/nifi-api/flow/"
        "process-groups/d3d6b945-0182-1000-d7e4-d81b8f79f310"
    ),
    tasks=[
        Task(
            name="d3f023ac-0182-1000-8bbe-e2b00347fff8",
            displayName="FetchFile",
            sourceUrl=(
                "https://localhost:8443/nifi-api/processors/"
                "d3f023ac-0182-1000-8bbe-e2b00347fff8"
            ),
            taskType="org.apache.nifi.processors.standard.FetchFile",
            downstreamTasks=[],
        ),
        Task(
            name="d3f1304d-0182-1000-f0f5-9a6927976941",
            displayName="ListFile",
            sourceUrl=(
                "https://localhost:8443/nifi-api/processors/"
                "d3f1304d-0182-1000-f0f5-9a6927976941"
            ),
            taskType="org.apache.nifi.processors.standard.ListFile",
            downstreamTasks=["d3f023ac-0182-1000-8bbe-e2b00347fff8"],
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

MOCK_PIPELINE_2 = Pipeline(
    id="38cd7319-cde9-4d68-b9d3-82d28b20b7bc",
    name="364e6ed1-feab-403c-a0c7-0003a55ea8aa",
    fullyQualifiedName="nifi_source.364e6ed1-feab-403c-a0c7-0003a55ea8aa",
    displayName="NiFi Flow 2",
    sourceUrl=(
        "https://localhost:8443/nifi-api/flow/"
        "process-groups/364e6ed1-feab-403c-a0c7-0003a55ea8aa"
    ),
    tasks=[],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)


MOCK_PARENT_PIPELINE = Pipeline(
    id="f9d1c7e1-4c0a-4578-a1bd-e9941c88a1c5",
    name="affe20b6-b5b6-47fb-8dd3-ff53cd4aee4a",
    fullyQualifiedName="nifi_source.affe20b6-b5b6-47fb-8dd3-ff53cd4aee4a",
    displayName="Parent NiFi Flow",
    sourceUrl=(
        "https://localhost:8443/nifi-api/flow/"
        "process-groups/d3d6b945-0182-1000-d7e4-d81b8f79f310"
    ),
    tasks=[
        Task(
            name="ec8246b3-d740-4d8e-8571-7059a9f615e7",
            displayName="Wait",
            sourceUrl=(
                "https://localhost:8443/nifi-api/processors/"
                "ec8246b3-d740-4d8e-8571-7059a9f615e7"
            ),
            taskType="org.apache.nifi.processors.standard.Wait",
            downstreamTasks=[],
        ),
        Task(
            name="be1ecb80-3c73-46ec-8e3f-6b90a14f91c7",
            displayName="ValidateJson",
            sourceUrl=(
                "https://localhost:8443/nifi-api/processors/"
                "be1ecb80-3c73-46ec-8e3f-6b90a14f91c7"
            ),
            taskType="org.apache.nifi.processors.standard.ValidateJson",
            downstreamTasks=["ec8246b3-d740-4d8e-8571-7059a9f615e7"],
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

EXPECTED_PIPELINE_BULK_LINEAGE_DETAILS = [
    Either(
        right=AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=MOCK_PARENT_PIPELINE.id, type="pipeline"),
                toEntity=EntityReference(id=MOCK_PIPELINE.id, type="pipeline"),
                lineageDetails=LineageDetails(source=LineageSource.PipelineLineage),
            ),
        )
    ),
    Either(
        right=AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=MOCK_PIPELINE.id, type="pipeline"),
                toEntity=EntityReference(id=MOCK_PIPELINE_2.id, type="pipeline"),
                lineageDetails=LineageDetails(source=LineageSource.PipelineLineage),
            ),
        )
    ),
]


class NifiUnitTest(TestCase):
    """
    Nifi unit tests
    """

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

        config = OpenMetadataWorkflowConfig.model_validate(mock_nifi_config)
        self.nifi = NifiSource.create(
            mock_nifi_config["source"],
            OpenMetadata(config.workflowConfig.openMetadataServerConfig),
        )
        self.nifi.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.nifi.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root

        # Mock metadata.get_by_name to return different pipeline entities based on FQN
        self.original_get_by_name = self.nifi.metadata.get_by_name
        self.nifi.metadata.get_by_name = self._mock_get_by_name

        self.nifi.pipeline_parents_mapping = {
            EXPECTED_NIFI_DETAILS.id_: [EXPECTED_NIFI_DETAILS.parent_pipeline_id],
        }
        self.nifi.process_group_connections = [
            NifiProcessorConnections(
                id_="fd99b000-6117-47c1-a075-b09591b04d61",
                source_id="d3d6b945-0182-1000-d7e4-d81b8f79f310",
                destination_id="364e6ed1-feab-403c-a0c7-0003a55ea8aa",
            )
        ]

    def _mock_get_by_name(self, entity, fqn):
        """Mock function to return different pipeline entities based on FQN"""
        fqn_pipeline_mapping = {
            f"{self.nifi.context.get().pipeline_service}.{EXPECTED_PARENT_NIFI_DETAILS.id_}": MOCK_PARENT_PIPELINE,
            f"{self.nifi.context.get().pipeline_service}.{EXPECTED_NIFI_DETAILS.id_}": MOCK_PIPELINE,
            f"{self.nifi.context.get().pipeline_service}.{EXPECTED_NIFI_DETAILS_2.id_}": MOCK_PIPELINE_2,
        }
        return fqn_pipeline_mapping.get(fqn, self.original_get_by_name(entity, fqn))

    def test_pipeline_name(self):
        assert (
            self.nifi.get_pipeline_name(EXPECTED_NIFI_DETAILS)
            == mock_data["processGroupFlow"]["breadcrumb"]["breadcrumb"]["name"]
        )

    def test_pipelines(self):
        pipline = list(self.nifi.yield_pipeline(EXPECTED_NIFI_DETAILS))[0].right
        assert pipline == EXPECTED_CREATED_PIPELINES

    def test_pipeline_bulk_lineage_details(self):
        pipeline_bulk_lineage_details = list(
            self.nifi.yield_pipeline_bulk_lineage_details()
        )
        assert pipeline_bulk_lineage_details == EXPECTED_PIPELINE_BULK_LINEAGE_DETAILS
