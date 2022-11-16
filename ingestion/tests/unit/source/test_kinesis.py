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
Kinesis unit tests
"""
import json
from base64 import b64encode
from unittest import TestCase
from unittest.mock import patch

import boto3
from moto import mock_kinesis

from metadata.ingestion.api.workflow import Workflow

CONFIG = """
{
  "source": {
    "type": "kinesis",
    "serviceName": "local_kinesis",
    "serviceConnection": {
      "config": {
        "type": "Kinesis",
        "awsConfig": {
            "awsRegion": "eu-west-1"
        }
      }
    },
    "sourceConfig": {
      "config": {
        "type": "MessagingMetadata",
        "generateSampleData": true
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


def get_file_path():
    return json.loads(CONFIG)["sink"]["config"]["filename"]


def _setup_mock_kinesis(create_stream: bool = False):
    kinesis = boto3.Session().client("kinesis")
    if not create_stream:
        return
    kinesis.create_stream(StreamName="mock-stream", ShardCount=5)
    kinesis.put_record(
        StreamName="mock-stream",
        Data=b64encode("mock-data".encode("utf-8")),
        PartitionKey="mock-key",
    )


@mock_kinesis
@patch("sqlalchemy.engine.base.Engine.connect")
class KinesisIngestionTest(TestCase):
    def test_kinesis_empty_topics(self, mock_connect):
        _setup_mock_kinesis()
        execute_workflow()
        file_path = get_file_path()
        with open(file_path, "r") as file:
            assert len(json.loads(file.read())) == 0

    def test_kinesis_topics(self, mock_connect):
        _setup_mock_kinesis(create_stream=True)
        execute_workflow()
        file_path = get_file_path()
        with open(file_path, "r") as file:
            data = json.loads(file.read())
        assert data[0]["name"] == "mock-stream"
        assert data[0]["partitions"] == 5
        assert "mock-data" in data[0]["sampleData"]["messages"]
