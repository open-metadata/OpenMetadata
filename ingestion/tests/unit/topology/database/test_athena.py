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
Test athena source
"""

import unittest
from unittest.mock import patch
from uuid import UUID

from pydantic import AnyUrl
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
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
from metadata.generated.schema.entity.services.storageService import StorageServiceType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Href,
    Markdown,
    SourceUrl,
    Timestamp,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.athena.metadata import AthenaSource
from metadata.ingestion.source.database.common_db_source import TableNameAndType

EXPECTED_DATABASE_NAMES = ["mydatabase"]
MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="sample_instance",
    fullyQualifiedName="sample_athena_schema.sample_db.sample_instance",
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
MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="sample_athena_service",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)
MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="sample_db",
    fullyQualifiedName="test_athena.sample_db",
    displayName="sample_db",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)
MOCK_TABLE_NAME = "sample_table"
EXPECTED_DATABASES = [
    Either(
        left=None,
        right=CreateDatabaseRequest(
            name=EntityName(__root__="sample_db"),
            displayName=None,
            description=None,
            tags=None,
            owner=None,
            service=FullyQualifiedEntityName(__root__="sample_athena_service"),
            dataProducts=None,
            default=False,
            retentionPeriod=None,
            extension=None,
            sourceUrl=None,
            domain=None,
            lifeCycle=None,
            sourceHash=None,
        ),
    )
]
EXPECTED_QUERY_TABLE_NAMES_TYPES = [
    TableNameAndType(name="sample_table", type_=TableType.External)
]
MOCK_LOCATION_ENTITY = [
    Container(
        id=Uuid(__root__=UUID("9c489754-bb60-435b-b2a5-0e43100cf950")),
        name=EntityName(__root__="dbt-testing/mayur/customers.csv"),
        fullyQualifiedName=FullyQualifiedEntityName(
            __root__='s3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv"'
        ),
        displayName=None,
        description=None,
        version=None,
        updatedAt=Timestamp(__root__=1717070902713),
        updatedBy="admin",
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/containers/9c489754-bb60-435b-b2a5-0e43100cf950",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/containers/9c489754-bb60-435b-b2a5-0e43100cf950",
            )
        ),
        owner=None,
        service=EntityReference(
            id=Uuid(__root__=UUID("dd91cca3-cc54-4776-9efa-48f845cdfb92")),
            type="storageService",
            name="s3_local",
            fullyQualifiedName="s3_local",
            description=Markdown(__root__=""),
            displayName="s3_local",
            deleted=False,
            inherited=None,
            href=Href(
                __root__=AnyUrl(
                    "http://localhost:8585/api/v1/services/storageServices/dd91cca3-cc54-4776-9efa-48f845cdfb92",
                    scheme="http",
                    host="localhost",
                    host_type="int_domain",
                    port="8585",
                    path="/api/v1/services/storageServices/dd91cca3-cc54-4776-9efa-48f845cdfb92",
                )
            ),
        ),
        parent=None,
        children=None,
        dataModel=ContainerDataModel(
            isPartitioned=False,
            columns=[
                Column(
                    name=ColumnName(__root__="CUSTOMERID"),
                    displayName="CUSTOMERID",
                    dataType=DataType.INT,
                    arrayDataType=None,
                    dataLength=None,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="INT",
                    description=None,
                    fullyQualifiedName=FullyQualifiedEntityName(
                        __root__='s3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv".CUSTOMERID'
                    ),
                    tags=None,
                    constraint=None,
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=None,
                    profile=None,
                    customMetrics=None,
                ),
            ],
        ),
        prefix="/dbt-testing/mayur/customers.csv",
        numberOfObjects=2103.0,
        size=652260394.0,
        fileFormats=[FileFormat.csv],
        serviceType=StorageServiceType.S3,
        followers=None,
        tags=None,
        changeDescription=None,
        deleted=False,
        retentionPeriod=None,
        extension=None,
        sourceUrl=SourceUrl(
            __root__="https://s3.console.aws.amazon.com/s3/buckets/awsdatalake-testing?region=us-east-2&prefix=dbt-testing/mayur/customers.csv/&showversions=false"
        ),
        fullPath="s3://awsdatalake-testing/dbt-testing/mayur/customers.csv",
        domain=None,
        dataProducts=None,
        votes=None,
        lifeCycle=None,
        sourceHash="22b1c2f2e7feeaa8f37c6649e01f027d",
    )
]

MOCK_TABLE_ENTITY = [
    Table(
        id=Uuid(__root__=UUID("2c040cf8-432d-4597-9517-4794d6142da3")),
        name=EntityName(__root__="demo_data_ext_tbl3"),
        displayName=None,
        fullyQualifiedName=FullyQualifiedEntityName(
            __root__="local_athena.demo.default.demo_data_ext_tbl3"
        ),
        description=None,
        version=None,
        updatedAt=Timestamp(__root__=1717071974350),
        updatedBy="admin",
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/tables/2c040cf8-432d-4597-9517-4794d6142da3",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/tables/2c040cf8-432d-4597-9517-4794d6142da3",
            )
        ),
        tableType=TableType.Regular,
        columns=[
            Column(
                name=ColumnName(__root__="CUSTOMERID"),
                displayName=None,
                dataType=DataType.INT,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="int",
                description=None,
                fullyQualifiedName=FullyQualifiedEntityName(
                    __root__="local_athena.demo.default.demo_data_ext_tbl3.CUSTOMERID"
                ),
                tags=None,
                constraint=Constraint.NULL,
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
        ],
        tableConstraints=None,
        tablePartition=None,
        owner=None,
        databaseSchema=EntityReference(
            id=Uuid(__root__=UUID("b03b0229-8a9f-497a-a675-74cb24a9be74")),
            type="databaseSchema",
            name="default",
            fullyQualifiedName="local_athena.demo.default",
            description=None,
            displayName="default",
            deleted=False,
            inherited=None,
            href=Href(
                __root__=AnyUrl(
                    "http://localhost:8585/api/v1/databaseSchemas/b03b0229-8a9f-497a-a675-74cb24a9be74",
                    scheme="http",
                    host="localhost",
                    host_type="int_domain",
                    port="8585",
                    path="/api/v1/databaseSchemas/b03b0229-8a9f-497a-a675-74cb24a9be74",
                )
            ),
        ),
        database=EntityReference(
            id=Uuid(__root__=UUID("f054c55c-34bf-4c5f-addd-5cc26c7c832a")),
            type="database",
            name="demo",
            fullyQualifiedName="local_athena.demo",
            description=None,
            displayName="demo",
            deleted=False,
            inherited=None,
            href=Href(
                __root__=AnyUrl(
                    "http://localhost:8585/api/v1/databases/f054c55c-34bf-4c5f-addd-5cc26c7c832a",
                    scheme="http",
                    host="localhost",
                    host_type="int_domain",
                    port="8585",
                    path="/api/v1/databases/f054c55c-34bf-4c5f-addd-5cc26c7c832a",
                )
            ),
        ),
        service=EntityReference(
            id=Uuid(__root__=UUID("5e98afd3-7257-4c35-a560-f4c25b0f4b97")),
            type="databaseService",
            name="local_athena",
            fullyQualifiedName="local_athena",
            description=None,
            displayName="local_athena",
            deleted=False,
            inherited=None,
            href=Href(
                __root__=AnyUrl(
                    "http://localhost:8585/api/v1/services/databaseServices/5e98afd3-7257-4c35-a560-f4c25b0f4b97",
                    scheme="http",
                    host="localhost",
                    host_type="int_domain",
                    port="8585",
                    path="/api/v1/services/databaseServices/5e98afd3-7257-4c35-a560-f4c25b0f4b97",
                )
            ),
        ),
        serviceType=DatabaseServiceType.Athena,
        location=None,
        schemaDefinition=None,
        tags=None,
        usageSummary=None,
        followers=None,
        joins=None,
        sampleData=None,
        tableProfilerConfig=None,
        customMetrics=None,
        profile=None,
        testSuite=None,
        dataModel=None,
        changeDescription=None,
        deleted=False,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        dataProducts=None,
        fileFormat=None,
        votes=None,
        lifeCycle=None,
        sourceHash="824e80b1c79b0c4ae0acd99d2338e149",
    )
]
EXPECTED_COLUMN_LINEAGE = [
    ColumnLineage(
        fromColumns=[
            FullyQualifiedEntityName(
                __root__='s3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv".CUSTOMERID'
            )
        ],
        toColumn=FullyQualifiedEntityName(
            __root__="local_athena.demo.default.demo_data_ext_tbl3.CUSTOMERID"
        ),
        function=None,
    )
]

mock_athena_config = {
    "source": {
        "type": "Athena",
        "serviceName": "test_athena",
        "serviceConnection": {
            "config": {
                "type": "Athena",
                "databaseName": "mydatabase",
                "awsConfig": {
                    "awsAccessKeyId": "dummy",
                    "awsSecretAccessKey": "dummy",
                    "awsRegion": "us-east-2",
                },
                "s3StagingDir": "https://s3-directory-for-datasource.com",
                "workgroup": "workgroup name",
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
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}


class TestAthenaService(unittest.TestCase):
    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_athena_config)
        self.athena_source = AthenaSource.create(
            mock_athena_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.athena_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.__root__
        self.athena_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.__root__
        self.athena_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.__root__

    def test_get_database_name(self):
        assert list(self.athena_source.get_database_names()) == EXPECTED_DATABASE_NAMES

    def test_query_table_names_and_types(self):
        with patch.object(Inspector, "get_table_names", return_value=[MOCK_TABLE_NAME]):
            assert (
                self.athena_source.query_table_names_and_types(
                    MOCK_DATABASE_SCHEMA.name.__root__
                )
                == EXPECTED_QUERY_TABLE_NAMES_TYPES
            )

    def test_yield_database(self):
        assert (
            list(
                self.athena_source.yield_database(
                    database_name=MOCK_DATABASE.name.__root__
                )
            )
            == EXPECTED_DATABASES
        )

    def test_column_lineage(self):
        columns_list = [column.name.__root__ for column in MOCK_TABLE_ENTITY[0].columns]
        column_lineage = self.athena_source._get_column_lineage(
            MOCK_LOCATION_ENTITY[0].dataModel, MOCK_TABLE_ENTITY[0], columns_list
        )
        assert column_lineage == EXPECTED_COLUMN_LINEAGE
