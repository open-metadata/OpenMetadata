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
snowflake unit tests
"""

# pylint: disable=line-too-long

from unittest import TestCase
from unittest.mock import PropertyMock, patch

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
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

EXPECTED_PARTITION_COLUMNS = [
    ["c1", "c2"],
    ["c1", "c2"],
    ["v"],
    ["c2"],
    ["col"],
]

MOCK_DB_NAME = "SNOWFLAKE_SAMPLE_DATA"
MOCK_SCHEMA_NAME_1 = "INFORMATION_SCHEMA"
MOCK_SCHEMA_NAME_2 = "TPCDS_SF10TCL"
MOCK_VIEW_NAME = "COLUMNS"
MOCK_TABLE_NAME = "CALL_CENTER"
EXPECTED_SNOW_URL_VIEW = "https://app.snowflake.com/us-west-2/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/view/COLUMNS"
EXPECTED_SNOW_URL_TABLE = "https://app.snowflake.com/us-west-2/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/TPCDS_SF10TCL/table/CALL_CENTER"


class SnowflakeUnitTest(TestCase):
    """
    Unit test for snowflake source
    """

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_snowflake_config)
        self.snowflake_source: SnowflakeSource = SnowflakeSource.create(
            mock_snowflake_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_partition_parse_columns(self):
        for idx, expr in enumerate(RAW_CLUSTER_KEY_EXPRS):
            assert (
                self.snowflake_source.parse_column_name_from_expr(expr)
                == EXPECTED_PARTITION_COLUMNS[idx]
            )

    def _assert_urls(self):
        self.assertEqual(
            self.snowflake_source.get_source_url(
                database_name=MOCK_DB_NAME,
                schema_name=MOCK_SCHEMA_NAME_2,
                table_name=MOCK_TABLE_NAME,
                table_type=TableType.Regular,
            ),
            EXPECTED_SNOW_URL_TABLE,
        )

        self.assertEqual(
            self.snowflake_source.get_source_url(
                database_name=MOCK_DB_NAME,
                schema_name=MOCK_SCHEMA_NAME_1,
                table_name=MOCK_VIEW_NAME,
                table_type=TableType.View,
            ),
            EXPECTED_SNOW_URL_VIEW,
        )

    def test_source_url(self):
        """
        method to test source url
        """
        with patch.object(
            SnowflakeSource,
            "account",
            return_value="random_account",
            new_callable=PropertyMock,
        ):
            with patch.object(
                SnowflakeSource,
                "region",
                return_value="us-west-2",
                new_callable=PropertyMock,
            ):
                self._assert_urls()

            with patch.object(
                SnowflakeSource,
                "region",
                new_callable=PropertyMock,
                return_value=None,
            ):
                self.assertIsNone(
                    self.snowflake_source.get_source_url(
                        database_name=MOCK_DB_NAME,
                        schema_name=MOCK_SCHEMA_NAME_1,
                        table_name=MOCK_VIEW_NAME,
                        table_type=TableType.View,
                    )
                )
