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

from sqlalchemy.types import DATE, Float, String

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
    "open_metadata.cloudaudit_googleapis_com_data_access_20220121",
    "open_metadata.cloudaudit_googleapis_com_data_access_20220122",
    "open_metadata.cloudaudit_googleapis_com_data_access_20220124",
    "open_metadata.cloudaudit_googleapis_com_data_access_20220208",
    "open_metadata.cloudaudit_googleapis_com_data_access_20220216",
    "open_metadata.cloudaudit_googleapis_com_data_access_20220217",
    "open_metadata.cloudaudit_googleapis_com_data_access_20220316",
    "open_metadata.cloudaudit_googleapis_com_data_access_20220317",
    "open_metadata.copy_covid",
]

GET_TABLE_DESCRIPTIONS = {"text": None}
MOCK_GET_SCHEMA_NAMES = ["open_metadata"]
MOCK_UNIQUE_CONSTRAINTS = []
MOCK_PK_CONSTRAINT = {"constrained_columns": []}
MOCK_GET_COLUMN = [
    {
        "name": "country_name",
        "type": String(),
        "nullable": True,
        "comment": "Name of the country",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "alpha_3_code",
        "type": String(),
        "nullable": True,
        "comment": "3-letter alpha code abbreviation of the country/region. See `bigquery-public-data.utility_us.country_code_iso` for more details",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
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
        "name": "region_code",
        "type": String(),
        "nullable": True,
        "comment": "Code of the region within the country",
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
        "name": "close_public_transit",
        "type": String(),
        "nullable": True,
        "comment": "C5 - Ordinal scale to record closing of public transportation; 0 - No measures 1 - Recommend closing (or significantly reduce volume/route/means of transport available) 2 - Require closing (or prohibit most citizens from using it)",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "close_public_transit_flag",
        "type": String(),
        "nullable": True,
        "comment": "Are C5 actions targeted at specific areas or general:  0 - Targeted 1- General No data - blank",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "close_public_transit_notes",
        "type": String(),
        "nullable": True,
        "comment": "Additional details about C5 policy actions",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "stay_at_home_requirements",
        "type": String(),
        "nullable": True,
        "comment": "C6 - Ordinal scale record of orders to “shelter-in- place” and otherwise confine to home.",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "stay_at_home_requirements_flag",
        "type": String(),
        "nullable": True,
        "comment": 'Are C6 actions targeted at specific areas or general:  0 - Targeted 1- General No data - blank"\\',
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "testing_policy",
        "type": String(),
        "nullable": True,
        "comment": "H2 - Ordinal scale record of who can get tested;  0 – No testing policy 1 – Only those who both (a) have symptoms AND (b) meet specific criteria (eg key workers, admitted to hospital, came into contact with a known case, returned from overseas) 2 – testing of anyone showing COVID-19 symptoms 3 – open public testing (eg “drive through” testing available to asymptomatic people) No data Nb we are looking for policies about testing for having an infection (PCR tests) - not for policies about testing for immunity (antibody tests).",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "testing_policy_notes",
        "type": String(),
        "nullable": True,
        "comment": "Additional details about H2 policy actions",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "contact_tracing",
        "type": String(),
        "nullable": True,
        "comment": "H3 - Ordinal scale record if governments doing contact tracing; 0 - No contact tracing 1 - Limited contact tracing - not done for all cases 2 - Comprehensive contact tracing - done for all cases No data",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
        "policy_tags": None,
    },
    {
        "name": "contact_tracing_notes",
        "type": String(),
        "nullable": True,
        "comment": "Additional details about H3 policy actions",
        "default": None,
        "precision": None,
        "scale": None,
        "max_length": None,
        "raw_data_type": "VARCHAR",
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
]


MOCK_GET_VIEW_NAMES = []
MOCK_GET_VIEW_DEFINITION = ""


class BigQueryIngestionTest(TestCase):
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
