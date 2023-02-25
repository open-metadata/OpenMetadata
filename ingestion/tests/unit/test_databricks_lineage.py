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
Databricks lineage utils tests
"""

import json
from datetime import datetime
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.databricks.lineage import (
    DatabricksLineageSource,
)

mock_file_path = Path(__file__).parent / "resources/datasets/databricks_dataset.json"
with open(mock_file_path, encoding="utf-8") as file:
    mock_data: dict = json.load(file)


EXPECTED_DATABRICKS_DETAILS = [
    TableQuery(
        query=' /* {"app": "OpenMetadata", "version": "0.13.0.dev0"} */\nSHOW TABLES IN `test`',
        userName="vijay@getcollate.io",
        startTime="1665566128192",
        endTime="1665566128329",
        analysisDate=datetime.now(),
        aborted=None,
        serviceName="local_databricks1",
        databaseSchema=None,
    ),
    TableQuery(
        query=' /* {"app": "OpenMetadata", "version": "0.13.0.dev0"} */\nSHOW TABLES IN `test`',
        userName="vijay@getcollate.io",
        startTime="1665566127416",
        endTime="1665566127568",
        analysisDate=datetime.now(),
        aborted=None,
        serviceName="local_databricks1",
        databaseSchema=None,
    ),
    TableQuery(
        query=' /* {"app": "OpenMetadata", "version": "0.13.0.dev0"} */\nSHOW TABLES IN `default`',
        userName="vijay@getcollate.io",
        startTime="1665566125414",
        endTime="1665566125579",
        analysisDate=datetime.now(),
        aborted=None,
        serviceName="local_databricks1",
        databaseSchema=None,
    ),
    TableQuery(
        query=' /* {"app": "OpenMetadata", "version": "0.13.0.dev0"} */\nDESCRIBE default.view3',
        userName="vijay@getcollate.io",
        startTime="1665566124428",
        endTime="1665566124730",
        analysisDate=datetime.now(),
        aborted=None,
        serviceName="local_databricks1",
        databaseSchema=None,
    ),
]

mock_databricks_config = {
    "source": {
        "type": "databricks-lineage",
        "serviceName": "local_databricks1",
        "serviceConnection": {
            "config": {
                "token": "random_token",
                "hostPort": "localhost:443",
                "connectionArguments": {
                    "http_path": "sql/1.0/endpoints/path",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseLineage",
                "queryLogDuration": 1,
                "resultLimit": 10000,
            }
        },
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


class DatabricksLineageTests(TestCase):
    """
    Implements the necessary methods to extract
    Databricks lineage test
    """

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        config = OpenMetadataWorkflowConfig.parse_obj(mock_databricks_config)

        self.databricks = DatabricksLineageSource.create(
            mock_databricks_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    @patch(
        "metadata.ingestion.source.database.databricks.client.DatabricksClient.list_query_history"
    )
    def test_get_table_query(self, list_query_history):
        list_query_history.return_value = mock_data
        results = self.databricks.get_table_query()
        query_list = []
        for result in results:
            if isinstance(result, TableQuery):
                query_list.append(result)
        for _, (expected, original) in enumerate(
            zip(EXPECTED_DATABRICKS_DETAILS, query_list)
        ):
            expected.analysisDate = original.analysisDate = datetime.now()
            self.assertEqual(expected, original)
