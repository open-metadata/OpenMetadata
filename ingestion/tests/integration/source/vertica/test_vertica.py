import imp
import json
from unittest import TestCase, mock

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.source.vertica import VerticaSource

config = {
    "source": {
        "type": "vertica",
        "config": {
            "username": "test",
            "password": "test",
            "database": "test_openmetadata_db",
            "service_name": "test_vertica",
            "host_port": "localhost:5433",
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "metadata_server": {
        "type": "metadata-server",
        "config": {
            "api_endpoint": "http://localhost:8585/api",
            "auth_provider_type": "no-auth",
        },
    },
}


class VerticaIngestionTest(TestCase):
    VERTICA_SOURCE = "metadata.ingestion.source.vertica.VerticaSource"

    def test_vertica(self):
        mocked_client = mock.MagicMock()
        with mock.patch(self.VERTICA_SOURCE) as mock_sdk:
            mock_sdk.return_value = mocked_client
            mocked_client.get_connection.return_value = DatabaseService(
                id="2ea1c918-9e2b-11ec-bf6e-1e00fb0a5848",
                name="test_vertica",
                displayName="test_vertica",
                serviceType=DatabaseServiceType.Vertica,
                databaseConnection=DatabaseConnection(
                    username="test",
                    password="test",
                    hostPort="localhost:5433",
                    database="test_openmetadata_db",
                ),
                href="http://localhost:8585/api/v1/services/databaseServices/2ea1c918-9e2b-11ec-bf6e-1e00fb0a5848",
                version=0.1,
            )
            mocked_client.fetch_tables.return_value = [
                OMetaDatabaseAndTable(
                    database=Database(
                        name="test_openmetadata_db",
                        service=EntityReference(
                            id="2ea1c918-9e2b-11ec-bf6e-1e00fb0a5848", type="Vertica"
                        ),
                    ),
                    table=Table(
                        id="2f8cf334-9e2b-11ec-bf6e-1e00fb0a5848",
                        name="test_table",
                        fullyQualifiedName="test_vertica.test_openmetadata_db.test_table",
                        tableType=TableType.Regular,
                        columns=[
                            Column(
                                name="ID",
                                dataType=DataType.VARCHAR,
                                dataLength=36,
                                dataTypeDisplay="VARCHAR(36)",
                                constraint=Constraint.PRIMARY_KEY,
                            ),
                            Column(
                                name="EMAIL",
                                dataType=DataType.VARCHAR,
                                dataLength=36,
                                dataTypeDisplay="VARCHAR(36)",
                                constraint=Constraint.NOT_NULL,
                            ),
                            Column(
                                name="Name",
                                dataType=DataType.VARCHAR,
                                dataLength=36,
                                dataTypeDisplay="VARCHAR(36)",
                                constraint=Constraint.NULL,
                            ),
                        ],
                    ),
                )
            ]

            workflow = Workflow.create(config)
            workflow.execute()
            workflow.print_status()
            workflow.stop()
