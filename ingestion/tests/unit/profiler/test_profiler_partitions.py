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

from typing import Optional, cast
from unittest import TestCase
from unittest.mock import patch

from google.cloud.bigquery import PartitionRange, RangePartitioning, TimePartitioning
from pydantic import BaseModel

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    PartitionIntervalUnit,
    PartitionProfilerConfig,
    Table,
    TablePartition,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.workflow.profiler import ProfilerWorkflow

"""
Check Partitioned Table in Profiler Workflow
"""
MOCK_GET_SOURCE_CONNECTION = "XXXXX-XXXX-XXXXX"
mock_bigquery_config = {
    "source": {
        "type": "bigquery",
        "serviceName": "local_bigquery",
        "serviceConnection": {
            "config": {"type": "BigQuery", "credentials": {"gcpConfig": {}}}
        },
        "sourceConfig": {
            "config": {
                "type": "Profiler",
            }
        },
    },
    "processor": {
        "type": "orm-profiler",
        "config": {
            "profiler": {
                "name": "my_profiler",
                "timeout_seconds": 60,
                "metrics": ["row_count", "min", "max", "COUNT", "null_count"],
            },
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
    tablePartition: Optional[TablePartition]
    tableProfilerConfig: Optional[TableProfilerConfig]
    serviceType = DatabaseServiceType.BigQuery

    class Config:
        arbitrary_types_allowed = True


class MockRedshiftTable(BaseModel):
    tablePartition: Optional[TablePartition]
    tableProfilerConfig: Optional[TableProfilerConfig]
    serviceType = DatabaseServiceType.Redshift

    class Config:
        arbitrary_types_allowed = True


MOCK_TIME_UNIT_PARTITIONING = TimePartitioning(
    expiration_ms=None, field="test_column", type_="DAY"
)

MOCK_INGESTION_TIME_PARTITIONING = TimePartitioning(expiration_ms=None, type_="HOUR")

MOCK_RANGE_PARTITIONING = RangePartitioning(
    field="test_column", range_=PartitionRange(end=100, interval=10, start=0)
)


class ProfilerPartitionUnitTest(TestCase):
    @patch(
        "metadata.profiler.source.metadata.OpenMetadataSource._validate_service_name"
    )
    @patch("google.auth.default")
    @patch("sqlalchemy.engine.base.Engine.connect")
    @patch("sqlalchemy_bigquery._helpers.create_bigquery_client")
    @patch("metadata.ingestion.source.database.bigquery.connection.test_connection")
    def __init__(
        self,
        methodName,
        mock_connect,
        mock_create_bigquery_client,
        auth_default,
        validate_service_name,
        mock_test_connection,
    ):
        super().__init__(methodName)
        mock_test_connection.return_value = True
        validate_service_name.return_value = True
        auth_default.return_value = (None, MOCK_GET_SOURCE_CONNECTION)
        self.profiler_workflow = ProfilerWorkflow.create(mock_bigquery_config)

    def test_partition_details_time_unit(self):
        table_entity = MockTable(
            tablePartition=TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName="e",
                        intervalType=PartitionIntervalTypes.TIME_UNIT,
                        interval="DAY",
                    )
                ]
            ),
            tableProfilerConfig=None,
        )

        table_entity = cast(Table, table_entity)
        resp = ProfilerInterface.get_partition_details(table_entity)

        if resp:
            assert resp.partitionColumnName == "e"
            assert resp.partitionInterval == 1
            assert not resp.partitionValues
        else:
            assert False

        table_entity.tableProfilerConfig = TableProfilerConfig(
            partitioning=PartitionProfilerConfig(
                partitionColumnName="e",
                partitionInterval=3,
                partitionIntervalUnit="MONTH",
            )  # type: ignore
        )

        resp = ProfilerInterface.get_partition_details(table_entity)

        if resp:
            assert resp.partitionColumnName == "e"
            assert resp.partitionInterval == 3
            assert resp.partitionIntervalUnit == PartitionIntervalUnit.MONTH
        else:
            assert False

    def test_partition_details_ingestion_time_date(self):
        table_entity = MockTable(
            tablePartition=TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName="e",
                        intervalType=PartitionIntervalTypes.INGESTION_TIME.value,
                        interval="DAY",
                    )
                ]
            ),
            tableProfilerConfig=None,
        )

        table_entity = cast(Table, table_entity)
        resp = ProfilerInterface.get_partition_details(table_entity)

        if resp:
            assert resp.partitionColumnName == "_PARTITIONDATE"
            assert resp.partitionInterval == 1
            assert not resp.partitionValues
        else:
            assert False

        table_entity.tableProfilerConfig = TableProfilerConfig(
            partitioning=PartitionProfilerConfig(
                partitionColumnName="_PARTITIONDATE",
                partitionInterval=10,
                partitionIntervalUnit="DAY",
            )  # type: ignore
        )

        resp = ProfilerInterface.get_partition_details(table_entity)
        if resp:
            assert resp.partitionInterval == 10
            assert resp.partitionColumnName == "_PARTITIONDATE"
            assert resp.partitionIntervalUnit == PartitionIntervalUnit.DAY
        else:
            assert False

    def test_partition_details_ingestion_time_hour(self):
        table_entity = MockTable(
            tablePartition=TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName="e",
                        intervalType=PartitionIntervalTypes.INGESTION_TIME.value,
                        interval="HOUR",
                    )
                ]
            ),
            tableProfilerConfig=None,
        )

        table_entity = cast(Table, table_entity)
        resp = ProfilerInterface.get_partition_details(table_entity)

        if resp:
            assert resp.partitionColumnName == "_PARTITIONTIME"
            assert resp.partitionInterval == 1
            assert not resp.partitionValues
        else:
            assert False

        table_entity.tableProfilerConfig = TableProfilerConfig(
            partitioning=PartitionProfilerConfig(
                partitionColumnName="_PARTITIONTIME",
                partitionInterval=1,
                partitionIntervalUnit="HOUR",
            )  # type: ignore
        )

        resp = ProfilerInterface.get_partition_details(table_entity)

        if resp:
            assert resp.partitionInterval == 1
            assert resp.partitionColumnName == "_PARTITIONTIME"
            assert resp.partitionIntervalUnit == PartitionIntervalUnit.HOUR
        else:
            assert False

    def test_partition_non_bq_table_profiler_partition_config(self):
        table_entity = MockRedshiftTable(
            tablePartition=TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName="datetime",
                        intervalType=PartitionIntervalTypes.TIME_UNIT.value,
                        interval="DAY",
                    )
                ]
            ),
            tableProfilerConfig=TableProfilerConfig(
                partitioning=PartitionProfilerConfig(
                    enablePartitioning=True,
                    partitionColumnName="foo",
                    partitionIntervalType=PartitionIntervalTypes.TIME_UNIT,
                    partitionIntervalUnit="DAY",
                    partitionInterval=1,
                )  # type: ignore
            ),
        )

        table_entity = cast(Table, table_entity)
        resp = ProfilerInterface.get_partition_details(table_entity)
        if resp:
            assert resp.enablePartitioning
            assert resp.partitionColumnName == "foo"
            assert resp.partitionIntervalType == PartitionIntervalTypes.TIME_UNIT
            assert resp.partitionIntervalUnit == PartitionIntervalUnit.DAY
            assert resp.partitionInterval == 1
        else:
            assert False

    def test_partition_non_bq_table_no_profiler_partition_config(self):
        table_entity = MockRedshiftTable(
            tablePartition=TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName="datetime",
                        intervalType=PartitionIntervalTypes.TIME_UNIT.value,
                        interval="DAY",
                    )
                ]
            ),
            tableProfilerConfig=None,
        )

        table_entity = cast(Table, table_entity)
        resp = ProfilerInterface.get_partition_details(table_entity)

        assert resp is None
