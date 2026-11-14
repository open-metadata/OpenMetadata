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
"""Doris partition details follow the partition method and the partition column types"""

from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.entity.data.table import PartitionIntervalTypes
from metadata.ingestion.source.database.doris.metadata import DorisSource

COLUMN_VALUE = PartitionIntervalTypes.COLUMN_VALUE
INTEGER_RANGE = PartitionIntervalTypes.INTEGER_RANGE
TIME_UNIT = PartitionIntervalTypes.TIME_UNIT

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


def _partition_row(table_name, engine, partition_method, partition_expression):
    return SimpleNamespace(
        TABLE_NAME=table_name,
        ENGINE=engine,
        PARTITION_METHOD=partition_method,
        PARTITION_EXPRESSION=partition_expression,
    )


# information_schema.tables joined with information_schema.partitions on Doris master:
# TABLE_NAME, ENGINE, PARTITION_METHOD, PARTITION_EXPRESSION
PARTITION_ROWS = [
    _partition_row("order", "Doris", "UNPARTITIONED", "NULL"),
    _partition_row("t_uniq", "Doris", "LIST", "region"),
    _partition_row("t_list_multi", "Doris", "LIST", "region, city"),
    _partition_row("t_auto_list", "Doris", "LIST", "city"),
    _partition_row("t_types", "Doris", "RANGE", "k_date"),
    _partition_row("t_auto", "Doris", "RANGE", "ts"),
    _partition_row("t_dyn", "Doris", "RANGE", "dt"),
    _partition_row("t_range_int", "Doris", "RANGE", "id"),
    _partition_row("t_range_multi", "Doris", "RANGE", "dt, id"),
    # AUTO PARTITION BY RANGE table before its first load
    _partition_row("t_auto_empty", "Doris", None, None),
    _partition_row("v_user_summary", "View", None, None),
    _partition_row("mv_region_amount", None, "UNPARTITIONED", "NULL"),
    # materialized views partitioned like their base table t_dyn, t_range_int and t_auto_empty
    _partition_row("mv_dyn", None, "RANGE", "dt"),
    _partition_row("mv_range_int", None, "RANGE", "id"),
    _partition_row("mv_auto_empty", None, None, None),
]

# SHOW CREATE TABLE on Doris master, PROPERTIES shortened
CREATE_TABLE = {
    "order": """CREATE TABLE `order` (
  `id` int NULL,
  `desc` varchar(20) NULL
) ENGINE=OLAP
DUPLICATE KEY(`id`)
DISTRIBUTED BY HASH(`id`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
);""",
    "t_uniq": """CREATE TABLE `t_uniq` (
  `region` varchar(10) NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(50) NULL COMMENT "user name"
) ENGINE=OLAP
UNIQUE KEY(`region`, `user_id`)
COMMENT 'unique key table'
PARTITION BY LIST (`region`)
(PARTITION p_east VALUES IN ("EAST"),
PARTITION p_west VALUES IN ("WEST"))
DISTRIBUTED BY HASH(`user_id`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
);""",
    "t_types": """CREATE TABLE `t_types` (
  `k_date` date NOT NULL COMMENT "partition col",
  `k_id` bigint NOT NULL COMMENT "id",
  `c_int` int NULL
) ENGINE=OLAP
DUPLICATE KEY(`k_date`, `k_id`)
COMMENT 'table with many types'
PARTITION BY RANGE(`k_date`)
(PARTITION p202601 VALUES [('0000-01-01'), ('2026-02-01')),
PARTITION p202602 VALUES [('2026-02-01'), ('2026-03-01')))
DISTRIBUTED BY HASH(`k_id`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
);""",
    "t_auto": """CREATE TABLE `t_auto` (
  `ts` datetime NOT NULL,
  `v` int NULL
) ENGINE=OLAP
DUPLICATE KEY(`ts`)
AUTO PARTITION BY RANGE (date_trunc(`ts`, 'day'))
(PARTITION p20260101000000 VALUES [('2026-01-01 00:00:00'), ('2026-01-02 00:00:00')),
PARTITION p20260102000000 VALUES [('2026-01-02 00:00:00'), ('2026-01-03 00:00:00')))
DISTRIBUTED BY HASH(`v`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
);""",
    "t_dyn": """CREATE TABLE `t_dyn` (
  `dt` date NOT NULL,
  `v` int NULL
) ENGINE=OLAP
DUPLICATE KEY(`dt`)
PARTITION BY RANGE(`dt`)
(PARTITION p20261112 VALUES [('2026-11-12'), ('2026-11-13')),
PARTITION p20261113 VALUES [('2026-11-13'), ('2026-11-14')),
PARTITION p20261114 VALUES [('2026-11-14'), ('2026-11-15')))
DISTRIBUTED BY HASH(`dt`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1",
"dynamic_partition.enable" = "true",
"dynamic_partition.time_unit" = "DAY",
"dynamic_partition.time_zone" = "Asia/Shanghai",
"dynamic_partition.start" = "-2",
"dynamic_partition.end" = "2",
"dynamic_partition.prefix" = "p"
);""",
    "t_range_int": """CREATE TABLE `t_range_int` (
  `id` int NOT NULL,
  `v` int NULL
) ENGINE=OLAP
DUPLICATE KEY(`id`)
PARTITION BY RANGE(`id`)
(PARTITION p1 VALUES [("-2147483648"), ("100")),
PARTITION p2 VALUES [("100"), ("200")))
DISTRIBUTED BY HASH(`id`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
);""",
    "t_range_multi": """CREATE TABLE `t_range_multi` (
  `dt` date NOT NULL,
  `id` int NOT NULL,
  `v` int NULL
) ENGINE=OLAP
DUPLICATE KEY(`dt`, `id`)
PARTITION BY RANGE(`dt`, `id`)
(PARTITION p1 VALUES [('0000-01-01', "-2147483648"), ('2026-02-01', "100")))
DISTRIBUTED BY HASH(`id`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
);""",
    "t_auto_empty": """CREATE TABLE `t_auto_empty` (
  `ts` datetime NOT NULL,
  `k` int NOT NULL,
  `v` int NULL
) ENGINE=OLAP
UNIQUE KEY(`ts`, `k`)
AUTO PARTITION BY RANGE (date_trunc(`ts`, 'month'))
()
DISTRIBUTED BY HASH(`k`) BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
);""",
}

