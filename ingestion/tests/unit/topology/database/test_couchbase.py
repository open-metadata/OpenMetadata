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
Test Couchbase using the topology
"""

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
from metadata.ingestion.source.database.couchbase.metadata import CouchbaseSource

mock_couch_config = {
    "source": {
        "type": "couchbase",
        "serviceName": "local_couchbase",
        "serviceConnection": {
            "config": {
                "type": "Couchbase",
                "bucket": "default",
                "username": "username",
                "password": "password",
                "hostport": "localhost",
            },
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
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
    name="local_couchbase",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Couchbase,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="default",
    fullyQualifiedName="local_couchbase.default",
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
    fullyQualifiedName="local_couchbase.default.default",
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

MOCK_CREATE_TABLE = [
    CreateTableRequest(
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
                dataType=DataType.RECORD,
                dataTypeDisplay=DataType.RECORD.value,
                children=[
                    Column(
                        name="line",
                        dataType=DataType.STRING,
                        dataTypeDisplay=DataType.STRING.value,
                    )
                ],
            ),
        ],
        tableConstraints=None,
        databaseSchema="local_couchbase.default.default",
    )
]

EXPECTED_DATABASE_NAMES = ["default"]

EXPECTED_DATABASE_SCHEMA_NAMES = [
    "random_schema",
    "random1_schema",
]

MOCK_DATABASE_SCHEMA_NAMES = [
    "random_schema",
    "random1_schema",
]

EXPECTED_TABLE_NAMES = [
    ("random_table", TableType.Regular),
    ("random1_table", TableType.Regular),
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


class CouchbaseUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.couchbase.metadata.CouchbaseSource.test_connection"
    )
    @patch("metadata.ingestion.source.database.couchbase.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False

        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_couch_config)
        self.couch_source = CouchbaseSource.create(
            mock_couch_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.couch_source.context.__dict__["database_service"] = MOCK_DATABASE_SERVICE
        self.couch_source.context.__dict__["database"] = MOCK_DATABASE
        self.couch_source.context.__dict__["database_schema"] = MOCK_DATABASE_SCHEMA

    def test_database_names(self):
        assert EXPECTED_DATABASE_NAMES == list(self.couch_source.get_database_names())

    def test_database_schema_names(self):
        with patch.object(
            CouchbaseSource,
            "get_schema_name_list",
            return_value=MOCK_DATABASE_SCHEMA_NAMES,
        ):
            assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
                self.couch_source.get_database_schema_names()
            )

    def test_table_names(self):
        with patch.object(
            CouchbaseSource, "get_table_name_list", return_value=MOCK_TABLE_NAMES
        ):
            assert EXPECTED_TABLE_NAMES == list(
                self.couch_source.get_tables_name_and_type()
            )

    def test_yield_tables(self):
        Column.__eq__ = custom_column_compare
        with patch.object(
            CouchbaseSource, "get_table_columns_dict", return_value=MOCK_JSON_TABLE_DATA
        ):
            assert MOCK_CREATE_TABLE == [
                either.right
                for either in self.couch_source.yield_table(EXPECTED_TABLE_NAMES[0])
            ]
