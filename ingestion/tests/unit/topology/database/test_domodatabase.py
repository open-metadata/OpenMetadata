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
Test Domo Dashboard using the topology
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.domodatabase.metadata import DomodatabaseSource

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="domodashboard_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.DomoDatabase,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="do_it_all_with_default_config",
    fullyQualifiedName="domodashboard_source_test.do_it_all_with_default_config",
    displayName="do_it_all_with_default_config",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="do_it_all_with_default_schema",
    fullyQualifiedName="domodashboard_source_test.do_it_all_with_default_config.do_it_all_with_default_schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name="do_it_all_with_default_schema",
        displayName=None,
        description=None,
        owners=None,
        database="domodashboard_source_test.do_it_all_with_default_config",
    )
]

mock_domodatabase_config = {
    "source": {
        "type": "domodatabase",
        "serviceName": "test2",
        "serviceConnection": {
            "config": {
                "type": "DomoDatabase",
                "clientId": "00000",
                "secretToken": "abcdefg",
                "accessToken": "accessTpokem",
                "apiHost": "api.domo.com",
                "instanceDomain": "https://domain.domo.com",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "domodatabase"},
        }
    },
}


MOCK_TABLE = {
    "id": "01bcd21a-6a0d-4560-93c3-ad99b5e9af4c",
    "name": "DataSet Input",
    "description": "this is a description for dataset input",
    "rows": 99,
    "columns": 10,
    "schema": {
        "columns": [
            {"type": "DOUBLE", "name": "amount"},
            {"type": "DOUBLE", "name": "bank_transfer_amount"},
            {"type": "DOUBLE", "name": "coupon_amount"},
            {"type": "DOUBLE", "name": "credit_card_amount"},
        ]
    },
    "owner": {"id": 1027954122, "name": "Nihar Doshi"},
    "dataCurrentAt": "2022-10-18T05:30:06Z",
    "createdAt": "2022-10-17T05:52:21Z",
    "updatedAt": "2022-10-18T05:30:07Z",
    "pdpEnabled": False,
    "policies": [
        {
            "id": 17,
            "type": "open",
            "name": "All Rows",
            "filters": [],
            "users": [],
            "virtualUsers": [],
            "groups": [],
        }
    ],
}


EXPTECTED_TABLE = [
    CreateTableRequest(
        name="DataSet Input",
        displayName="DataSet Input",
        description="this is a description for dataset input",
        tableType=TableType.Regular.value,
        columns=[
            Column(
                name="amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=1,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
            Column(
                name="bank_transfer_amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=2,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
            Column(
                name="coupon_amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=3,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
            Column(
                name="credit_card_amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=4,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
        ],
        tableConstraints=None,
        tablePartition=None,
        tableProfilerConfig=None,
        owners=None,
        databaseSchema="domodashboard_source_test.do_it_all_with_default_config.do_it_all_with_default_schema",
        tags=None,
        schemaDefinition=None,
        extension=None,
    )
]


class DomoDatabaseUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Domo Database Unit Test
    """

    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
    )
    @patch("pydomo.Domo")
    def __init__(
        self,
        methodName,
        domo_client,  # pylint: disable=unused-argument
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_domodatabase_config
        )
        self.domodatabase = DomodatabaseSource.create(
            mock_domodatabase_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.domodatabase.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.domodatabase.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.domodatabase.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    def test_yield_schema(self):
        schema_list = []
        yield_schemas = self.domodatabase.yield_database_schema(
            schema_name=MOCK_DATABASE_SCHEMA.name.root
        )

        for schema in yield_schemas:
            if isinstance(schema, CreateDatabaseSchemaRequest):
                schema_list.append(schema)

        for _, (exptected, original) in enumerate(
            zip(EXPECTED_DATABASE_SCHEMA, schema_list)
        ):
            self.assertEqual(exptected, original)

    def test_yield_table(self):
        table_list = []
        self.domodatabase.domo_client.ds_meta.return_value = MOCK_TABLE
        yield_tables = self.domodatabase.yield_table(
            ("01bcd21a-6a0d-4560-93c3-ad99b5e9af4c", "Regular")
        )
        for table in yield_tables:
            if isinstance(table, CreateTableRequest):
                table_list.append(table)

        for _, (expected, original) in enumerate(zip(EXPTECTED_TABLE, table_list)):
            self.assertEqual(expected, original)
