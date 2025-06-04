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
Test fivetran using the topology
"""
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.fivetran.metadata import (
    FivetranPipelineDetails,
    FivetranSource,
)

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/fivetran_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

mock_fivetran_config = {
    "source": {
        "type": "fivetran",
        "serviceName": "fivetran_source",
        "serviceConnection": {
            "config": {
                "type": "Fivetran",
                "apiKey": "sample_api_key",
                "apiSecret": "sample_api_secret",
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


EXPECTED_FIVETRAN_DETAILS = FivetranPipelineDetails(
    source=mock_data.get("source"),
    destination=mock_data.get("destination"),
    group=mock_data.get("group"),
    connector_id=mock_data.get("source").get("id"),
)


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="wackiness_remote_aiding_pointless",
    displayName="test <> postgres_rds",
    tasks=[
        Task(
            name="wackiness_remote_aiding_pointless",
            displayName="test <> postgres_rds",
            sourceUrl=SourceUrl(
                "https://fivetran.com/dashboard/connectors/aiding_pointless/status?groupId=wackiness_remote&service=postgres_rds"
            ),
        )
    ],
    service=FullyQualifiedEntityName("fivetran_source"),
    sourceUrl=SourceUrl(
        "https://fivetran.com/dashboard/connectors/aiding_pointless/status?groupId=wackiness_remote&service=postgres_rds"
    ),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="fivetran_source",
    fullyQualifiedName=FullyQualifiedEntityName("fivetran_source"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Fivetran,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="wackiness_remote_aiding_pointless",
    fullyQualifiedName="fivetran_source.wackiness_remote_aiding_pointless",
    displayName="test <> postgres_rds",
    tasks=[
        Task(
            name="wackiness_remote_aiding_pointless",
            displayName="test <> postgres_rds",
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)


class FivetranUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.pipeline.fivetran.connection.get_connection")
    def __init__(self, methodName, fivetran_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_fivetran_config)
        self.fivetran = FivetranSource.create(
            mock_fivetran_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.fivetran.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.fivetran.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.client = fivetran_client.return_value
        self.client.list_groups.return_value = [mock_data.get("group")]
        self.client.list_group_connectors.return_value = [mock_data.get("source")]
        self.client.get_destination_details.return_value = mock_data.get("destination")
        self.client.get_connector_details.return_value = mock_data.get("source")

    def test_pipeline_list(self):
        assert list(self.fivetran.get_pipelines_list())[0] == EXPECTED_FIVETRAN_DETAILS

    def test_pipeline_name(self):
        assert (
            self.fivetran.get_pipeline_name(EXPECTED_FIVETRAN_DETAILS)
            == f'{mock_data.get("group").get("name")} <> {mock_data.get("source").get("schema")}'
        )

    def test_pipelines(self):
        pipline = list(self.fivetran.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[0].right
        assert pipline == EXPECTED_CREATED_PIPELINES
