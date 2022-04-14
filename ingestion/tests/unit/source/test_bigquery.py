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
Query parser utils tests
"""
import json
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import ARRAY, DATE, Float, Integer, Numeric, String
from sqlalchemy_bigquery._types import STRUCT

from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable

CONFIG = """
{
  "source": {
    "type": "bigquery",
    "serviceName": "local_bigquery",
    "serviceConnection": {
      "config": {
        "type": "BigQuery",
        "projectID": "project_id",
        "enablePolicyTagImport": true,
        "connectionOptions": {
          "credentials": {
            "type": "service_account",
            "project_id": "project_id",
            "private_key_id": "private_key_id",
            "private_key": "private_key",
            "client_email": "gcpuser@project_id.iam.gserviceaccount.com",
            "client_id": "client_id",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": ""
          }
        }
      }
    },
    "sourceConfig": {"config": {"enableDataProfiler": false}}
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

MOCK_GET_TABLE_NAMES = ["test_schema_1.test_table_1", "test_schema_1.test_table_2"]

GET_TABLE_DESCRIPTIONS = {"text": "Test"}
MOCK_GET_SCHEMA_NAMES = ["test_schema_1"]
MOCK_UNIQUE_CONSTRAINTS = []
MOCK_PK_CONSTRAINT = {"constrained_columns": []}
MOCK_GET_COLUMN = [
    {
        "name": "region_name",
        "type": String(),
        "nullable": True,
        "comment": "Name of the region within the country",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "date",
        "type": DATE(),
        "nullable": True,
        "comment": "Date of the measured policy action status",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "DATE",
        "policy_tags": None,
    },
    {
        "name": "emergency_healthcare_investment",
        "type": Float(),
        "nullable": True,
        "comment": "H4 - Short-term spending on, e.g, hospitals, masks, etc in USD; Record monetary value in USD of new short-term spending on health. If none, enter 0. No data - blank Please use the exchange rate of the date you are coding, not the current date.",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "FLOAT",
        "policy_tags": None,
    },
    {
        "name": "bigquery_test_datatype_2",
        "type": Integer(),
        "nullable": True,
        "comment": None,
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "INTEGER",
        "policy_tags": None,
    },
    {
        "name": "bigquery_test_datatype_3",
        "type": ARRAY(
            STRUCT(bigquery_test_datatype_31=ARRAY(STRUCT(record_test=String())))
        ),
        "nullable": True,
        "comment": None,
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "ARRAY",
        "policy_tags": None,
    },
    {
        "name": "bigquery_test_datatype_3.bigquery_test_datatype_31",
        "type": ARRAY(STRUCT(record_test=String())),
        "nullable": True,
        "comment": None,
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "ARRAY",
        "policy_tags": None,
    },
    {
        "name": "bigquery_test_datatype_4",
        "type": ARRAY(Numeric()),
        "nullable": True,
        "comment": None,
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "ARRAY",
        "policy_tags": None,
    },
    {
        "name": "bigquery_test_datatype_5",
        "type": STRUCT(
            bigquery_test_datatype_51=ARRAY(
                STRUCT(bigquery_test_datatype_511=ARRAY(String()))
            )
        ),
        "nullable": True,
        "comment": None,
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "STRUCT<bigquery_test_datatype_51 ARRAY<STRUCT<bigquery_test_datatype_511 ARRAY<STRING>>>>",
        "policy_tags": None,
    },
    {
        "name": "bigquery_test_datatype_5.bigquery_test_datatype_51",
        "type": ARRAY(STRUCT(bigquery_test_datatype_511=ARRAY(String()))),
        "nullable": True,
        "comment": None,
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "ARRAY",
        "policy_tags": None,
    },
    {
        "name": "bigquery_test_datatype_5.bigquery_test_datatype_51.bigquery_test_datatype_511",
        "type": ARRAY(String()),
        "nullable": True,
        "comment": None,
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "ARRAY",
        "policy_tags": None,
    },
]

MOCK_GET_VIEW_NAMES = []
MOCK_GET_VIEW_DEFINITION = ""

MOCK_GET_INDEXES = [
    {"name": "partition", "column_names": ["region_name"], "unique": False},
    {
        "name": "clustering",
        "column_names": ["bigquery_test_datatype_5"],
        "unique": False,
    },
]


def execute_workflow(config_dict):
    workflow = Workflow.create(config_dict)
    workflow.execute()
    workflow.print_status()
    workflow.stop()


class BigQueryIngestionTest(TestCase):
    @patch("sqlalchemy.engine.reflection.Inspector.get_indexes")
    @patch("metadata.ingestion.source.sql_source.SQLSource.fetch_sample_data")
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_definition")
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_comment")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_schema_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_unique_constraints")
    @patch("sqlalchemy.engine.reflection.Inspector.get_pk_constraint")
    @patch("sqlalchemy.engine.reflection.Inspector.get_columns")
    @patch("sqlalchemy.engine.base.Engine.connect")
    @patch("sqlalchemy_bigquery._helpers.create_bigquery_client")
    def test_bigquery_ingestion(
        self,
        mock_connect,
        mock_create_bigquery_client,
        get_columns,
        get_pk_constraint,
        get_unique_constraints,
        get_schema_names,
        get_table_names,
        get_table_comment,
        get_view_names,
        get_view_definition,
        fetch_sample_data,
        get_indexes,
    ):
        get_schema_names.return_value = MOCK_GET_SCHEMA_NAMES
        get_table_names.return_value = MOCK_GET_TABLE_NAMES
        get_table_comment.return_value = GET_TABLE_DESCRIPTIONS
        get_unique_constraints.return_value = MOCK_UNIQUE_CONSTRAINTS
        get_pk_constraint.return_value = MOCK_PK_CONSTRAINT
        get_columns.return_value = MOCK_GET_COLUMN
        get_view_names.return_value = MOCK_GET_VIEW_NAMES
        get_view_definition.return_value = MOCK_GET_VIEW_DEFINITION
        fetch_sample_data.return_value = []
        get_indexes.return_value = MOCK_GET_INDEXES

        execute_workflow(json.loads(CONFIG))

        config = json.loads(CONFIG)
        file_data = open(config["sink"]["config"]["filename"])
        file_sink = json.load(file_data)
        for ometa_data in file_sink:
            table = ometa_data.get("table")
            _: OMetaDatabaseAndTable = OMetaDatabaseAndTable.parse_obj(ometa_data)
            _: Table = Table.parse_obj(table)

            assert table.get("description") == GET_TABLE_DESCRIPTIONS.get("text")
            table_name = (
                f"{ometa_data.get('database_schema').get('name')}.{table.get('name')}"
            )
            if table.get("tableType") == TableType.Regular.value:
                assert table_name in MOCK_GET_TABLE_NAMES

            for column in table.get("columns"):
                _: Column = Column.parse_obj(column)
                if column in MOCK_UNIQUE_CONSTRAINTS:
                    assert Column.constraint.UNIQUE == column.get("constraint")
                if column in MOCK_PK_CONSTRAINT.get("constrained_columns"):
                    assert Column.constraint.PRIMARY_KEY == column.get("constraint")
            if table.get("name") in MOCK_GET_VIEW_NAMES:
                assert table.get("tableType") == TableType.View.value
                assert table.get("viewDefinition") == MOCK_GET_VIEW_DEFINITION
