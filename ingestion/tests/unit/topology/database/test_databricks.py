from unittest import TestCase
from unittest.mock import patch

from sqlalchemy_databricks import DatabricksDialect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.databricks.metadata import DatabricksSource

mock_databricks_config = {
    "source": {
        "type": "databricks",
        "serviceName": "local_datalake",
        "serviceConnection": {
            "config": {
                "type": "Databricks",
                "catalog": "hive_metastore",
                "databaseSchema": "default",
                "token": "123sawdtesttoken",
                "hostPort": "localhost:443",
                "connectionArguments": {"http_path": "/sql/1.0/warehouses/abcdedfg"},
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {"excludes": []},
            }
        },
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

EXPECTED_DATABASE_NAMES = ["hive_metastore"]

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="local_databricks",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Databricks,
)

MOCK_DATABASE = Database(
    id="a4e2f4aa-10af-4d4b-a85b-5daad6f70720",
    name="hive_metastore",
    fullyQualifiedName="local_databricks.hive_metastore",
    displayName="hive_metastore",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)


class DatabricksUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.databricks.metadata.DatabricksSource.test_connection"
    )
    @patch()
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_databricks_config)
        self.databricks_source = DatabricksSource.create(
            mock_databricks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.databricks_source.context.__dict__["database"] = MOCK_DATABASE
        self.databricks_source.context.__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE

    def test_database_names(self):
        assert EXPECTED_DATABASE_NAMES == list(
            self.databricks_source.get_database_names()
        )
