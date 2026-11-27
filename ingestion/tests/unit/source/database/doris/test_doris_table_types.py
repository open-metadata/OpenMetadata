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
"""Doris table types: materialized views, views listed once, and the DDL Doris prints"""

from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest
from pydoris.sqlalchemy.dialect import DorisDialect
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.doris.metadata import DorisSource

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

# The objects of a schema on Doris 4.1.3 and master: name, TABLE_TYPE and ENGINE in information_schema.tables
# (Table_type in SHOW FULL TABLES). An async materialized view is a BASE TABLE whose ENGINE is NULL.
OBJECTS = [
    ("t_uniq", "BASE TABLE", "Doris"),
    ("order", "BASE TABLE", "Doris"),
    ("mv_region_amount", "BASE TABLE", None),
    ("v_user_summary", "VIEW", "View"),
]

# mv_infos('database' = 'om_verify')
MATERIALIZED_VIEWS = ["mv_region_amount"]

# SHOW CREATE TABLE and SHOW CREATE MATERIALIZED VIEW on Doris master, PROPERTIES shortened
SHOW_CREATE = {
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
    "v_user_summary": """CREATE VIEW `v_user_summary`
(`region`,`user_id`,`cnt`)
 COMMENT 'view comment' AS SELECT `internal`.`om_verify`.`u`.`region`, `internal`.`om_verify`.`u`.`user_id`, \
COUNT(*) AS `cnt`
FROM `internal`.`om_verify`.`t_uniq` `u`
GROUP BY `internal`.`om_verify`.`u`.`region`, `internal`.`om_verify`.`u`.`user_id`;""",
    "mv_region_amount": """CREATE MATERIALIZED VIEW mv_region_amount
(`region`,`amount`)
BUILD IMMEDIATE REFRESH COMPLETE ON MANUAL
DUPLICATE KEY(`region`)
DISTRIBUTED BY RANDOM BUCKETS 1
PROPERTIES (
"replication_allocation" = "tag.location.default: 1"
)
AS SELECT `internal`.`om_verify`.`u`.`region`, SUM(`internal`.`om_verify`.`t`.`c_dec`) AS `amount` \
FROM `internal`.`om_verify`.`t_uniq` `u` JOIN `internal`.`om_verify`.`t_types` `t` \
ON `internal`.`om_verify`.`u`.`user_id` = `internal`.`om_verify`.`t`.`k_id` GROUP BY `internal`.`om_verify`.`u`.`region`""",
}

# Inspector.get_table_ddl as another connector module installs it: the DDL SQLAlchemy rebuilds from
# reflection, without the key model, partitioning, distribution or properties
REFLECTED_DDL = {
    "t_uniq": "CREATE TABLE om_verify.t_uniq (\n\tregion VARCHAR(10) NOT NULL, \n\tuser_id INTEGER NOT NULL\n)"
}

MATERIALIZED_VIEW_REFUSED = "not support async materialized view, please use `show create materialized view`"


class DorisInspector:
    """The inspector calls of the generic source, answered as pydoris and Doris answer them"""

    def get_table_names(self, schema):
        # pydoris reads SHOW FULL TABLES and keeps the BASE TABLE rows
        return [name for name, table_type, _ in OBJECTS if table_type == "BASE TABLE"]

    def get_view_names(self, schema):
        return [name for name, table_type, _ in OBJECTS if table_type == "VIEW"]

    def get_view_definition(self, view_name, schema):
        # The MySQL dialect reads SHOW CREATE TABLE, which Doris refuses for an async materialized view
        if view_name in MATERIALIZED_VIEWS:
            raise OperationalError("SHOW CREATE TABLE", {}, Exception(MATERIALIZED_VIEW_REFUSED))
        return SHOW_CREATE[view_name]

    def get_table_ddl(self, connection, table_name, schema):
        return REFLECTED_DDL[table_name]


def _execute(statement, params=None):
    """Answer the connector's statements as Doris does"""
    query = str(statement).strip()
    if "mv_infos" in query:
        assert params == {"schema": "om_verify"}
        return [(name,) for name in MATERIALIZED_VIEWS]
    if "information_schema.tables" in query.lower():
        # TABLE_NAME, ENGINE of every object of the schema, views included
        return [(name, engine) for name, _, engine in OBJECTS]
    # SHOW CREATE TABLE / SHOW CREATE MATERIALIZED VIEW `om_verify`.`<table>`
    table_name = query.rsplit(".", 1)[-1].strip("`")
    if query.startswith("SHOW CREATE MATERIALIZED VIEW"):
        # row schema: Materialized View, Create Materialized View, Session Variables
        row = (table_name, SHOW_CREATE[table_name], "{sql_mode=32}")
    elif query.startswith("SHOW CREATE TABLE") and table_name in MATERIALIZED_VIEWS:
        raise OperationalError(query, {}, Exception(MATERIALIZED_VIEW_REFUSED))
    else:
        # row schema: Table, Create Table
        row = (table_name, SHOW_CREATE[table_name])
    return MagicMock(one=MagicMock(return_value=row))


