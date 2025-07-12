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
bigquery unit tests
"""

# pylint: disable=line-too-long
import types
from copy import deepcopy
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
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.bigquery.lineage import BigqueryLineageSource
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource

mock_bq_config = {
    "source": {
        "type": "bigquery",
        "serviceName": "local_bigquery",
        "serviceConnection": {
            "config": {
                "type": "BigQuery",
                "billingProjectId": "my-gcp-billing-project",
                "credentials": {
                    "gcpConfig": {
                        "type": "service_account",
                        "projectId": "my-gcp-project",
                        "privateKeyId": "private_key_id",
                        # this is a valid key that was generated on a local machine and is not used for any real project
                        "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpQIBAAKCAQEAw3vHG9fDIkcYB0xi2Mv4fS2gUzKR9ZRrcVNeKkqGFTT71AVB\nOzgIqYVe8b2aWODuNye6sipcrqTqOt05Esj+sxhk5McM9bE2RlxXC5QH/Bp9zxMP\n/Yksv9Ov7fdDt/loUk7sTXvI+7LDJfmRYU6MtVjyyLs7KpQIB2xBWEToU1xZY+v0\ndRC1NA+YWc+FjXbAiFAf9d4gXkYO8VmU5meixVh4C8nsjokEXk0T/HEItpZCxadk\ndZ7LKUE/HDmWCO2oNG6sCf4ET2crjSdYIfXuREopX1aQwnk7KbI4/YIdlRz1I369\nAz3+Hxlf9lLJVH3+itN4GXrR9yWWKWKDnwDPbQIDAQABAoIBAQC3X5QuTR7SN8iV\niBUtc2D84+ECSmza5shG/UJW/6N5n0Mf53ICgBS4GNEwiYCRISa0/ILIgK6CcVb7\nsuvH8F3kWNzEMui4TO0x4YsR5GH9HkioCCS224frxkLBQnL20HIIy9ok8Rpe6Zjg\nNZUnp4yczPyqSeA9l7FUbTt69uDM2Cx61m8REOpFukpnYLyZGbmNPYmikEO+rq9r\nwNID5dkSeVuQYo4MQdRavOGFUWvUYXzkEQ0A6vPyraVBfolESX8WaLNVjic7nIa3\nujdSNojnJqGJ3gslntcmN1d4JOfydc4bja4/NdNlcOHpWDGLzY1QnaDe0Koxn8sx\nLT9MVD2NAoGBAPy7r726bKVGWcwqTzUuq1OWh5c9CAc4N2zWBBldSJyUdllUq52L\nWTyva6GRoRzCcYa/dKLLSM/k4eLf9tpxeIIfTOMsvzGtbAdm257ndMXNvfYpxCfU\nK/gUFfAUGHZ3MucTHRY6DTkJg763Sf6PubA2fqv3HhVZDK/1HGDtHlTPAoGBAMYC\npdV7O7lAyXS/d9X4PQZ4BM+P8MbXEdGBbPPlzJ2YIb53TEmYfSj3z41u9+BNnhGP\n4uzUyAR/E4sxrA2+Ll1lPSCn+KY14WWiVGfWmC5j1ftdpkbrXstLN8NpNYzrKZwx\njdR0ZkwvZ8B5+kJ1hK96giwWS+SJxJR3TohcQ18DAoGAJSfmv2r//BBqtURnHrd8\nwq43wvlbC8ytAVg5hA0d1r9Q4vM6w8+vz+cuWLOTTyobDKdrG1/tlXrd5r/sh9L0\n15SIdkGm3kPTxQbPNP5sQYRs8BrV1tEvoao6S3B45DnEBwrdVN42AXOvpcNGoqE4\nuHpahyeuiY7s+ZV8lZdmxSsCgYEAolr5bpmk1rjwdfGoaKEqKGuwRiBX5DHkQkxE\n8Zayt2VOBcX7nzyRI05NuEIMrLX3rZ61CktN1aH8fF02He6aRaoE/Qm9L0tujM8V\nNi8WiLMDeR/Ifs3u4/HAv1E8v1byv0dCa7klR8J257McJ/ID4X4pzcxaXgE4ViOd\nGOHNu9ECgYEApq1zkZthEQymTUxs+lSFcubQpaXyf5ZC61cJewpWkqGDtSC+8DxE\nF/jydybWuoNHXymnvY6QywxuIooivbuib6AlgpEJeybmnWlDOZklFOD0abNZ+aNO\ndUk7XVGffCakXQ0jp1kmZA4lGsYK1h5dEU5DgXqu4UYJ88Vttax2W+Y=\n-----END RSA PRIVATE KEY-----\n",
                        "clientEmail": "gcpuser@project_id.iam.gserviceaccount.com",
                        "clientId": "1234",
                        "authUri": "https://accounts.google.com/o/oauth2/auth",
                        "tokenUri": "https://oauth2.googleapis.com/token",
                        "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
                        "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
                    }
                },
            },
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata", "includeTags": False}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "bigquery"},
        }
    },
}

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
    name=EntityName("customers"),
    displayName=None,
    description="description\nwith new line",
    tableType="Regular",
    columns=[
        Column(
            name="customer_id",
            dataType="INT",
            dataLength=1,
            dataTypeDisplay="INTEGER",
            constraint="PRIMARY_KEY",
        ),
        Column(
            name="first_name",
            dataType="STRING",
            dataLength=1,
            dataTypeDisplay="VARCHAR",
            constraint="NULL",
        ),
        Column(
            name="last_name",
            dataType="STRING",
            dataLength=1,
            dataTypeDisplay="VARCHAR",
            constraint="NULL",
        ),
    ],
    tableConstraints=[],
    databaseSchema=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="databaseSchema"
    ),
    tags=[],
    sourceUrl=SourceUrl(
        "https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2ssample_schema!3scustomers"
    ),
)

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName("random-project-id"),
        tags=[],
        service=FullyQualifiedEntityName("bigquery_source_test"),
        default=False,
        sourceUrl=SourceUrl(
            "https://console.cloud.google.com/bigquery?project=random-project-id"
        ),
    )
]
EXPTECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName("sample_schema"),
        description="Some description with it's own\nnew line",
        database=FullyQualifiedEntityName("bigquery_source_test.random-project-id"),
        sourceUrl=SourceUrl(
            "https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m4!1m3!3m2!1srandom-project-id!2ssample_schema"
        ),
    )
]

MOCK_TABLE_NAMES = [
    ("customers", "Regular", None),
    ("orders", "Regular", "description\nwith new line"),
]

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
            name=EntityName("customers"),
            tableType="Regular",
            columns=[
                Column(
                    name="customer_id",
                    dataType="INT",
                    dataLength=1,
                    dataTypeDisplay="INTEGER",
                    constraint="PRIMARY_KEY",
                ),
                Column(
                    name="first_name",
                    dataType="STRING",
                    dataLength=1,
                    dataTypeDisplay="VARCHAR",
                    constraint="NULL",
                ),
                Column(
                    name="last_name",
                    dataType="STRING",
                    dataLength=1,
                    dataTypeDisplay="VARCHAR",
                    constraint="NULL",
                ),
            ],
            tableConstraints=[],
            databaseSchema=FullyQualifiedEntityName(
                root="bigquery_source_test.random-project-id.sample_schema"
            ),
            tags=[],
            sourceUrl=SourceUrl(
                "https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2ssample_schema!3scustomers"
            ),
        )
    ],
    [
        CreateTableRequest(
            name=EntityName("orders"),
            description="description\nwith new line",
            tableType="Regular",
            columns=[
                Column(
                    name="order_id",
                    dataType="INT",
                    dataLength=1,
                    dataTypeDisplay="INTEGER",
                    constraint="NULL",
                ),
                Column(
                    name="customer_id",
                    dataType="INT",
                    dataLength=1,
                    dataTypeDisplay="INTEGER",
                    constraint="NULL",
                ),
                Column(
                    name="status",
                    dataType="STRING",
                    dataLength=1,
                    dataTypeDisplay="VARCHAR",
                    constraint="NULL",
                ),
            ],
            tableConstraints=[
                TableConstraint(
                    constraintType="FOREIGN_KEY",
                    columns=["customer_id"],
                    referredColumns=[
                        FullyQualifiedEntityName(
                            root="bigquery_source_test.random-project-id.sample_schema.customers.customer_id"
                        )
                    ],
                )
            ],
            databaseSchema=FullyQualifiedEntityName(
                root="bigquery_source_test.random-project-id.sample_schema"
            ),
            tags=[],
            sourceUrl=SourceUrl(
                "https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2ssample_schema!3sorders"
            ),
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
                    "bigquery_source_test.random-project-id.sample_schema.customers.customer_id"
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
        self.config = parse_workflow_config_gracefully(mock_bq_config)
        self.metadata = OpenMetadata(
            OpenMetadataConnection.model_validate(
                mock_bq_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )
        self.bq_source = BigquerySource.create(mock_bq_config["source"], self.metadata)
        self.bq_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
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
        self.bq_source.client = Mock()

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
        def schema_comment_query(query: str):
            if query.strip().startswith(
                "SELECT option_value as schema_description FROM"
            ):
                result = Mock()
                mock_result = Mock()
                mock_result.schema_description = (
                    '"Some description with it\'s own\\nnew line"'
                )
                result.result.return_value = [mock_result]
                return result
            else:
                raise NotImplementedError

        self.bq_source.client.query = schema_comment_query

        assert EXPTECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.bq_source.yield_database_schema(
                schema_name=MOCK_DATABASE_SCHEMA.name.root
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
        ] = MOCK_DATABASE_SCHEMA.name.root

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
                lambda table_name, schema, table_type, db_name: MOCK_COLUMN_DATA[
                    i
                ]  # pylint: disable=cell-var-from-loop
            )
            self.bq_source.inspector.get_table_ddl = (
                lambda table_name, schema, db_name: None  # pylint: disable=cell-var-from-loop
            )
            self.bq_source.inspector.get_table_comment = lambda table_name, schema: {
                "text": table[2]
            }  # pylint: disable=cell-var-from-loop
            assert EXPECTED_TABLE[i] == [
                either.right
                for either in self.bq_source.yield_table((table[0], table[1]))
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

        mock_credentials_path_bq_config = deepcopy(mock_bq_config)
        mock_credentials_path_bq_config["source"]["serviceConnection"]["config"][
            "credentials"
        ]["gcpConfig"] = {"path": "credentials.json", "projectId": "my-gcp-project"}
        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_credentials_path_bq_config
        )
        self.bq_query_parser = BigqueryLineageSource(
            self.config.source, self.config.workflowConfig.openMetadataServerConfig
        )

    def test_get_engine_without_project_id_specified(self):
        for engine in self.bq_query_parser.get_engine():
            assert engine is self.bq_query_parser.engine
