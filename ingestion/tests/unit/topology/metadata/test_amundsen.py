import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.metadata.amundsen import AmundsenSource

amundsen_mock_config = {
    "source": {
        "type": "amundsen",
        "serviceName": "local_amundsen",
        "serviceConnection": {
            "config": {
                "type": "Amundsen",
                "username": "neo4j",
                "password": "test",
                "hostPort": "bolt://localhost:7687",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            },
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "no-auth",
        }
    },
}

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/amundsen_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

EXPECTED_TABLE_NAME = [
    "delta_test_table",
    "test's_table4",
    "test_table1",
    "test_table2",
    "test_table3",
    "test_view1",
]
EXPECTED_TABLE_DESCRIPTION = [
    "test table for delta",
    "4th test",
    "1st test table",
    "2nd test table",
    "3rd test",
    "1st test view",
]


class AmundsenUnitTest(TestCase):
    @patch("metadata.clients.neo4j_client.Neo4jHelper")
    def __init__(self, methodName, neo4j_helper) -> None:
        super().__init__(methodName)
        self.config = OpenMetadataWorkflowConfig.parse_obj(amundsen_mock_config)
        self.amundsen_source = AmundsenSource.create(
            amundsen_mock_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.amundsen_source.neo4j_helper = neo4j_helper.return_value
        self.amundsen_source.neo4j_helper.execute_query.return_value = mock_data
        self.table_details = []
        for data in mock_data:
            table_requests_result = self.amundsen_source.create_table_entity(table=data)
            for table_request in table_requests_result:
                if type(table_request) == CreateTableRequest:
                    self.table_details.append(table_request)

    def test_table_name(self):
        for i in range(0, len(self.table_details)):
            assert self.table_details[i].name.__root__ in EXPECTED_TABLE_NAME

    def test_table_description(self):
        for i in range(0, len(self.table_details)):
            assert (
                self.table_details[i].description.__root__ in EXPECTED_TABLE_DESCRIPTION
            )