def _doris_source(**source_config):
    config = deepcopy(DORIS_WORKFLOW_CONFIG["source"])
    config["sourceConfig"]["config"].update(source_config)
    with (
        patch("metadata.ingestion.source.database.common_db_source.create_connection"),
        patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"),
    ):
        source = DorisSource.create(config, MagicMock())
    source.engine.dialect = MySQLDialect()
    source.engine.connect.return_value.execute.side_effect = _execute
    source._inspector_map = {source.context.get_current_thread_id(): DorisInspector()}
    context = source.context.get()
    context.upsert("database_service", "local_doris")
    context.upsert("database", "default")
    context.upsert("database_schema", "om_verify")
    return source


@pytest.fixture
def doris_source():
    return _doris_source()


def _statements(doris_source):
    return [str(call.args[0]).strip() for call in doris_source.engine.connect.return_value.execute.call_args_list]


class TestTableList:
    """Base tables come from the tables listing and views from the views listing, so each is listed once"""

    def test_tables_and_views_listed_once(self, doris_source):
        assert list(doris_source.get_tables_name_and_type()) == [
            ("t_uniq", TableType.Regular),
            ("order", TableType.Regular),
            ("mv_region_amount", TableType.MaterializedView),
            ("v_user_summary", TableType.View),
        ]

    def test_views_not_listed_when_excluded(self):
        doris_source = _doris_source(includeViews=False)

        assert list(doris_source.get_tables_name_and_type()) == [
            ("t_uniq", TableType.Regular),
            ("order", TableType.Regular),
            ("mv_region_amount", TableType.MaterializedView),
        ]

    def test_failed_materialized_view_read_raises(self, doris_source):
        """A failed mv_infos() read is not an empty one: the materialized views must not be ingested as tables"""

        def execute(statement, params=None):
            if "mv_infos" in str(statement):
                raise OperationalError(
                    str(statement), params, Exception("Lost connection to MySQL server during query")
                )
            return _execute(statement, params)

        doris_source.engine.connect.return_value.execute.side_effect = execute

        with pytest.raises(OperationalError):
            doris_source.query_table_names_and_types("om_verify")


class TestSchemaDefinition:
    """Materialized views and, with includeDDL, tables get the DDL Doris prints"""

    def test_materialized_view_definition(self, doris_source):
        definition = doris_source.get_schema_definition(
            TableType.MaterializedView, "mv_region_amount", "om_verify", DorisInspector()
        )

        assert definition == SHOW_CREATE["mv_region_amount"]
        assert _statements(doris_source) == ["SHOW CREATE MATERIALIZED VIEW `om_verify`.`mv_region_amount`"]

    def test_table_ddl(self):
        doris_source = _doris_source(includeDDL=True)

        definition = doris_source.get_schema_definition(TableType.Regular, "t_uniq", "om_verify", DorisInspector())

        assert definition == SHOW_CREATE["t_uniq"]
        assert _statements(doris_source) == ["SHOW CREATE TABLE `om_verify`.`t_uniq`"]

    def test_no_table_ddl_without_include_ddl(self, doris_source):
        assert doris_source.get_schema_definition(TableType.Regular, "t_uniq", "om_verify", DorisInspector()) is None
        assert _statements(doris_source) == []

    def test_view_definition(self, doris_source):
        definition = doris_source.get_schema_definition(TableType.View, "v_user_summary", "om_verify", DorisInspector())

        assert definition == SHOW_CREATE["v_user_summary"]

    def test_failed_definition_read_leaves_definition_unset(self, doris_source):
        def execute(statement, params=None):
            raise OperationalError(str(statement), params, Exception("Lost connection to MySQL server during query"))

        doris_source.engine.connect.return_value.execute.side_effect = execute

        definition = doris_source.get_schema_definition(
            TableType.MaterializedView, "mv_region_amount", "om_verify", DorisInspector()
        )

        assert definition is None


class TestTableDescription:
    """The table comment is read with the pydoris dialect"""

    def test_table_comment(self, doris_source):
        connection = MagicMock()
        result = connection.execute.return_value
        result.fetchone.return_value = ("unique key table",)
        result.__iter__.return_value = iter([("unique key table",)])
        inspector = MagicMock()
        inspector.get_table_comment.side_effect = lambda table_name, schema: DorisDialect().get_table_comment(
            connection, table_name, schema
        )

        assert doris_source.get_table_description("om_verify", "t_uniq", inspector) == "unique key table"

    def test_failed_comment_read_keeps_table(self, doris_source):
        inspector = MagicMock()
        inspector.get_table_comment.side_effect = OperationalError(
            "SELECT table_comment", {}, Exception("Lost connection to MySQL server during query")
        )

        assert doris_source.get_table_description("om_verify", "t_uniq", inspector) is None
