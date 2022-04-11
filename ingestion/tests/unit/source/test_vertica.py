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
Vertica unit test
"""
import json
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import (
    CHAR,
    DATE,
    FLOAT,
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
    "type": "vertica",
    "serviceName": "local_vertica",
    "serviceConnection": {
      "config": {
        "type": "Vertica",
        "username": "openmetadata_user",
        "password": "",
        "hostPort": "localhost:5433",
        "database": "custom_database_name"
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
    "airflow_pipeline_entity",
    "bot_entity",
    "change_event",
    "chart_entity",
    "dashboard_entity",
]

GET_TABLE_DESCRIPTIONS = {"text": "Test Description"}

MOCK_GET_SCHEMA_NAMES = ["test_openmetadata_db"]

MOCK_UNIQUE_CONSTRAINTS = [
    {"name": "unique_name", "column_names": ["name"], "duplicates_index": "unique_name"}
]

MOCK_PK_CONSTRAINT = {"constrained_columns": ["id"], "name": "NOT_NULL"}

MOCK_GET_COLUMN = [
    {
        "name": "deleted",
        "type": SMALLINT(),
        "default": None,
        "comment": None,
        "nullable": True,
        "autoincrement": False,
        "computed": {
            "sqltext": "(json_extract(`json`,_utf8mb4'$.deleted'))",
            "persisted": False,
        },
    },
    {
        "name": "json",
        "type": JSON(),
        "default": None,
        "comment": None,
        "nullable": False,
    },
    {
        "name": "date",
        "type": DATE(),
        "nullable": True,
        "default": "",
        "autoincrement": False,
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "weekday_indicator",
        "type": CHAR(length=7),
        "nullable": True,
        "default": "",
        "autoincrement": False,
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "ts",
        "type": TIMESTAMP(),
        "nullable": True,
        "default": "",
        "autoincrement": False,
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "symbol",
        "type": VARCHAR(length=8),
        "nullable": True,
        "default": "",
        "autoincrement": False,
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "bid",
        "type": FLOAT(),
        "nullable": True,
        "default": "1.00",
        "autoincrement": False,
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "test_col",
        "type": INTEGER(),
        "nullable": True,
        "default": "20",
        "autoincrement": False,
        "comment": None,
        "primary_key": False,
    },
]


MOCK_GET_VIEW_NAMES = ["test_view"]
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


class VerticaIngestionTest(TestCase):
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_definition")
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_comment")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_schema_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_unique_constraints")
    @patch("sqlalchemy.engine.reflection.Inspector.get_pk_constraint")
    @patch("sqlalchemy.engine.reflection.Inspector.get_columns")
    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_mysql_ingestion(
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
