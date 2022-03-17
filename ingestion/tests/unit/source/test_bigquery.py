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

from sqlalchemy.types import JSON, SMALLINT, VARCHAR

from metadata.ingestion.api.workflow import Workflow

CONFIG = """
{
  "source": {
    "type": "bigquery",
    "config": {
      "service_name": "test_bigquery",
      "project_id": "project_id",
      "host_port": "host_port",
      "username": "username",
      "service_name": "gcp_bigquery",
      "connect_args":{}
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {
      "api_endpoint": "http://localhost:8585/api"
    }
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
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
GET_TABLE_DESCRIPTIONS = {"text": None}
MOCK_GET_SCHEMA_NAMES = ["test_openmetadata_db"]
MOCK_UNIQUE_CONSTRAINTS = [
    {"name": "unique_name", "column_names": ["name"], "duplicates_index": "unique_name"}
]
MOCK_PK_CONSTRAINT = {"constrained_columns": ["id"], "name": None}
MOCK_GET_COLUMN = [
    {
        "name": "id",
        "type": VARCHAR(length=36),
        "default": None,
        "comment": None,
        "nullable": True,
        "computed": {
            "sqltext": "(json_unquote(json_extract(`json`,_utf8mb4'$.id')))",
            "persisted": True,
        },
    },
    {
        "name": "name",
        "type": VARCHAR(length=256),
        "default": None,
        "comment": None,
        "nullable": True,
        "computed": {
            "sqltext": "(json_unquote(json_extract(`json`,_utf8mb4'$.name')))",
            "persisted": False,
        },
    },
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
]

MOCK_GET_VIEW_NAMES = ["test_view"]
MOCK_GET_VIEW_DEFINITION = "SELECT failedpn.metric_date, failedpn.metric_hour, failedpn.game_id, failedpn.game_id_str, failedpn.user_id, failedpn.event_ts, failedpn.bundle_id, failedpn.mkt, failedpn.mkt_str, failedpn.device_token FROM bi_pipeline.failedpn"


class BigQueryIngestionTest(TestCase):
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_definition")
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_comment")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_schema_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_unique_constraints")
    @patch("sqlalchemy.engine.reflection.Inspector.get_pk_constraint")
    @patch("sqlalchemy.engine.reflection.Inspector.get_columns")
    @patch("metadata.utils.engines.get_engine")
    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_bigquery_ingestion(
        self,
        mock_get_engine,
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
        workflow = Workflow.create(json.loads(CONFIG))
        workflow.execute()
        workflow.print_status()
        workflow.stop()
