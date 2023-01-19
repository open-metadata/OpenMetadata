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

import types
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import VARCHAR

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    IntervalType,
    TablePartition,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource

mock_snowflake_config = {
    "source": {
        "type": "snowflake",
        "serviceName": "local_snowflake",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "username": "username",
                "password": "password",
                "database": "database",
                "warehouse": "warehouse",
                "account": "account.region_name.cloud_service",
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


RAW_CLUSTER_KEY_EXPRS = [
    "LINEAR(c1, c2)",
    "LINEAR(to_date(c1), substring(c2, 0, 10))",
    "LINEAR(v:'Data':id::number)",
    "LINEAR(to_date(substring(c2, 0, 10)))",
    "col",
]

MOCK_TOKEN = "LINEAR(cp_catalog_page_sk)"


EXPECTED_PARTITION_COLUMNS = [
    ["c1", "c2"],
    ["c1", "c2"],
    ["v"],
    ["c2"],
    ["col"],
]

MOCK_SCHEMA = "TPCDS_SF100TCL"
MOCK_TABLE_NAME = "CALL_CENTER"


EXPECTED_IDENITIFIERS = ["cp_catalog_page_sk"]

EXPECTED_FIXED_PARTITION_COLUMN_CASE = ["CC_CALL_CENTER_SK"]

EXPECTED_TABLE_PARTITION = TablePartition(
    columns=["CC_CALL_CENTER_SK"], intervalType=IntervalType.COLUMN_VALUE, interval=None
)


MOCK_COLUMN_VALUE = [
    {
        "name": "CC_CALL_CENTER_SK",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
    }
]


EXPECTED_COLUMN_VALUE = [
    Column(
        name="CC_CALL_CENTER_SK",
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="VARCHAR(1)",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    )
]


MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="postgres_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Postgres,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="postgres_source.default",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="postgres_source.118146679784.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
)


class SnowflakeUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    @patch(
        "metadata.ingestion.source.database.snowflake.metadata.SnowflakeSource.__fix_partition_column_case"
    )
    def __init__(
        self, methodName, __fix_partition_column_case, test_connection
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        __fix_partition_column_case.return_value = partition_columns = [
            "cc_call_center_sk"
        ]
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_snowflake_config)
        self.snowflake_source = SnowflakeSource.create(
            mock_snowflake_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.snowflake_source.context.__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE
        self.snowflake_source.context.__dict__["database"] = MOCK_DATABASE
        self.snowflake_source.context.__dict__["database_schema"] = MOCK_DATABASE_SCHEMA

    def test_partition_parse_columns(self):
        for i in range(len(RAW_CLUSTER_KEY_EXPRS)):
            assert (
                self.snowflake_source.parse_column_name_from_expr(
                    RAW_CLUSTER_KEY_EXPRS[i]
                )
                == EXPECTED_PARTITION_COLUMNS[i]
            )

    def test_table_partition_details(self):

        inspector = types.SimpleNamespace()
        inspector.get_columns = lambda MOCK_TABLE_NAME, MOCK_SCHEMA: MOCK_COLUMN_VALUE

        self.snowflake_source.partition_details[
            f"{MOCK_SCHEMA}.{MOCK_TABLE_NAME}"
        ] = MOCK_TOKEN

        test = self.snowflake_source.get_table_partition_details(
            MOCK_TABLE_NAME, MOCK_SCHEMA, inspector
        )
        assert test == EXPECTED_TABLE_PARTITION
