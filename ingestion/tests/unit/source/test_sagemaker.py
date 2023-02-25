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
SageMaker unit tests
"""
import json
from unittest import TestCase
from unittest.mock import patch

import boto3
from moto import mock_sagemaker

from metadata.ingestion.api.workflow import Workflow

CONFIG = """
{
  "source": {
    "type": "sagemaker",
    "serviceName": "local_sagemaker",
    "serviceConnection": {
      "config": {
        "type": "SageMaker",
        "awsConfig": {
            "awsAccessKeyId": "aws_access_key_id",
            "awsSecretAccessKey": "aws_secret_access_key",
            "awsRegion": "us-east-2"
        }
      }
    },
    "sourceConfig": {
      "config": {
        "type": "MlModelMetadata"
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


def _setup_mock_sagemaker(create_model: bool = False):
    sagemaker = boto3.Session().client("sagemaker")
    if not create_model:
        return
    sagemaker.create_model(
        ModelName="mock-model",
        PrimaryContainer={
            "Environment": {},
            "Image": "123.dkr.ecr.eu-west-1.amazonaws.com/image:mock-image",
            "Mode": "SingleModel",
        },
        ExecutionRoleArn="arn:aws:iam::123:role/service-role/mockRole",
        EnableNetworkIsolation=False,
    )


@mock_sagemaker
@patch("sqlalchemy.engine.base.Engine.connect")
class SageMakerIngestionTest(TestCase):
    def test_sagemaker_empty_models(self, mock_connect):
        _setup_mock_sagemaker()
        execute_workflow()
        file_path = get_file_path()
        with open(file_path, "r") as file:
            assert len(json.loads(file.read())) == 0

    def test_sagemaker_models(self, mock_connect):
        _setup_mock_sagemaker(create_model=True)
        execute_workflow()
        file_path = get_file_path()
        with open(file_path, "r") as file:
            data = json.loads(file.read())
        assert data[0]["name"] == "mock-model"
