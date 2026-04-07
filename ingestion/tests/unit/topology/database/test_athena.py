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
Test athena source
"""

import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch
from uuid import UUID

from pydantic import AnyUrl

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
from metadata.ingestion.source.database.athena.models import AthenaStatus
from metadata.ingestion.source.database.athena.usage import AthenaUsageSource
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
        right=CreateDatabaseRequest(
            name=EntityName("sample_db"),
            service=FullyQualifiedEntityName("sample_athena_service"),
            default=False,
        ),
    )
]
EXPECTED_QUERY_TABLE_NAMES_TYPES = [
    TableNameAndType(name="sample_table", type_=TableType.External)
]
MOCK_LOCATION_ENTITY = [
    Container(
        id=Uuid(UUID("9c489754-bb60-435b-b2a5-0e43100cf950")),
        name=EntityName("dbt-testing/mayur/customers.csv"),
        fullyQualifiedName=FullyQualifiedEntityName(
            's3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv"'
        ),
        updatedAt=Timestamp(1717070902713),
        updatedBy="admin",
        href=Href(
            root=AnyUrl(
                "http://localhost:8585/api/v1/containers/9c489754-bb60-435b-b2a5-0e43100cf950",
            )
        ),
        service=EntityReference(
            id=Uuid(UUID("dd91cca3-cc54-4776-9efa-48f845cdfb92")),
            type="storageService",
            name="s3_local",
            fullyQualifiedName="s3_local",
            description=Markdown(""),
            displayName="s3_local",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/services/storageServices/dd91cca3-cc54-4776-9efa-48f845cdfb92",
                )
            ),
        ),
        dataModel=ContainerDataModel(
            isPartitioned=False,
            columns=[
                Column(
                    name=ColumnName("CUSTOMERID"),
                    displayName="CUSTOMERID",
                    dataType=DataType.INT,
                    dataTypeDisplay="INT",
                    fullyQualifiedName=FullyQualifiedEntityName(
                        's3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv".CUSTOMERID'
                    ),
                ),
            ],
        ),
        prefix="/dbt-testing/mayur/customers.csv",
        numberOfObjects=2103.0,
        size=652260394.0,
        fileFormats=[FileFormat.csv],
        serviceType=StorageServiceType.S3,
        deleted=False,
        sourceUrl=SourceUrl(
            "https://s3.console.aws.amazon.com/s3/buckets/awsdatalake-testing?region=us-east-2&prefix=dbt-testing/mayur/customers.csv/&showversions=false"
        ),
        fullPath="s3://awsdatalake-testing/dbt-testing/mayur/customers.csv",
        sourceHash="22b1c2f2e7feeaa8f37c6649e01f027d",
    )
]

MOCK_TABLE_ENTITY = [
    Table(
        id=Uuid(UUID("2c040cf8-432d-4597-9517-4794d6142da3")),
        name=EntityName("demo_data_ext_tbl3"),
        fullyQualifiedName=FullyQualifiedEntityName(
            "local_athena.demo.default.demo_data_ext_tbl3"
        ),
        updatedAt=Timestamp(1717071974350),
        updatedBy="admin",
        href=Href(
            root=AnyUrl(
                "http://localhost:8585/api/v1/tables/2c040cf8-432d-4597-9517-4794d6142da3",
            )
        ),
        tableType=TableType.Regular,
        columns=[
            Column(
                name=ColumnName("CUSTOMERID"),
                dataType=DataType.INT,
                dataLength=1,
                dataTypeDisplay="int",
                fullyQualifiedName=FullyQualifiedEntityName(
                    "local_athena.demo.default.demo_data_ext_tbl3.CUSTOMERID"
                ),
                constraint=Constraint.NULL,
            ),
        ],
        databaseSchema=EntityReference(
            id=Uuid(UUID("b03b0229-8a9f-497a-a675-74cb24a9be74")),
            type="databaseSchema",
            name="default",
            fullyQualifiedName="local_athena.demo.default",
            displayName="default",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/databaseSchemas/b03b0229-8a9f-497a-a675-74cb24a9be74",
                )
            ),
        ),
        database=EntityReference(
            id=Uuid(UUID("f054c55c-34bf-4c5f-addd-5cc26c7c832a")),
            type="database",
            name="demo",
            fullyQualifiedName="local_athena.demo",
            displayName="demo",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/databases/f054c55c-34bf-4c5f-addd-5cc26c7c832a",
                )
            ),
        ),
        service=EntityReference(
            id=Uuid(UUID("5e98afd3-7257-4c35-a560-f4c25b0f4b97")),
            type="databaseService",
            name="local_athena",
            fullyQualifiedName="local_athena",
            displayName="local_athena",
            deleted=False,
            href=Href(
                root=AnyUrl(
                    "http://localhost:8585/api/v1/services/databaseServices/5e98afd3-7257-4c35-a560-f4c25b0f4b97",
                )
            ),
        ),
        serviceType=DatabaseServiceType.Athena,
        deleted=False,
        sourceHash="824e80b1c79b0c4ae0acd99d2338e149",
    )
]
EXPECTED_COLUMN_LINEAGE = [
    ColumnLineage(
        fromColumns=[
            FullyQualifiedEntityName(
                's3_local.awsdatalake-testing."dbt-testing/mayur/customers.csv".CUSTOMERID'
            )
        ],
        toColumn=FullyQualifiedEntityName(
            "local_athena.demo.default.demo_data_ext_tbl3.CUSTOMERID"
        ),
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
            "securityConfig": {"jwtToken": "athena"},
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
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_athena_config)
        self.athena_source = AthenaSource.create(
            mock_athena_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.athena_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root
        self.athena_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.athena_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    def test_get_database_name(self):
        assert list(self.athena_source.get_database_names()) == EXPECTED_DATABASE_NAMES

    def test_query_table_names_and_types(self):
        mock_glue_client = MagicMock()
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [
            {"TableList": [{"Name": MOCK_TABLE_NAME, "Parameters": {}}]}
        ]
        mock_glue_client.get_paginator.return_value = mock_paginator
        self.athena_source.glue_client = mock_glue_client
        assert (
            self.athena_source.query_table_names_and_types(
                MOCK_DATABASE_SCHEMA.name.root
            )
            == EXPECTED_QUERY_TABLE_NAMES_TYPES
        )

    def test_query_table_names_and_types_iceberg(self):
        mock_glue_client = MagicMock()
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [
            {
                "TableList": [
                    {
                        "Name": MOCK_TABLE_NAME,
                        "Parameters": {"table_type": "ICEBERG"},
                    }
                ]
            }
        ]
        mock_glue_client.get_paginator.return_value = mock_paginator
        self.athena_source.glue_client = mock_glue_client
        assert self.athena_source.query_table_names_and_types(
            MOCK_DATABASE_SCHEMA.name.root
        ) == [TableNameAndType(name=MOCK_TABLE_NAME, type_=TableType.Iceberg)]

    def test_yield_database(self):
        assert (
            list(
                self.athena_source.yield_database(database_name=MOCK_DATABASE.name.root)
            )
            == EXPECTED_DATABASES
        )

    def test_column_lineage(self):
        columns_list = [column.name.root for column in MOCK_TABLE_ENTITY[0].columns]
        column_lineage = self.athena_source._get_column_lineage(
            MOCK_LOCATION_ENTITY[0].dataModel, MOCK_TABLE_ENTITY[0], columns_list
        )
        assert column_lineage == EXPECTED_COLUMN_LINEAGE

    def test_get_table_extensions_returns_none_without_type_ref(self):
        self.athena_source._string_property_type_ref = None
        assert self.athena_source.get_table_extensions(MOCK_TABLE_NAME) is None

    def test_get_table_extensions_returns_properties_from_description(self):
        from metadata.generated.schema.type.customProperty import PropertyType

        self.athena_source._string_property_type_ref = PropertyType(
            EntityReference(
                id=UUID("00000000-0000-0000-0000-000000000001"), type="type"
            )
        )
        mock_inspector = MagicMock()
        mock_inspector.get_table_comment.return_value = {"text": "desc"}
        mock_inspector.get_table_options.return_value = {
            "awsathena_location": "s3://bucket/path",
            "awsathena_tblproperties": {"prop_key": "prop_value", "null_prop": None},
        }
        self.athena_source.get_table_description(
            MOCK_DATABASE_SCHEMA.name.root, MOCK_TABLE_NAME, mock_inspector
        )

        with patch.object(self.athena_source, "metadata") as mock_metadata:
            result = self.athena_source.get_table_extensions(MOCK_TABLE_NAME)

        assert result == {"prop_key": "prop_value"}
        assert "null_prop" not in result
        mock_metadata.create_or_update_custom_property.assert_called_once()


SUBMISSION_DT = datetime(2024, 1, 2, 10, 0, 0)
COMPLETION_DT = datetime(2024, 1, 2, 10, 5, 0)


class TestAthenaUsageYieldTableQueries:
    def _make_source(self):
        source = MagicMock()
        source.dialect.value = "athena"
        source.config.serviceName = "test_athena"
        source.start = datetime(2024, 1, 1)
        source.is_not_dbt_or_om_query.return_value = True
        return source

    def _make_query_list(self, status):
        query = MagicMock()
        query.Query = "SELECT 1"
        query.Status = status
        query.Statistics = None
        query_list = MagicMock()
        query_list.QueryExecutions = [query]
        return query_list

    def test_end_time_uses_completion_datetime_when_present(self):
        status = MagicMock()
        status.State = "SUCCEEDED"
        status.SubmissionDateTime = SUBMISSION_DT
        status.CompletionDateTime = COMPLETION_DT

        source = self._make_source()
        source.get_queries.return_value = [self._make_query_list(status)]

        results = list(AthenaUsageSource.yield_table_queries(source))

        assert len(results) == 1
        assert len(results[0].queries) == 1
        assert results[0].queries[0].endTime == COMPLETION_DT.isoformat(" ", "seconds")

    def test_end_time_falls_back_to_submission_when_completion_missing(self):
        status = AthenaStatus(State="SUCCEEDED", SubmissionDateTime=SUBMISSION_DT)

        source = self._make_source()
        source.get_queries.return_value = [self._make_query_list(status)]

        results = list(AthenaUsageSource.yield_table_queries(source))

        assert len(results) == 1
        assert len(results[0].queries) == 1
        assert results[0].queries[0].endTime == SUBMISSION_DT.isoformat(" ", "seconds")
