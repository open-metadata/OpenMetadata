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

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.data.table import Table as GTable
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable

CONFIG = """
{
    "source": {
      "type": "dynamodb",
      "config": {
        "aws_access_key_id": "aws_access_key_id",
        "aws_secret_access_key": "aws_secret_access_key",
        "service_name": "DynamoDBTest",
        "region_name": "us-east-2",
        "endpoint_url": "https://dynamodb.us-east-2.amazonaws.com",
        "db_name":"custom_database_name",
        "table_filter_pattern":{
          "excludes": ["Music.*"]
        }
      }
    },
    "sink": {
      "type": "file",
      "config": {
        "filename": "./datasets.json"
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


def execute_workflow():
    workflow = Workflow.create(json.loads(CONFIG))
    workflow.execute()
    workflow.print_status()
    workflow.stop()


class Table:
    def __init__(self, name, attribute_definitions):
        self.name = name
        self.attribute_definitions = attribute_definitions


MOCK_GET_COLUMNS = [
    {"AttributeName": "Name", "AttributeType": "S"},
    {"AttributeName": "Location", "AttributeType": "L"},
]

MOCK_GET_COLUMNS_TWO = [{"AttributeName": 1234, "AttributeType": "S"}]


MOCK_GET_TABLE_NAMES = [
    Table(name="Forum", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="Music", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="ProductCatalog", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="Reply", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="Thread", attribute_definitions=MOCK_GET_COLUMNS),
]

MOCK_GET_TABLE_NAMES_CHECK_TABLE = [
    Table(name=1234, attribute_definitions=MOCK_GET_COLUMNS),
]

MOCK_GET_TABLE_NAMES_CHECK_COLUMN = [
    Table(name="Thread", attribute_definitions=MOCK_GET_COLUMNS_TWO),
]

MOCK_GET_TABLE_NAMES_EMPTY = []

MOCK_GET_TABLE_NAMES_OTHER_DATATYPE = None

EXCLUDED_TABLE_NAMES = [
    Table(name="Music", attribute_definitions=MOCK_GET_COLUMNS),
]


@patch("boto3.resources.collection.CollectionManager.all")
@patch("sqlalchemy.engine.base.Engine.connect")
class DynamoDbIngestionTest(TestCase):
    def test_dynamodb_ingestion(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES
        execute_workflow()

    def test_dynamodb_table(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES_CHECK_TABLE
        execute_workflow()

    def test_dynamodb_columm(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES_CHECK_COLUMN
        execute_workflow()

    def test_dynamodb_empty_table(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES_EMPTY
        execute_workflow()

    def test_dynamodb_other_datatype_table(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES_OTHER_DATATYPE
        execute_workflow()

    def test_dynamodb_file_sink(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES
        execute_workflow()
        file_path = json.loads(CONFIG)["sink"]["config"]["filename"]
        with open(file_path, "r") as file:
            for item in json.loads(file.read()):
                OMetaDatabaseAndTable.parse_obj(item)
                Database.parse_obj(item.get("database"))
                table_obj = GTable.parse_obj(item.get("table"))
                for column in table_obj.columns:
                    Column.parse_obj(column)
