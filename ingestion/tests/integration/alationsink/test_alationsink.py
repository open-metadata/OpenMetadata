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
Test Alation Sink using the integration testing
"""

from unittest.mock import patch

import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import (
    CreateTableRequest as CreateOMTableRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.metadata.alationsink.metadata import AlationsinkSource
from metadata.ingestion.source.metadata.alationsink.models import (
    ColumnIndex,
    CreateColumnRequest,
    CreateDatasourceRequest,
    CreateSchemaRequest,
    CreateTableRequest,
)

from ..integration_base import generate_name, get_create_service  # noqa: TID252

mock_alation_sink_config = {
    "source": {
        "type": "AlationSink",
        "serviceName": "local_alation_sink",
        "serviceConnection": {
            "config": {
                "authType": {"accessToken": "access_token"},
                "hostPort": "https://alation.example.com",
                "projectName": "Test",
                "paginationLimit": 50,
                "datasourceLinks": {
                    "112": "my_service.my_database",
                },
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

MOCK_ALATION_DATASOURCE_ID = 34

DATABASE_NAME = "my_database"
DATABASE_DESCRIPTION = "Mock database for the Alation sink request builders."
SCHEMA_NAME = "my_schema"
SCHEMA_DESCRIPTION = "Mock schema for the Alation sink request builders."

# `::>` is not an FQN separator; it guards against a builder that over-quotes names.
QUOTED_TABLE_NAME = "dim_::>address"
REGULAR_TABLE_NAME = "dim_address"
VIEW_TABLE_NAME = "dim_address_clean"
TABLE_DESCRIPTION = "Mock dimension table holding customer addresses."
VIEW_DESCRIPTION = "Created from dim_address after a small cleanup."


def mock_list_connectors():
    return {
        "Oracle OCF connector": 112,
        "Starburst Trino OCF Connector": 113,
        "AWS Glue OCF Connector": 114,
        "BigQuery OCF Connector": 115,
        "MySQL OCF Connector": 116,
    }


# get_create_service builds a Mysql service, which SERVICE_TYPE_MAPPER resolves to the
# "MySQL OCF Connector" entry above.
EXPECTED_CONNECTOR_ID = 116

TABLE_COLUMNS = [
    Column(
        name="address_id",
        dataType=DataType.NUMERIC,
        dataTypeDisplay="numeric",
        description="Unique identifier for the address.",
        constraint=Constraint.PRIMARY_KEY,
        ordinalPosition=1,
    ),
    Column(
        name="shop_id",
        dataType=DataType.NUMERIC,
        dataTypeDisplay="numeric",
        description="The ID of the store.",
        constraint=Constraint.NOT_NULL,
        ordinalPosition=2,
    ),
    Column(
        name="city",
        dataType=DataType.VARCHAR,
        dataLength=100,
        dataTypeDisplay="varchar(100)",
        description="The city of the address.",
        constraint=Constraint.NULL,
        ordinalPosition=3,
    ),
]

EXPECTED_DATASOURCE_REQUEST = CreateDatasourceRequest(
    uri="None",
    connector_id=EXPECTED_CONNECTOR_ID,
    db_username="Test",
    db_password=None,
    title=DATABASE_NAME,
    description=DATABASE_DESCRIPTION,
)

EXPECTED_SCHEMA_REQUEST = CreateSchemaRequest(
    key=f"{MOCK_ALATION_DATASOURCE_ID}.{SCHEMA_NAME}",
    title=SCHEMA_NAME,
    description=SCHEMA_DESCRIPTION,
)

EXPECTED_TABLES = [
    CreateTableRequest(
        key=f"{MOCK_ALATION_DATASOURCE_ID}.{SCHEMA_NAME}.{QUOTED_TABLE_NAME}",
        title=QUOTED_TABLE_NAME,
        description=TABLE_DESCRIPTION,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key=f"{MOCK_ALATION_DATASOURCE_ID}.{SCHEMA_NAME}.{REGULAR_TABLE_NAME}",
        title=REGULAR_TABLE_NAME,
        description=TABLE_DESCRIPTION,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key=f"{MOCK_ALATION_DATASOURCE_ID}.{SCHEMA_NAME}.{VIEW_TABLE_NAME}",
        title=VIEW_TABLE_NAME,
        description=VIEW_DESCRIPTION,
        table_type="VIEW",
        sql=None,
    ),
]

EXPECTED_COLUMNS = [
    CreateColumnRequest(
        key=f"{MOCK_ALATION_DATASOURCE_ID}.{SCHEMA_NAME}.{REGULAR_TABLE_NAME}.address_id",
        column_type="numeric",
        title="address_id",
        description="Unique identifier for the address.",
        nullable=None,
        position="1",
        index=ColumnIndex(
            isPrimaryKey=True,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key=f"{MOCK_ALATION_DATASOURCE_ID}.{SCHEMA_NAME}.{REGULAR_TABLE_NAME}.shop_id",
        column_type="numeric",
        title="shop_id",
        description="The ID of the store.",
        nullable=False,
        position="2",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key=f"{MOCK_ALATION_DATASOURCE_ID}.{SCHEMA_NAME}.{REGULAR_TABLE_NAME}.city",
        column_type="varchar(100)",
        title="city",
        description="The city of the address.",
        nullable=True,
        position="3",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
]


@pytest.fixture(scope="module")
def alation_sink_source(metadata):
    """AlationsinkSource whose connector listing is stubbed to mock_list_connectors."""
    with patch.object(AlationsinkSource, "test_connection", return_value=False):
        source = AlationsinkSource.create(mock_alation_sink_config["source"], metadata)
    source.connectors = mock_list_connectors()
    return source


@pytest.fixture(scope="module")
def om_database(metadata):
    """A Mysql service holding one database, one schema and three tables."""
    service = metadata.create_or_update(
        data=get_create_service(entity=DatabaseService, name=generate_name())
    )
    database = metadata.create_or_update(
        data=CreateDatabaseRequest(
            name=DATABASE_NAME,
            description=DATABASE_DESCRIPTION,
            service=service.fullyQualifiedName,
        )
    )
    db_schema = metadata.create_or_update(
        data=CreateDatabaseSchemaRequest(
            name=SCHEMA_NAME,
            description=SCHEMA_DESCRIPTION,
            database=database.fullyQualifiedName,
        )
    )
    for name, description, table_type in (
        (QUOTED_TABLE_NAME, TABLE_DESCRIPTION, TableType.Regular),
        (REGULAR_TABLE_NAME, TABLE_DESCRIPTION, TableType.Regular),
        (VIEW_TABLE_NAME, VIEW_DESCRIPTION, TableType.View),
    ):
        metadata.create_or_update(
            data=CreateOMTableRequest(
                name=name,
                description=description,
                tableType=table_type,
                databaseSchema=db_schema.fullyQualifiedName,
                columns=TABLE_COLUMNS,
            )
        )

    yield database

    metadata.delete(
        entity=DatabaseService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


def test_datasources(metadata, alation_sink_source, om_database):
    database = metadata.get_by_name(entity=Database, fqn=om_database.fullyQualifiedName)

    assert (
        alation_sink_source.create_datasource_request(database)
        == EXPECTED_DATASOURCE_REQUEST
    )


def test_schemas(metadata, alation_sink_source, om_database):
    om_schema = metadata.get_by_name(
        entity=DatabaseSchema,
        fqn=f"{model_str(om_database.fullyQualifiedName)}.{SCHEMA_NAME}",
    )
    returned_schema_request = alation_sink_source.create_schema_request(
        alation_datasource_id=MOCK_ALATION_DATASOURCE_ID, om_schema=om_schema
    )

    assert returned_schema_request == EXPECTED_SCHEMA_REQUEST


def test_tables(metadata, alation_sink_source, om_database):
    om_tables = metadata.list_all_entities(
        entity=Table,
        skip_on_failure=True,
        params={
            "database": f"{model_str(om_database.fullyQualifiedName)}.{SCHEMA_NAME}"
        },
    )
    returned_tables = [
        alation_sink_source.create_table_request(
            alation_datasource_id=MOCK_ALATION_DATASOURCE_ID,
            schema_name=SCHEMA_NAME,
            om_table=om_table,
        )
        for om_table in om_tables
    ]

    assert sorted(returned_tables, key=lambda table: table.key) == sorted(
        EXPECTED_TABLES, key=lambda table: table.key
    )


def test_columns(metadata, alation_sink_source, om_database):
    om_table = metadata.get_by_name(
        entity=Table,
        fqn=f"{model_str(om_database.fullyQualifiedName)}.{SCHEMA_NAME}.{REGULAR_TABLE_NAME}",
    )
    returned_columns = [
        alation_sink_source.create_column_request(
            alation_datasource_id=MOCK_ALATION_DATASOURCE_ID,
            schema_name=SCHEMA_NAME,
            table_name=model_str(om_table.name),
            om_column=om_column,
            table_constraints=om_table.tableConstraints,
        )
        for om_column in om_table.columns
    ]

    assert returned_columns == EXPECTED_COLUMNS
