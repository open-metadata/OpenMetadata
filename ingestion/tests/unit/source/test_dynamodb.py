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
Dynamodb unit test
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
    "serviceName": "local_dynamodb",
    "serviceConnection": {
      "config": {
        "awsAccessKeyId": "aws_access_key_id",
        "awsSecretAccessKey": "aws_secret_access_key",
        "awsRegion": "us-east-2",
        "endPointURL": "https://dynamodb.us-east-2.amazonaws.com",
        "database": "custom_database_name"
      }
    },
    "sourceConfig": {
      "config": {
        "enableDataProfiler": false,
        "tableFilterPattern": {
          "includes": [""]
        }
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


def execute_workflow():
    workflow = Workflow.create(json.loads(CONFIG))
    workflow.execute()
    workflow.print_status()
    workflow.stop()


class Table:
    def __init__(self, name, attribute_definitions):
        self.name = name
        self.attribute_definitions = attribute_definitions


def get_file_path():
    return json.loads(CONFIG)["sink"]["config"]["filename"]


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
    Table(name=1234, attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="Cars", attribute_definitions=MOCK_GET_COLUMNS_TWO),
]

MOCK_GET_TABLE_NAMES_EMPTY = []

MOCK_GET_TABLE_NAMES_OTHER_DATATYPE = None


@patch("boto3.resources.collection.CollectionManager.all")
@patch("sqlalchemy.engine.base.Engine.connect")
class DynamoDbIngestionTest(TestCase):
    def test_dynamodb_empty_table(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES_EMPTY
        execute_workflow()
        file_path = get_file_path()
        with open(file_path, "r") as file:
            assert len(json.loads(file.read())) == 0

    def test_dynamodb_other_datatype_table(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES_OTHER_DATATYPE
        execute_workflow()
        file_path = get_file_path()
        with open(file_path, "r") as file:
            assert len(json.loads(file.read())) == 0

    def test_dynamodb_file_sink(self, mock_connect, all):
        all.return_value = MOCK_GET_TABLE_NAMES
        execute_workflow()
        table_names_list = [i.name for i in MOCK_GET_TABLE_NAMES]
        column_names_list = [i["AttributeName"] for i in MOCK_GET_COLUMNS]
        file_path = get_file_path()
        with open(file_path, "r") as file:
            for item in json.loads(file.read()):
                OMetaDatabaseAndTable.parse_obj(item)
                Database.parse_obj(item.get("database"))
                table_obj = GTable.parse_obj(item.get("table"))
                assert table_obj.name.__root__ in table_names_list
                for column in table_obj.columns:
                    column_obj = Column.parse_obj(column)
                    assert column_obj.name.__root__ in column_names_list
