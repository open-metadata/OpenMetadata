#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Unit tests for the DynamoDB BaseConnection wiring (non-Engine: boto3 client)."""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection as DynamoDBConnectionConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.dynamodb.connection import DynamoDBConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.dynamodb.connection"


def _config() -> DynamoDBConnectionConfig:
    return DynamoDBConnectionConfig(awsConfig=AWSCredentials(awsRegion="us-east-1"))


def test_dynamodb_connection_is_base_connection():
    assert issubclass(DynamoDBConnection, BaseConnection)


def test_get_client_builds_the_dynamo_client():
    with patch(f"{CONNECTION_MODULE}.AWSClient") as mock_aws:
        client = DynamoDBConnection(_config()).client
    mock_aws.return_value.get_dynamo_client.assert_called_once_with()
    assert client is mock_aws.return_value.get_dynamo_client.return_value
