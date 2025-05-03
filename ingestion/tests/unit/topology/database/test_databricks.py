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
Test databricks using the topology
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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.databricks.metadata import DatabricksSource

# pylint: disable=line-too-long
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
                "httpPath": "/sql/1.0/warehouses/abcdedfg",
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
            "securityConfig": {"jwtToken": "databricks"},
        }
    },
}


MOCK_TABLE = {
    "id": "2d725b6e-1588-4814-9d8b-eff384cd1053",
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

MOCK_TABLE_2 = {
    "id": "3df43ed7-5f2f-46bb-9793-384c6374a81d",
    "name": "growth data",
    "description": "company growth data",
    "rows": 5,
    "columns": 2,
    "schema": {
        "columns": [
            {"type": "ARRAY", "name": "quarters.result"},
            {"type": "NUMBER", "name": "profit"},
        ]
    },
    "owner": {"id": 6024954162, "name": "Sam"},
    "dataCurrentAt": "2024-07-15T05:30:06Z",
    "createdAt": "2024-07-15T05:52:21Z",
    "updatedAt": "2024-07-15T05:30:07Z",
}

EXPTECTED_TABLE_2 = [
    CreateTableRequest(
        name="growth data",
        displayName="growth data",
        description="company growth data",
        tableType=TableType.Regular.value,
        columns=[
            Column(
                name="quarters.result",
                dataType=DataType.ARRAY.value,
            ),
            Column(
                name="profit",
                dataType=DataType.NUMBER.value,
            ),
        ],
        databaseSchema=FullyQualifiedEntityName(
            "local_databricks.hive_metastore.do_it_all_with_default_schema"
        ),
    )
]

EXPECTED_DATABASE_NAMES = ["hive_metastore"]
EXPECTED_DATABASE_SCHEMA_NAMES = ["default"]

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
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="ec5be98f-917c-44be-b178-47b3237ef648",
    name="do_it_all_with_default_schema",
    fullyQualifiedName="domodatabase_source.do_it_all_with_default_config.do_it_all_with_default_schema",
    service=EntityReference(id="ec5be98f-917c-44be-b178-47b3237ef648", type="database"),
    database=EntityReference(
        id="a4e2f4aa-10af-4d4b-a85b-5daad6f70720",
        type="database",
    ),
)


EXPTECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name="do_it_all_with_default_schema",
        displayName=None,
        description=None,
        owners=None,
        database="local_databricks.hive_metastore",
    )
]


EXPTECTED_TABLE = [
    CreateTableRequest(
        name="newtable",
        displayName="newtable",
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
        databaseSchema=FullyQualifiedEntityName(
            "local_databricks.hive_metastore.do_it_all_with_default_schema"
        ),
        tags=None,
        schemaDefinition=None,
        extension=None,
    )
]


class DatabricksUnitTest(TestCase):
    """
    Databricks unit tests
    """

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    @patch(
        "metadata.ingestion.source.database.databricks.metadata.DatabricksSource._init_version"
    )
    def __init__(self, methodName, test_connection, db_init_version) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        db_init_version.return_value = None

        self.config = OpenMetadataWorkflowConfig.model_validate(mock_databricks_config)
        self.databricks_source = DatabricksSource.create(
            mock_databricks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.databricks_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.databricks_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root

        self.databricks_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    def test_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.databricks_source.get_database_schema_names()
        )

    def test_raw_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.databricks_source.get_raw_database_schema_names()
        )

    def test_yield_schema(self):
        schema_list = []
        yield_schemas = self.databricks_source.yield_database_schema(
            schema_name=model_str(MOCK_DATABASE_SCHEMA.name)
        )

        for schema in yield_schemas:
            if isinstance(schema, CreateDatabaseSchemaRequest):
                schema_list.append(schema)

        for _, (exptected, original) in enumerate(
            zip(EXPTECTED_DATABASE_SCHEMA, schema_list)
        ):
            self.assertEqual(exptected, original)

    def test_yield_table(self):
        table_list = []
        yield_tables = self.databricks_source.yield_table(
            ("2d725b6e-1588-4814-9d8b-eff384cd1053", "Regular")
        )

        for table in yield_tables:
            if isinstance(table, CreateTableRequest):
                table_list.append(table)

        for _, (expected, original) in enumerate(zip(EXPTECTED_TABLE, table_list)):
            self.assertEqual(expected, original)

    def test_yield_table_2(self):
        table_list = []
        yield_tables = self.databricks_source.yield_table(
            ("3df43ed7-5f2f-46bb-9793-384c6374a81d", "Regular")
        )

        for table in yield_tables:
            if isinstance(table, CreateTableRequest):
                table_list.append(table)

        for _, (expected, original) in enumerate(zip(EXPTECTED_TABLE_2, table_list)):
            self.assertEqual(expected, original)
