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
Test Greenplum using the topology
"""

from collections import namedtuple
from unittest import TestCase
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TablePartition,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.greenplum.metadata import GreenplumSource
from metadata.ingestion.source.database.greenplum.queries import (
    GREENPLUM_GET_TABLE_NAMES_V6,
    GREENPLUM_GET_TABLE_NAMES_V7,
)

mock_greenplum_config = {
    "source": {
        "type": "greenplum",
        "serviceName": "local_greenplum1",
        "serviceConnection": {
            "config": {
                "type": "Greenplum",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:5432",
                "database": "greenplum",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "greenplum"},
        }
    },
}

PartitionRow = namedtuple("PartitionRow", ["schema", "table_name", "partition_strategy", "column_name"])


class greenplumUnitTest(TestCase):  # noqa: N801
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_greenplum_config)
        self.greenplum_source = GreenplumSource.create(
            mock_greenplum_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection")
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.greenplum_source.close()


@pytest.fixture()
def greenplum_source():
    with patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    ) as test_connection:
        test_connection.return_value = False
        source = GreenplumSource.create(
            mock_greenplum_config["source"],
            OpenMetadataWorkflowConfig.model_validate(mock_greenplum_config).workflowConfig.openMetadataServerConfig,
        )
        yield source


@pytest.fixture()
def mock_engine_with_version(greenplum_source):
    def _factory(version_string):
        mock_engine = MagicMock()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.scalar.return_value = version_string
        greenplum_source.engine = mock_engine
        greenplum_source._greenplum_version = None
        return mock_engine, mock_conn

    return _factory


def test_version_detection_v6(greenplum_source, mock_engine_with_version):
    mock_engine_with_version(
        "PostgreSQL 9.4.26 (Greenplum Database 6.25.3 build dev) on x86_64-pc-linux-gnu compiled by gcc 6.4.0"
    )
    assert greenplum_source._get_greenplum_major_version() == 6
    assert not greenplum_source._is_v7_or_later()


def test_version_detection_v7(greenplum_source, mock_engine_with_version):
    mock_engine_with_version(
        "PostgreSQL 12.12 (Greenplum Database 7.0.0 build dev) on x86_64-pc-linux-gnu compiled by gcc 12.3.1"
    )
    assert greenplum_source._get_greenplum_major_version() == 7
    assert greenplum_source._is_v7_or_later()


def test_version_detection_caches_result(greenplum_source, mock_engine_with_version):
    mock_engine, _ = mock_engine_with_version(
        "PostgreSQL 12.12 (Greenplum Database 7.2.0 build dev) on x86_64-pc-linux-gnu"
    )
    greenplum_source._get_greenplum_major_version()
    greenplum_source._get_greenplum_major_version()
    mock_engine.connect.assert_called_once()


def test_version_detection_defaults_to_7_on_error(greenplum_source):
    mock_engine = MagicMock()
    mock_engine.connect.side_effect = OperationalError("SELECT version()", {}, Exception("connection error"))
    greenplum_source.engine = mock_engine
    greenplum_source._greenplum_version = None
    assert greenplum_source._get_greenplum_major_version() == 7


def test_version_detection_defaults_to_7_on_unparseable(greenplum_source, mock_engine_with_version):
    mock_engine_with_version("PostgreSQL 14.0 on x86_64-pc-linux-gnu")
    assert greenplum_source._get_greenplum_major_version() == 7


def test_partition_details_v7(greenplum_source):
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.all.return_value = [
        PartitionRow(schema="public", table_name="sales", partition_strategy="range", column_name="sale_date")
    ]
    greenplum_source.engine = mock_engine
    greenplum_source._greenplum_version = 7

    is_partitioned, partition = greenplum_source.get_table_partition_details("sales", "public", MagicMock())

    assert is_partitioned is True
    assert partition == TablePartition(
        columns=[
            PartitionColumnDetails(
                columnName="sale_date",
                intervalType=PartitionIntervalTypes.TIME_UNIT,
                interval=None,
            )
        ]
    )


def test_partition_details_v6(greenplum_source):
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.all.return_value = [
        PartitionRow(schema="public", table_name="sales", partition_strategy="list", column_name="region")
    ]
    greenplum_source.engine = mock_engine
    greenplum_source._greenplum_version = 6

    is_partitioned, partition = greenplum_source.get_table_partition_details("sales", "public", MagicMock())

    assert is_partitioned is True
    assert partition == TablePartition(
        columns=[
            PartitionColumnDetails(
                columnName="region",
                intervalType=PartitionIntervalTypes.COLUMN_VALUE,
                interval=None,
            )
        ]
    )


def test_partition_details_no_results(greenplum_source):
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.all.return_value = []
    greenplum_source.engine = mock_engine
    greenplum_source._greenplum_version = 7

    is_partitioned, partition = greenplum_source.get_table_partition_details("not_partitioned", "public", MagicMock())

    assert is_partitioned is False
    assert partition is None


def test_partition_details_expression_key_returns_true_no_columns(greenplum_source):
    """Expression-based partition keys yield NULL column_name rows; the
    table should still be reported as partitioned (is_partitioned=True)
    because a row exists in the partitioning catalog, even though we
    cannot resolve the column names yet.  partition details are None."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.all.return_value = [
        PartitionRow(schema="public", table_name="sales", partition_strategy="range", column_name=None)
    ]
    greenplum_source.engine = mock_engine
    greenplum_source._greenplum_version = 7

    is_partitioned, partition = greenplum_source.get_table_partition_details("sales", "public", MagicMock())

    assert is_partitioned is True
    assert partition is None


def test_query_table_names_uses_v6_query_for_v6(greenplum_source):
    mock_connection = MagicMock()
    mock_connection.execute.return_value = []
    greenplum_source._greenplum_version = 6

    with patch.object(
        type(greenplum_source),
        "connection",
        new_callable=lambda: property(lambda self: mock_connection),
    ):
        list(greenplum_source.query_table_names_and_types("public"))

    executed_sql = str(mock_connection.execute.call_args[0][0])
    assert executed_sql.strip() == GREENPLUM_GET_TABLE_NAMES_V6.strip()
    assert "pg_partition_rule" in executed_sql


def test_query_table_names_uses_v7_query_for_v7(greenplum_source):
    mock_connection = MagicMock()
    mock_connection.execute.return_value = []
    greenplum_source._greenplum_version = 7

    with patch.object(
        type(greenplum_source),
        "connection",
        new_callable=lambda: property(lambda self: mock_connection),
    ):
        list(greenplum_source.query_table_names_and_types("public"))

    executed_sql = str(mock_connection.execute.call_args[0][0])
    assert executed_sql.strip() == GREENPLUM_GET_TABLE_NAMES_V7.strip()
    assert "relispartition" in executed_sql
    assert "pg_partition_rule" not in executed_sql
