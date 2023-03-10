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
from dataclasses import dataclass

from botocore.client import ClientError, BaseClient

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.objectstore.s3ObjectStoreConnection import (
    S3StoreConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException


@dataclass
class S3ObjectStoreClient:
    s3_client: BaseClient
    cloudwatch_client: BaseClient


def get_connection(connection: S3StoreConnection) -> S3ObjectStoreClient:
    """
    Returns 2 clients - the s3 client and the cloudwatch client needed for total nr of objects and total size
    """
    aws_client = AWSClient(connection.awsConfig)
    return S3ObjectStoreClient(
        s3_client=aws_client.get_client(service_name="s3"),
        cloudwatch_client=aws_client.get_client(service_name="cloudwatch")
    )


def test_connection(client: S3ObjectStoreClient) -> None:
    """
        Test connection to both s3 and cloudwatch
        """
    try:
        client.s3_client.list_buckets()
        client.cloudwatch_client.list_dashboards()
    except ClientError as err:
        msg = f"Connection error for {client}: {err}. Check the connection details."
        raise SourceConnectionException(msg) from err
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg) from exc
