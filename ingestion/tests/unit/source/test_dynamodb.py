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

from metadata.ingestion.api.workflow import Workflow

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
      "type": "metadata-rest",
      "config": {}
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


class Table:
    def __init__(self, name, attribute_definitions):
        self.name = name
        self.attribute_definitions = attribute_definitions


MOCK_GET_COLUMNS = [{"AttributeName": "Name", "AttributeType": "S"}]

MOCK_GET_TABLE_NAMES = [
    Table(name="Forum", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="Music", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="ProductCatalog", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="Reply", attribute_definitions=MOCK_GET_COLUMNS),
    Table(name="Thread", attribute_definitions=MOCK_GET_COLUMNS),
]

EXCLUDED_TABLE_NAMES = [
    Table(name="Music", attribute_definitions=MOCK_GET_COLUMNS),
]


class DynamoDbIngestionTest(TestCase):
    @patch("metadata.ingestion.source.dynamodb.DynamodbSource.get_tables")
    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_dynamodb_ingestion(self, mock_connect, get_tables):
        get_tables.return_value = MOCK_GET_TABLE_NAMES
        workflow = Workflow.create(json.loads(CONFIG))
        workflow.execute()
        workflow.print_status()
        workflow.stop()
