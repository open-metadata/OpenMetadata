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
Test Hive using the topology
"""

import types
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import INTEGER, VARCHAR, Integer, String

import metadata.ingestion.source.database.hive.utils as hive_dialect
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.hive.metadata import HiveSource

mock_hive_config = {
    "source": {
        "type": "hive",
        "serviceName": "sample_hive",
        "serviceConnection": {
            "config": {
                "type": "Hive",
                "databaseSchema": "test_database_schema",
                "username": "username",
                "hostPort": "localhost:1466",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="hive_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Hive,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="sample_database",
    fullyQualifiedName="hive_source_test.sample_database",
    displayName="sample_database",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="sample_schema",
    fullyQualifiedName="hive_source_test.sample_database.sample_schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

MOCK_COLUMN_VALUE = [
    {
        "name": "sample_col_1",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "sample_col_2",
        "type": INTEGER(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "int",
        "comment": None,
    },
    {
        "name": "sample_col_3",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "sample_col_4",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
        "system_data_type": "varchar(50)",
    },
]

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName(__root__="sample_database"),
        displayName=None,
        description=None,
        tags=None,
        owner=None,
        service=FullyQualifiedEntityName(__root__="hive_source_test"),
        dataProducts=None,
        default=False,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName(__root__="sample_schema"),
        displayName=None,
        description=None,
        owner=None,
        database=FullyQualifiedEntityName(__root__="hive_source_test.sample_database"),
        dataProducts=None,
        tags=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_TABLE = [
    CreateTableRequest(
        name=EntityName(__root__="sample_table"),
        displayName=None,
        description=None,
        tableType=TableType.Regular.name,
        columns=[
            Column(
                name=ColumnName(__root__="sample_col_1"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(50)",
                description=None,
                fullyQualifiedName=None,
                tags=None,
                constraint="NULL",
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(__root__="sample_col_2"),
                displayName=None,
                dataType=DataType.INT.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="int",
                description=None,
                fullyQualifiedName=None,
                tags=None,
                constraint="NULL",
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(__root__="sample_col_3"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(50)",
                description=None,
                fullyQualifiedName=None,
                tags=None,
                constraint="NULL",
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(__root__="sample_col_4"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(50)",
                description=None,
                fullyQualifiedName=None,
                tags=None,
                constraint="NULL",
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
        ],
        tableConstraints=[],
        tablePartition=None,
        tableProfilerConfig=None,
        owner=None,
        databaseSchema=FullyQualifiedEntityName(
            __root__="hive_source_test.sample_database.sample_schema"
        ),
        tags=None,
        schemaDefinition=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        dataProducts=None,
        fileFormat=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_COMPLEX_COL_TYPE = [
    {
        "name": "id",
        "type": Integer,
        "comment": None,
        "nullable": True,
        "default": None,
        "system_data_type": "int",
        "is_complex": False,
    },
    {
        "name": "data",
        "type": String(),
        "comment": None,
        "nullable": True,
        "default": None,
        "system_data_type": "struct<a:struct<b:decimal(20,0)>>",
        "is_complex": True,
    },
    {
        "name": "data2",
        "type": String(),
        "comment": None,
        "nullable": True,
        "default": None,
        "system_data_type": "struct<colll:decimal(20,0)>",
        "is_complex": True,
    },
]


class HiveUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Hive Unit Test
    """

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(
        self,
        methodName,
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_hive_config)
        self.hive = HiveSource.create(
            mock_hive_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.hive.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.__root__
        self.thread_id = self.hive.context.get_current_thread_id()
        self.hive._inspector_map[self.thread_id] = types.SimpleNamespace()

        self.hive._inspector_map[
            self.thread_id
        ].get_pk_constraint = lambda table_name, schema_name: []
        self.hive._inspector_map[
            self.thread_id
        ].get_unique_constraints = lambda table_name, schema_name: []
        self.hive._inspector_map[
            self.thread_id
        ].get_foreign_keys = lambda table_name, schema_name: []

    def test_yield_database(self):
        assert EXPECTED_DATABASE == [
            either.right
            for either in self.hive.yield_database(MOCK_DATABASE.name.__root__)
        ]

        self.hive.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.__root__
        self.hive.context.get().__dict__["database"] = MOCK_DATABASE.name.__root__

    def test_yield_schema(self):
        assert EXPECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.hive.yield_database_schema(
                schema_name=MOCK_DATABASE_SCHEMA.name.__root__
            )
        ]

        self.hive.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.__root__

    def test_yield_table(self):
        self.hive.inspector.get_columns = (
            lambda table_name, schema_name, db_name: MOCK_COLUMN_VALUE
        )
        assert EXPECTED_TABLE == [
            either.right
            for either in self.hive.yield_table(("sample_table", "Regular"))
        ]

    def test_col_data_type(self):
        """
        Test different col type ingested as expected
        """
        table_columns = [
            ("id", "int", ""),
            ("data", "struct<a:struct<b:decimal(20,0)>>", ""),
            ("data2", "struct<colll:decimal(20,0)>", ""),
        ]
        hive_dialect._get_table_columns = (  # pylint: disable=protected-access
            lambda connection, table_name, schema_name: table_columns
        )

        col_list = list(
            hive_dialect.get_columns(
                self=hive_dialect,
                connection=mock_hive_config["source"],
                table_name="sample_table",
                schema="sample_schema",
            )
        )
        for _, (expected, original) in enumerate(
            zip(EXPECTED_COMPLEX_COL_TYPE, col_list)
        ):

            def custom_eq(self, __value: object) -> bool:
                return (
                    self.length == __value.length
                    and self.collation == __value.collation
                )

            String.__eq__ = custom_eq
            self.assertEqual(expected, original)
