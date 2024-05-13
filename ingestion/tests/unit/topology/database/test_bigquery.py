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
bigquery unit tests
"""

# pylint: disable=line-too-long
import types
from typing import Dict
from unittest import TestCase
from unittest.mock import Mock, patch

from sqlalchemy import Integer, String

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Table,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
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
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.bigquery.lineage import BigqueryLineageSource
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource

mock_bq_config = {
    "source": {
        "type": "bigquery",
        "serviceName": "local_bigquery",
        "serviceConnection": {
            "config": {"type": "BigQuery", "credentials": {"gcpConfig": {}}}
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata", "includeTags": False}},
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

mock_credentials_path_bq_config = mock_bq_config
mock_credentials_path_bq_config["source"]["serviceConnection"]["config"]["credentials"][
    "gcpConfig"
]["__root__"] = "credentials.json"


MOCK_DB_NAME = "random-project-id"
MOCK_SCHEMA_NAME = "test_omd"
MOCK_TABLE_NAME = "customer_products"
EXPECTED_URL = "https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2stest_omd!3scustomer_products"

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="bigquery_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Hive,
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="sample_schema",
    fullyQualifiedName="bigquery_source_test.random-project-id.sample_schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

MOCK_TABLE = Table(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name=EntityName(__root__="customers"),
    displayName=None,
    description=None,
    tableType="Regular",
    columns=[
        Column(
            name="customer_id",
            displayName=None,
            dataType="INT",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="INTEGER",
            description=None,
            fullyQualifiedName=None,
            tags=None,
            constraint="PRIMARY_KEY",
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            profile=None,
            customMetrics=None,
        ),
        Column(
            name="first_name",
            displayName=None,
            dataType="STRING",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="VARCHAR",
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
            name="last_name",
            displayName=None,
            dataType="STRING",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="VARCHAR",
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
    databaseSchema=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="databaseSchema"
    ),
    tags=[],
    schemaDefinition=None,
    retentionPeriod=None,
    extension=None,
    sourceUrl=SourceUrl(
        __root__="https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2ssample_schema!3scustomers"
    ),
    domain=None,
    dataProducts=None,
    fileFormat=None,
    lifeCycle=None,
    sourceHash=None,
)

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName(__root__="random-project-id"),
        displayName=None,
        description=None,
        tags=[],
        owner=None,
        service=FullyQualifiedEntityName(__root__="bigquery_source_test"),
        dataProducts=None,
        default=False,
        retentionPeriod=None,
        extension=None,
        sourceUrl=SourceUrl(
            __root__="https://console.cloud.google.com/bigquery?project=random-project-id"
        ),
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]
EXPTECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName(__root__="sample_schema"),
        displayName=None,
        description="",
        owner=None,
        database=FullyQualifiedEntityName(
            __root__="bigquery_source_test.random-project-id"
        ),
        dataProducts=None,
        tags=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=SourceUrl(
            __root__="https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m4!1m3!3m2!1srandom-project-id!2ssample_schema"
        ),
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

MOCK_TABLE_NAMES = [tuple(("customers", "Regular")), tuple(("orders", "Regular"))]

MOCK_COLUMN_DATA = [
    [
        {
            "name": "customer_id",
            "type": Integer(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "system_data_type": "INTEGER",
            "is_complex": False,
            "policy_tags": None,
        },
        {
            "name": "first_name",
            "type": String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "system_data_type": "VARCHAR",
            "is_complex": False,
            "policy_tags": None,
        },
        {
            "name": "last_name",
            "type": String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "system_data_type": "VARCHAR",
            "is_complex": False,
            "policy_tags": None,
        },
    ],
    [
        {
            "name": "order_id",
            "type": Integer(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "system_data_type": "INTEGER",
            "is_complex": False,
            "policy_tags": None,
        },
        {
            "name": "customer_id",
            "type": Integer(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "system_data_type": "INTEGER",
            "is_complex": False,
            "policy_tags": None,
        },
        {
            "name": "status",
            "type": String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "system_data_type": "VARCHAR",
            "is_complex": False,
            "policy_tags": None,
        },
    ],
]

MOCK_PK_CONSTRAINT: Dict[str, Dict] = {
    "customers": dict({"constrained_columns": ("customer_id",)}),
    "orders": dict({"constrained_columns": ()}),
}

MOCK_FK_CONSTRAINT = {
    "customers": [],
    "orders": [
        {
            "name": "orders.fk$1",
            "referred_schema": "demo_dbt_jaffle",
            "referred_table": "customers",
            "constrained_columns": ["customer_id"],
            "referred_columns": ["customer_id"],
        }
    ],
}

EXPECTED_TABLE = [
    [
        CreateTableRequest(
            name=EntityName(__root__="customers"),
            displayName=None,
            description=None,
            tableType="Regular",
            columns=[
                Column(
                    name="customer_id",
                    displayName=None,
                    dataType="INT",
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="INTEGER",
                    description=None,
                    fullyQualifiedName=None,
                    tags=None,
                    constraint="PRIMARY_KEY",
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=None,
                    profile=None,
                    customMetrics=None,
                ),
                Column(
                    name="first_name",
                    displayName=None,
                    dataType="STRING",
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="VARCHAR",
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
                    name="last_name",
                    displayName=None,
                    dataType="STRING",
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="VARCHAR",
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
                __root__="bigquery_source_test.random-project-id.sample_schema"
            ),
            tags=[],
            schemaDefinition=None,
            retentionPeriod=None,
            extension=None,
            sourceUrl=SourceUrl(
                __root__="https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2ssample_schema!3scustomers"
            ),
            domain=None,
            dataProducts=None,
            fileFormat=None,
            lifeCycle=None,
            sourceHash=None,
        )
    ],
    [
        CreateTableRequest(
            name=EntityName(__root__="orders"),
            displayName=None,
            description=None,
            tableType="Regular",
            columns=[
                Column(
                    name="order_id",
                    displayName=None,
                    dataType="INT",
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="INTEGER",
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
                    name="customer_id",
                    displayName=None,
                    dataType="INT",
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="INTEGER",
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
                    name="status",
                    displayName=None,
                    dataType="STRING",
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="VARCHAR",
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
            tableConstraints=[
                TableConstraint(
                    constraintType="FOREIGN_KEY",
                    columns=["customer_id"],
                    referredColumns=[
                        FullyQualifiedEntityName(
                            __root__="bigquery_source_test.random-project-id.sample_schema.customers.customer_id"
                        )
                    ],
                )
            ],
            tablePartition=None,
            tableProfilerConfig=None,
            owner=None,
            databaseSchema=FullyQualifiedEntityName(
                __root__="bigquery_source_test.random-project-id.sample_schema"
            ),
            tags=[],
            schemaDefinition=None,
            retentionPeriod=None,
            extension=None,
            sourceUrl=SourceUrl(
                __root__="https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2ssample_schema!3sorders"
            ),
            domain=None,
            dataProducts=None,
            fileFormat=None,
            lifeCycle=None,
            sourceHash=None,
        )
    ],
]


MOCK_TABLE_CONSTRAINT = [
    [],
    [
        TableConstraint(
            constraintType="FOREIGN_KEY",
            columns=["customer_id"],
            referredColumns=[
                FullyQualifiedEntityName(
                    __root__="bigquery_source_test.random-project-id.sample_schema.customers.customer_id"
                )
            ],
        )
    ],
]


class BigqueryUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Bigquery Unit Test
    """

    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource._test_connection"
    )
    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource.set_project_id"
    )
    @patch("metadata.ingestion.source.database.bigquery.connection.get_connection")
    def __init__(
        self, methodName, get_connection, set_project_id, test_connection
    ) -> None:
        super().__init__(methodName)
        get_connection.return_value = Mock()
        test_connection.return_value = False
        set_project_id.return_value = "random-project-id"
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_bq_config)
        self.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                mock_bq_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )
        self.bq_source = BigquerySource.create(mock_bq_config["source"], self.metadata)
        self.bq_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.__root__
        self.thread_id = self.bq_source.context.get_current_thread_id()
        self.bq_source._inspector_map[self.thread_id] = types.SimpleNamespace()
        self.bq_source._inspector_map[
            self.thread_id
        ].get_pk_constraint = lambda table_name, schema: []
        self.bq_source._inspector_map[
            self.thread_id
        ].get_unique_constraints = lambda table_name, schema_name: []
        self.bq_source._inspector_map[
            self.thread_id
        ].get_foreign_keys = lambda table_name, schema: []
        self.bq_source._inspector_map[
            self.thread_id
        ].get_columns = lambda table_name, schema, db_name: []

    def test_source_url(self):
        self.assertEqual(
            self.bq_source.get_source_url(
                database_name=MOCK_DB_NAME,
                schema_name=MOCK_SCHEMA_NAME,
                table_name=MOCK_TABLE_NAME,
                table_type=TableType.Regular,
            ),
            EXPECTED_URL,
        )

    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.get_database_tag_labels"
    )
    def test_yield_database(self, get_database_tag_labels):
        get_database_tag_labels.return_value = []
        assert EXPECTED_DATABASE == [
            either.right for either in self.bq_source.yield_database(MOCK_DB_NAME)
        ]

    def test_yield_database_schema(self):
        assert EXPTECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.bq_source.yield_database_schema(
                schema_name=MOCK_DATABASE_SCHEMA.name.__root__
            )
        ]

    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource.get_tag_labels"
    )
    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource.get_table_partition_details"
    )
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService._get_foreign_constraints"
    )
    def test_get_columns_with_constraints(
        self, _get_foreign_constraints, get_table_partition_details, get_tag_labels
    ):
        """
        Test different constraint type ingested as expected
        """

        get_tag_labels.return_value = []
        get_table_partition_details.return_value = False, None
        self.bq_source.context.get().__dict__["database"] = MOCK_DB_NAME
        self.bq_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.__root__

        for i, table in enumerate(MOCK_TABLE_NAMES):
            _get_foreign_constraints.return_value = MOCK_TABLE_CONSTRAINT[i]
            self.bq_source.inspector.get_pk_constraint = (
                lambda table_name, schema: MOCK_PK_CONSTRAINT[
                    table[0]
                ]  # pylint: disable=cell-var-from-loop
            )
            self.bq_source.inspector.get_foreign_keys = (
                lambda table_name, schema: MOCK_FK_CONSTRAINT[
                    table[0]
                ]  # pylint: disable=cell-var-from-loop
            )
            self.bq_source.inspector.get_columns = (
                lambda table_name, schema, db_name: MOCK_COLUMN_DATA[
                    i
                ]  # pylint: disable=cell-var-from-loop
            )
            self.bq_source.inspector.get_table_ddl = (
                lambda table_name, schema, db_name: None  # pylint: disable=cell-var-from-loop
            )
            self.bq_source.inspector.get_table_comment = (
                lambda table_name, schema, db_name: None  # pylint: disable=cell-var-from-loop
            )
            assert EXPECTED_TABLE[i] == [
                either.right for either in self.bq_source.yield_table(table)
            ]


class BigqueryLineageSourceTest(TestCase):
    """
    Implements the necessary methods to extract
    Bigquery Lineage Test
    """

    @patch("metadata.ingestion.source.database.bigquery.connection.get_connection")
    @patch("metadata.ingestion.source.database.bigquery.connection.test_connection")
    @patch(
        "metadata.ingestion.source.database.bigquery.query_parser.BigqueryQueryParserSource.set_project_id"
    )
    def __init__(
        self,
        methodName,
        set_project_id_lineage,  # pylint: disable=unused-argument
        test_connection,  # pylint: disable=unused-argument
        get_connection,  # pylint: disable=unused-argument
    ) -> None:
        super().__init__(methodName)

        self.config = OpenMetadataWorkflowConfig.parse_obj(
            mock_credentials_path_bq_config
        )
        self.bq_query_parser = BigqueryLineageSource(
            self.config.source, self.config.workflowConfig.openMetadataServerConfig
        )

    def test_get_engine_without_project_id_specified(self):
        for engine in self.bq_query_parser.get_engine():
            assert engine is self.bq_query_parser.engine
