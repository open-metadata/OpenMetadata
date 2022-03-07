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
Query parser utils tests
"""
import json
from os import name
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

config = """
{
  "source": {
    "type": "mysql",
    "config": {
      "username": "test",
      "password": "test",
      "database": "test_openmetadata_db",
      "host_port":"localhost:3306",
      "service_name": "test_mysql"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
"""


class MysqlIngestionTest(TestCase):
    FROZEN_TIME = "2022-02-03 07:00:00"
    MYSQL_SOURCE = "metadata.ingestion.source.mysql.MysqlSource"

    def test_mysql_ingestion(self):
        mocked_client = mock.MagicMock()
        with mock.patch(self.MYSQL_SOURCE) as mock_sdk:
            mock_sdk.return_value = mocked_client
            mocked_client.service.return_value = DatabaseService(
                id="051b94f8-9dfd-11ec-b909-0242ac120002",
                name="test_mysql",
                displayName="test_mysql",
                serviceType=DatabaseServiceType.MySQL,
                databaseConnection=DatabaseConnection(
                    username="test",
                    password="test",
                    hostPort="localhost:3306",
                    database="test_openmetadata_db",
                ),
                href="http://localhost:8585/api/v1/services/databaseServices/051b94f8-9dfd-11ec-b909-0242ac120002",
                version="0.1",
            )

            mocked_client.fetch_tables.return_value = [
                OMetaDatabaseAndTable(
                    database=Database(
                        name="test_openmetadata_db",
                        service=EntityReference(
                            id="051b94f8-9dfd-11ec-b909-0242ac120002",
                            type="MySQL",
                        ),
                    ),
                    table=Table(
                        id="4641fc92-9e11-11ec-b909-0242ac120002",
                        name="test_table_1",
                        fullyQualifiedName="test_mysql.test_openmetadata_db.test_table_1",
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
                                dataLength=255,
                                dataTypeDisplay="VARCHAR(255)",
                                constraint=Constraint.UNIQUE,
                            ),
                            Column(
                                name="Name",
                                dataType=DataType.VARCHAR,
                                dataLength=255,
                                dataTypeDisplay="VARCHAR(255)",
                                constraint=Constraint.NOT_NULL,
                            ),
                        ],
                    ),
                ),
            ]
            mocked_client.fetch_views.return_value = []
            mocked_client.delete_tables.return_value = None
            mocked_client.connection.return_value = None

            workflow = Workflow.create(json.loads(config))
            workflow.execute()
            workflow.print_status()
            workflow.stop()
