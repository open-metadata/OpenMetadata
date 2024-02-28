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
import unittest
from typing import Optional
from unittest import TestCase
from unittest.mock import Mock, patch

from google.cloud.bigquery import PartitionRange, RangePartitioning, TimePartitioning
from google.cloud.bigquery.table import Table
from pydantic import BaseModel

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource

"""
Check Partitioned Table in Profiler Workflow
"""

mock_bigquery_config = {
    "source": {
        "type": "bigquery",
        "serviceName": "local_bigquery7",
        "serviceConnection": {
            "config": {"type": "BigQuery", "credentials": {"gcpConfig": {}}}
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
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

TEST_PARTITION = {"schema_name": "test_schema", "table_name": "test_table"}

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="bigquery_source.bigquery.db",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)


class MockTable(BaseModel):
    time_partitioning: Optional[TimePartitioning]
    range_partitioning: Optional[RangePartitioning]

    class Config:
        arbitrary_types_allowed = True


MOCK_TIME_UNIT_PARTITIONING = TimePartitioning(
    expiration_ms=None, field="test_column", type_="DAY"
)

MOCK_INGESTION_TIME_PARTITIONING = TimePartitioning(expiration_ms=None, type_="HOUR")

MOCK_RANGE_PARTITIONING = RangePartitioning(
    field="test_column", range_=PartitionRange(end=100, interval=10, start=0)
)


class BigqueryUnitTest(TestCase):
    @patch("google.cloud.bigquery.Client")
    @patch("metadata.ingestion.connections.builders.create_generic_db_connection")
    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource.set_project_id"
    )
    @patch(
        "metadata.ingestion.source.database.bigquery.metadata.BigquerySource._test_connection"
    )
    @patch("metadata.ingestion.source.database.common_db_source.get_connection")
    def __init__(
        self,
        methodName,
        get_connection_common,
        test_connection,
        set_project_id,
        create_generic_connection,
        client,
    ) -> None:
        super().__init__(methodName)
        get_connection_common.return_value = Mock()
        client.return_value = Mock()
        create_generic_connection.return_value = Mock()
        set_project_id.return_value = Mock()
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_bigquery_config)
        self.bigquery_source = BigquerySource.create(
            mock_bigquery_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.bigquery_source.context.__dict__[
            "database"
        ] = MOCK_DATABASE.fullyQualifiedName.__root__
        self.bigquery_source.client = client
        self.inspector = types.SimpleNamespace()

        unittest.mock.patch.object(Table, "object")

    def test_time_unit_partition(self):
        self.bigquery_source.client.get_table = lambda fqn: MockTable(
            time_partitioning=MOCK_TIME_UNIT_PARTITIONING
        )
        bool_resp, partition = self.bigquery_source.get_table_partition_details(
            schema_name=TEST_PARTITION.get("schema_name"),
            table_name=TEST_PARTITION.get("table_name"),
            inspector=self.inspector,
        )

        assert partition.columns == [
            PartitionColumnDetails(
                columnName="test_column",
                intervalType=PartitionIntervalTypes.TIME_UNIT,
                interval="DAY",
            )
        ]
        assert (
            partition.columns[0].intervalType.value
            == PartitionIntervalTypes.TIME_UNIT.value
        )
        assert partition.columns[0].interval == "DAY"
        assert bool_resp

    def test_ingestion_time_partition(self):
        self.bigquery_source.client.get_table = lambda fqn: MockTable(
            time_partitioning=MOCK_INGESTION_TIME_PARTITIONING
        )
        bool_resp, partition = self.bigquery_source.get_table_partition_details(
            schema_name=TEST_PARTITION.get("schema_name"),
            table_name=TEST_PARTITION.get("table_name"),
            inspector=self.inspector,
        )

        self.assertIsInstance(partition.columns, list)
        assert (
            partition.columns[0].intervalType.value
            == PartitionIntervalTypes.INGESTION_TIME.value
        )
        assert partition.columns[0].interval == "HOUR"
        assert bool_resp

    def test_range_partition(self):
        self.bigquery_source.client.get_table = lambda fqn: MockTable(
            time_partitioning=None, range_partitioning=MOCK_RANGE_PARTITIONING
        )

        bool_resp, partition = self.bigquery_source.get_table_partition_details(
            schema_name=TEST_PARTITION.get("schema_name"),
            table_name=TEST_PARTITION.get("table_name"),
            inspector=self.inspector,
        )

        self.assertIsInstance(partition.columns, list)
        assert (
            partition.columns[0].intervalType.value
            == PartitionIntervalTypes.INTEGER_RANGE.value
        )
        assert partition.columns[0].interval == 10
        assert bool_resp

    def test_no_partition(self):
        self.bigquery_source.client.get_table = lambda fqn: MockTable(
            time_partitioning=None, range_partitioning=None
        )

        bool_resp, partition = self.bigquery_source.get_table_partition_details(
            schema_name=TEST_PARTITION.get("schema_name"),
            table_name=TEST_PARTITION.get("table_name"),
            inspector=self.inspector,
        )

        assert not bool_resp
        assert not partition
