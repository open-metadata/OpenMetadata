import json
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.ingestion.api.workflow import Workflow
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


MOCK_CONNECTION = AirbyteConnection(hostPort="http://localhost:1234")


class AirbyteUnitTest(TestCase):
    @patch("metadata.utils.connections.test_connection")
    def test_airbyte_source(self, test_connection):
        test_connection.return_value = True
        self.workflow = Workflow.create(mock_airbyte_config)
        self.workflow.source.client.list_workspaces = lambda: mock_data.get("workspace")
        self.workflow.source.client.list_connections = (
            lambda workflow_id: mock_data.get("connection")
        )
        pipeline_list = list(self.workflow.source.get_pipelines_list())
        assert pipeline_list[0] == EXPECTED_ARIBYTE_DETAILS
