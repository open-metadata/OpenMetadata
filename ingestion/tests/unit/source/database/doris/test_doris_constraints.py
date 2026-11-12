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
"""Doris primary keys follow the table model, not the Key flag of SHOW FULL COLUMNS"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.entity.data.table import Constraint, ConstraintType
from metadata.ingestion.ometa.utils import model_str
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

# SHOW FULL COLUMNS rows from Doris master:
# Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment
SHOW_FULL_COLUMNS_ROWS = {
    # UNIQUE KEY(region, user_id)
    "t_uniq": [
        ("region", "varchar(10)", "", "NO", "YES", None, "", "", ""),
        ("user_id", "int", "", "NO", "YES", None, "", "", ""),
        ("name", "varchar(50)", "", "YES", "NO", None, "NONE", "", "user name"),
    ],
    # UNIQUE KEY(id)
    "t_uniq_single": [
        ("id", "int", "", "NO", "YES", None, "", "", ""),
        ("name", "varchar(50)", "", "YES", "NO", None, "NONE", "", ""),
    ],
    # AGGREGATE KEY(dt, site)
    "t_agg": [
        ("dt", "date", "", "NO", "YES", None, "", "", ""),
        ("site", "int", "", "NO", "YES", None, "", "", ""),
        ("pv", "bigint", "", "YES", "NO", "0", "SUM", "", ""),
    ],
    # DUPLICATE KEY(k_date, k_id)
    "t_dup": [
        ("k_date", "date", "", "NO", "YES", None, "", "", ""),
        ("k_id", "bigint", "", "NO", "YES", None, "", "", ""),
        ("c_int", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    # the legacy PRIMARY KEY model, KeysType.PRIMARY_KEYS
    "t_pri": [
        ("k1", "int", "", "NO", "YES", None, "", "", ""),
        ("k2", "int", "", "NO", "YES", None, "", "", ""),
        ("v", "int", "", "YES", "NO", None, "NONE", "", ""),
    ],
    # DUPLICATE KEY(region), the model CREATE TABLE ... AS SELECT gives a table
    "t_ctas": [
        ("region", "varchar(10)", "", "NO", "YES", None, "", "", ""),
        ("c", "bigint", "", "YES", "NO", None, "NONE", "", ""),
    ],
}

# information_schema.table_options rows from Doris master: TABLE_NAME, TABLE_MODEL, TABLE_MODEL_KEY
TABLE_OPTIONS_ROWS = [
    SimpleNamespace(TABLE_NAME="t_uniq", TABLE_MODEL="UNI", TABLE_MODEL_KEY="region,user_id"),
    SimpleNamespace(TABLE_NAME="t_uniq_single", TABLE_MODEL="UNI", TABLE_MODEL_KEY="id"),
    SimpleNamespace(TABLE_NAME="t_agg", TABLE_MODEL="AGG", TABLE_MODEL_KEY="dt,site"),
    SimpleNamespace(TABLE_NAME="t_dup", TABLE_MODEL="DUP", TABLE_MODEL_KEY="k_date,k_id"),
    SimpleNamespace(TABLE_NAME="t_pri", TABLE_MODEL="PRI", TABLE_MODEL_KEY="k1,k2"),
    SimpleNamespace(TABLE_NAME="t_ctas", TABLE_MODEL="DUP", TABLE_MODEL_KEY="region"),
]


def _execute(statement, *_):
    """Answer the connector's queries with the rows Doris returns"""
    query = str(statement).strip()
    if "information_schema.table_options" in query:
        return TABLE_OPTIONS_ROWS
    # SHOW FULL COLUMNS FROM `om_verify`.`<table>`
    return SHOW_FULL_COLUMNS_ROWS[query.rsplit(".", 1)[-1].strip("`")]


@pytest.fixture
def doris_source():
    with (
        patch("metadata.ingestion.source.database.common_db_source.create_connection"),
        patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"),
    ):
        source = DorisSource.create(DORIS_WORKFLOW_CONFIG["source"], MagicMock())
    source.engine.dialect = MySQLDialect()
    source.engine.connect.return_value.execute.side_effect = _execute
    context = source.context.get()
    context.upsert("database_service", "local_doris")
    context.upsert("database", "default")
    context.upsert("database_schema", "om_verify")
    return source


class TestPrimaryKeyConstraints:
    """Only UNIQUE KEY and AGGREGATE KEY tables have a primary key"""

    @pytest.mark.parametrize(
        ("table_name", "table_constraints", "column_constraints"),
        [
            pytest.param(
                "t_uniq",
                [(ConstraintType.PRIMARY_KEY, ["region", "user_id"])],
                {"region": Constraint.NOT_NULL, "user_id": Constraint.NOT_NULL, "name": Constraint.NULL},
                id="unique-composite-key",
            ),
            pytest.param(
                "t_uniq_single",
                [],
                {"id": Constraint.PRIMARY_KEY, "name": Constraint.NULL},
                id="unique-single-key",
            ),
            pytest.param(
                "t_agg",
                [(ConstraintType.PRIMARY_KEY, ["dt", "site"])],
                {"dt": Constraint.NOT_NULL, "site": Constraint.NOT_NULL, "pv": Constraint.NULL},
                id="aggregate-key",
            ),
            pytest.param(
                "t_pri",
                [(ConstraintType.PRIMARY_KEY, ["k1", "k2"])],
                {"k1": Constraint.NOT_NULL, "k2": Constraint.NOT_NULL, "v": Constraint.NULL},
                id="primary-key",
            ),
            pytest.param(
                "t_dup",
                [],
                {"k_date": Constraint.NOT_NULL, "k_id": Constraint.NOT_NULL, "c_int": Constraint.NULL},
                id="duplicate-composite-key",
            ),
            pytest.param(
                "t_ctas",
                [],
                {"region": Constraint.NOT_NULL, "c": Constraint.NULL},
                id="duplicate-single-key",
            ),
        ],
    )
    def test_primary_key_follows_table_model(self, doris_source, table_name, table_constraints, column_constraints):
        columns, constraints, _ = doris_source.get_columns_and_constraints(
            "om_verify", table_name, "default", inspector=None
        )

        assert [(constraint.constraintType, constraint.columns) for constraint in constraints] == table_constraints
        assert {model_str(column.name): column.constraint for column in columns} == column_constraints

    def test_table_options_read_once_per_schema(self, doris_source):
        for table_name in ("t_uniq", "t_agg", "t_dup"):
            doris_source.get_columns_and_constraints("om_verify", table_name, "default", inspector=None)

        queries = [str(call.args[0]) for call in doris_source.engine.connect.return_value.execute.call_args_list]
        assert sum("information_schema.table_options" in query for query in queries) == 1

    def test_table_options_failure_keeps_tables_without_primary_keys(self, doris_source):
        """A Doris without information_schema.table_options, or a failing query, must not drop the tables"""

        def execute(statement, *args):
            if "information_schema.table_options" in str(statement):
                raise OperationalError(str(statement), {}, Exception("Unknown table 'table_options'"))
            return _execute(statement, *args)

        execute_mock = doris_source.engine.connect.return_value.execute
        execute_mock.side_effect = execute

        for table_name in ("t_uniq", "t_uniq_single"):
            columns, constraints, _ = doris_source.get_columns_and_constraints(
                "om_verify", table_name, "default", inspector=None
            )
            assert constraints == []
            assert Constraint.PRIMARY_KEY not in {column.constraint for column in columns}

        queries = [str(call.args[0]) for call in execute_mock.call_args_list]
        assert sum("information_schema.table_options" in query for query in queries) == 1
