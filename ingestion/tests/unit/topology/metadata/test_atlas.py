import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.metadata.atlas import AtlasSource

mock_atlas_config = {
    "source": {
        "type": "Atlas",
        "serviceName": "local_atlas",
        "serviceConnection": {
            "config": {
                "type": "Atlas",
                "atlasHost": "http://localhost:3001",
                "username": "username",
                "password": "password",
                "dbService": "deltalake3",
                "messagingService": "Mysql",
                "serviceType": "Hive",
                "hostPort": "http://localhost:10000",
                "entityTypes": "examples/workflows/atlas_mapping.yaml",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
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


KEY = "Table"
TABLES = {KEY: ["b233b2ae-8a4a-44a3-b446-4027462b2cc6"]}

METADATA_CONFIG = OpenMetadataConnection(
    hostPort=mock_atlas_config["workflowConfig"]["openMetadataServerConfig"][
        "hostPort"
    ],
)

MOCK_DATABASE_SERVICE = DatabaseService(
    id="4cc102e6-ab46-4c16-a69f-6e5f23453634",
    name="deltalake3",
    fullyQualifiedName="deltalake3",
    serviceType=DatabaseServiceType.Datalake,
)

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/atlas_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

EXPECTED_TABLE_NAME = [
    "sales_fact",
]
EXPECTED_DESCRIPTION_NAME = ["sales fact table"]


class AtlasUnitTest(TestCase):
    @patch("metadata.ingestion.source.metadata.atlas.AtlasSource.test_connection")
    @patch("metadata.ingestion.source.metadata.atlas.AtlasClient")
    def __init__(self, methodName, atlas_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_atlas_config)
        self.atlas_source = AtlasSource.create(
            mock_atlas_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.atlas_client = atlas_client.return_value
        self.atlas_source.service = MOCK_DATABASE_SERVICE
        self.atlas_client.get_entity.return_value = mock_data
        self.table_details = []
        result = self.atlas_source._parse_table_entity(KEY, TABLES[KEY])
        for r in result:
            if type(r) == CreateTableRequest:
                self.table_details.append(r)

    def test_name(self):
        for table in self.table_details:
            assert table.name.__root__ in EXPECTED_TABLE_NAME

    def test_description(self):
        for table in self.table_details:
            assert table.description.__root__ in EXPECTED_DESCRIPTION_NAME
