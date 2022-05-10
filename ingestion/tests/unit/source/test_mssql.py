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
Mssql unit test
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

METADATA_REST_CONFIG = """
{
  "source": {
    "type": "mssql",
    "serviceName": "local_mssql5",
    "serviceConnection": {
       "config": {
        "type": "Mssql",
        "database": "catalog_test",
        "username": "sa",
        "password": "test",
        "hostPort": "localhost:1433"
      }
    },
      "sourceConfig": {
        "config": {
        "enableDataProfiler": false,
        "schemaFilterPattern":{
          "excludes": ["system.*","information_schema.*","INFORMATION_SCHEMA.*"]  
        }
        }
      }
    },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "no-auth"
    }
  }
}

"""


FILE_SINK_CONFIG = """
{
  "source": {
    "type": "mssql",
    "serviceName": "local_mssql4",
    "serviceConnection": {
       "config": {
        "type": "Mssql",
        "database": "catalog_test",
        "username": "sa",
        "password": "test",
        "hostPort": "localhost:1433"
      }
    },
      "sourceConfig": {
        "config": {
        "enableDataProfiler": false,
        "schemaFilterPattern":{
          "excludes": ["system.*","information_schema.*","INFORMATION_SCHEMA.*"]  
        }
        }
      }
    },
  "sink": {
    "type": "file",
    "config": {
        "filename": "/var/tmp/mssql.json"
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
    "zsession_log1",
    "zsession_log2",
    "session_log1",
    "catalog_table",
]
GET_TABLE_DESCRIPTIONS = {"text": "Test Description"}

MOCK_GET_SCHEMA_NAMES = ["dbo"]

MOCK_UNIQUE_CONSTRAINTS = [
    {"name": "unique_name", "column_names": ["name"], "duplicates_index": "unique_name"}
]

MOCK_PK_CONSTRAINT = {"constrained_columns": ["id"], "name": "NOT_NULL"}

MOCK_GET_COLUMN = [
    {
        "name": "userid",
        "type": INTEGER(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
    },
    {
        "name": "phonenumber",
        "type": INTEGER(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
    },
    {
        "name": "session_id",
        "type": INTEGER(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
    },
    {
        "name": "session_name",
        "type": VARCHAR(length=255, collation="SQL_Latin1_General_CP1_CI_AS"),
        "nullable": True,
        "default": None,
        "autoincrement": False,
    },
]

MOCK_GET_VIEW_NAMES = [
    "test_view",
    "new_view",
    "catalog_test_view",
    "test_view2",
    "test_view1",
]

MOCK_GET_VIEW_DEFINITION_VIEW = """
create VIEW dbo.test_view1
as (SELECT userid,phonenumber from dbo.zsession_log2 UNION SELECT userid,phonenumber from zsession_log1);
"""


MOCK_GET_VIEW_DEFINITION_TABLE = """
    create view catalog_test_view as SELECT * from session_log1
    """

MOCK_GET_VIEW_DEFINITION_JOIN_QUERY = """
    create view into catalog_table as SELECT
FROM zsession_log1 
INNER JOIN zsession_log2
ON zsession_log1.user_id = zsession_log2.user_id; dbo.zsession_log2
    """


def execute_workflow(CONFIG):
    workflow = Workflow.create(json.loads(CONFIG))
    workflow.execute()
    workflow.print_status()
    workflow.stop()


def validate_with_file_sink(CONFIG, viewDefinition):
    try:
        config = json.loads(CONFIG)
        file_data = open(config["sink"]["config"]["filename"])
        data = json.load(file_data)
        for i in data:
            table = i.get("table")
            _: OMetaDatabaseAndTable = OMetaDatabaseAndTable.parse_obj(i)
            _: Table = Table.parse_obj(table)

            assert table.get("description") == GET_TABLE_DESCRIPTIONS.get("text")

            if table.get("tableType") == TableType.Regular.value:
                assert table.get("name") in MOCK_GET_TABLE_NAMES

            for column in table.get("columns"):
                _: Column = Column.parse_obj(column)
                if column in MOCK_UNIQUE_CONSTRAINTS[0].get("column_names"):
                    assert Column.constraint.UNIQUE == column.get("constraint")
                if column in MOCK_PK_CONSTRAINT.get("constrained_columns"):
                    assert Column.constraint.PRIMARY_KEY == column.get("constraint")
            if table.get("name") in MOCK_GET_VIEW_NAMES:
                assert table.get("tableType") == TableType.View.value
                assert table.get("viewDefinition") == viewDefinition

    finally:
        file_data.close()


@patch("sqlalchemy.engine.reflection.Inspector.get_view_definition")
@patch("sqlalchemy.engine.reflection.Inspector.get_view_names")
@patch("sqlalchemy.engine.reflection.Inspector.get_table_comment")
@patch("sqlalchemy.engine.reflection.Inspector.get_table_names")
@patch("sqlalchemy.engine.reflection.Inspector.get_schema_names")
@patch("sqlalchemy.engine.reflection.Inspector.get_unique_constraints")
@patch("sqlalchemy.engine.reflection.Inspector.get_pk_constraint")
@patch("sqlalchemy.engine.reflection.Inspector.get_columns")
@patch("sqlalchemy.engine.base.Engine.connect")
class MssqlIngestionTest(TestCase):
    def test_mssql_ingestion_with_view_lineage(
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

        get_view_definition.return_value = MOCK_GET_VIEW_DEFINITION_VIEW
        execute_workflow(METADATA_REST_CONFIG)

    def test_mssql_ingestion_with_table_lineage(
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

        get_view_definition.return_value = MOCK_GET_VIEW_DEFINITION_TABLE
        execute_workflow(METADATA_REST_CONFIG)

    def test_mssql_ingestion_with_insert_lineage(
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

        get_view_definition.return_value = MOCK_GET_VIEW_DEFINITION_JOIN_QUERY
        execute_workflow(METADATA_REST_CONFIG)

    def test_mssql_ingestion_with_file_sink(
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

        get_view_definition.return_value = MOCK_GET_VIEW_DEFINITION_VIEW
        execute_workflow(FILE_SINK_CONFIG)
        validate_with_file_sink(FILE_SINK_CONFIG, MOCK_GET_VIEW_DEFINITION_VIEW)
