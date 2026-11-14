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
"""Doris column type mapping"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.dialects.mysql.base import MySQLDialect

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.doris.metadata import DorisSource, _get_column

DORIS_WORKFLOW_CONFIG = {
    "source": {
        "type": "doris",
        "serviceName": "local_doris",
        "serviceConnection": {"config": {"type": "Doris", "username": "root", "hostPort": "localhost:9030"}},
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "doris"},
        }
    },
}

# SHOW FULL COLUMNS rows from Doris master:
# Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment
IP_SHOW_FULL_COLUMNS_ROWS = [
    ("k_id", "bigint", "", "NO", "YES", None, "", "", "id"),
    ("c_ipv4", "ipv4", "", "YES", "NO", None, "NONE", "", ""),
    ("c_ipv6", "ipv6", "", "YES", "NO", None, "NONE", "", ""),
    ("c_ips", "array<ipv4>", "", "YES", "NO", None, "NONE", "", ""),
]


@pytest.fixture
def doris_source():
    with (
        patch("metadata.ingestion.source.database.common_db_source.create_connection"),
        patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"),
    ):
        source = DorisSource.create(DORIS_WORKFLOW_CONFIG["source"], MagicMock())
    source.engine.dialect = MySQLDialect()
    context = source.context.get()
    context.upsert("database_service", "local_doris")
    context.upsert("database", "default")
    context.upsert("database_schema", "om_verify")
    return source


class TestGetColumnDataType:
    """_get_column maps the type strings Doris prints in SHOW FULL COLUMNS"""

    @pytest.mark.parametrize(
        ("raw_type", "expected"),
        [
            ("tinyint", DataType.TINYINT),
            ("largeint", DataType.LARGEINT),
            ("boolean", DataType.BOOLEAN),
            ("decimal(10,2)", DataType.DECIMAL),
            ("decimalv3(10,2)", DataType.DECIMAL),
            ("date", DataType.DATE),
            ("datev2", DataType.DATE),
            ("datetime(3)", DataType.DATETIME),
            ("datetimev2(3)", DataType.DATETIME),
            ("char(10)", DataType.CHAR),
            ("varchar(20)", DataType.VARCHAR),
            ("varchar(*)", DataType.VARCHAR),
            ("text", DataType.TEXT),
            ("json", DataType.JSON),
            ("variant", DataType.VARIANT),
            ("array<int>", DataType.ARRAY),
            ("map<text,int>", DataType.MAP),
            ("struct<a:int,b:decimal(10,2)>", DataType.STRUCT),
            ("hll", DataType.HLL),
            ("bitmap", DataType.BITMAP),
            ("quantile_state", DataType.QUANTILE_STATE),
            ("agg_state<max_by(int not null, int null)>", DataType.AGG_STATE),
            ("ipv4", DataType.IPV4),
            ("ipv6", DataType.IPV6),
        ],
    )
    def test_system_data_type(self, raw_type, expected):
        assert _get_column(0, "c", raw_type, "YES", None, "")["system_data_type"] == expected.value

    @pytest.mark.parametrize(
        ("raw_type", "expected"),
        [
            ("array<int>", DataType.INT),
            ("array<datev2>", DataType.DATE),
            ("array<ipv4>", DataType.IPV4),
            ("array<ipv6>", DataType.IPV6),
        ],
    )
    def test_array_element_data_type(self, raw_type, expected):
        assert _get_column(0, "c", raw_type, "YES", None, "")["arr_data_type"] == expected.value


class TestIpColumnsAreIngested:
    """IPV4/IPV6 columns reach the Table entity instead of being dropped"""

    def test_ip_columns_are_ingested(self, doris_source):
        doris_source.engine.connect.return_value.execute.return_value = IP_SHOW_FULL_COLUMNS_ROWS

        columns, _, _ = doris_source.get_columns_and_constraints("om_verify", "t_types", "default", inspector=None)

        assert [(model_str(column.name), column.dataType, column.arrayDataType) for column in columns] == [
            ("k_id", DataType.BIGINT, None),
            ("c_ipv4", DataType.IPV4, None),
            ("c_ipv6", DataType.IPV6, None),
            ("c_ips", DataType.ARRAY, DataType.IPV4),
        ]