# SHOW FULL COLUMNS rows from Doris master:
# Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment
SHOW_FULL_COLUMNS_ROWS = {
    "t_types": [
        ("k_date", "date", "", "NO", "YES", None, "", "", "partition col"),
        ("k_id", "bigint", "", "NO", "YES", None, "", "", "id"),
        ("c_int", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    "t_auto": [
        ("ts", "datetime", "", "NO", "YES", None, "", "", ""),
        ("v", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    "t_dyn": [
        ("dt", "date", "", "NO", "YES", None, "", "", ""),
        ("v", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    "t_range_int": [
        ("id", "int", "", "NO", "YES", None, "", "", ""),
        ("v", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    "t_range_multi": [
        ("dt", "date", "", "NO", "YES", None, "", "", ""),
        ("id", "int", "", "NO", "YES", None, "", "", ""),
        ("v", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    "t_auto_empty": [
        ("ts", "datetime", "", "NO", "YES", None, "", "", ""),
        ("k", "int", "", "NO", "YES", None, "", "", ""),
        ("v", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    "mv_dyn": [
        ("dt", "date", "", "NO", "YES", None, "", "", ""),
        ("v", "bigint", "", "YES", "YES", None, "", "", ""),
    ],
    "mv_range_int": [
        ("id", "int", "", "NO", "YES", None, "", "", ""),
        ("v", "bigint", "", "YES", "YES", None, "", "", ""),
    ],
}


def _execute(statement, *_):
    """Answer the connector's queries with the rows Doris returns"""
    query = str(statement).strip()
    if "information_schema.partitions" in query:
        return PARTITION_ROWS
    # SHOW CREATE TABLE / SHOW FULL COLUMNS FROM `om_verify`.`<table>`
    table_name = query.rsplit(".", 1)[-1].strip("`")
    if query.startswith("SHOW CREATE TABLE"):
        return MagicMock(one=MagicMock(return_value=(table_name, CREATE_TABLE[table_name])))
    return SHOW_FULL_COLUMNS_ROWS[table_name]


def _doris_source(threads=1):
    config = deepcopy(DORIS_WORKFLOW_CONFIG["source"])
    config["sourceConfig"]["config"]["threads"] = threads
    with (
        patch("metadata.ingestion.source.database.common_db_source.create_connection"),
        patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"),
    ):
        source = DorisSource.create(config, MagicMock())
    source.engine.dialect = MySQLDialect()
    source.engine.connect.return_value.execute.side_effect = _execute
    context = source.context.get()
    context.upsert("database_service", "local_doris")
    context.upsert("database", "default")
    context.upsert("database_schema", "om_verify")
    return source


@pytest.fixture
def doris_source():
    return _doris_source()


def _statements(doris_source):
    """What the connector asked Doris: the schema's partitions, or the SHOW command it ran on the table"""
    queries = [str(call.args[0]).strip() for call in doris_source.engine.connect.return_value.execute.call_args_list]
    return [
        "information_schema.partitions" if "information_schema.partitions" in query else query.rsplit(" ", 1)[0]
        for query in queries
    ]


class TestPartitionDetails:
    """LIST partitions are column values; RANGE partitions are time units or integer ranges by column type"""

    @pytest.mark.parametrize(
        ("table_name", "partition_columns"),
        [
            pytest.param("t_uniq", [("region", COLUMN_VALUE, None)], id="list"),
            pytest.param(
                "t_list_multi",
                [("region", COLUMN_VALUE, None), ("city", COLUMN_VALUE, None)],
                id="list-multi-column",
            ),
            pytest.param("t_auto_list", [("city", COLUMN_VALUE, None)], id="auto-list"),
            pytest.param("t_types", [("k_date", TIME_UNIT, None)], id="range-date"),
            pytest.param("t_auto", [("ts", TIME_UNIT, "DAY")], id="auto-range-date-trunc"),
            pytest.param("t_dyn", [("dt", TIME_UNIT, "DAY")], id="dynamic-partition"),
            pytest.param("t_range_int", [("id", INTEGER_RANGE, None)], id="range-integer"),
            pytest.param(
                "t_range_multi",
                [("dt", TIME_UNIT, None), ("id", INTEGER_RANGE, None)],
                id="range-multi-column",
            ),
            pytest.param("t_auto_empty", [("ts", TIME_UNIT, "MONTH")], id="auto-range-without-partitions"),
            pytest.param("mv_dyn", [("dt", TIME_UNIT, None)], id="materialized-view-range-date"),
            pytest.param("mv_range_int", [("id", INTEGER_RANGE, None)], id="materialized-view-range-integer"),
        ],
    )
    def test_partitioned_table(self, doris_source, table_name, partition_columns):
        is_partitioned, partition = doris_source.get_table_partition_details(table_name, "om_verify", inspector=None)

        assert is_partitioned is True
        assert [(column.columnName, column.intervalType, column.interval) for column in partition.columns] == (
            partition_columns
        )

    @pytest.mark.parametrize(
        "table_name",
        [
            pytest.param("order", id="unpartitioned"),
            pytest.param("mv_region_amount", id="unpartitioned-materialized-view"),
            pytest.param("v_user_summary", id="view"),
            pytest.param("mv_auto_empty", id="materialized-view-without-partitions"),
        ],
    )
    def test_not_partitioned(self, doris_source, table_name):
        assert doris_source.get_table_partition_details(table_name, "om_verify", inspector=None) == (False, None)

    def test_partitions_read_once_per_schema(self, doris_source):
        for table_name in ("t_uniq", "v_user_summary", "order", "mv_region_amount"):
            doris_source.get_table_partition_details(table_name, "om_verify", inspector=None)

        assert _statements(doris_source) == ["information_schema.partitions"]

    def test_partitions_kept_for_each_thread(self):
        """With `threads`, each worker ingests its own schema at the same time"""
        doris_source = _doris_source(threads=2)
        for schema_name in ("om_verify", "om_probe", "om_verify", "om_probe"):
            doris_source.get_table_partition_details("t_uniq", schema_name, inspector=None)

        assert _statements(doris_source) == ["information_schema.partitions"] * 2

    @pytest.mark.parametrize(
        ("table_name", "statements"),
        [
            pytest.param("v_user_summary", [], id="view"),
            pytest.param("t_uniq", [], id="list"),
            pytest.param("mv_dyn", ["SHOW FULL COLUMNS FROM"], id="materialized-view-range"),
            pytest.param("t_auto", ["SHOW CREATE TABLE", "SHOW FULL COLUMNS FROM"], id="range"),
            pytest.param(
                "t_auto_empty", ["SHOW CREATE TABLE", "SHOW FULL COLUMNS FROM"], id="range-without-partitions"
            ),
        ],
    )
    def test_table_statements(self, doris_source, table_name, statements):
        """Only RANGE partitions need the column types, and only an OLAP table has DDL to read"""
        doris_source.get_table_partition_details(table_name, "om_verify", inspector=None)

        assert _statements(doris_source) == ["information_schema.partitions", *statements]

    @pytest.mark.parametrize(
        ("table_name", "expected"),
        [
            pytest.param("t_uniq", (True, [("region", COLUMN_VALUE, None)]), id="list"),
            pytest.param("t_types", (True, [("k_date", TIME_UNIT, None)]), id="range-date"),
            pytest.param("t_auto", (True, [("ts", TIME_UNIT, "DAY")]), id="auto-range-date-trunc"),
            pytest.param("order", (False, None), id="unpartitioned"),
            pytest.param("v_user_summary", (False, None), id="view"),
        ],
    )
    def test_partitions_read_from_ddl_without_partition_rows(self, doris_source, table_name, expected):
        """Before Doris 2.1.7 and 3.0.2, information_schema.partitions lists no partition"""

        def execute(statement, *args):
            if "information_schema.partitions" in str(statement):
                return [_partition_row(row.TABLE_NAME, row.ENGINE, None, None) for row in PARTITION_ROWS]
            return _execute(statement, *args)

        doris_source.engine.connect.return_value.execute.side_effect = execute

        is_partitioned, partition = doris_source.get_table_partition_details(table_name, "om_verify", inspector=None)

        columns = (
            [(column.columnName, column.intervalType, column.interval) for column in partition.columns]
            if partition
            else None
        )
        assert (is_partitioned, columns) == expected

    def test_partitions_failure_keeps_tables_without_partitions(self, doris_source):
        """A failing partition query must not drop the tables"""

        def execute(statement, *args):
            if "information_schema.partitions" in str(statement):
                raise OperationalError(str(statement), {}, Exception("Lost connection to MySQL server during query"))
            return _execute(statement, *args)

        doris_source.engine.connect.return_value.execute.side_effect = execute

        for table_name in ("t_uniq", "t_auto"):
            assert doris_source.get_table_partition_details(table_name, "om_verify", inspector=None) == (False, None)
        assert _statements(doris_source) == ["information_schema.partitions"]
