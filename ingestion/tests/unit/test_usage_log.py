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
#  pylint: disable=line-too-long,unused-argument

"""
Usage via query logs tests
"""

from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.query.usage import QueryLogUsageSource

dataset = Path(__file__).parent / "resources/datasets/query_log.csv"

mock_query_log_config = {
    "source": {
        "type": "query-log-usage",
        "serviceName": "local_glue",
        "serviceConnection": {
            "config": {
                "type": "Glue",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
            }
        },
        "sourceConfig": {
            "config": {"type": "DatabaseUsage", "queryLogFilePath": str(dataset)}
        },
    },
    "processor": {"type": "query-parser", "config": {}},
    "stage": {"type": "table-usage", "config": {"filename": "/tmp/query_log_usage"}},
    "bulkSink": {
        "type": "metadata-usage",
        "config": {"filename": "/tmp/query_log_usage"},
    },
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


def custom_query_compare(self, other):
    return (
        self.query == other.query
        and self.userName == other.userName
        and self.startTime == other.startTime
        and self.aborted == other.aborted
        and self.serviceName == other.serviceName
        and self.databaseName == other.databaseName
        and self.databaseSchema == other.databaseSchema
        and self.duration == other.duration
    )


EXPECTED_QUERIES = [
    TableQuery(
        query="select * from sales",
        userName="",
        startTime="",
        endTime="",
        aborted=False,
        serviceName="local_glue",
        databaseName="default",
        databaseSchema="information_schema",
        duration=None,
    ),
    TableQuery(
        query="select * from marketing",
        userName="",
        startTime="",
        endTime="",
        aborted=False,
        serviceName="local_glue",
        databaseName="default",
        databaseSchema="information_schema",
        duration=None,
    ),
    TableQuery(
        query="insert into marketing select * from sales",
        userName="",
        startTime="",
        endTime="",
        aborted=False,
        serviceName="local_glue",
        databaseName="default",
        databaseSchema="information_schema",
        duration=None,
    ),
]


class QueryLogSourceTest(TestCase):
    """
    Implements the necessary unit tests for
    Usage & Lineage via Query Log
    """

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_query_log_config)
        self.source = QueryLogUsageSource.create(
            mock_query_log_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_queries(self):
        queries = list(self.source.get_table_query())
        TableQuery.__eq__ = custom_query_compare
        for index in range(len(queries[0].queries)):
            assert queries[0].queries[index] == EXPECTED_QUERIES[index]
