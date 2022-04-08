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
Clickhouse unit test
"""

import json
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import (
    BIGINT,
    CHAR,
    INTEGER,
    JSON,
    SMALLINT,
    TEXT,
    TIMESTAMP,
    VARCHAR,
)

from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable

CONFIG = """
{
    "source": {
      "type": "clickhouse",
      "serviceName": "local_clickhouse",
      "serviceConnection": {
        "config": {
          "type": "ClickHouse",
          "username":"default",
          "password":"",
          "hostPort": "localhost:8123",
          "database": "default" 
        }
      },
      "sourceConfig": {
        "config": {
        "enableDataProfiler": false,
        "schemaFilterPattern":{
          "excludes": ["system.*","information_schema.*","INFORMATION_SCHEMA.*"]  
        },
      "dbtManifestFilePath": "./examples/sample_data/dbt/manifest_1.0.json",
      "dbtCatalogFilePath": "./examples/sample_data/dbt/catalog_1.0.json"
        }
      }
    },
    "sink": {
      "type": "file",
      "config": {
          "filename": "/var/tmp/datasets.json"
      }
    },
    "workflowConfig": {
      "openMetadataServerConfig": {
        "hostPort": "http://localhost:8585/api",
        "authProvider": "no-auth"
      }
    }
  }
"""

MOCK_GET_TABLE_NAMES = [
    "accounts",
    "binary_log_transaction_compression_stats",
    "test_table",
]

GET_TABLE_DESCRIPTIONS = {"text": "Test Description"}
MOCK_GET_SCHEMA_NAMES = ["information_schema", "openmetadata_db"]

MOCK_UNIQUE_CONSTRAINTS = [
    {
        "name": "OBJECT",
        "column_names": ["OBJECT_TYPE", "OBJECT_SCHEMA", "OBJECT_NAME"],
        "duplicates_index": "OBJECT",
    }
]


MOCK_PK_CONSTRAINT = {
    "constrained_columns": ["TRANSACTION_COUNTER"],
    "name": "NOT_NULL",
}

MOCK_GET_COLUMN = [
    {
        "name": "OBJECT_TYPE",
        "type": VARCHAR(length=64),
        "default": None,
        "comment": None,
        "nullable": True,
    },
    {
        "name": "MAXLEN",
        "type": INTEGER,
        "default": None,
        "comment": None,
        "nullable": True,
        "autoincrement": False,
    },
    {
        "name": "TRANSACTION_COUNTER",
        "type": BIGINT,
        "default": None,
        "comment": "Number of transactions written to the log",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "COMPRESSION_PERCENTAGE",
        "type": SMALLINT(),
        "default": None,
        "comment": "The compression ratio as a percentage.",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "FIRST_TRANSACTION_ID",
        "type": TEXT(),
        "default": None,
        "comment": "The first transaction written.",
        "nullable": True,
    },
    {
        "name": "FIRST_TRANSACTION_TIMESTAMP",
        "type": TIMESTAMP(),
        "default": None,
        "comment": "When the first transaction was written.",
        "nullable": True,
    },
    {
        "name": "LAST_TRANSACTION_ID",
        "type": JSON,
        "default": None,
        "comment": "The last transaction written.",
        "nullable": True,
    },
    {
        "name": "LAST_TRANSACTION_COMPRESSED_BYTES",
        "type": BIGINT,
        "default": None,
        "comment": "Last transaction written compressed bytes.",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "Db",
        "type": CHAR(collation="utf8_bin", length=64),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
]

MOCK_GET_VIEW_NAMES = ["ADMINISTRABLE_ROLE_AUTHORIZATIONS", "APPLICABLE_ROLES"]

MOCK_GET_VIEW_DEFINITION = """
CREATE VIEW test_view AS
          SELECT * FROM accounts
          UNION
          SELECT * FROM APPLICABLE_ROLES
"""


def execute_workflow():
    workflow = Workflow.create(json.loads(CONFIG))
    workflow.execute()
    workflow.print_status()
    workflow.stop()


class ClickhouseIngestionTest(TestCase):
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_definition")
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_comment")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_schema_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_unique_constraints")
    @patch("sqlalchemy.engine.reflection.Inspector.get_pk_constraint")
    @patch("sqlalchemy.engine.reflection.Inspector.get_columns")
    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_clickhouse_ingestion(
        self,
        mock_connect,
        get_columns,
        get_pk_constraint,
        get_unique_constraints,
        get_schema_names,
        get_table_names,
        get_table_comment,
        get_view_names,
        get_view_definition,
    ):
        get_schema_names.return_value = MOCK_GET_SCHEMA_NAMES
        get_table_names.return_value = MOCK_GET_TABLE_NAMES
        get_table_comment.return_value = GET_TABLE_DESCRIPTIONS
        get_unique_constraints.return_value = MOCK_UNIQUE_CONSTRAINTS
        get_pk_constraint.return_value = MOCK_PK_CONSTRAINT
        get_columns.return_value = MOCK_GET_COLUMN
        get_view_names.return_value = MOCK_GET_VIEW_NAMES
        get_view_definition.return_value = MOCK_GET_VIEW_DEFINITION

        execute_workflow()

    def test_file_sink(self):
        config = json.loads(CONFIG)
        file_data = open(config["sink"]["config"]["filename"])
        data = json.load(file_data)
        for i in data:
            table = i.get("table")
            omdtable_obj: OMetaDatabaseAndTable = OMetaDatabaseAndTable.parse_obj(i)
            table_obj: Table = Table.parse_obj(table)

            assert table.get("description") == GET_TABLE_DESCRIPTIONS.get("text")

            if table.get("tableType") == TableType.Regular.value:
                assert table.get("name") in MOCK_GET_TABLE_NAMES

            for column in table.get("columns"):
                column_obj: Column = Column.parse_obj(column)
                if column in MOCK_UNIQUE_CONSTRAINTS[0].get("column_names"):
                    assert Column.constraint.UNIQUE == column.get("constraint")
                if column in MOCK_PK_CONSTRAINT.get("constrained_columns"):
                    assert Column.constraint.PRIMARY_KEY == column.get("constraint")
            if table.get("name") in MOCK_GET_VIEW_NAMES:
                assert table.get("tableType") == TableType.View.value
                assert table.get("viewDefinition") == MOCK_GET_VIEW_DEFINITION
