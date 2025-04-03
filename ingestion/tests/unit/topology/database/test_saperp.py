#  Copyright 2024 Collate
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
TestCase for SAP ERP using the topology
"""

import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    TableConstraint,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.saperp.client import SapErpClient
from metadata.ingestion.source.database.saperp.metadata import SaperpSource
from metadata.ingestion.source.database.saperp.models import SapErpColumn, SapErpTable

mock_saperp_config = {
    "source": {
        "type": "SapErp",
        "serviceName": "local_saperp",
        "serviceConnection": {
            "config": {
                "type": "SapErp",
                "hostPort": "https://test.com",
                "apiKey": "test_api_key",
                "databaseName": "saperp_database",
                "databaseSchema": "saperp_database_schema",
                "paginationLimit": 100,
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="saperp_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.SapErp,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="saperp_database",
    fullyQualifiedName="saperp_source_test.saperp_database",
    displayName="saperp_database",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="saperp_database_schema",
    fullyQualifiedName="saperp_source_test.saperp_database.saperp_database_schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

EXPECTED_TABLES_AND_COLUMNS = [
    CreateTableRequest(
        name=EntityName(root="T001B_PS"),
        displayName=None,
        description=Markdown(root="Account Assignment Objects in General Ledger"),
        tableType="Regular",
        columns=[
            Column(
                name=ColumnName(root="BUKRS"),
                displayName="Pstng period variant",
                dataType="CHAR",
                arrayDataType=None,
                dataLength=4,
                precision=None,
                scale=None,
                dataTypeDisplay="CHAR(4)",
                description=Markdown(root="Posting Period Variant"),
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=3,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(root="FIELD"),
                displayName="GL Field Name",
                dataType="CHAR",
                arrayDataType=None,
                dataLength=30,
                precision=None,
                scale=None,
                dataTypeDisplay="CHAR(30)",
                description=Markdown(root="General Ledger Field Name"),
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=4,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(root="MANDT"),
                displayName="Client",
                dataType="INT",
                arrayDataType=None,
                dataLength=3,
                precision=None,
                scale=None,
                dataTypeDisplay="CLNT(3)",
                description=Markdown(root="Client"),
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=1,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(root="RRCTY"),
                displayName="Record Type",
                dataType="CHAR",
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="CHAR(1)",
                description=Markdown(root="Record Type"),
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=2,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
        ],
        dataModel=None,
        tableConstraints=[
            TableConstraint(
                constraintType="PRIMARY_KEY",
                columns=["BUKRS", "FIELD", "MANDT", "RRCTY"],
                referredColumns=None,
            )
        ],
        tablePartition=None,
        tableProfilerConfig=None,
        owners=None,
        databaseSchema=FullyQualifiedEntityName(
            root="saperp_source_test.saperp_database.saperp_database_schema"
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
    ),
    CreateTableRequest(
        name=EntityName(root="T001B_PS_PER"),
        displayName=None,
        description=Markdown(
            root="Permitted Posting Periods for Account Assignment Objects"
        ),
        tableType="Regular",
        columns=[
            Column(
                name=ColumnName(root="BKONT"),
                displayName="To Account Assmnt",
                dataType="CHAR",
                arrayDataType=None,
                dataLength=30,
                precision=None,
                scale=None,
                dataTypeDisplay="CHAR(30)",
                description=Markdown(root="To Account Assignment"),
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=5,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(root="BRGRU"),
                displayName="Authorization Group",
                dataType="CHAR",
                arrayDataType=None,
                dataLength=4,
                precision=None,
                scale=None,
                dataTypeDisplay="CHAR(4)",
                description=Markdown(root="Authorization Group"),
                fullyQualifiedName=None,
                tags=None,
                constraint="NOT_NULL",
                ordinalPosition=15,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(root="BUKRS"),
                displayName="Pstng period variant",
                dataType="CHAR",
                arrayDataType=None,
                dataLength=4,
                precision=None,
                scale=None,
                dataTypeDisplay="CHAR(4)",
                description=Markdown(root="Posting Period Variant"),
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=3,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
        ],
        dataModel=None,
        tableConstraints=[
            TableConstraint(
                constraintType="PRIMARY_KEY",
                columns=["BKONT", "BUKRS"],
                referredColumns=None,
            )
        ],
        tablePartition=None,
        tableProfilerConfig=None,
        owners=None,
        databaseSchema=FullyQualifiedEntityName(
            root="saperp_source_test.saperp_database.saperp_database_schema"
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
    ),
]


def read_datasets(file_name: str) -> dict:
    mock_file_path = (
        Path(__file__).parent.parent.parent / f"resources/datasets/saperp/{file_name}"
    )
    with open(mock_file_path, encoding="UTF-8") as file:
        return json.load(file)


def mock_list_tables(self):  # pylint: disable=unused-argument
    tables = read_datasets("tables.json")
    return [SapErpTable(**table) for table in tables]


def mock_list_columns(self, table_name: str):  # pylint: disable=unused-argument
    columns = read_datasets("columns.json")
    return [
        SapErpColumn(**column) for column in columns if column["tabname"] == table_name
    ]


class SapErpUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Alation Unit Test
    """

    @patch(
        "metadata.ingestion.source.database.saperp.metadata.SaperpSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_saperp_config)
        self.saperp = SaperpSource.create(
            mock_saperp_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.saperp.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.saperp.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.saperp.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    @patch.object(SapErpClient, "list_tables", mock_list_tables)
    @patch.object(SapErpClient, "list_columns", mock_list_columns)
    def test_yield_table(self):
        """
        Test the yield table
        """
        tables = self.saperp.get_tables_name_and_type()
        returned_tables = []
        for table in tables:
            returned_tables.extend(
                [either.right for either in self.saperp.yield_table(table)]
            )
        for _, (expected, original) in enumerate(
            zip(EXPECTED_TABLES_AND_COLUMNS, returned_tables)
        ):
            self.assertEqual(expected, original)
