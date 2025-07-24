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
Test flink using the topology
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.ingestion.source.pipeline.flink.metadata import FlinkSource
from metadata.ingestion.source.pipeline.flink.models import FlinkPipeline

mock_flink_config = {
    "source": {
        "type": "flink",
        "serviceName": "flink_test",
        "serviceConnection": {
            "config": {"type": "Flink", "hostPort": "http://127.0.0.1:8081"}
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


MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="flink_test",
    fullyQualifiedName=FullyQualifiedEntityName("flink_test"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Flink,
)

MOCK_PIPELINE = FlinkPipeline(
    jid="2aaa012e-099a-11ed-861d-0242ac120002",
    name="alphabet",
    state="Completed",
    start_time=1718948457617,
    end_time=1718948457663,
)
MOCK_JOB = {
    "jid": "14f093794bf421e732aa6750d15ce5a6",
    "name": "WordCount",
    "start-time": 1718926965658,
    "end-time": 1718926965903,
    "duration": 245,
    "state": "FINISHED",
    "last-modification": 1718926965903,
    "tasks": {
        "running": 0,
        "canceling": 0,
        "canceled": 0,
        "total": 2,
        "created": 0,
        "scheduled": 0,
        "deploying": 0,
        "reconciling": 0,
        "finished": 2,
        "initializing": 0,
        "failed": 0,
    },
}
EXPECTED_PIPELINE_NAME = "alphabet"
EXPECTED_PIPELINE = [
    CreatePipelineRequest(
        name=EntityName(root="alphabet"),
        sourceUrl=SourceUrl(
            root="<MagicMock name='get_connection().config.hostPort' id='4883082864'>/#/job/running/None/overview"
        ),
        tasks=[],
        service=FullyQualifiedEntityName(root="flink_test"),
    )
]


class FlinkUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.pipeline.flink.connection.get_connection")
    def __init__(self, methodName, flink_client, test_connection) -> None:

        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_flink_config)
        self.flink = FlinkSource.create(
            mock_flink_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.flink.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name
        self.flink.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.client = flink_client.return_value

    def test_pipeline_name(self):
        assert self.flink.get_pipeline_name(MOCK_PIPELINE) == EXPECTED_PIPELINE_NAME

    def test_pipelines(self):
        pipelines_list = []
        results = self.flink.yield_pipeline(MOCK_PIPELINE)
        for result in results:
            pipelines_list.append(result.right)

        for _, (expected, original) in enumerate(
            zip(EXPECTED_PIPELINE, pipelines_list)
        ):
            expected.sourceUrl = original.sourceUrl
            self.assertEqual(expected, original)
