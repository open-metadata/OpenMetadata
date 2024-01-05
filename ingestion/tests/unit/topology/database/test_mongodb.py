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
Test MongoDB using the topology
"""

import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.mongodb.metadata import MongodbSource

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/glue_db_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

mock_mongo_config = {
    "source": {
        "type": "mongodb",
        "serviceName": "local_mongodb",
        "serviceConnection": {
            "config": {
                "type": "MongoDB",
                "username": "ulixius",
                "password": "dummy_password",
                "hostPort": "localhost:27017",
            },
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {"includes": ["random_schema"]},
                "tableFilterPattern": {"includes": ["random_table"]},
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

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="local_mongodb",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="default",
    fullyQualifiedName="local_mongodb.default",
    displayName="default",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="local_mongodb.default.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_JSON_TABLE_DATA = [
    {
        "name": "mayur",
        "age": 25,
        "is_married": False,
        "address": {"line": "random address"},
    },
    {"name": "onkar", "age": 26, "is_married": True},
]

MOCK_CREATE_TABLE = CreateTableRequest(
    name="random_table",
    tableType=TableType.Regular,
    columns=[
        Column(
            name="name",
            displayName="name",
            dataType=DataType.STRING,
            dataTypeDisplay=DataType.STRING.value,
        ),
        Column(
            name="age",
            displayName="age",
            dataType=DataType.INT,
            dataTypeDisplay=DataType.INT.value,
        ),
        Column(
            name="is_married",
            displayName="is_married",
            dataType=DataType.BOOLEAN,
            dataTypeDisplay=DataType.BOOLEAN.value,
        ),
        Column(
            name="address",
            displayName="address",
            dataType=DataType.JSON,
            dataTypeDisplay=DataType.JSON.value,
            children=[
                Column(
                    name="line",
                    dataType=DataType.STRING,
                    dataTypeDisplay=DataType.STRING.value,
                    displayName="line",
                )
            ],
        ),
    ],
    tableConstraints=None,
    databaseSchema="local_mongodb.default.default",
)


EXPECTED_DATABASE_NAMES = ["default"]

EXPECTED_DATABASE_SCHEMA_NAMES = [
    "random_schema",
]

MOCK_DATABASE_SCHEMA_NAMES = [
    "random_schema",
    "random1_schema",
]

EXPECTED_TABLE_NAMES = [
    ("random_table", TableType.Regular),
]

MOCK_TABLE_NAMES = [
    "random_table",
    "random1_table",
]


def custom_column_compare(self, other):
    return (
        self.name == other.name
        and self.description == other.description
        and self.children == other.children
    )


class MongoDBUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.mongodb.metadata.MongodbSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_mongo_config)
        self.mongo_source = MongodbSource.create(
            mock_mongo_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.mongo_source.context.__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.__root__
        self.mongo_source.context.__dict__["database"] = MOCK_DATABASE.name.__root__
        self.mongo_source.context.__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.__root__

    def test_database_names(self):
        assert EXPECTED_DATABASE_NAMES == list(self.mongo_source.get_database_names())

    def test_database_schema_names(self):
        with patch.object(
            MongodbSource,
            "get_schema_name_list",
            return_value=MOCK_DATABASE_SCHEMA_NAMES,
        ):
            assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
                self.mongo_source.get_database_schema_names()
            )

    def test_table_names(self):
        with patch.object(
            MongodbSource, "get_table_name_list", return_value=MOCK_TABLE_NAMES
        ):
            assert EXPECTED_TABLE_NAMES == list(
                self.mongo_source.get_tables_name_and_type()
            )

    def test_yield_tables(self):
        Column.__eq__ = custom_column_compare
        with patch.object(
            MongodbSource, "get_table_columns_dict", return_value=MOCK_JSON_TABLE_DATA
        ):
            assert (
                MOCK_CREATE_TABLE
                == next(self.mongo_source.yield_table(EXPECTED_TABLE_NAMES[0])).right
            )
