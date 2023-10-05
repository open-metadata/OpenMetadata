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
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource

mock_bq_config = {
    "source": {
        "type": "bigquery",
        "serviceName": "local_bigquery",
        "serviceConnection": {
            "config": {"type": "BigQuery", "credentials": {"gcpConfig": {}}}
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


MOCK_DB_NAME = "random-project-id"
MOCK_SCHEMA_NAME = "test_omd"
MOCK_TABLE_NAME = "customer_products"
EXPECTED_URL = "https://console.cloud.google.com/bigquery?project=random-project-id&ws=!1m5!1m4!4m3!1srandom-project-id!2stest_omd!3scustomer_products"


class BigqueryUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource._test_connection"
    )
    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource.set_project_id"
    )
    def __init__(self, methodName, set_project_id, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        set_project_id.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_bq_config)
        self.bq_source = BigquerySource.create(
            mock_bq_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

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
